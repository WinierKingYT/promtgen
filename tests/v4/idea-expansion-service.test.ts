import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { analyzeIdea, updateSuggestionStatus } from '../../src/v4/planning-engine.js';
import { addExpansionCardAsSuggestion } from '../../src/v4/application/idea-expansion-intake.js';
import { selectExpansionBundle } from '../../src/v4/application/proposal-bundle-selectors.js';
import {
  generateExpansionCards,
  clearExpansionCache,
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
