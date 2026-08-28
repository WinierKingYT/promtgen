import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { analyzeIdea, updateSuggestionStatus } from '../../src/v4/planning-engine.js';
import { addExpansionCardAsSuggestion } from '../../src/v4/application/idea-expansion-intake.js';
import { selectExpansionBundle } from '../../src/v4/application/proposal-bundle-selectors.js';
import {
  generateExpansionCards,
  clearExpansionCache,
  createUserExpansionCard,
  selectVisibleExpansionResult,
  type ExpansionResult
} from '../../src/v4/application/idea-expansion-service.js';
import { getExpansionCategories } from '../../src/v4/idea-expansion/categories.js';
import type { ProjectDocumentV5 } from '../../src/v4/contracts.js';

const project = () => analyzeIdea('Şehir içi bisiklet rotası öneren bir mobil uygulama') as ProjectDocumentV5;

const card = (title: string) => ({
  id: `card-${title}`, title, description: `${title} açıklaması`,
  kind: 'feature', effort: 'low', impact: 'high', mvpHint: 'mvp-adayı'
});

/** Şemadan geçen bir yanıt döndüren sahte sağlayıcı. */
const okProvider = (calls: { count: number }) => ({
  model: 'mock',
  async structured({ schema }: { schema: { parse(value: unknown): unknown } }) {
    calls.count += 1;
    return schema.parse({ cards: [card('A'), card('B'), card('C'), card('D')] });
  }
});

const failingProvider = { model: 'mock', async structured() { throw new Error('SCHEMA_VALIDATION_FAILED'); } };

const aiSettings = { providerId: 'ollama', model: 'qwen2.5:7b', baseUrl: 'http://127.0.0.1:11434', useAiWhenAvailable: true } as any;
const offlineSettings = { providerId: 'offline', model: 'promtgen-local', baseUrl: '', useAiWhenAvailable: true } as any;

describe('generateExpansionCards', () => {
  beforeEach(() => clearExpansionCache());

  it('AI başarılıysa kartları ve local-ai modunu döner', async () => {
    const calls = { count: 0 };
    const result = await generateExpansionCards(project(), 'trust', {
      settings: aiSettings, provider: okProvider(calls)
    });
    assert.equal(result.mode, 'local-ai');
    assert.equal(result.cards.length, 4);
    assert.equal(result.categoryId, 'trust');
    assert.ok(
      result.cards.every(item => item.origin === 'ai'),
      'model çıktısı kartları AI kökenli olarak işaretlenmeli'
    );
  });

  it('sağlayıcı yokken seedTitles ile fallback üretir', async () => {
    const target = project();
    const result = await generateExpansionCards(target, 'trust', { settings: offlineSettings });
    assert.equal(result.mode, 'fallback');
    assert.ok(result.cards.length >= 2, 'başlangıç başlıkları kart olarak sunulmalı');
    assert.ok(result.fallbackReason, 'fallback nedeni bildirilmeli');

    const category = getExpansionCategories(target).find(item => item.id === 'trust');
    assert.ok(category, 'trust kategorisi bulunmalı');
    assert.deepEqual(
      result.cards.map(c => c.title),
      category.seedTitles,
      'fallback kartları yalnız kategorinin kendi seedTitles değerlerinden üretilmeli, uydurulmamalı'
    );

    assert.ok(
      result.cards.every(item => item.origin === 'local-seed'),
      'yerel kartlar kökenini kendi üzerinde taşımalı; tüketici tahmin etmemeli'
    );
    for (const item of result.cards) {
      assert.equal(item.effort, undefined, 'değerlendirilmemiş efor uydurulmamalı');
      assert.equal(item.impact, undefined, 'değerlendirilmemiş etki uydurulmamalı');
      assert.equal(item.mvpHint, undefined, 'değerlendirilmemiş MVP etiketi uydurulmamalı');
    }
  });

  it('AI hata verirse fallback üretir, hata yutulmaz', async () => {
    const result = await generateExpansionCards(project(), 'trust', {
      settings: aiSettings, provider: failingProvider
    });
    assert.equal(result.mode, 'fallback');
    assert.match(result.fallbackReason || '', /SCHEMA_VALIDATION_FAILED/);
  });

  it('bilinmeyen kategori için hata verir', async () => {
    await assert.rejects(
      () => generateExpansionCards(project(), 'olmayan-kategori', { settings: offlineSettings }),
      /kategori/i
    );
  });

  /**
   * Tier 3 (fikre özel, model-üretimi) eksenler getExpansionCategories'in
   * senkron/saf sonucunda hiç yer almaz — bkz. idea-expansion/categories.ts.
   * Board bu yüzden kategoriyi burada açıkça geçirir; aksi hâlde iç arama
   * onu asla bulamaz ve "Bilinmeyen genişletme kategorisi" hatası fırlar.
   */
  it('options.category geçildiğinde senkron listede olmayan (AI ekseni) kategori için de kart üretir', async () => {
    const calls = { count: 0 };
    const aiAxisCategory = {
      id: 'ai.rota-guvenligi',
      label: 'Rota güvenliği',
      hint: 'Rota ne kadar güvenli?',
      seedTitles: []
    };
    const result = await generateExpansionCards(project(), 'ai.rota-guvenligi', {
      settings: aiSettings,
      provider: okProvider(calls),
      category: aiAxisCategory
    });
    assert.equal(result.categoryId, 'ai.rota-guvenligi');
    assert.equal(result.cards.length, 4);
  });

  it('options.category kimliği categoryId ile uyuşmuyorsa yok sayılır ve senkron listeye düşer', async () => {
    const aiAxisCategory = {
      id: 'ai.baska-eksen',
      label: 'Başka eksen',
      hint: 'Başka soru?',
      seedTitles: []
    };
    await assert.rejects(
      () => generateExpansionCards(project(), 'olmayan-kategori', {
        settings: offlineSettings,
        category: aiAxisCategory
      }),
      /kategori/i
    );
  });

  it('aynı kategori ve revision için ikinci çağrıda AI çağrılmaz', async () => {
    const calls = { count: 0 };
    const provider = okProvider(calls);
    const target = project();
    await generateExpansionCards(target, 'trust', { settings: aiSettings, provider });
    await generateExpansionCards(target, 'trust', { settings: aiSettings, provider });
    assert.equal(calls.count, 1, 'önbellek ikinci AI çağrısını engellemeli');
  });

  it('refresh: true önbelleği atlar', async () => {
    const calls = { count: 0 };
    const provider = okProvider(calls);
    const target = project();
    await generateExpansionCards(target, 'trust', { settings: aiSettings, provider });
    await generateExpansionCards(target, 'trust', { settings: aiSettings, provider, refresh: true });
    assert.equal(calls.count, 2);
  });
});

/**
 * Karara bağlanmış bir kart panoda yeniden aday olarak görünmemeli. İstem
 * reddedilenleri bağlamda görüyor ama bu modelin uymasına bağlı bir söz;
 * başlangıç kartları ise sabit başlıklar olduğu için her açılışta aynen geri
 * geliyordu. Kullanıcı kartı ekleyemeyeceği hâlde "Fikre ekle" düğmesini
 * görüyor, bastığında "daha önce reddettin" uyarısı alıyordu.
 */
describe('karara bağlanmış kartlar panoda tekrar gösterilmez', () => {
  beforeEach(() => clearExpansionCache());

  const decidedProject = (title: string, status: 'accepted' | 'rejected' | 'deferred') => {
    const once = addExpansionCardAsSuggestion(
      project(),
      { id: 'x', title, description: `${title} açıklaması`, kind: 'feature', origin: 'ai' },
      'Güven ve gizlilik'
    );
    const bundle = selectExpansionBundle(once.project)!;
    return updateSuggestionStatus(once.project, bundle.id, bundle.items[0].id, status) as ProjectDocumentV5;
  };

  for (const status of ['accepted', 'rejected', 'deferred'] as const) {
    it(`${status} kart AI sonucundan düşürülür`, async () => {
      const calls = { count: 0 };
      const result = await generateExpansionCards(decidedProject('B', status), 'trust', {
        settings: aiSettings, provider: okProvider(calls)
      });
      assert.deepEqual(result.cards.map(item => item.title), ['A', 'C', 'D']);
      assert.equal(result.hiddenCount, 1, 'kaç kartın gizlendiği çağırana bildirilmeli');
    });
  }

  it('başlangıç kartları da düşürülür: sabit başlıklar her açılışta geri gelmemeli', async () => {
    const category = getExpansionCategories(project()).find(item => item.id === 'trust')!;
    const seedTitle = category.seedTitles[0];
    const result = await generateExpansionCards(decidedProject(seedTitle, 'rejected'), 'trust', {
      settings: offlineSettings, provider: failingProvider
    });
    assert.equal(result.mode, 'fallback');
    assert.ok(!result.cards.some(item => item.title === seedTitle), 'reddedilen başlangıç kartı geri gelmemeli');
    assert.equal(result.hiddenCount, 1);
  });

  it('karar verilmemişse hiçbir kart düşürülmez', async () => {
    const calls = { count: 0 };
    const result = await generateExpansionCards(project(), 'trust', {
      settings: aiSettings, provider: okProvider(calls)
    });
    assert.equal(result.cards.length, 4);
    assert.equal(result.hiddenCount, 0);
  });
});

/**
 * Kullanıcının panoya serbest metinle eklediği öneri kartı. AI kartlarının
 * aksine bir değerlendirme (effort/impact/mvpHint) taşımaz; kullanıcı burada
 * hiçbir yargı vermedi.
 */
describe('createUserExpansionCard', () => {
  it('kırpılmış başlıkla origin=user bir kart üretir', () => {
    const card = createUserExpansionCard('  Kendi fikrim: rota geçmişini dışa aktar  ');
    assert.ok(card);
    assert.equal(card?.title, 'Kendi fikrim: rota geçmişini dışa aktar');
    assert.equal(card?.description, 'Kendi fikrim: rota geçmişini dışa aktar');
    assert.equal(card?.origin, 'user');
    assert.equal(card?.kind, 'feature');
  });

  it('kimliği AI (ai.) ve yerel başlangıç (seed-) önekleriyle asla çakışmaz', () => {
    const card = createUserExpansionCard('Yeni bir öneri');
    assert.ok(card?.id.startsWith('user.'));
    assert.ok(!card?.id.startsWith('ai.'));
    assert.ok(!card?.id.startsWith('seed-'));
  });

  it('boş veya yalnız boşluk girişte null döner', () => {
    assert.equal(createUserExpansionCard(''), null);
    assert.equal(createUserExpansionCard('   '), null);
  });

  it('değerlendirme alanları (effort/impact/mvpHint) hiç yazılmaz, uydurulmaz', () => {
    const card = createUserExpansionCard('Bir öneri');
    assert.equal(card?.effort, undefined);
    assert.equal(card?.impact, undefined);
    assert.equal(card?.mvpHint, undefined);
  });

  it('aşırı uzun girişi makul bir uzunlukta kırpar', () => {
    const huge = 'a'.repeat(5000);
    const card = createUserExpansionCard(huge);
    assert.ok((card?.title.length || 0) <= 500);
  });
});

describe('selectVisibleExpansionResult', () => {
  const resultFor = (categoryId: string): ExpansionResult => ({
    categoryId,
    cards: [{ id: `${categoryId}-1`, title: `${categoryId} kartı`, description: '…', kind: 'feature', origin: 'ai' }],
    mode: 'local-ai',
    fallbackReason: null
  });

  it('etkin kategoriye ait sonucu gösterir', () => {
    const result = resultFor('trust');
    assert.equal(selectVisibleExpansionResult('trust', result), result);
  });

  it('geç gelen başka kategorinin sonucunu göstermez', () => {
    // Yavaş "trust" isteği, önbellekli "money" seçildikten sonra çözülürse
    // kartlar yanlış başlığın altına düşerdi; "Fikre ekle" de yanlış kategori
    // etiketini fingerprint'e ve tartışma kaydına yazardı.
    assert.equal(selectVisibleExpansionResult('money', resultFor('trust')), null);
  });

  it('hiçbir kategori seçili değilken sonuç göstermez', () => {
    assert.equal(selectVisibleExpansionResult(null, resultFor('trust')), null);
    assert.equal(selectVisibleExpansionResult('trust', null), null);
  });
});

/**
 * Parti İÇİ tekrar elemesi. `hideDecidedCards` bunu yakalayamaz: o yalnız
 * PROJEDE zaten karara bağlanmış başlıkları eler, partinin kendi içine
 * bakmaz. Başlıklar canlı ölçümden birebir alınmıştır (qwen2.5:7b, fikir =
 * "unityde bir at sistemi yapmak istiyorum multiplayer olucak"): 8 kartın
 * 4'ü aynı mekanizmanın parantezle çoğaltılmış varyasyonuydu.
 */
describe('aynı partideki tekrar kartları elenir', () => {
  beforeEach(() => clearExpansionCache());

  const horseCard = (title: string, description: string) => ({
    id: `card-${title}`, title, description,
    kind: 'feature', effort: 'low', impact: 'high', mvpHint: 'mvp-adayı'
  });

  const duplicateBatch = [
    horseCard('At Etkileşimleri (Kafa Saldırısı)', 'Oyuncular atın kafasıyla nesnelere vurarak onları itebilir.'),
    horseCard('At Etkileşimleri (Sürükleme)', 'Oyuncular atı kullanarak nesneleri sürükleyebilir.'),
    horseCard('At Etkileşimleri (Toplama)', 'Oyuncular atı kullanarak nesneleri toplayabilir.'),
    horseCard('Sesli Sohbet', 'Yakındaki oyuncular birbirini mesafeye bağlı olarak duyabilmeli.')
  ];

  const duplicateProvider = {
    model: 'mock',
    async structured({ schema }: { schema: { parse(value: unknown): unknown } }) {
      return schema.parse({ cards: duplicateBatch });
    }
  };

  it('varyasyon kartları tek karta iner, farklı kart korunur', async () => {
    const result = await generateExpansionCards(project(), 'trust', {
      settings: aiSettings, provider: duplicateProvider
    });
    assert.deepEqual(result.cards.map(item => item.title), [
      'At Etkileşimleri (Kafa Saldırısı)',
      'Sesli Sohbet'
    ]);
    assert.equal(result.duplicateCount, 2, 'parti içi tekrar sayısı ayrı bildirilmeli');
    assert.equal(result.hiddenCount, 0, 'tekrar sayısı "karara bağlanmış" sayacına KARIŞMAMALI');
  });

  it('eleme karara bağlanmışlar düşürüldükten SONRA çalışır', async () => {
    // İlk varyasyon zaten reddedilmişse temsilci kart bir SONRAKİ görünür
    // varyasyon olur; sıra ters olsaydı görünür hiçbir kart kalmayabilirdi.
    const once = addExpansionCardAsSuggestion(
      project(),
      { id: 'x', title: 'At Etkileşimleri (Kafa Saldırısı)', description: '…', kind: 'feature', origin: 'ai' },
      'Güven ve gizlilik'
    );
    const bundle = selectExpansionBundle(once.project)!;
    const decided = updateSuggestionStatus(once.project, bundle.id, bundle.items[0].id, 'rejected') as ProjectDocumentV5;

    const result = await generateExpansionCards(decided, 'trust', {
      settings: aiSettings, provider: duplicateProvider
    });
    assert.deepEqual(result.cards.map(item => item.title), [
      'At Etkileşimleri (Sürükleme)',
      'Sesli Sohbet'
    ]);
    assert.equal(result.hiddenCount, 1);
    assert.equal(result.duplicateCount, 1);
  });

  /**
   * Başlangıç kartlarının açıklaması kategori ipucundan üretilir ve HEPSİ
   * BİREBİR AYNIDIR; eleme bu yola uygulansaydı elle seçilmiş başlıklar
   * birbirinin tekrarı sanılıp silinirdi. Yanlış eleme gerçek bir öneriyi
   * gizler — bu yüzden fallback yolu dokunulmadan bırakıldı.
   */
  it('başlangıç (fallback) kartlarına eleme uygulanmaz', async () => {
    const category = getExpansionCategories(project()).find(item => item.id === 'trust')!;
    const result = await generateExpansionCards(project(), 'trust', {
      settings: offlineSettings, provider: failingProvider
    });
    assert.equal(result.mode, 'fallback');
    assert.equal(result.cards.length, category.seedTitles.length, 'elle seçilmiş başlıkların hepsi kalmalı');
    assert.equal(result.duplicateCount, 0);
  });
});

/**
 * ELEME SONRASI TAMAMLAMA (top-up).
 *
 * Tekrar elemesi kart sayısını düşürüyordu: kullanıcı "3 öneri tekrar
 * ediyorsa onu önüme çıkartma ama yerine başka öneriler ver" dedi. Elenen
 * kartların YERİNE ikinci bir turda GERÇEKTEN FARKLI kartlar istenir.
 *
 * Tamamlama turu modele "N tane daha üret, sayıyı tamamla" DEMEZ — bu, az
 * önce kaldırılan kota hatasının geri gelmesi olurdu. Bunun yerine elde olan
 * başlıklar KISIT olarak verilir; model yeni bir şey bulamıyorsa az kart
 * döndürmesi doğru cevaptır ve sonuç sessizce olduğu gibi kalır.
 */
describe('tekrar elendikten sonra tamamlama turu', () => {
  beforeEach(() => clearExpansionCache());

  const anyCard = (title: string, description: string) => ({
    id: `card-${title}`, title, description,
    kind: 'feature', effort: 'low', impact: 'high', mvpHint: 'mvp-adayı'
  });

  /**
   * Birbirinden SÖZLÜKSEL olarak tamamen ayrı kartlar. Eleme ölçütü kelime
   * örtüşmesine bakar; ortak kelime bırakmayan bu üçlüler yanlışlıkla
   * birbirinin tekrarı sayılmaz, böylece test yalnız tamamlama turunu ölçer.
   */
  const VOCAB = [
    'zeytin', 'pencere', 'kaplumbağa', 'martı', 'fırın', 'denizaltı',
    'kanyon', 'portakal', 'çadır', 'fener', 'buzdolabı', 'saksafon',
    'yelkovan', 'kestane', 'turnike', 'manolya', 'iskele', 'pusula',
    'kavanoz', 'tırpan', 'lokomotif', 'şemsiye', 'ahtapot', 'vitrin',
    'kükürt', 'ipek', 'nane', 'rüzgargülü', 'oltacı', 'bambu',
    'çınar', 'defne', 'ebru', 'filika', 'gonca', 'hamak',
    'ıhlamur', 'jeoloji', 'kütük', 'limon', 'mercan', 'nilüfer',
    'obruk', 'papatya', 'rende', 'sarnıç', 'takoz', 'uçurtma',
    'vadi', 'yakut', 'zümrüt', 'abaküs', 'böcek', 'ceviz'
  ];

  /** VOCAB'in `index` numaralı üçlüsünden kart üretir; üçlüler kesişmez. */
  const distinctCard = (index: number) => {
    const [a, b, c] = VOCAB.slice(index * 3, index * 3 + 3);
    return anyCard(a, `${a} ${b} ${c}`);
  };

  const distinctCards = (from: number, count: number) =>
    Array.from({ length: count }, (_unused, offset) => distinctCard(from + offset));

  /** Canlı ölçümden alınan varyasyon partisi: dört kart, ikisi elenir. */
  const duplicateBatch = [
    anyCard('At Etkileşimleri (Kafa Saldırısı)', 'Oyuncular atın kafasıyla nesnelere vurarak onları itebilir.'),
    anyCard('At Etkileşimleri (Sürükleme)', 'Oyuncular atı kullanarak nesneleri sürükleyebilir.'),
    anyCard('At Etkileşimleri (Toplama)', 'Oyuncular atı kullanarak nesneleri toplayabilir.'),
    anyCard('Sesli Sohbet', 'Yakındaki oyuncular birbirini mesafeye bağlı olarak duyabilmeli.')
  ];

  /**
   * Çağrı sırasına göre farklı parti döndüren sahte sağlayıcı; istem metnini
   * de kaydeder. Bir tur `Error` ise o turda fırlatır. Orkestratörün onarım
   * denemeleri yüzünden aynı tur birden çok kez çağrılabilir; bu yüzden TUR
   * sayacı çağrı sayısından ayrı tutulur.
   */
  const scriptedProvider = (
    rounds: Array<Array<Record<string, unknown>> | Error>,
    log: { prompts: string[]; rounds: number }
  ) => ({
    model: 'mock',
    async structured({ system, schema }: { system: string; schema: { parse(value: unknown): unknown } }) {
      log.prompts.push(system);
      // Tamamlama istemi elde olan başlıkları taşır; tur ayrımı buna bakar.
      const index = /ZATEN ELİMDE/.test(system) ? 1 : 0;
      log.rounds = Math.max(log.rounds, index + 1);
      const round = rounds[Math.min(index, rounds.length - 1)];
      if (round instanceof Error) throw round;
      return schema.parse({ cards: round });
    }
  });

  it('tekrar elendiğinde tamamlama turu çalışır ve yeni kartlar eklenir', async () => {
    const log = { prompts: [] as string[], rounds: 0 };
    const result = await generateExpansionCards(project(), 'trust', {
      settings: aiSettings,
      provider: scriptedProvider([duplicateBatch, distinctCards(0, 3)], log)
    });

    assert.equal(log.rounds, 2, 'tekrar elendiğinde bir tamamlama turu çalışmalı');
    assert.deepEqual(result.cards.map(item => item.title), [
      'At Etkileşimleri (Kafa Saldırısı)',
      'Sesli Sohbet',
      'zeytin',
      'martı',
      'kanyon'
    ], 'elenen kartların yerine gerçekten farklı kartlar gelmeli');
    assert.ok(result.cards.every(item => item.origin === 'ai'), 'tamamlama kartları da AI kökenli işaretlenmeli');
    assert.equal(result.mode, 'local-ai');
    assert.equal(result.fallbackReason, null);
  });

  it('tekrar YOKKEN tamamlama turu hiç çalışmaz', async () => {
    const log = { prompts: [] as string[], rounds: 0 };
    const result = await generateExpansionCards(project(), 'trust', {
      settings: aiSettings,
      provider: scriptedProvider([distinctCards(0, 4), distinctCards(4, 3)], log)
    });
    assert.equal(log.rounds, 1, 'gereksiz ikinci çağrı kullanıcıyı ~25 saniye daha bekletirdi');
    assert.equal(result.cards.length, 4);
    assert.equal(result.duplicateCount, 0);
  });

  it('tamamlama turu hata verirse ilk parti AYNEN korunur', async () => {
    const log = { prompts: [] as string[], rounds: 0 };
    const result = await generateExpansionCards(project(), 'trust', {
      settings: aiSettings,
      provider: scriptedProvider([duplicateBatch, new Error('SCHEMA_VALIDATION_FAILED')], log)
    });
    assert.equal(log.rounds, 2, 'tamamlama denenmiş olmalı');
    assert.deepEqual(result.cards.map(item => item.title), [
      'At Etkileşimleri (Kafa Saldırısı)',
      'Sesli Sohbet'
    ], 'tamamlama başarısızsa ilk partinin geçerli kartları kaybolmamalı');
    assert.equal(result.mode, 'local-ai', 'ilk çağrının modu korunmalı');
    assert.equal(result.fallbackReason, null, 'tamamlama hatası kullanıcıya fallback gibi gösterilmemeli');
  });

  it('tamamlama turu yalnız elde olan kartları döndürürse sessizce durulur', async () => {
    const log = { prompts: [] as string[], rounds: 0 };
    const repeatBatch = [
      anyCard('At Etkileşimleri (Sürükleme)', 'Oyuncular atı kullanarak nesneleri sürükleyebilir.'),
      anyCard('At Etkileşimleri (Toplama)', 'Oyuncular atı kullanarak nesneleri toplayabilir.'),
      anyCard('Sesli Sohbet (tekrar)', 'Yakındaki oyuncular birbirini mesafeye bağlı olarak duyabilmeli.')
    ];
    const result = await generateExpansionCards(project(), 'trust', {
      settings: aiSettings,
      provider: scriptedProvider([duplicateBatch, repeatBatch], log)
    });
    assert.equal(log.rounds, 2, 'en çok BİR tamamlama turu; üçüncü tur olmamalı');
    assert.deepEqual(result.cards.map(item => item.title), [
      'At Etkileşimleri (Kafa Saldırısı)',
      'Sesli Sohbet'
    ], 'zaten elde olan kartlar ikinci kez eklenmemeli');
  });

  it('birleşik sonuç 10 kartı aşmaz', async () => {
    const log = { prompts: [] as string[], rounds: 0 };
    const firstBatch = [...duplicateBatch.slice(0, 3), ...distinctCards(0, 7)];
    const result = await generateExpansionCards(project(), 'trust', {
      settings: aiSettings,
      provider: scriptedProvider([firstBatch, distinctCards(7, 10)], log)
    });
    assert.equal(log.rounds, 2);
    assert.equal(result.cards.length, 10, 'şema üst sınırıyla tutarlı kalmalı');
    assert.equal(new Set(result.cards.map(item => item.title)).size, 10);
  });

  it('elde olan başlıklar tamamlama istemine kısıt olarak yazılır', async () => {
    const log = { prompts: [] as string[], rounds: 0 };
    await generateExpansionCards(project(), 'trust', {
      settings: aiSettings,
      provider: scriptedProvider([duplicateBatch, distinctCards(0, 3)], log)
    });
    const topUpPrompt = log.prompts.find(prompt => prompt.includes('ZATEN ELİMDE'));
    assert.ok(topUpPrompt, 'tamamlama istemi elde olan başlıkları bildirmeli');
    assert.match(String(topUpPrompt), /At Etkileşimleri \(Kafa Saldırısı\)/);
    assert.match(String(topUpPrompt), /Sesli Sohbet/);
    assert.doesNotMatch(String(topUpPrompt), /tane daha/, 'tamamlama turu bir KOTA dayatmamalı');
    assert.ok(!log.prompts[0].includes('ZATEN ELİMDE'), 'ilk tur kısıtsız çalışmalı');
  });

  it('nihai birleşik sonuç önbelleğe yazılır; ikinci çağrı AI çalıştırmaz', async () => {
    const log = { prompts: [] as string[], rounds: 0 };
    const provider = scriptedProvider([duplicateBatch, distinctCards(0, 3)], log);
    const target = project();
    const first = await generateExpansionCards(target, 'trust', { settings: aiSettings, provider });
    const promptCount = log.prompts.length;
    const second = await generateExpansionCards(target, 'trust', { settings: aiSettings, provider });
    assert.equal(log.prompts.length, promptCount, 'önbellek tamamlama turunu da kapsamalı');
    assert.deepEqual(second.cards.map(item => item.title), first.cards.map(item => item.title));
    assert.equal(second.cards.length, 5);
  });

  /** Fallback yolunda AI yoktur; tamamlama turu orada ARANMAZ. */
  it('fallback yolunda tamamlama turu denenmez', async () => {
    const log = { prompts: [] as string[], rounds: 0 };
    const result = await generateExpansionCards(project(), 'trust', {
      settings: aiSettings,
      provider: scriptedProvider([new Error('SCHEMA_VALIDATION_FAILED')], log)
    });
    assert.equal(result.mode, 'fallback');
    assert.equal(log.rounds, 1, 'ilk çağrı düştüyse tamamlama turu hiç başlamamalı');
  });
});
