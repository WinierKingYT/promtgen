import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  analyzeIdea,
  applyApprovedChanges,
  previewApprovedChanges,
  proposeNextOptions,
  updateSuggestionStatus
} from '../../src/v4/planning-engine.js';
import { addExpansionCardAsSuggestion } from '../../src/v4/application/idea-expansion-intake.js';
import { selectExpansionBundle } from '../../src/v4/application/proposal-bundle-selectors.js';
import type { ExpansionCard } from '../../src/v4/application/idea-expansion-service.js';
import type { ProjectDocumentV5, SuggestionBundle } from '../../src/v4/contracts.js';

// Ölçülen gerçek girdi: bu fikirle üretilen İKİNCİ paket, aday havuzu tükendiği
// için "Tur N" dinamik önerilerini taşır ve kusur tam orada görülmüştü.
const IDEA = 'unityde bir at sistemi yapmak istiyorum multiplayer olucak';

const RISK_TEXT =
  'Yanlış çıkarsa mimariyi veya kapsamı en çok değiştirecek varsayım için erken doğrulama görevi ekle.';
const QUESTION_TEXT = 'Bu turda en önemli kullanıcı sonucunu ve onu kanıtlayacak gözlemi kesinleştir.';
const DECISION_TEXT = 'Bir sonraki uygulanabilir kilometre taşının çıktısını ve kabul kriterini belirle.';

/** Aday havuzu tükendiğinde açılan dinamik ("Tur N") paketi projeye ekler. */
function projectWithDynamicBundle(): { project: ProjectDocumentV5; bundle: SuggestionBundle } {
  const base = analyzeIdea(IDEA) as ProjectDocumentV5;
  const bundle = proposeNextOptions(base);
  const project = structuredClone(base);
  project.proposalStore.bundles.push(structuredClone(bundle));
  return { project, bundle: project.proposalStore.bundles[project.proposalStore.bundles.length - 1] };
}

/** Paketteki tüm önerileri kabul eder; apply kapısı bekleyen karar istemiyor. */
function acceptAll(project: ProjectDocumentV5, bundle: SuggestionBundle): ProjectDocumentV5 {
  let next = project;
  for (const item of bundle.items) next = updateSuggestionStatus(next, bundle.id, item.id, 'accepted') as ProjectDocumentV5;
  return next;
}

describe('öneri metni yalnız birincil bölüme yazılır', () => {
  it('üç bölümü etkileyen öneri, metnini sadece birincil bölüme bırakır', () => {
    const { project, bundle } = projectWithDynamicBundle();
    const risk = bundle.items.find(item => item.description === RISK_TEXT)!;
    assert.deepEqual(risk.affectedSections, ['risks', 'tasks', 'testing'], 'ölçülen etki listesi korunmalı');

    const applied = applyApprovedChanges(acceptAll(project, bundle), bundle.id) as ProjectDocumentV5;

    assert.ok(applied.sections.risks.items.includes(RISK_TEXT), 'risk metni birincil bölüme yazılmalı');
    assert.equal(applied.sections.tasks.items.includes(RISK_TEXT), false, 'aynı cümle görevlere kopyalanmamalı');
    assert.equal(
      applied.sections.testing.items.includes(RISK_TEXT),
      false,
      'bir görev cümlesi test stratejisine kopyalanmamalı'
    );
  });

  it('her kabul edilen öneri belgede tam bir kez görünür', () => {
    const { project, bundle } = projectWithDynamicBundle();
    const applied = applyApprovedChanges(acceptAll(project, bundle), bundle.id) as ProjectDocumentV5;
    const allItems = Object.values(applied.sections).flatMap(section => section.items);
    for (const text of [RISK_TEXT, QUESTION_TEXT, DECISION_TEXT]) {
      assert.equal(allItems.filter(item => item === text).length, 1, `tek cümle tek yerde durmalı: ${text}`);
    }
  });

  it('aynı bölüme düşen iki öneri de yazılır; hiçbiri kaybolmaz', () => {
    // İlk paketteki üç öneri de birincil bölüm olarak "scope"a düşer.
    const base = analyzeIdea(IDEA) as ProjectDocumentV5;
    const bundle = base.proposalStore.bundles[0];
    const applied = applyApprovedChanges(acceptAll(base, bundle), bundle.id) as ProjectDocumentV5;
    const scopeTexts = new Set(applied.sections.scope.items);
    assert.ok(scopeTexts.size >= 2, 'aynı bölüme düşen öneriler birbirini bastırmamalı');
    for (const item of bundle.items) {
      const text = item.editedDescription || item.description;
      const written = Object.values(applied.sections).some(section => section.items.includes(text));
      assert.ok(written, `kabul edilen öneri hiçbir bölüme yazılmadı: ${item.title}`);
    }
  });
});

describe('etki bilgisi önizlemede kaybolmaz', () => {
  it('etkilenen ama yazılmayan bölümler önizlemede görünmeye devam eder', () => {
    const { project, bundle } = projectWithDynamicBundle();
    const decided = acceptAll(project, bundle);
    const preview = previewApprovedChanges(decided, bundle.id);

    const risks = preview.sections.find(section => section.sectionId === 'risks');
    const tasks = preview.sections.find(section => section.sectionId === 'tasks');
    const testing = preview.sections.find(section => section.sectionId === 'testing');

    assert.ok(risks?.additions.includes(RISK_TEXT), 'birincil bölüm eklenecek metni göstermeli');
    assert.ok(testing, 'etkilenen test bölümü önizlemeden düşmemeli');
    assert.equal(testing!.additions.includes(RISK_TEXT), false, 'etkilenen bölüm metni almaz');
    assert.ok(testing!.unchanged.includes(RISK_TEXT), 'etki bağlantısı "değişmeyecek" olarak görünmeli');
    assert.ok(testing!.sourceSuggestionIds.length > 0, 'etkiyi hangi önerinin doğurduğu izlenebilmeli');
    assert.ok(tasks, 'etkilenen görev bölümü önizlemeden düşmemeli');
  });
});

describe('birincil bölüm ayrımı mevcut davranışı bozmaz', () => {
  it('decisions ve risks kayıt sayıları değişmez', () => {
    const { project, bundle } = projectWithDynamicBundle();
    const decided = acceptAll(project, bundle);
    const preview = previewApprovedChanges(decided, bundle.id);
    const applied = applyApprovedChanges(decided, bundle.id) as ProjectDocumentV5;

    assert.equal(preview.records.decisions, 1);
    assert.equal(preview.records.risks, 1);
    assert.equal(applied.decisions.length - project.decisions.length, 1, 'bir karar kaydı üretilmeli');
    assert.equal(applied.risks.length - project.risks.length, 1, 'bir risk kaydı üretilmeli');
    assert.deepEqual(
      applied.decisions[applied.decisions.length - 1].affectedSectionIds,
      ['tasks', 'scope'],
      'karar kaydı tam etki listesini taşımalı'
    );
  });

  it('metin alan bölüm empty → draft geçişini yapar, almayan bölüm empty kalır', () => {
    const { project, bundle } = projectWithDynamicBundle();
    assert.equal(project.sections.risks.status, 'empty');
    assert.equal(project.sections.testing.status, 'empty');

    const applied = applyApprovedChanges(acceptAll(project, bundle), bundle.id) as ProjectDocumentV5;
    assert.equal(applied.sections.risks.status, 'draft', 'içerik alan bölüm taslağa geçmeli');
    assert.equal(applied.sections.testing.status, 'empty', 'içerik almayan bölüm boş sayılmalı');
  });

  it('birincil bölüm bilgisi olmayan eski paket makul davranır', () => {
    const { project, bundle } = projectWithDynamicBundle();
    // Alan eklenmeden önce yazılmış paketleri taklit et.
    for (const item of bundle.items) delete (item as { primarySection?: string }).primarySection;

    const applied = applyApprovedChanges(acceptAll(project, bundle), bundle.id) as ProjectDocumentV5;
    assert.ok(applied.sections.risks.items.includes(RISK_TEXT), 'eski pakette de tür-uyumlu bölüm seçilmeli');
    assert.equal(applied.sections.testing.items.includes(RISK_TEXT), false, 'eski pakette de kopya çıkmamalı');
    assert.equal(applied.sections.tasks.items.includes(RISK_TEXT), false, 'eski pakette de kopya çıkmamalı');
    assert.ok(applied.sections.vision.items.includes(QUESTION_TEXT));
    assert.ok(applied.sections.tasks.items.includes(DECISION_TEXT));
  });

  it('fikir genişletme kartının plana işlenmesi değişmez', () => {
    const card: ExpansionCard = {
      id: 'card-1',
      title: 'Verinin nerede durduğunu açıkça göster',
      description: 'Kullanıcı ilk açılışta verinin cihazda kaldığını görsün.',
      kind: 'decision',
      effort: 'low',
      impact: 'high',
      deliveryHorizon: 'core',
      origin: 'ai'
    };
    const base = analyzeIdea('Şehir içi bisiklet rotası öneren bir mobil uygulama') as ProjectDocumentV5;
    const intake = addExpansionCardAsSuggestion(base, card, 'Güven ve gizlilik');
    const bundle = selectExpansionBundle(intake.project)!;
    const decided = updateSuggestionStatus(intake.project, bundle.id, bundle.items[0].id, 'accepted') as ProjectDocumentV5;
    const applied = applyApprovedChanges(decided, bundle.id) as ProjectDocumentV5;

    assert.ok(applied.sections.decisions.items.includes(card.description), 'tek bölümlü kart aynı bölüme işlenmeli');
    assert.equal(applied.decisions.length, 1, 'karar kaydı üretimi değişmemeli');
  });

  it('önizleme ve uygulama saf kalır: girdi belgesi mutasyona uğramaz', () => {
    const { project, bundle } = projectWithDynamicBundle();
    const decided = acceptAll(project, bundle);
    const snapshot = structuredClone(decided);
    previewApprovedChanges(decided, bundle.id);
    assert.deepEqual(decided, snapshot, 'önizleme girdiyi değiştirmemeli');
    applyApprovedChanges(decided, bundle.id);
    assert.deepEqual(decided, snapshot, 'uygulama girdiyi değiştirmemeli');
  });
});
