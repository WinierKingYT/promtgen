import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import { getConceptAgreementGate } from '../../src/v4/application/idea-discussion-service.js';
import { previewIdeaPlanConversion } from '../../src/v4/application/idea-plan-conversion-service.js';
import type { ProjectDocumentV5 } from '../../src/v4/contracts.js';

/**
 * Dönüşüm kapısı, kullanıcıyı biriken her fikir kaydını tek tek karara
 * bağlamaya zorlamamalıdır. Yalnız planı belirsiz bırakan kayıtlar blokler:
 *
 *   decision / question -> kritik, çözülmeden plana geçilmez
 *   hypothesis / risk   -> ertelenebilir, plana varsayım ve risk olarak taşınır
 */

const record = (id: string, kind: string, status = 'pending') => ({
  id, kind, text: `${kind} kaydı ${id}`, originalText: '', note: '', answer: '',
  rationale: '', validationPlan: '', history: [], status,
  sourceBundleId: 'bundle-1', sourceMessageId: 'msg-1', createdAt: '2026-08-02T00:00:00.000Z'
});

function projectWithRecords(kinds: string[]): ProjectDocumentV5 {
  const project = analyzeIdea('Ekiplerin toplantı notlarından karar çıkaran web uygulaması') as any;
  project.ideaDiscussion = {
    ...(project.ideaDiscussion || {}),
    records: kinds.map((kind, index) => record(`rec-${index}`, kind))
  };
  return project as ProjectDocumentV5;
}

describe('Idea to plan conversion gate', () => {
  it('karar ve soruyu kritik, hipotez ve riski ertelenebilir sayar', () => {
    const gate = getConceptAgreementGate(projectWithRecords(['decision', 'question', 'hypothesis', 'risk']));

    assert.equal(gate.pending.length, 4);
    assert.deepEqual(gate.criticalPending.map(item => item.kind).sort(), ['decision', 'question']);
    assert.deepEqual(gate.deferrablePending.map(item => item.kind).sort(), ['hypothesis', 'risk']);
  });

  it('yalnız ertelenebilir kayıtlar varsa bunlar dönüşümü bloklamaz', () => {
    const many = Array.from({ length: 12 }, (_, index) => (index % 2 ? 'risk' : 'hypothesis'));
    const preview = previewIdeaPlanConversion(projectWithRecords(many));

    assert.equal(
      preview.blockers.some(text => /kritik karar veya açık soru/.test(text)),
      false,
      '12 ertelenebilir kayıt tek başına dönüşümü bloklamamalı'
    );
  });

  it('kritik kayıt varsa dönüşüm blokludur ve sayısı bildirilir', () => {
    const preview = previewIdeaPlanConversion(projectWithRecords(['decision', 'decision', 'risk']));
    const blocker = preview.blockers.find(text => /kritik karar veya açık soru/.test(text));

    assert.ok(blocker, 'kritik kayıt bloklamalı');
    assert.match(blocker, /^2 /, 'yalnız kritik olanlar sayılmalı; risk sayıya girmemeli');
  });

  it('kayıt yokken bu engel hiç görünmez', () => {
    const preview = previewIdeaPlanConversion(projectWithRecords([]));
    assert.equal(preview.blockers.some(text => /kritik karar veya açık soru/.test(text)), false);
  });
});
