import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createDiscoveryAnswerDraft, type DiscoveryConceptField } from '../../src/v4/application/discovery-answer-service.js';
import { createInitialConceptInterpretation } from '../../src/v4/application/idea-discussion-service.js';
import { createProjectDocument } from '../../src/v4/project-document.js';

interface CorpusCase {
  id: string;
  question: string;
  answer: string;
  existingTargetUser?: string;
  expectedQuality: 'actionable' | 'ambiguous' | 'conflicting';
  expectedFields: DiscoveryConceptField[];
  forbiddenFields: DiscoveryConceptField[];
  canCloseQuestion: boolean;
  expectsChangeWarning?: boolean;
}

const corpus = JSON.parse(
  readFileSync(new URL('../../benchmarks/discovery/answer-adversarial-corpus.json', import.meta.url), 'utf8')
) as CorpusCase[];

function projectFor(item: CorpusCase) {
  const project = createProjectDocument({ idea: 'Bireysel geliştirici için görev planlama uygulaması' });
  const summary = createInitialConceptInterpretation(project);
  summary.openQuestions = [item.question];
  if (item.existingTargetUser) summary.targetUser = item.existingTargetUser;
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

describe('discovery answer adversarial corpus', () => {
  for (const item of corpus) {
    it(item.id, () => {
      const draft = createDiscoveryAnswerDraft(projectFor(item), {
        focusedQuestion: item.question,
        answer: item.answer
      }, {
        idFactory: (() => {
          let index = 0;
          return () => `${item.id}-${++index}`;
        })(),
        now: () => '2026-07-29T10:00:00.000Z'
      });

      assert.ok(draft);
      const fields = draft.patches
        .map(patch => patch.field)
        .filter(field => field !== 'openQuestions');
      assert.deepEqual([...new Set(fields)].sort(), [...item.expectedFields].sort());
      for (const forbidden of item.forbiddenFields) assert.ok(!fields.includes(forbidden));
      assert.equal(draft.assessment.quality, item.expectedQuality);
      assert.equal(draft.assessment.canCloseQuestion, item.canCloseQuestion);
      assert.equal(draft.patches.some(patch => patch.field === 'openQuestions'), item.canCloseQuestion);
      for (const patch of draft.patches) {
        assert.ok(patch.confidence >= 15 && patch.confidence <= 96);
        assert.ok(patch.evidence.length > 0);
      }
      if (item.expectsChangeWarning) {
        assert.ok(draft.assessment.warnings.some(warning => /önceki alan/i.test(warning)));
      }
    });
  }

  it('çok uzun cevabı yalnız açık etiketlerle işler ve güven cezasını görünür yapar', () => {
    const item: CorpusCase = {
      id: 'long-answer',
      question: 'Birincil kullanıcı kim?',
      answer: `Hedef kullanıcı: bireysel geliştirici ${'ayrıntılı bağlam '.repeat(90)}`,
      expectedQuality: 'actionable',
      expectedFields: ['targetUser'],
      forbiddenFields: [],
      canCloseQuestion: true
    };
    const draft = createDiscoveryAnswerDraft(projectFor(item), {
      focusedQuestion: item.question,
      answer: item.answer
    })!;

    assert.ok(draft.assessment.warnings.some(warning => /çok uzun/i.test(warning)));
    assert.ok(draft.patches.find(patch => patch.field === 'targetUser')!.confidence < 90);
  });

  it('hesaplanan güven farklı kanıt düzeylerinde sabit bir sayı üretmez', () => {
    const explicit = corpus.find(item => item.id === 'multi-field-answer')!;
    const inferred = {
      ...explicit,
      answer: 'Her gün çalışan bireysel geliştirici',
      question: 'Birincil kullanıcı kim?'
    };
    const explicitDraft = createDiscoveryAnswerDraft(projectFor(explicit), {
      focusedQuestion: explicit.question,
      answer: explicit.answer
    })!;
    const inferredDraft = createDiscoveryAnswerDraft(projectFor(inferred), {
      focusedQuestion: inferred.question,
      answer: inferred.answer
    })!;

    assert.notEqual(
      explicitDraft.patches.find(patch => patch.field === 'targetUser')!.confidence,
      inferredDraft.patches.find(patch => patch.field === 'targetUser')!.confidence
    );
  });
});
