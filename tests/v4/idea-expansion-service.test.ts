import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { analyzeIdea, updateSuggestionStatus } from '../../src/v4/planning-engine.js';
import { addExpansionCardAsSuggestion } from '../../src/v4/application/idea-expansion-intake.js';
import { selectExpansionBundle } from '../../src/v4/application/proposal-bundle-selectors.js';
import {
  generateExpansionCards,
  clearExpansionCache,
  createUserExpansionCard,
  expansionGenerationKey,
  selectVisibleExpansionResult,
  type ExpansionResult
} from '../../src/v4/application/idea-expansion-service.js';
import { getExpansionCategories } from '../../src/v4/idea-expansion/categories.js';
import type { ConceptSummary, ProjectDocumentV5 } from '../../src/v4/contracts.js';

const project = () => analyzeIdea('Şehir içi bisiklet rotası öneren bir mobil uygulama') as ProjectDocumentV5;

/**
 * Zeminli bir temel taşıyan proje: `targetUser` kullanıcının KENDİ sözüdür
 * (`source: 'idea'`), geri kalanı modelin varsayımıdır. Anahtar testleri bu
 * ayrımı kullanır — bağlama yalnız zeminli alanlar girer (bkz.
 * context-builder.ts `buildFoundationContext`).
 */
function groundedProject(targetUser: string): ProjectDocumentV5 {
  const target = project();
  const summary: ConceptSummary = {
    summary: 'Şehir içi rota öneren bir mobil uygulama.',
    targetUser,
    problemStatement: 'Güvenli rota bilgisi dağınık.',
    currentAlternative: '',
    desiredOutcome: '',
    interpretationConfidence: 0.5,
    confidenceRationale: [],
    confirmedFeatures: [],
    outOfScope: [],
    technicalApproaches: [],
    openQuestions: [],
    knownRisks: [],
    firstReleaseTarget: '',
    userConfirmed: false,
    foundationGrounding: {
      summary: { source: 'assumption' },
      problemStatement: { source: 'assumption' },
      targetUser: { source: 'idea' },
      currentAlternative: { source: 'unknown', reason: 'Fikirde geçmiyor.' },
      desiredOutcome: { source: 'assumption' },
      firstReleaseTarget: { source: 'assumption' }
    }
  };
  target.ideaLabSession = {
    ...(target.ideaLabSession || {
      status: 'active' as const,
      approaches: [],
      ideaNotes: [],
      candidateDecisions: [],
      candidateRisks: []
    }),
    conceptSummary: summary
  };
  return target;
}

const card = (title: string) => ({
  id: `card-${title}`, title, description: `${title} açıklaması`,
  kind: 'feature', effort: 'low', impact: 'high', deliveryHorizon: 'core'
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
      assert.equal(item.deliveryHorizon, undefined, 'değerlendirilmemiş teslim sırası uydurulmamalı');
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
 * aksine bir değerlendirme (effort/impact/deliveryHorizon) taşımaz; kullanıcı burada
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

  it('değerlendirme alanları (effort/impact/deliveryHorizon) hiç yazılmaz, uydurulmaz', () => {
    const card = createUserExpansionCard('Bir öneri');
    assert.equal(card?.effort, undefined);
    assert.equal(card?.impact, undefined);
    assert.equal(card?.deliveryHorizon, undefined);
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
    kind: 'feature', effort: 'low', impact: 'high', deliveryHorizon: 'core'
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
    kind: 'feature', effort: 'low', impact: 'high', deliveryHorizon: 'core'
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

/**
 * EMİR KİPİ (TON) ELEMESİ.
 *
 * Canlı ölçümde kartlar FİKİR değil GÖREV gibi yazılıyordu: "Oyuncuların
 * atlarına etkileşim kurabilecek araçlar oluşturun." İstem düzeltildi
 * (bkz. ai/tasks/idea-expansion.ts) ama istem bir SÖZDÜR; bu oturumda dört
 * kez model isteme uymadı. Mekanik denetim
 * `application/expansion-card-tone.ts`tedir.
 *
 * PARTİ REDDEDİLMEZ. 7B modelde parti reddi çoğu turda maxRepairAttempts'i
 * tüketip başlangıç kartlarına düşürür ve ürün DAHA KÖTÜ olur; bu yüzden
 * kart TEK TEK elenir ve zaten var olan tamamlama turu devreye girer.
 */
describe('emir kipiyle yazılmış kartların elenmesi', () => {
  beforeEach(() => clearExpansionCache());

  const toneCard = (title: string, description: string) => ({
    id: `card-${title}`, title, description,
    kind: 'feature', effort: 'low', impact: 'high', deliveryHorizon: 'core'
  });

  /** Birbirinden sözlüksel olarak ayrı meşru kartlar; eleme onlara dokunmamalı. */
  const legitBatch = [
    toneCard('At dayanıklılığı', 'At koştukça yorulur, dinlenmesi gerekir.'),
    toneCard('Görünürlük', 'Oyuncular birbirinin atını görebilir.'),
    toneCard('Ağ eşitlemesi', 'Atın hareketi ağ üzerinden eşitlenir.')
  ];

  const fresh = [
    toneCard('Eyer ve envanter', 'Eyerde taşınan eşyalar ayrı bir çantada durur.'),
    toneCard('Uzaktan çağırma', 'Islıkla çağrılan hayvan sahibine yaklaşır.'),
    toneCard('Nal bakımı', 'Zeminin sertliği nalların ömrünü kısaltır.')
  ];

  const rounded = (
    rounds: Array<Array<Record<string, unknown>> | Error>,
    log: { prompts: string[]; rounds: number }
  ) => ({
    model: 'mock',
    async structured({ system, schema }: { system: string; schema: { parse(value: unknown): unknown } }) {
      log.prompts.push(system);
      const index = /ZATEN ELİMDE/.test(system) ? 1 : 0;
      log.rounds = Math.max(log.rounds, index + 1);
      const round = rounds[Math.min(index, rounds.length - 1)];
      if (round instanceof Error) throw round;
      return schema.parse({ cards: round });
    }
  });

  it('emir kipli kart TEK TEK elenir; parti reddedilmez, yedeğe düşülmez', async () => {
    const log = { prompts: [] as string[], rounds: 0 };
    const batch = [
      ...legitBatch,
      toneCard('Etkileşim araçları', 'Oyuncuların atlarına etkileşim kurabilecek araçlar oluşturun.')
    ];
    const result = await generateExpansionCards(project(), 'trust', {
      settings: aiSettings, provider: rounded([batch, batch], log)
    });
    assert.deepEqual(result.cards.map(item => item.title), legitBatch.map(item => item.title));
    assert.equal(result.commandToneCount, 1);
    assert.equal(result.mode, 'local-ai', 'ton ihlali partiyi düşürmemeli');
    assert.equal(result.fallbackReason, null);
  });

  it('ölçülen dört emir kipli kartın hepsi elenir, meşru kart kalır', async () => {
    const log = { prompts: [] as string[], rounds: 0 };
    const batch = [
      toneCard('Yarış şablonları', 'At yarışı için farklı şablonları oluşturun. Örneğin, klasik yarış, uzun mesafe yarışı ve hız yarışı gibi.'),
      toneCard('Zamanlayıcılar', 'At yarışlarının akışını ve zamanlamasını kontrol edecek zamanlayıcılar ve akış kontrol mekanizmaları oluşturun.'),
      toneCard('Etkileşim araçları', 'Oyuncuların atlarına etkileşim kurabilecek araçlar oluşturun.'),
      toneCard('Koordineli hareket', 'Atlar arasında koordineli hareketler oluşturun.'),
      legitBatch[0]
    ];
    const result = await generateExpansionCards(project(), 'trust', {
      settings: aiSettings, provider: rounded([batch, batch], log)
    });
    assert.deepEqual(result.cards.map(item => item.title), ['At dayanıklılığı']);
    assert.equal(result.commandToneCount, 4);
  });

  it('ton elemesi tamamlama turunu tetikler', async () => {
    const log = { prompts: [] as string[], rounds: 0 };
    const batch = [
      ...legitBatch,
      toneCard('Koordineli hareket', 'Atlar arasında koordineli hareketler oluşturun.')
    ];
    const result = await generateExpansionCards(project(), 'trust', {
      settings: aiSettings, provider: rounded([batch, fresh], log)
    });
    assert.equal(log.rounds, 2, 'eleme kart sayısını düşürdü; tamamlama turu çalışmalı');
    assert.deepEqual(result.cards.map(item => item.title), [
      ...legitBatch.map(item => item.title),
      ...fresh.map(item => item.title)
    ]);
    assert.ok(result.cards.every(item => item.origin === 'ai'));
  });

  it('tamamlama turundaki emir kipli kartlar da elenir', async () => {
    const log = { prompts: [] as string[], rounds: 0 };
    const batch = [
      ...legitBatch,
      toneCard('Zamanlayıcılar', 'At yarışlarının akışını ve zamanlamasını kontrol edecek zamanlayıcılar ve akış kontrol mekanizmaları oluşturun.')
    ];
    const topUp = [
      fresh[0],
      fresh[1],
      toneCard('Yarış şablonları', 'At yarışı için farklı şablonları oluşturun.')
    ];
    const result = await generateExpansionCards(project(), 'trust', {
      settings: aiSettings, provider: rounded([batch, topUp], log)
    });
    assert.deepEqual(result.cards.map(item => item.title), [
      ...legitBatch.map(item => item.title),
      'Eyer ve envanter',
      'Uzaktan çağırma'
    ], 'ikinci turun emir kipli kartı da elenmeli');
  });

  it('ton sayacı "senin kararın" ve "model tekrarı" sayaçlarına KARIŞMAZ', async () => {
    const log = { prompts: [] as string[], rounds: 0 };
    const batch = [
      ...legitBatch,
      toneCard('Koordineli hareket', 'Atlar arasında koordineli hareketler oluşturun.')
    ];
    const result = await generateExpansionCards(project(), 'trust', {
      settings: aiSettings, provider: rounded([batch, batch], log)
    });
    assert.equal(result.commandToneCount, 1);
    assert.equal(result.hiddenCount, 0);
    assert.equal(result.duplicateCount, 0);
  });

  it('emir kipi yokken hiçbir şey elenmez ve tamamlama turu çalışmaz', async () => {
    const log = { prompts: [] as string[], rounds: 0 };
    const result = await generateExpansionCards(project(), 'trust', {
      settings: aiSettings, provider: rounded([[...legitBatch, fresh[0]], fresh], log)
    });
    assert.equal(log.rounds, 1);
    assert.equal(result.commandToneCount, 0);
    assert.equal(result.cards.length, 4);
  });

  /**
   * SIRA: ton elemesi tekrar elemesinden ÖNCE çalışır. İki kart birbirinin
   * varyasyonuysa ve ilki emir kipliyse, ters sırada temsilci olarak emir
   * kipli kart tutulur, meşru varyasyon onunla birlikte düşer ve ARDINDAN
   * temsilci de elenir: kullanıcı İKİSİNİ birden kaybeder.
   */
  it('ton elemesi tekrar elemesinden ÖNCE çalışır; meşru varyasyon hayatta kalır', async () => {
    const log = { prompts: [] as string[], rounds: 0 };
    const batch = [
      toneCard('At etkileşimleri (Sürükleme)', 'Oyuncular atı kullanarak nesneleri sürükleyebilsin diye bir mekanizma oluşturun.'),
      toneCard('At etkileşimleri (Toplama)', 'Oyuncular atı kullanarak nesneleri toplayabilir.'),
      legitBatch[0]
    ];
    const result = await generateExpansionCards(project(), 'trust', {
      settings: aiSettings, provider: rounded([batch, batch], log)
    });
    assert.ok(
      result.cards.some(item => item.title === 'At etkileşimleri (Toplama)'),
      'meşru varyasyon kartı kaybolmamalı'
    );
    assert.equal(result.commandToneCount, 1);
  });

  /**
   * Fallback yolunda AI yoktur: başlangıç başlıkları sözlükten gelir ve
   * emir kipiyle yazılmaz. Eleme oraya UYGULANMAZ — yanlış eleme elle
   * seçilmiş bir başlığı kullanıcıdan gizlerdi.
   */
  it('başlangıç (fallback) kartlarına ton elemesi uygulanmaz', async () => {
    const category = getExpansionCategories(project()).find(item => item.id === 'trust')!;
    const result = await generateExpansionCards(project(), 'trust', {
      settings: offlineSettings, provider: failingProvider
    });
    assert.equal(result.mode, 'fallback');
    assert.equal(result.cards.length, category.seedTitles.length);
    assert.equal(result.commandToneCount, 0);
  });
});

/**
 * Uçuştaki bir üretim iptal edildiğinde ortada bir SONUÇ yoktur: ne AI
 * kartları ne de "AI bağlı değil" anlamına gelen yedek kartlar. Arka plan
 * doldurma fikir değişince uçuştaki işi iptal ettiği için (bkz.
 * expansion-prefetch.ts) bu yol artık her oturumda yürünüyor.
 */
describe('iptal edilen üretim', () => {
  beforeEach(() => clearExpansionCache());

  const hangingProvider = {
    model: 'mock',
    async structured({ signal }: { signal?: AbortSignal }) {
      return new Promise<never>((_resolve, reject) => {
        if (signal?.aborted) {
          reject(new Error('AbortError'));
          return;
        }
        signal?.addEventListener('abort', () => reject(new Error('AbortError')));
      });
    }
  } as any;

  it('iptal hata olarak yükselir; yedek kartlara DÜŞÜLMEZ', async () => {
    const controller = new AbortController();
    const pending = generateExpansionCards(project(), 'trust', {
      settings: aiSettings, provider: hangingProvider, signal: controller.signal
    });
    controller.abort();
    await assert.rejects(
      () => pending,
      'iptal edilen istek yedek kart üretmemeli; çağıran ekrana hiçbir şey yazmamalı'
    );
  });

  it('iptal edilen istek önbelleğe HİÇBİR ŞEY yazmaz', async () => {
    const target = project();
    const controller = new AbortController();
    const pending = generateExpansionCards(target, 'trust', {
      settings: aiSettings, provider: hangingProvider, signal: controller.signal
    });
    controller.abort();
    await pending.catch(() => {});

    // Aynı anahtar için ikinci çağrı gerçekten yeniden üretmeli: önbellekte
    // iptalden kalma bir yedek girdi bulursa AI'ı hiç çalıştırmazdı.
    const calls = { count: 0 };
    const result = await generateExpansionCards(target, 'trust', {
      settings: aiSettings, provider: okProvider(calls)
    });
    assert.equal(calls.count, 1, 'iptal önbelleğe girdi bırakmamalı');
    assert.equal(result.mode, 'local-ai');
  });
});


/**
 * Sınır ve FIFO KALDI, gerekçesi güncellendi. Anahtar artık her
 * kalıcılaştırmada değil YALNIZ fikir gerçekten değişince kayıyor; birikimi
 * üreten şey de o. Kullanıcı fikir metnini her düzelttiğinde eski anahtara
 * bir daha hiç bakılmaz ve arka plan doldurma her fikir sürümü için ~6 giriş
 * yazar — sınır bu ölü ağırlık içindir.
 *
 * Testler bilerek fikir METNİNİ değiştirir: `documentRevision` artık yeni bir
 * giriş açmadığı için onunla ölçmek sınırı hiç sınamazdı.
 */
describe('önbellek büyümesi', () => {
  beforeEach(() => clearExpansionCache());

  const withIdea = (base: ProjectDocumentV5, version: number) =>
    ({
      ...base,
      identity: { ...base.identity, originalIdea: `Bisiklet rotası uygulaması — sürüm ${version}` }
    } as ProjectDocumentV5);

  it('çok eski fikir sürümünün girdisi düşürülür; önbellek sınırsız büyümez', async () => {
    const base = project();
    const calls = { count: 0 };
    await generateExpansionCards(withIdea(base, 1), 'trust', {
      settings: aiSettings, provider: okProvider(calls)
    });
    assert.equal(calls.count, 1);

    for (let version = 2; version <= 200; version += 1) {
      await generateExpansionCards(withIdea(base, version), 'trust', {
        settings: aiSettings, provider: okProvider(calls)
      });
    }

    const before = calls.count;
    await generateExpansionCards(withIdea(base, 1), 'trust', {
      settings: aiSettings, provider: okProvider(calls)
    });
    assert.equal(before + 1, calls.count, 'çok eski girdi önbellekten düşmüş olmalı');
  });

  it('son yazılan girdi sınır yüzünden düşürülmez', async () => {
    const base = project();
    const calls = { count: 0 };
    for (let version = 1; version <= 200; version += 1) {
      await generateExpansionCards(withIdea(base, version), 'trust', {
        settings: aiSettings, provider: okProvider(calls)
      });
    }
    const before = calls.count;
    await generateExpansionCards(withIdea(base, 200), 'trust', {
      settings: aiSettings, provider: okProvider(calls)
    });
    assert.equal(calls.count, before, 'en son yazılan girdi hâlâ önbellekte olmalı');
  });

  it('KART KABULÜ yeni giriş AÇMAZ: sınır kullanıcının etkinliğiyle tüketilmez', async () => {
    let target = project();
    const calls = { count: 0 };
    await generateExpansionCards(target, 'trust', { settings: aiSettings, provider: okProvider(calls) });

    for (let index = 0; index < 30; index += 1) {
      const intake = addExpansionCardAsSuggestion(
        target,
        {
          id: `card-${index}`,
          title: `Kabul edilen kart ${index}`,
          description: 'Kullanıcının fikre eklediği kart.',
          kind: 'feature',
          origin: 'ai'
        },
        'Güven',
        { status: 'accepted' }
      );
      assert.equal(intake.added, true);
      target = intake.project;
      await generateExpansionCards(target, 'trust', { settings: aiSettings, provider: okProvider(calls) });
    }

    assert.equal(calls.count, 1, '30 kabul tek bir üretimle karşılanmalı');
  });
});

/**
 * ÖLÇÜLEN KUSUR VE DÜZELTMESİ.
 *
 * Anahtar `documentRevision` içeriyordu ve revizyon HER kalıcılaştırmada
 * artıyordu -- kart eklemek dâhil. Canlı ölçümde (Ollama qwen2.5:7b, at
 * sistemi fikri) üç kart kabul edildi ve pano kart sayısı 12 -> 18 -> 21
 * diye tırmandı: her kabul altı bölümün ~2,5 dakikalık üretimini BAŞTAN
 * başlatıyor, bölümler farklı anlarda dolduğu için bölümler arası tekrar
 * elemesi tutmuyor ve kabul edilen kartın kendisi bile geri geliyordu.
 *
 * Anahtar artık kartların ÜRETİLDİĞİ FİKRE dayanır: proje kimliği, fikir
 * metni ve temelin zeminli (`source: 'idea'`) alanları.
 */
describe('üretim anahtarı fikre dayanır, oturum etkinliğine değil', () => {
  const acceptCard = (target: ProjectDocumentV5, title: string) => {
    const intake = addExpansionCardAsSuggestion(
      target,
      { id: `card-${title}`, title, description: `${title} açıklaması`, kind: 'feature', origin: 'ai' },
      'Güven'
    , { status: 'accepted' });
    assert.equal(intake.added, true, 'kart gerçekten eklenmeli');
    return intake.project;
  };

  it('ASIL DÜZELTME: kart kabul etmek anahtarı DEĞİŞTİRMEZ', () => {
    const before = project();
    const after = acceptCard(before, 'Atı uzaktan çağırma');
    assert.equal(expansionGenerationKey(after), expansionGenerationKey(before));
  });

  it('kart kabulü belge revizyonunu artırsa bile anahtar sabit kalır', () => {
    const before = project();
    const after = { ...acceptCard(before, 'Eyer ve envanter'), documentRevision: 9 } as ProjectDocumentV5;
    assert.equal(expansionGenerationKey(after), expansionGenerationKey(before));
  });

  it('BOZULMAMASI GEREKEN: fikir metni değişince anahtar DEĞİŞİR', () => {
    const before = project();
    const after = {
      ...before,
      identity: { ...before.identity, originalIdea: 'Bambaşka bir fikir: masaüstü not uygulaması' }
    } as ProjectDocumentV5;
    assert.notEqual(expansionGenerationKey(after), expansionGenerationKey(before));
  });

  it('zeminli (source:idea) temel alanı değişince anahtar DEĞİŞİR', () => {
    const before = groundedProject('Şehirdeki bisikletliler');
    const after = groundedProject('Kuryeler');
    assert.notEqual(expansionGenerationKey(after), expansionGenerationKey(before));
  });

  it('zeminsiz (assumption) temel alanı anahtarı DEĞİŞTİRMEZ', () => {
    const before = groundedProject('Şehirdeki bisikletliler');
    const after = structuredClone(before);
    after.ideaLabSession.conceptSummary.problemStatement = 'Model bunu kendi uydurdu';
    after.ideaLabSession.conceptSummary.foundationGrounding.problemStatement = {
      source: 'assumption', reason: 'fikirde karşılığı yok'
    } as never;
    assert.equal(expansionGenerationKey(after), expansionGenerationKey(before));
  });

  it('anahtar KARARLI: aynı girdi her seferinde aynı anahtarı verir', () => {
    const target = groundedProject('Şehirdeki bisikletliler');
    assert.equal(expansionGenerationKey(target), expansionGenerationKey(target));
    assert.equal(expansionGenerationKey(structuredClone(target)), expansionGenerationKey(target));
  });

  it('anahtar NESNE ALAN SIRASINDAN bağımsızdır', () => {
    const target = groundedProject('Şehirdeki bisikletliler');
    const summary = target.ideaLabSession.conceptSummary;
    const reordered = structuredClone(target);
    // Aynı alanlar, ters sırayla yeniden kurulmuş bir nesne.
    reordered.ideaLabSession.conceptSummary = Object.fromEntries(
      Object.entries(summary).reverse()
    ) as typeof summary;
    reordered.identity = { ...target.identity };
    assert.equal(expansionGenerationKey(reordered), expansionGenerationKey(target));
  });

  it('başka projenin anahtarı ayrıdır', () => {
    const before = project();
    const after = { ...before, id: 'baska-proje' } as ProjectDocumentV5;
    assert.notEqual(expansionGenerationKey(after), expansionGenerationKey(before));
  });
});

describe('önbellek anahtarı ile üretim anahtarı aynı olaylarda değişir', () => {
  beforeEach(() => clearExpansionCache());

  it('kart kabul edildikten sonra AI YENİDEN çağrılmaz', async () => {
    const calls = { count: 0 };
    const provider = okProvider(calls);
    const before = project();
    await generateExpansionCards(before, 'trust', { settings: aiSettings, provider });

    const after = addExpansionCardAsSuggestion(
      before,
      { id: 'card-x', title: 'Atı uzaktan çağırma', description: 'Islıkla çağırma.', kind: 'feature', origin: 'ai' },
      'Güven',
      { status: 'accepted' }
    ).project;
    await generateExpansionCards(after, 'trust', { settings: aiSettings, provider });

    assert.equal(calls.count, 1, 'kart kabulü altı bölümün üretimini baştan başlatmamalı');
  });

  it('fikir metni değişince AI YENİDEN çağrılır', async () => {
    const calls = { count: 0 };
    const provider = okProvider(calls);
    const before = project();
    await generateExpansionCards(before, 'trust', { settings: aiSettings, provider });

    const after = {
      ...before,
      identity: { ...before.identity, originalIdea: 'Bambaşka bir fikir: masaüstü not uygulaması' }
    } as ProjectDocumentV5;
    await generateExpansionCards(after, 'trust', { settings: aiSettings, provider });

    assert.equal(calls.count, 2, 'kartlar artık başka bir fikri yanıtlıyor olurdu; tazelenmeli');
  });

  it('zeminli temel alanı değişince AI YENİDEN çağrılır', async () => {
    const calls = { count: 0 };
    const provider = okProvider(calls);
    const before = groundedProject('Şehirdeki bisikletliler');
    await generateExpansionCards(before, 'trust', { settings: aiSettings, provider });
    await generateExpansionCards(groundedProject('Kuryeler'), 'trust', { settings: aiSettings, provider });
    assert.equal(calls.count, 2);
  });
});
