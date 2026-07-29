import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyDiscoveryAnswerDraft,
  compareDiscoveryAnswerWithAI,
  createDiscoveryAnswerDraft,
  updateDiscoveryAnswerPatch
} from '../../src/v4/application/discovery-answer-service.js';
import { createInitialConceptInterpretation } from '../../src/v4/application/idea-discussion-service.js';
import { createProjectDocument } from '../../src/v4/project-document.js';

function projectWithQuestion(question = 'Bu ürünü düzenli kullanacak birincil kullanıcı kim?') {
  const project = createProjectDocument({ idea: 'Dağınık görevleri düzenleyen bir uygulama' });
  const summary = createInitialConceptInterpretation(project);
  summary.openQuestions = [question, 'İlk sürümün doğrulanabilir sınırı nedir?'];
  project.ideaLabSession = {
    status: 'active',
    approaches: [],
    ideaNotes: [],
    candidateDecisions: [],
    candidateRisks: [],
    conceptSummary: summary
  };
  return project;
}

const options = {
  idFactory: (() => {
    let index = 0;
    return () => `id-${++index}`;
  })(),
  now: () => '2026-07-28T12:00:00.000Z'
};

describe('discovery answer proposal service', () => {
  it('serbest yanıtı yalnız alan önerisine dönüştürür ve projeyi değiştirmez', () => {
    const project = projectWithQuestion();
    const before = structuredClone(project);
    const draft = createDiscoveryAnswerDraft(project, {
      focusedQuestion: project.ideaLabSession!.conceptSummary!.openQuestions[0],
      answer: 'Her gün AI kodlama araçları kullanan bireysel geliştirici'
    }, options);

    assert.ok(draft);
    assert.deepEqual(project, before);
    assert.deepEqual(draft.patches.map(patch => patch.field), ['targetUser', 'openQuestions']);
    assert.ok(draft.patches.every(patch => patch.status === 'pending'));
    assert.equal(draft.provenance.mode, 'rule-engine');
    assert.equal(draft.assessment.quality, 'actionable');
    assert.ok(draft.patches[0].evidence.length >= 2);
  });

  it('yalnız kabul edilen ve düzenlenen alanları tek işlemde uygular', () => {
    const project = projectWithQuestion();
    const draft = createDiscoveryAnswerDraft(project, {
      focusedQuestion: project.ideaLabSession!.conceptSummary!.openQuestions[0],
      answer: 'Bireysel geliştirici'
    }, options)!;
    const accepted = updateDiscoveryAnswerPatch(draft, draft.patches[0].id, 'edited', 'AI araçları kullanan bireysel geliştirici');
    const resolved = updateDiscoveryAnswerPatch(accepted, draft.patches[1].id, 'rejected');
    const result = applyDiscoveryAnswerDraft(project, resolved);

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.project.ideaLabSession!.conceptSummary!.targetUser, 'AI araçları kullanan bireysel geliştirici');
    assert.deepEqual(result.project.ideaLabSession!.conceptSummary!.openQuestions, project.ideaLabSession!.conceptSummary!.openQuestions);
    assert.equal(result.project.ideaLabSession!.conceptSummary!.userConfirmed, false);
    assert.equal(project.ideaLabSession!.conceptSummary!.targetUser === result.project.ideaLabSession!.conceptSummary!.targetUser, false);
  });

  it('yanıtlanan soruyu ancak ayrı kabul edildiğinde açık sorulardan kaldırır', () => {
    const project = projectWithQuestion();
    let draft = createDiscoveryAnswerDraft(project, {
      focusedQuestion: project.ideaLabSession!.conceptSummary!.openQuestions[0],
      answer: 'Bireysel geliştirici'
    }, options)!;
    for (const patch of draft.patches) draft = updateDiscoveryAnswerPatch(draft, patch.id, 'accepted');
    const result = applyDiscoveryAnswerDraft(project, draft);

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.deepEqual(result.project.ideaLabSession!.conceptSummary!.openQuestions, ['İlk sürümün doğrulanabilir sınırı nedir?']);
  });

  it('stale revision durumunda hiçbir kısmi değişiklik uygulamaz', () => {
    const project = projectWithQuestion();
    let draft = createDiscoveryAnswerDraft(project, {
      focusedQuestion: project.ideaLabSession!.conceptSummary!.openQuestions[0],
      answer: 'Bireysel geliştirici'
    }, options)!;
    draft = updateDiscoveryAnswerPatch(draft, draft.patches[0].id, 'accepted');
    const changed = structuredClone(project);
    changed.documentRevision += 1;
    const before = structuredClone(changed);
    const result = applyDiscoveryAnswerDraft(changed, draft);

    assert.equal(result.success, false);
    assert.match(result.reason, /değişti/i);
    assert.deepEqual(changed, before);
  });

  it('soru alanla güvenli biçimde eşleşmiyorsa öneri uydurmaz ve soruyu kapatmaz', () => {
    const project = projectWithQuestion('Bu fikir hakkında başka ne düşünüyorsun?');
    const draft = createDiscoveryAnswerDraft(project, {
      focusedQuestion: project.ideaLabSession!.conceptSummary!.openQuestions[0],
      answer: 'Birçok farklı şey olabilir.'
    }, options);

    assert.ok(draft);
    assert.equal(draft.assessment.quality, 'ambiguous');
    assert.equal(draft.assessment.canCloseQuestion, false);
    assert.deepEqual(draft.patches, []);
  });

  it('AI ve kural sonucunu karşılaştırır fakat hiçbir öneriyi otomatik kabul etmez', () => {
    const project = projectWithQuestion();
    const risksBefore = structuredClone(project.ideaLabSession!.conceptSummary!.knownRisks);
    const draft = createDiscoveryAnswerDraft(project, {
      focusedQuestion: project.ideaLabSession!.conceptSummary!.openQuestions[0],
      answer: 'Bireysel geliştirici'
    }, options)!;
    const compared = compareDiscoveryAnswerWithAI(draft, {
      fields: [
        { field: 'targetUser', value: 'Küçük ajans ekibi', confidence: 78, rationale: 'Yanıtta ekip sinyali bulundu.' },
        { field: 'knownRisks', value: ['Kapsam belirsizliği'], confidence: 64, rationale: 'Belirsizlik açıkça belirtildi.' }
      ],
      warnings: []
    }, {
      runId: 'run-1',
      mode: 'cloud-ai',
      providerId: 'openai',
      model: 'test-model',
      promptVersion: '1.0.0',
      schemaId: 'discovery-answer-extraction-v1',
      schemaVersion: 1,
      requestedAt: '2026-07-28T12:00:00.000Z',
      completedAt: '2026-07-28T12:00:01.000Z',
      latencyMs: 1000,
      retryCount: 0,
      fallbackReason: null,
      inputHash: 'hash'
    });

    assert.equal(compared.comparison?.disagreements.length, 1);
    assert.equal(compared.comparison?.aiOnly.length, 1);
    assert.ok(compared.patches.every(patch => patch.status === 'pending'));
    assert.deepEqual(project.ideaLabSession!.conceptSummary!.knownRisks, risksBefore);
  });
});
