import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { routeIdea, createCanonicalProjectInstance } from '../../src/v4/domain/services/project-creation.js';
import { acceptProposalItemAtomically } from '../../src/v4/domain/services/proposal-service.ts';
import { CanonicalProject, ProposalItem } from '../../src/v4/domain/types.js';
import { toProjectId } from '../../src/v4/domain/ids.js';

describe('Category 4: Functional Correctness Pipeline', () => {
  it('routeIdea routes vague/short ideas to IDEA_EXPANSION and rich ideas to IDEA_LAB', () => {
    const shortRoute = routeIdea('Oyun yapmak istiyorum');
    assert.equal(shortRoute.phase, 'IDEA_EXPANSION', 'Short vague idea routes to IDEA_EXPANSION');

    const richRoute = routeIdea('Web SaaS platformu: admin paneli, rol tabanlı yetki, Stripe ödeme entegrasyonu ve offline IndexedDB senkronizasyonu olan mobil uyumlu portal');
    assert.equal(richRoute.phase, 'IDEA_LAB', 'Rich idea with multiple signals routes to IDEA_LAB');
  });

  it('createCanonicalProjectInstance sets schemaVersion 5 and routed phase', () => {
    const proj = createCanonicalProjectInstance({
      ideaText: 'Mobil Flutter e-ticaret uygulaması'
    });
    assert.equal(proj.schemaVersion, 5);
    assert.ok(proj.id.startsWith('project-'));
    assert.ok(['IDEA_EXPANSION', 'DISCOVERY', 'IDEA_LAB'].includes(proj.lifecycle.activePhase));
  });

  it('acceptProposalItemAtomically enforces idempotency via commandId', () => {
    const initialProject = createCanonicalProjectInstance({ ideaText: 'Test Projesi' });

    // Add sample proposal bundle
    const sampleItem: ProposalItem = {
      id: 'prop-item-1',
      kind: 'feature',
      title: 'Ödeme Entegrasyonu',
      description: 'Stripe API ödemesi',
      pros: ['Güvenli'],
      cons: ['Komisyon'],
      effort: 'medium',
      impact: 'high',
      recommended: true,
      status: 'pending'
    };

    initialProject.proposalStore.bundles.push({
      id: 'bundle-1' as any,
      title: 'Keşif Paketi',
      phase: 'DISCOVERY',
      status: 'open',
      createdAt: new Date().toISOString(),
      items: [sampleItem],
      provenance: {
        mode: 'cloud',
        providerId: 'openai',
        model: 'gpt-4.1-mini',
        requestedAt: '',
        completedAt: '',
        schemaId: 'discovery-v1',
        schemaVersion: '1.0'
      }
    });

    const commandId = `cmd-${Date.now()}`;

    // First call
    const res1 = acceptProposalItemAtomically({
      project: initialProject,
      bundleId: 'bundle-1',
      itemId: 'prop-item-1',
      commandId,
      expectedRevision: 1
    });

    assert.ok(res1.success, 'First call succeeds');
    assert.equal(res1.project.revision, 2, 'Revision bumped to 2');
    assert.equal(res1.project.requirements.length, 1, 'Requirement added');

    // Second call with SAME commandId (simulating double click)
    const res2 = acceptProposalItemAtomically({
      project: res1.project,
      bundleId: 'bundle-1',
      itemId: 'prop-item-1',
      commandId, // Duplicate commandId
      expectedRevision: 2
    });

    assert.ok(res2.success, 'Duplicate call returns success without re-applying');
    assert.ok(res2.alreadyApplied, 'Idempotency flag marked as alreadyApplied');
    assert.equal(res2.project.requirements.length, 1, 'Requirement count remains 1');
  });

  it('acceptProposalItemAtomically rejects stale revision (Concurrency Control)', () => {
    const project = createCanonicalProjectInstance({ ideaText: 'Test Projesi' });
    project.revision = 3; // Current revision is 3

    const res = acceptProposalItemAtomically({
      project,
      bundleId: 'bundle-1',
      itemId: 'prop-item-1',
      commandId: `cmd-stale-${Date.now()}`,
      expectedRevision: 1 // Stale expected revision!
    });

    assert.ok(!res.success, 'Fails on stale revision');
    assert.ok(res.error?.includes('Çakışan revizyon saptandı'), 'Contains concurrency error message');
  });
});
