import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import { addExpansionCardAsSuggestion } from '../../src/v4/application/idea-expansion-intake.js';
import { selectExpansionBundle } from '../../src/v4/application/proposal-bundle-selectors.js';
import type { ExpansionCard } from '../../src/v4/application/idea-expansion-service.js';
import type { ProjectDocumentV5 } from '../../src/v4/contracts.js';

const project = () => analyzeIdea('Şehir içi bisiklet rotası öneren bir mobil uygulama') as ProjectDocumentV5;

const card: ExpansionCard = {
  id: 'card-1',
  title: 'Verinin nerede durduğunu açıkça göster',
  description: 'Kullanıcı ilk açılışta verinin cihazda kaldığını görsün.',
  kind: 'feature',
  effort: 'low',
  impact: 'high',
  mvpHint: 'mvp-adayı',
  origin: 'ai'
};

/** Çevrimdışı üretilmiş başlangıç kartı: hiçbir değerlendirme alanı taşımaz. */
const seedCard: ExpansionCard = {
  id: 'seed-trust-0',
  title: 'Tek tıkla dışa aktarma ve silme',
  description: 'Kullanıcı neden güvensin? sorusuna bu başlangıç önerisiyle bakabilirsin.',
  kind: 'feature',
  origin: 'local-seed'
};

/**
 * Kartlar turun paketine değil kendi keşif paketine düşer; "ilk açık paket"
 * artık analyzeIdea'nın tur paketidir. Ayrımın gerekçesi için bkz.
 * proposal-bundle-selectors.ts ve idea-expansion-bundle-separation.test.ts.
 */
const openBundle = (next: ProjectDocumentV5) => selectExpansionBundle(next)!;

describe('addExpansionCardAsSuggestion', () => {
  it('kartı bekleyen öneri olarak keşif paketine ekler', () => {
    const { project: next, added } = addExpansionCardAsSuggestion(project(), card, 'Güven ve gizlilik');
    assert.equal(added, true);
    const bundle = openBundle(next);
    assert.ok(bundle, 'açık paket oluşmalı');
    const item = bundle.items.find(entry => entry.title === card.title);
    assert.ok(item, 'kart öneri olarak eklenmeli');
    assert.equal(item.status, 'pending');
    assert.equal(item.kind, 'feature');
    assert.equal(item.effort, 'low');
    assert.equal(item.impact, 'high');
  });

  it('canonical planı değiştirmez', () => {
    const before = project();
    const { project: next } = addExpansionCardAsSuggestion(before, card, 'Güven ve gizlilik');
    assert.equal(next.canonicalRevision, before.canonicalRevision);
    assert.equal(next.requirements.length, before.requirements.length);
    assert.equal(next.decisions.length, before.decisions.length);
  });

  it('aynı kartı iki kez eklemez', () => {
    const once = addExpansionCardAsSuggestion(project(), card, 'Güven ve gizlilik');
    const twice = addExpansionCardAsSuggestion(once.project, card, 'Güven ve gizlilik');
    const items = openBundle(twice.project).items.filter(entry => entry.title === card.title);
    assert.equal(items.length, 1);
  });

  it('ikinci ekleme sessizce yutulmaz: added=false ve nedeni bildirilir', () => {
    const once = addExpansionCardAsSuggestion(project(), card, 'Güven ve gizlilik');
    const twice = addExpansionCardAsSuggestion(once.project, card, 'Güven ve gizlilik');
    assert.equal(twice.added, false, 'çağıran, hiçbir şey eklenmediğini görebilmeli');
    assert.ok(twice.reason.trim().length > 0, 'kullanıcıya söylenecek dürüst bir neden dönmeli');
    assert.equal(
      twice.project,
      once.project,
      'değişiklik yoksa aynı belge dönmeli; kalıcılaştırılacak yeni bir sürüm üretilmemeli'
    );
    assert.equal(twice.project.documentRevision, once.project.documentRevision);
  });

  it('fikir defterine de kayıt düşer', () => {
    const { project: next } = addExpansionCardAsSuggestion(project(), card, 'Güven ve gizlilik');
    const records = next.ideaDiscussion?.records || [];
    assert.ok(records.some(record => record.text === card.title), 'kayıt defterinde iz kalmalı');
  });

  it('yerel başlangıç kartı köken işaretiyle kaydedilir', () => {
    const { project: next, added } = addExpansionCardAsSuggestion(project(), seedCard, 'Güven ve gizlilik');
    assert.equal(added, true);
    const item = openBundle(next).items.find(entry => entry.title === seedCard.title);
    assert.ok(item, 'başlangıç kartı da öneri olarak eklenebilmeli');
    assert.match(
      item.recommendationReason,
      /yerel başlangıç/i,
      'kaydın kendisi kartın yerel kökenli olduğunu söylemeli'
    );
    assert.match(
      item.recommendationReason,
      /değerlendir/i,
      'efor ve etkinin ölçülmediği açıkça yazılmalı'
    );
  });

  it('AI kartı yerel köken işareti taşımaz', () => {
    const { project: next } = addExpansionCardAsSuggestion(project(), card, 'Güven ve gizlilik');
    const item = openBundle(next).items.find(entry => entry.title === card.title);
    assert.ok(item);
    assert.doesNotMatch(
      item.recommendationReason,
      /yerel başlangıç/i,
      'model değerlendirmesinden gelen kart yerel köken işareti taşımamalı'
    );
  });

  it('kökeni tüketici tahmin etmez: aynı alanlarla gelen kart origin değerine göre işaretlenir', () => {
    // İki kart aynı değerlendirme alanlarını taşısa bile ayrım origin'den gelir.
    const disguised: ExpansionCard = { ...card, id: 'card-2', title: 'Aynı alanlar, yerel köken', origin: 'local-seed' };
    const { project: next } = addExpansionCardAsSuggestion(project(), disguised, 'Güven ve gizlilik');
    const item = openBundle(next).items.find(entry => entry.title === disguised.title);
    assert.ok(item);
    assert.match(item.recommendationReason, /yerel başlangıç/i);
  });
});
