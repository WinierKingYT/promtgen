import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildBudgetedContext, estimateTokenCount } from '../../src/v4/ai/context/context-builder.js';
import { computeDataChecksum } from '../../src/v4/storage/backup-manager.js';
import { createCanonicalProjectInstance } from '../../src/v4/domain/services/project-creation.js';
import { toRequirementId, toTaskId } from '../../src/v4/domain/ids.js';

describe('Category 10: Performance & Scalability Benchmarks', () => {
  it('buildBudgetedContext enforces maxTokens ceiling and completes in <15ms', () => {
    const proj = createCanonicalProjectInstance({ ideaText: 'Büyük Ölçekli Performans Test Projesi' });

    // Generate 100 accepted decisions and requirements
    for (let i = 0; i < 100; i++) {
      proj.requirements.push({
        id: toRequirementId(`req-${i}`),
        title: `Gereksinim ${i}`,
        description: `Açıklama ${i}`,
        category: 'functional',
        priority: 'must',
        status: 'accepted',
        acceptanceCriteria: [],
        relatedDecisionIds: [],
        relatedRiskIds: [],
        relatedTaskIds: [],
        provenance: { origin: 'user', createdAt: '' }
      });
    }

    const start = performance.now();
    const res = buildBudgetedContext(proj, 1000);
    const duration = performance.now() - start;

    assert.ok(duration < 15, `Context builder took ${duration.toFixed(2)}ms (expected <15ms)`);
    assert.ok(res.estimatedTokens <= 1200, `Tokens bounded at ${res.estimatedTokens}`);
  });

  it('Checksum calculation on 3,000 entities completes in <50ms', () => {
    const proj = createCanonicalProjectInstance({ ideaText: '3k Entity Scale Test' });

    for (let i = 0; i < 1000; i++) {
      proj.requirements.push({
        id: toRequirementId(`req-${i}`),
        title: `Req ${i}`,
        description: `Desc ${i}`,
        category: 'functional',
        priority: 'must',
        status: 'accepted',
        acceptanceCriteria: [],
        relatedDecisionIds: [],
        relatedRiskIds: [],
        relatedTaskIds: [],
        provenance: { origin: 'user', createdAt: '' }
      });
    }

    for (let i = 0; i < 2000; i++) {
      proj.tasks.push({
        id: toTaskId(`task-${i}`),
        title: `Task ${i}`,
        description: `Desc ${i}`,
        type: 'implementation',
        status: 'ready',
        priority: 'medium',
        requirementIds: [],
        decisionIds: [],
        dependencyTaskIds: [],
        acceptanceCriterionIds: [],
        testCaseIds: [],
        provenance: { origin: 'user', createdAt: '' }
      });
    }

    const start = performance.now();
    const hash = computeDataChecksum(proj);
    const duration = performance.now() - start;

    assert.ok(hash.startsWith('fnv1a32-'));
    assert.ok(duration < 50, `3k entity checksum took ${duration.toFixed(2)}ms (expected <50ms)`);
  });
});
