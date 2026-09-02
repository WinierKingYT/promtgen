import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeIdea, applyApprovedChanges, updateSuggestionStatus } from '../../src/v4/planning-engine.js';
import { addExpansionCardAsSuggestion } from '../../src/v4/application/idea-expansion-intake.js';
import { selectExpansionBundle } from '../../src/v4/application/proposal-bundle-selectors.js';
import { createUserExpansionCard, type ExpansionCard } from '../../src/v4/application/idea-expansion-service.js';
import { buildIdeaStateView } from '../../src/v4/application/idea-state-view.js';
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

  it('kullanıcı-yazımı kart bekleyen öneri olarak keşif paketine eklenir', () => {
    const userCard = createUserExpansionCard('Rota geçmişini dışa aktarmak istiyorum')!;
    const { project: next, added } = addExpansionCardAsSuggestion(project(), userCard, 'Kullanıcının kendi önerisi');
    assert.equal(added, true);
    const item = openBundle(next).items.find(entry => entry.title === userCard.title);
    assert.ok(item, 'kullanıcı kartı da öneri olarak eklenebilmeli');
    assert.equal(item.status, 'pending');
  });

  it('kullanıcı-yazımı kart kendi nedenini taşır; yerel başlangıç mesajıyla karışmaz', () => {
    const userCard = createUserExpansionCard('Kendi önerim')!;
    const { project: next } = addExpansionCardAsSuggestion(project(), userCard, 'Kullanıcının kendi önerisi');
    const item = openBundle(next).items.find(entry => entry.title === userCard.title);
    assert.ok(item);
    assert.match(item.recommendationReason, /kendi yazdın/i, 'kaydın kendisi kartın kullanıcı kökenli olduğunu söylemeli');
    assert.doesNotMatch(
      item.recommendationReason,
      /yerel başlangıç/i,
      'kullanıcı kartı yerel başlangıç kartıyla aynı mesajı taşımamalı'
    );
  });

  it('kullanıcı-yazımı kartta efor/etki uydurulmaz; alan zorunlu olduğu için yalnız değerlendirilmemiş bir varsayılan taşınır', () => {
    const userCard = createUserExpansionCard('Kendi önerim')!;
    const { project: next } = addExpansionCardAsSuggestion(project(), userCard, 'Kullanıcının kendi önerisi');
    const item = openBundle(next).items.find(entry => entry.title === userCard.title);
    assert.ok(item);
    assert.equal(item.effort, 'medium');
    assert.equal(item.impact, 'medium');
    assert.notEqual(item.recommendationReason, '', 'değerlendirilmediği açıkça yazılmalı');
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

/**
 * BAŞLANGIÇ DURUMUNU ÇAĞIRAN BELİRLER.
 *
 * Ölçülen kusur: "Fikre ekle" düğmesi kartı `pending` yapıyordu. Kullanıcı
 * tıklıyor, sonuç "KARAR BEKLİYOR" oluyor, kartı çözecek "Kabul et" düğmesi
 * 1400 piksel aşağıda duruyordu. Kullanıcı zaten tıklayarak karar verdi;
 * ikinci bir onay adımı istemek dürüstlük değil tören.
 *
 * Ama ayrım servise SABİTLENEMEZ: kullanıcının hiç dokunmadığı, sohbet ya da
 * keşif yolundan gelen öneriler `pending` KALMALI. Aşağıdaki iki test bu
 * ayrımın iki ucunu birden çakılı tutar.
 */
describe('keşif kartının başlangıç durumu', () => {
  it('tıklama yolu: kart kabul edilmiş olarak girer ve fikrin KABUL EDİLENLER listesinde görünür', () => {
    const { project: next, added } = addExpansionCardAsSuggestion(
      project(),
      card,
      'Güven ve gizlilik',
      { status: 'accepted' }
    );
    assert.equal(added, true);
    const item = openBundle(next).items.find(entry => entry.title === card.title);
    assert.ok(item);
    assert.equal(item.status, 'accepted', 'kullanıcının tıklaması kararın kendisidir');

    const view = buildIdeaStateView(next);
    assert.ok(
      view.acceptedCards.some(entry => entry.title === card.title),
      'kabul edilen kart fikrin kabul edilenlerinde görünmeli'
    );
    assert.equal(
      view.pendingCards.some(entry => entry.title === card.title),
      false,
      'aynı kart ayrıca karar bekleyenlerde durmamalı'
    );
  });

  it('sohbet/keşif yolu: durum verilmezse kart KARAR BEKLER (regresyon)', () => {
    const { project: next } = addExpansionCardAsSuggestion(project(), card, 'Güven ve gizlilik');
    const item = openBundle(next).items.find(entry => entry.title === card.title);
    assert.ok(item);
    assert.equal(item.status, 'pending', 'kullanıcının tıklamadığı öneri kabul edilmiş sayılamaz');

    const view = buildIdeaStateView(next);
    assert.ok(view.pendingCards.some(entry => entry.title === card.title));
    assert.equal(view.acceptedCards.some(entry => entry.title === card.title), false);
  });

  it('kabul edilerek eklenen kart ikinci kez eklenemez; neden dürüstçe söylenir', () => {
    const once = addExpansionCardAsSuggestion(project(), card, 'Güven ve gizlilik', { status: 'accepted' });
    const twice = addExpansionCardAsSuggestion(once.project, card, 'Güven ve gizlilik', { status: 'accepted' });
    assert.equal(twice.added, false);
    assert.match(twice.reason, /zaten kabul ettin/i, 'bildirim kartın gerçek durumunu söylemeli');
    assert.doesNotMatch(
      twice.reason,
      /plana geçti/i,
      'kabul edilmiş ama henüz uygulanmamış kart için "plana geçti" demek olmamış bir şeyi bildirmek olurdu'
    );
    assert.equal(twice.project, once.project, 'değişiklik yoksa yeni bir belge sürümü üretilmemeli');
  });

  it('kabul edilen kart geri alınabilir: reddetme yolu bozulmaz', () => {
    const once = addExpansionCardAsSuggestion(project(), card, 'Güven ve gizlilik', { status: 'accepted' });
    const bundle = openBundle(once.project);
    const rejected = updateSuggestionStatus(once.project, bundle.id, bundle.items[0].id, 'rejected');

    const view = buildIdeaStateView(rejected);
    assert.equal(view.acceptedCards.length, 0, 'reddedilen kart kabul edilenlerden düşmeli');
    assert.equal(view.pendingCards.length, 0, 'reddedilmiş bir karar "bekliyor" diye gösterilemez');
    assert.equal(
      openBundle(rejected).items[0].status,
      'rejected',
      'kullanıcı kararını değiştirebilmeli; kayıt yerinde kalır'
    );
  });

  it('"Kararları uygula" kapısı DEĞİŞMEZ: bekleyen kart varsa plana hiçbir şey geçmez', () => {
    // Bir kart tıklamayla (accepted), biri tıklanmadan (pending) girer.
    const first = addExpansionCardAsSuggestion(project(), card, 'Güven ve gizlilik', { status: 'accepted' });
    const second = addExpansionCardAsSuggestion(
      first.project,
      { ...card, id: 'card-2', title: 'Sorulmamış bir öneri' },
      'Güven ve gizlilik'
    );
    const bundle = openBundle(second.project);
    const blocked = applyApprovedChanges(second.project, bundle.id) as ProjectDocumentV5;
    assert.equal(blocked, second.project, 'bekleyen kart varken kapı açılmaz');
    assert.equal(blocked.requirements.length, 0);

    // Bekleyen kart karara bağlanınca aynı kapı, aynı şekilde açılır.
    const pendingItem = bundle.items.find(entry => entry.title === 'Sorulmamış bir öneri')!;
    const decided = updateSuggestionStatus(second.project, bundle.id, pendingItem.id, 'rejected');
    const applied = applyApprovedChanges(decided, bundle.id) as ProjectDocumentV5;
    assert.equal(applied.requirements.length, 1, 'yalnız kabul edilen kart plana geçmeli');
    assert.equal(applied.requirements[0].title, card.title);
  });
});

/**
 * Kart hangi plan bölümünü etkiler? Sabit `['scope']` her kartı yalnız bir
 * kapsam maddesi yapıyordu: kabul edilen bir "MVP adayı" özellik kartı hiçbir
 * zaman gereksinim olmuyordu ve fikir→plan dönüşümü gereksinimleri
 * `confirmedFeatures`'tan ürettiği için orada da yakalanmıyordu.
 */
describe('keşif kartı türüne göre plana işlenir', () => {
  const apply = (kind: ExpansionCard['kind'], title: string) => {
    const once = addExpansionCardAsSuggestion(project(), { ...card, kind, title }, 'Güven ve gizlilik');
    const bundle = selectExpansionBundle(once.project)!;
    const decided = updateSuggestionStatus(once.project, bundle.id, bundle.items[0].id, 'accepted');
    return {
      before: once.project,
      after: applyApprovedChanges(decided, bundle.id) as ProjectDocumentV5,
      item: bundle.items[0]
    };
  };

  it('özellik kartı gereksinim olur ve kapsamda da görünür', () => {
    const { after } = apply('feature', 'Rota geçmişini cihazda tut');
    assert.equal(after.requirements.length, 1, 'kabul edilen özellik gereksinime dönüşmeli');
    assert.equal(after.requirements[0].title, 'Rota geçmişini cihazda tut');
    assert.ok(after.sections.scope.items.some(entry => entry.includes('cihazda')), 'kapsamda da izi kalmalı');
  });

  it('karar kartı karar olur, kapsama sızmaz', () => {
    const { after } = apply('decision', 'Konum iznini ayrı sor');
    assert.equal(after.decisions.length, 1);
    assert.equal(after.requirements.length, 0, 'karar gereksinim üretmemeli');
    assert.equal(after.sections.scope.items.length, 0, 'karar kapsam maddesi olmamalı');
  });

  it('mimari kartı karar defterine ve mimari bölümüne gider', () => {
    const { after } = apply('architecture', 'Veriyi cihazda şifreli sakla');
    assert.equal(after.decisions.length, 1);
    assert.equal(after.sections.scope.items.length, 0);
  });

  it('risk kartı risk olur', () => {
    const { after } = apply('risk', 'Konum verisi sızabilir');
    assert.equal(after.risks.length, 1);
    assert.equal(after.requirements.length, 0);
    assert.equal(after.sections.scope.items.length, 0);
  });

  it('soru kartı plana öğe yazmaz; yeri fikir defteridir', () => {
    const { after } = apply('question', 'Kullanıcı rotayı kiminle paylaşır?');
    assert.equal(after.requirements.length, 0);
    assert.equal(after.decisions.length, 0);
    assert.equal(after.risks.length, 0);
    assert.equal(after.sections.scope.items.length, 0, 'soru bir kapsam maddesi değildir');
    assert.ok(
      (after.ideaDiscussion?.records || []).some(record => record.kind === 'question'),
      'soru fikir defterinde durmalı'
    );
  });

  it('bölüm eşlemesi kartın türünden gelir, çağıranın tahmininden değil', () => {
    const { item } = apply('feature', 'Rota geçmişini cihazda tut');
    assert.deepEqual([...item.affectedSections].sort(), ['requirements', 'scope']);
  });
});
