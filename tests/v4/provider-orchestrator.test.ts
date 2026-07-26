import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runAITask } from '../../src/v4/ai/orchestrator.js';
import { discoveryTask } from '../../src/v4/ai/tasks/discovery.js';
import { createProjectDocument } from '../../src/v4/project-document.js';

const validDiscoveryOutput = {
  reply: 'Projeyi üç karar ekseninde inceleyelim.',
  analysisNote: 'Mimari belirsizlikler analiz edildi.',
  summary: 'Sıradaki kararlar',
  options: [1, 2, 3].map(index => ({
    kind: 'decision',
    title: `Karar ${index}`,
    description: `Karar ${index} açıklaması`,
    pros: ['Artı'],
    cons: ['Eksi'],
    effort: 'medium',
    impact: 'high',
    affectedSections: ['architecture'],
    recommended: index === 1
  })),
  openQuestions: ['İlk hedef kullanıcı kim?']
};

describe('Production AI orchestrator', () => {
  it('repairs one schema failure and records complete provenance', async () => {
    const project = createProjectDocument({
      idea: 'Yerel çalışan kapsamlı bir planlama uygulaması geliştirmek istiyorum.',
      name: 'AI orchestrator'
    });
    let calls = 0;
    const provider = {
      model: 'mock-model',
      async structured() {
        calls += 1;
        if (calls === 1) throw new Error('SCHEMA_VALIDATION_FAILED');
        return discoveryTask.schema.parse(validDiscoveryOutput);
      }
    };

    const result = await runAITask({
      task: discoveryTask,
      project,
      provider,
      providerId: 'openai',
      model: 'mock-model'
    });

    assert.equal(calls, 2);
    assert.equal(result.provenance.retryCount, 1);
    assert.equal(result.provenance.model, 'mock-model');
    assert.equal(result.provenance.promptVersion, discoveryTask.promptVersion);
    assert.equal(result.provenance.schemaId, discoveryTask.schemaId);
    assert.match(result.provenance.inputHash, /^[a-f0-9]{64}$/);
    assert.ok(result.provenance.latencyMs >= 0);
    assert.equal(result.output.summary, validDiscoveryOutput.summary);
  });
});
