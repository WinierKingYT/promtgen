import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateImpactAnalysis } from '../../src/v4/ai-discovery.js';
import { regenerateAffectedSectionsTask } from '../../src/v4/ai/tasks/regenerate-affected-sections.js';
import { applyChangeImpact } from '../../src/v4/application/change-impact-service.js';
import {
  applySectionPatchProposals,
  generateSectionPatchProposals,
  setSectionPatchStatus
} from '../../src/v4/application/section-regeneration-service.js';
import { validateProjectDocument, createProjectDocument } from '../../src/v4/project-document.js';

async function acceptedImpactProject() {
  const project = createProjectDocument({ idea: 'Yerel proje planlama uygulaması' });
  const proposed = await generateImpactAnalysis(project, 'Plan exportuna imzalı JSON özeti ekle');
  const applied = applyChangeImpact(proposed.project, proposed.impact.id);
  assert.equal(applied.success, true);
  return { project: applied.project, impactId: proposed.impact.id };
}

describe('controlled section regeneration', () => {
  it('keeps generated patches outside canonical sections until explicit decisions', async () => {
    const accepted = await acceptedImpactProject();
    const before = structuredClone(accepted.project.sections);
    const generated = await generateSectionPatchProposals(accepted.project, accepted.impactId, {
      settings: { providerId: 'offline', model: 'local', baseUrl: '', useAiWhenAvailable: false, useLocalMemory: false }
    });
    assert.ok(generated.proposals.length > 0);
    assert.equal(generated.proposals[0].status, 'pending');
    assert.equal(generated.proposals[0].provenance.mode, 'rule-engine');
    assert.deepEqual(generated.project.sections, before);
    assert.deepEqual(validateProjectDocument(generated.project), { valid: true, errors: [] });
  });

  it('requires a decision for every patch and applies accepted/edited content atomically', async () => {
    const accepted = await acceptedImpactProject();
    const generated = await generateSectionPatchProposals(accepted.project, accepted.impactId, {
      settings: { providerId: 'offline', model: 'local', baseUrl: '', useAiWhenAvailable: false, useLocalMemory: false }
    });
    const blocked = applySectionPatchProposals(generated.project, accepted.impactId);
    assert.equal(blocked.success, false);
    let decided = generated.project;
    generated.proposals.forEach((proposal, index) => {
      decided = setSectionPatchStatus(
        decided,
        proposal.id,
        index === 0 ? 'edited' : index === 1 ? 'accepted' : 'deferred',
        index === 0 ? `${proposal.proposedContent}\n\nKullanıcı düzenlemesi.` : ''
      );
    });
    const beforeRevision = decided.canonicalRevision;
    const result = applySectionPatchProposals(decided, accepted.impactId);
    assert.equal(result.success, true);
    assert.equal(result.project.canonicalRevision, beforeRevision + 1);
    assert.match(result.project.sections[generated.proposals[0].sectionId].content, /Kullanıcı düzenlemesi/);
    assert.deepEqual(validateProjectDocument(result.project), { valid: true, errors: [] });
  });

  it('marks approved patches stale when canonical revision changes', async () => {
    const accepted = await acceptedImpactProject();
    const generated = await generateSectionPatchProposals(accepted.project, accepted.impactId, {
      settings: { providerId: 'offline', model: 'local', baseUrl: '', useAiWhenAvailable: false, useLocalMemory: false }
    });
    let decided = generated.project;
    for (const proposal of generated.proposals) decided = setSectionPatchStatus(decided, proposal.id, 'accepted');
    decided.documentRevision += 1;
    decided.canonicalRevision += 1;
    const before = structuredClone(decided.sections);
    const result = applySectionPatchProposals(decided, accepted.impactId);
    assert.equal(result.success, false);
    assert.match(result.reason, /yeniden üretilmeli/);
    assert.deepEqual(result.project.sections, before);
    assert.ok(result.project.sectionPatchProposals.every(item => item.status === 'stale'));
  });

  it('defines an exact prompt/schema/context contract for the AI task', async () => {
    const accepted = await acceptedImpactProject();
    const context = regenerateAffectedSectionsTask.buildContext(accepted.project, { impactId: accepted.impactId });
    assert.ok(context.affectedSections.length > 0);
    const output = regenerateAffectedSectionsTask.schema.parse({
      summary: 'Bölümler güncellendi.',
      patches: [{ sectionId: context.affectedSections[0].id, proposedContent: 'Yeni içerik', rationale: 'Kabul edilen değişiklik', warnings: [] }]
    });
    assert.equal(output.patches.length, 1);
    assert.match(regenerateAffectedSectionsTask.buildPrompt(accepted.project), /kullanıcı onayı olmadan uygulanmayacaktır/);
  });

  it('runs the registered production task through the shared AI runtime', async () => {
    const accepted = await acceptedImpactProject();
    let receivedSystem = '';
    let receivedContext: unknown = null;
    const provider = {
      model: 'section-mock',
      async structured(input: {
        system: string;
        context: unknown;
        schema: { parse(value: unknown): unknown };
      }) {
        receivedSystem = input.system;
        receivedContext = input.context;
        const context = input.context as { affectedSections: Array<{ id: string }> };
        return input.schema.parse({
          summary: 'Paylaşılan runtime çıktısı.',
          patches: [{
            sectionId: context.affectedSections[0].id,
            proposedContent: 'Runtime tarafından doğrulanan bölüm içeriği.',
            rationale: 'Kabul edilmiş etki',
            warnings: []
          }]
        });
      }
    };
    const generated = await generateSectionPatchProposals(accepted.project, accepted.impactId, {
      settings: {
        providerId: 'openai',
        model: 'section-mock',
        baseUrl: 'https://api.openai.com/v1',
        useAiWhenAvailable: true,
        useLocalMemory: false
      },
      provider
    });
    assert.equal(generated.usedFallback, false);
    assert.match(receivedSystem, /yaşayan plan bölüm editörüsün/);
    assert.ok((receivedContext as { affectedSections: unknown[] }).affectedSections.length > 0);
    assert.equal(generated.proposals[0].provenance.providerId, 'openai');
    assert.equal(generated.proposals[0].provenance.model, 'section-mock');
    assert.equal(generated.proposals[0].provenance.schemaId, regenerateAffectedSectionsTask.schemaId);
    assert.match(generated.proposals[0].provenance.inputHash, /^[a-f0-9]{64}$/);
    assert.deepEqual(validateProjectDocument(generated.project), { valid: true, errors: [] });
  });
});
