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

  it('gives each attempt its own timeout budget', async () => {
    const project = createProjectDocument({
      idea: 'Yerel çalışan kapsamlı bir planlama uygulaması geliştirmek istiyorum.',
      name: 'Deneme başına bütçe'
    });
    // İlk deneme bütçesini sonuna kadar tüketir; ikincisi tükenmiş bir
    // sinyalle başlarsa üretilen iş çöpe gider ve tur hep fallback'e düşer.
    let calls = 0;
    const provider = {
      model: 'mock-model',
      async structured({ signal }: { signal?: AbortSignal }) {
        calls += 1;
        if (calls === 1) {
          await new Promise((_, reject) => {
            signal?.addEventListener('abort', () => reject(new Error('AbortError')), { once: true });
          });
        }
        assert.equal(signal?.aborted, false, 'ikinci deneme tükenmiş bütçeyle başlamamalı');
        return discoveryTask.schema.parse(validDiscoveryOutput);
      }
    };

    const result = await runAITask({
      task: { ...discoveryTask, timeoutMs: 80 },
      project,
      provider,
      providerId: 'ollama',
      model: 'mock-model'
    });

    assert.equal(calls, 2);
    assert.equal(result.provenance.retryCount, 1);
    assert.equal(result.output.summary, validDiscoveryOutput.summary);
  });

  it('tells the repair attempt what actually failed', async () => {
    const project = createProjectDocument({
      idea: 'Yerel çalışan kapsamlı bir planlama uygulaması geliştirmek istiyorum.',
      name: 'Onarım geri bildirimi'
    });
    // "Şemaya uymadı" tek başına işe yaramıyor: model neyi düzelteceğini
    // bilmediği için aynı hatayı tekrarlıyor ve tur fallback'e düşüyor.
    const systems: string[] = [];
    const provider = {
      model: 'mock-model',
      async structured({ system }: { system: string }) {
        systems.push(system);
        if (systems.length === 1) {
          throw discoveryTask.schema.safeParse({ ...validDiscoveryOutput, summary: 42 }).error;
        }
        return discoveryTask.schema.parse(validDiscoveryOutput);
      }
    };

    await runAITask({
      task: discoveryTask,
      project,
      provider,
      providerId: 'ollama',
      model: 'mock-model'
    });

    assert.equal(systems.length, 2);
    // Temel istem JSON şablonunda zaten "summary" geçiyor; ayırt edici olan
    // düzeltme bölümünün varlığı ve hatalı alanın orada adıyla listelenmesi.
    assert.ok(!systems[0].includes('Düzeltilecek noktalar'), 'ilk istem düzeltme bölümü içermemeli');
    assert.match(systems[1], /Düzeltilecek noktalar/);
    assert.match(systems[1], /- summary: /, 'onarım istemi hatalı alanı yoluyla bildirmeli');
  });

  it('does not retry after the user cancels', async () => {
    const project = createProjectDocument({
      idea: 'Yerel çalışan kapsamlı bir planlama uygulaması geliştirmek istiyorum.',
      name: 'Dış iptal'
    });
    // Deneme başına bütçe, dış iptali geçersiz kılmamalı: kullanıcı vazgeçtiyse
    // onarım denemesi hiç başlamamalı, yoksa iptal ettiği iş sürerdi.
    const controller = new AbortController();
    let calls = 0;
    const provider = {
      model: 'mock-model',
      async structured() {
        calls += 1;
        controller.abort();
        throw new Error('AbortError');
      }
    };

    await assert.rejects(() => runAITask({
      task: { ...discoveryTask, timeoutMs: 5_000 },
      project,
      provider,
      providerId: 'ollama',
      model: 'mock-model',
      signal: controller.signal
    }));
    assert.equal(calls, 1, 'kullanıcı vazgeçtikten sonra onarım denemesi yapılmamalı');
  });
});
