import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeIdea, confirmConceptSummary } from '../../src/v4/planning-engine.js';
import {
  getConceptAgreementGate,
  resolveIdeaRecordsForBundle
} from '../../src/v4/application/idea-discussion-service.js';
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

/**
 * İki defter aynı turu izler: proposalStore öneriyi, ideaDiscussion kaydı
 * tutar. Kullanıcı bir öneriyi açıkça kabul ettiğinde ikisi de bunu
 * yansıtmalıdır. Kayıt tarafı erteleme damgası yerse kullanıcının "evet"i
 * kaybolur ve confirmConceptSummary plana hiçbir karar/risk taşıyamaz.
 */
describe('Bundle kapanışı kullanıcının kabulünü korur', () => {
  const suggestion = (id: string, title: string, status: string) => ({
    id, fingerprint: `fp-${id}`, kind: 'decision', title, description: `${title} açıklaması`,
    pros: [], cons: [], effort: 'low', impact: 'high', affectedSections: ['scope'],
    recommended: false, recommendationReason: '', dependencies: [], status
  });

  const linkedRecord = (id: string, text: string) => ({
    id, kind: 'decision', text, originalText: text, note: '', answer: '',
    rationale: '', validationPlan: '', history: [], status: 'pending',
    sourceBundleId: 'bundle-1', sourceMessageId: 'msg-1', createdAt: '2026-08-06T00:00:00.000Z'
  });

  function projectWithBundle(): ProjectDocumentV5 {
    const project = analyzeIdea('Ekiplerin toplantı notlarından karar çıkaran web uygulaması') as any;
    project.proposalStore = {
      ...(project.proposalStore || {}),
      bundles: [{
        id: 'bundle-1', title: 'Tur 1', phase: 'DISCOVERY', status: 'open',
        createdAt: '2026-08-06T00:00:00.000Z',
        items: [
          suggestion('s-1', 'Önce tek şehirde doğrula', 'accepted'),
          suggestion('s-2', 'Çok şehir desteğiyle başla', 'pending')
        ]
      }]
    };
    project.ideaDiscussion = {
      ...(project.ideaDiscussion || {}),
      records: [
        linkedRecord('rec-1', 'Önce tek şehirde doğrula'),
        linkedRecord('rec-2', 'Çok şehir desteğiyle başla')
      ]
    };
    return project as ProjectDocumentV5;
  }

  const statusOf = (project: ProjectDocumentV5, id: string) =>
    (project.ideaDiscussion?.records || []).find(item => item.id === id)?.status;

  it('kabul edilen öneriye karşılık gelen kaydı accepted yapar', () => {
    const next = resolveIdeaRecordsForBundle(projectWithBundle(), 'bundle-1');
    assert.equal(statusOf(next, 'rec-1'), 'accepted', 'kullanıcının açık kabulü kayda da geçmeli');
  });

  it('kabul edilmeyen öneriyi erteler', () => {
    const next = resolveIdeaRecordsForBundle(projectWithBundle(), 'bundle-1');
    assert.equal(statusOf(next, 'rec-2'), 'deferred');
  });

  it('kabul edilen kayıt konsept mutabakatı kapısında accepted olarak görünür', () => {
    const gate = getConceptAgreementGate(resolveIdeaRecordsForBundle(projectWithBundle(), 'bundle-1'));
    assert.deepEqual(gate.accepted.map(item => item.text), ['Önce tek şehirde doğrula']);
    assert.equal(gate.criticalPending.length, 0, 'paket kapandıktan sonra bekleyen kritik kayıt kalmamalı');
  });

  // Kullanıcının gördüğü sonuç: seçtiği yön planda karar olarak yer almalı.
  // Zincirin tamamı burada koşar; tek bir halka kopsa bu test kırmızıya döner.
  it('kabul edilen karar canonical plana geçer', () => {
    const resolved = resolveIdeaRecordsForBundle(projectWithBundle(), 'bundle-1') as any;
    resolved.ideaLabSession = {
      ...(resolved.ideaLabSession || {}),
      status: 'draft',
      conceptSummary: {
        summary: 'Ekiplerin toplantı notlarından karar çıkaran web uygulaması.',
        targetUser: 'Haftada birden fazla toplantı yapan küçük ürün ekipleri.',
        problemStatement: 'Toplantıda alınan kararlar dağınık notlarda kayboluyor.',
        currentAlternative: 'Notlar elle yazılıp paylaşılıyor, takibi yapılmıyor.',
        desiredOutcome: 'Her toplantı sonunda kararlar ve sahipleri net listelenir.',
        mvpTarget: 'Tek ekipte, bir toplantının kararlarını çıkarıp paylaşmak.',
        confirmedFeatures: ['Toplantı notu yükleme', 'Karar çıkarma'],
        outOfScope: ['Takvim entegrasyonu'],
        technicalApproaches: [],
        knownRisks: [],
        openQuestions: [],
        interpretationConfidence: 70,
        confidenceRationale: 'Kullanıcı alanları doğruladı.',
        userConfirmed: false,
        confirmedAt: null
      }
    };

    const converted = confirmConceptSummary(resolved) as ProjectDocumentV5;
    assert.deepEqual(
      converted.decisions.map(item => item.decision),
      ['Önce tek şehirde doğrula'],
      'kullanıcının seçtiği yön planda karar olarak yer almalı'
    );
  });
});
