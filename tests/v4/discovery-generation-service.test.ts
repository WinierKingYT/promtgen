import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runConversationalDiscoveryTurnService } from '../../src/v4/application/discovery-generation-service.js';
import { createProjectDocument } from '../../src/v4/project-document.js';

function stubBundle(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    id: 'bundle-1',
    title: 'Test turu',
    phase: 'discovery',
    status: 'open',
    createdAt: now,
    items: [
      { id: 'i1', fingerprint: 'f1', kind: 'feature', title: 'A', description: 'D', pros: [], cons: [], effort: 'low', impact: 'low', recommended: true, recommendationReason: '', affectedSections: ['scope'], dependencies: [], status: 'pending' },
      { id: 'i2', fingerprint: 'f2', kind: 'feature', title: 'B', description: 'D', pros: [], cons: [], effort: 'low', impact: 'low', recommended: false, recommendationReason: '', affectedSections: ['scope'], dependencies: [], status: 'pending' },
      { id: 'i3', fingerprint: 'f3', kind: 'feature', title: 'C', description: 'D', pros: [], cons: [], effort: 'low', impact: 'low', recommended: false, recommendationReason: '', affectedSections: ['scope'], dependencies: [], status: 'pending' }
    ],
    replyMessage: 'Anladım.',
    analysisNote: 'Not.',
    openQuestions: [],
    source: { type: 'local', providerId: 'offline' },
    provenance: {
      runId: 'run-1', mode: 'rule-engine', providerId: 'offline', model: null,
      promptVersion: '1.0.0', requestedAt: now, completedAt: now,
      latencyMs: 0, retryCount: 0, fallbackReason: null, schemaId: 'discovery-v1', schemaVersion: 1, inputHash: 'x'
    },
    uncertainty: ['Hedef kullanıcı hâlâ belirsiz'],
    optionalPaths: [{ title: 'Kullanıcıyı daralt', reason: 'Grup geniş', prompt: 'Karşılaştır.' }],
    nextQuestionText: 'Bu ürünü kim kullanacak?',
    ...overrides
  };
}

describe('runConversationalDiscoveryTurnService — birleşik tur alanlarını mesaja taşıma', () => {
  it('bundle üzerindeki uncertainty/optionalPaths/nextQuestionText alanlarını son asistan mesajına yazar', async () => {
    const project = createProjectDocument({ idea: 'Bireysel geliştiriciler için yerel proje planlama aracı' });
    const dependencies = { createFallback: () => stubBundle(), mapProviderOutput: () => stubBundle() };
    const result = await runConversationalDiscoveryTurnService(
      project,
      { message: 'Bireysel geliştiriciler' },
      dependencies
    );
    const lastMessage = result.project.messages.at(-1)!;
    assert.deepEqual(lastMessage.uncertainty, ['Hedef kullanıcı hâlâ belirsiz']);
    assert.deepEqual(lastMessage.optionalPaths, [{ title: 'Kullanıcıyı daralt', reason: 'Grup geniş', prompt: 'Karşılaştır.' }]);
    assert.equal(lastMessage.nextQuestionText, 'Bu ürünü kim kullanacak?');
    assert.equal(typeof lastMessage.nextQuestionStep, 'string');
  });

  it('bundle bu alanları sağlamazsa idea-coach\'ın kendi yerel varsayılanına (questionFor/actionsFor) düşer', async () => {
    const project = createProjectDocument({ idea: 'Bireysel geliştiriciler için yerel proje planlama aracı' });
    // Bu bundle'ın openQuestions'ı boş DEĞİL — taze bir projede activeStep 'problem' olur
    // (questionFor'un problem eşleştiricisi: /problem|sorun|acı|ihtiyaç/i), bu yüzden bu soru
    // birleştirme döngüsünden (openQuestions merge) sonra questionFor() tarafından bulunmalı.
    // Bu, buildIdeaCoachState(next)'in birleştirilmiş next.openQuestions üzerinden (merge'den
    // ÖNCE değil, SONRA) çağrıldığını kanıtlar — merge'den önce çağrılsaydı bu soru henüz
    // projede olmayacağı için questionFor() derivedQuestion()'a düşer ve bu assertion başarısız olurdu.
    const mergedQuestion = 'Bu ürünün çözdüğü asıl sorun ne?';
    const bare = () => stubBundle({
      uncertainty: undefined,
      optionalPaths: undefined,
      nextQuestionText: undefined,
      openQuestions: [mergedQuestion]
    });
    const dependencies = { createFallback: bare, mapProviderOutput: bare };
    const result = await runConversationalDiscoveryTurnService(
      project,
      { message: 'Bireysel geliştiriciler' },
      dependencies
    );
    const lastMessage = result.project.messages.at(-1)!;
    // bundle alan sağlamadı ama mesaj yine de boş kalmamalı — idea-coach-service'in
    // questionFor()/actionsFor() sonucuna düşer (bkz. Task 5), tıpkı bu görevden
    // önceki davranışın render zamanında ürettiği sonuçla aynı.
    assert.equal(typeof lastMessage.nextQuestionText, 'string');
    assert.ok(lastMessage.nextQuestionText!.length > 0);
    assert.equal(typeof lastMessage.nextQuestionStep, 'string');
    assert.ok(Array.isArray(lastMessage.optionalPaths) && lastMessage.optionalPaths!.length > 0);
    assert.deepEqual(lastMessage.uncertainty, []);
    assert.equal(result.project.openQuestions.includes(mergedQuestion), true);
    assert.equal(lastMessage.nextQuestionText, mergedQuestion);
    assert.equal(lastMessage.nextQuestionStep, 'problem');
  });
});
