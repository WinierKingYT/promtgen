import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import {
  canPrefetchExpansion,
  createExpansionPrefetch,
  type ExpansionReadiness
} from '../../src/v4/application/expansion-prefetch.js';
import {
  clearExpansionCache,
  generateExpansionCards,
  type ExpansionResult
} from '../../src/v4/application/idea-expansion-service.js';
import {
  getExpansionCategorySet,
  mergeExpansionCategories,
  orderExpansionCategoriesForPresentation,
  type ExpansionCategory
} from '../../src/v4/idea-expansion/categories.js';
import type { ProjectDocumentV5 } from '../../src/v4/contracts.js';

const project = () => analyzeIdea('Şehir içi bisiklet rotası öneren bir mobil uygulama') as ProjectDocumentV5;

const aiSettings = {
  providerId: 'ollama', model: 'qwen2.5:7b', baseUrl: 'http://127.0.0.1:11434', useAiWhenAvailable: true
} as any;
const offlineSettings = {
  providerId: 'offline', model: 'promtgen-local', baseUrl: '', useAiWhenAvailable: true
} as any;

/** Mikro görev kuyruğunu boşaltır; uçuşta olan pump adımları ilerlesin. */
const tick = async (rounds = 4) => {
  for (let index = 0; index < rounds; index += 1) await new Promise(resolve => setImmediate(resolve));
};

const emptyResult = (categoryId: string): ExpansionResult => ({
  categoryId,
  cards: [],
  mode: 'local-ai',
  fallbackReason: null,
  hiddenCount: 0,
  duplicateCount: 0,
  commandToneCount: 0
});

/**
 * Elle çözülen sahte üretim. `live` alanı AYNI ANDA kaç üretimin uçuşta
 * olduğunu ölçer: yerel model istekleri sıraya aldığı için bu sayının 1'i
 * aşmaması bu görevin çekirdek kısıtıdır.
 */
function createFakeGenerator() {
  const state = {
    calls: [] as string[],
    aborted: [] as string[],
    live: 0,
    maxLive: 0,
    pending: new Map<string, { finish: () => void; fail: (reason: unknown) => void }>()
  };

  const generate = (categoryId: string, { signal }: { signal: AbortSignal; refresh: boolean }) =>
    new Promise<ExpansionResult>((resolve, reject) => {
      state.calls.push(categoryId);
      state.live += 1;
      state.maxLive = Math.max(state.maxLive, state.live);
      let settled = false;
      const release = () => {
        settled = true;
        state.live -= 1;
        state.pending.delete(categoryId);
      };
      state.pending.set(categoryId, {
        finish: () => { if (settled) return; release(); resolve(emptyResult(categoryId)); },
        fail: reason => { if (settled) return; release(); reject(reason); }
      });
      signal.addEventListener('abort', () => {
        if (settled) return;
        release();
        state.aborted.push(categoryId);
        reject(new Error('AbortError'));
      });
    });

  const finish = (categoryId: string) => state.pending.get(categoryId)?.finish();
  const fail = (categoryId: string, reason: unknown) => state.pending.get(categoryId)?.fail(reason);
  return { state, generate, finish, fail };
}

function createHarness(options: { enabled?: boolean } = {}) {
  const fake = createFakeGenerator();
  const statuses: Record<string, ExpansionReadiness>[] = [];
  const runner = createExpansionPrefetch({
    generate: fake.generate,
    isEnabled: () => options.enabled !== false,
    onStatus: next => statuses.push(next)
  });
  const latest = () => statuses[statuses.length - 1] || {};
  return { ...fake, runner, statuses, latest };
}

const KEY = 'r1';

describe('createExpansionPrefetch', () => {
  it('arka plan doldurmayı SIRAYLA yürütür; aynı anda en fazla bir üretim uçuşta olur', async () => {
    const harness = createHarness();
    harness.runner.fill(KEY, ['a', 'b', 'c']);
    await tick();

    assert.deepEqual(harness.state.calls, ['a'], 'sıra başlarken yalnız ilk kategori üretilmeli');
    assert.equal(harness.state.live, 1);

    harness.finish('a');
    await tick();
    assert.deepEqual(harness.state.calls, ['a', 'b'], 'ilki bitmeden ikincisi başlamamalı');

    harness.finish('b');
    await tick();
    harness.finish('c');
    await tick();

    assert.deepEqual(harness.state.calls, ['a', 'b', 'c']);
    assert.equal(harness.state.maxLive, 1, 'hiçbir anda birden fazla üretim uçuşta olmamalı');
    assert.equal(harness.latest().c, 'ready');

    harness.runner.stop();
  });

  it('kullanıcı isteği sırayı ATLAR: uçuştaki arka plan işi iptal edilir', async () => {
    const harness = createHarness();
    harness.runner.fill(KEY, ['a', 'b', 'c']);
    await tick();
    assert.deepEqual(harness.state.calls, ['a']);

    const clicked = harness.runner.requestNow('c');
    await tick();

    assert.deepEqual(harness.state.aborted, ['a'], 'arka plan işi kullanıcıya yol vermeli');
    assert.deepEqual(
      harness.state.calls,
      ['a', 'c'],
      'kullanıcının istediği kategori kuyruğun arkasına eklenmeden hemen üretilmeli'
    );
    assert.equal(harness.state.maxLive, 1, 'kullanıcı isteği arka planla aynı anda koşmamalı');

    harness.finish('c');
    const result = await clicked;
    assert.ok(result, 'kullanıcı isteği sonucu döndürmeli');
    assert.equal(result.categoryId, 'c');

    await tick();
    assert.ok(
      harness.state.calls.slice(2).length > 0,
      'kullanıcı isteği bitince arka plan sırası kaldığı yerden devam etmeli'
    );
    harness.runner.stop();
  });

  it('revizyon değişince uçuştaki arka plan işi İPTAL edilir ve eski durum silinir', async () => {
    const harness = createHarness();
    harness.runner.fill(KEY, ['a', 'b']);
    await tick();
    harness.finish('a');
    await tick();
    assert.equal(harness.latest().a, 'ready');
    assert.deepEqual(harness.state.calls, ['a', 'b']);

    harness.runner.fill('r2', ['a', 'b']);
    await tick();

    assert.deepEqual(harness.state.aborted, ['b'], 'eski revizyona ait uçuştaki iş iptal edilmeli');
    assert.notEqual(
      harness.latest().a,
      'ready',
      'eski revizyonun "hazır" damgası yeni revizyona taşınmamalı; önbellek anahtarı değişti'
    );
    assert.equal(harness.state.calls.filter(item => item === 'a').length, 2, 'yeni revizyon için yeniden üretilmeli');
    harness.runner.stop();
  });

  it('çevrimdışıyken arka plan doldurma HİÇ başlamaz', async () => {
    const harness = createHarness({ enabled: false });
    harness.runner.fill(KEY, ['a', 'b', 'c']);
    await tick();

    assert.deepEqual(harness.state.calls, [], 'çevrimdışı ayarda tek bir arka plan çağrısı bile yapılmamalı');

    // Kullanıcının KENDİ tıklaması çevrimdışıyken de çalışmayı sürdürür:
    // servis yerel başlangıç kartlarını ve "AI bağlı değil" uyarısını verir.
    const clicked = harness.runner.requestNow('a');
    await tick();
    assert.deepEqual(harness.state.calls, ['a'], 'kullanıcı tıklaması çevrimdışı kapısına takılmamalı');
    harness.finish('a');
    await clicked;
    harness.runner.stop();
  });

  it('durdurulunca uçuştaki iş iptal edilir, yeni üretim başlamaz ve durum yayını kesilir', async () => {
    const harness = createHarness();
    harness.runner.fill(KEY, ['a', 'b', 'c']);
    await tick();

    const publishedBefore = harness.statuses.length;
    harness.runner.stop();
    await tick(8);

    assert.deepEqual(harness.state.aborted, ['a'], 'unmount uçuştaki işi iptal etmeli');
    assert.deepEqual(harness.state.calls, ['a'], 'durdurulduktan sonra sıradaki kategoriler üretilmemeli');
    assert.equal(harness.state.live, 0, 'geride uçuşta iş kalmamalı');
    assert.equal(
      harness.statuses.length,
      publishedBefore,
      'durdurulduktan sonra durum yayını yapılmamalı (unmount sonrası setState olmaz)'
    );

    harness.runner.fill('r2', ['d']);
    await tick();
    assert.deepEqual(harness.state.calls, ['a'], 'durdurulmuş yürütücü yeniden doldurmaya başlamamalı');
  });

  it('arka plan sırası üst sınırı aşmaz; kullanıcının makinesi süresiz meşgul edilmez', async () => {
    const harness = createHarness();
    const many = Array.from({ length: 20 }, (_, index) => `c${index}`);
    harness.runner.fill(KEY, many);
    for (let index = 0; index < many.length; index += 1) {
      await tick();
      const current = harness.state.calls[harness.state.calls.length - 1];
      if (current) harness.finish(current);
    }
    await tick();

    assert.ok(harness.state.calls.length > 1, 'sıra gerçekten ilerlemeli');
    assert.ok(
      harness.state.calls.length < many.length,
      `arka plan tüm kategorileri doldurmamalı; ${harness.state.calls.length} üretim yapıldı`
    );
    harness.runner.stop();
  });

  it('bir kategori üretilemezse sessizce yutulmaz, durumu izlenebilir kalır', async () => {
    const harness = createHarness();
    harness.runner.fill(KEY, ['a', 'b']);
    await tick();
    harness.fail('a', new Error('SCHEMA_VALIDATION_FAILED'));
    await tick();

    assert.equal(harness.latest().a, 'failed', 'başarısız kategori durumunda görünmeli');
    assert.deepEqual(harness.state.calls, ['a', 'b'], 'bir kategorinin düşmesi sırayı durdurmamalı');
    harness.runner.stop();
  });

  it('zaten hazır olan kategori arka planda yeniden üretilmez', async () => {
    const harness = createHarness();
    // Revizyon (önbellek kuşağı) önce kurulur; gerçek kullanımda da pano
    // sırayı fikir hazır olur olmaz kurar, tıklamalar ondan sonra gelir.
    harness.runner.fill(KEY, ['z']);
    await tick();
    harness.finish('z');
    await tick();

    const clicked = harness.runner.requestNow('a');
    await tick();
    harness.finish('a');
    await clicked;

    harness.runner.fill(KEY, ['a', 'b']);
    await tick();

    assert.deepEqual(harness.state.calls, ['z', 'a', 'b'], 'hazır kategori için ikinci bir üretim yapılmamalı');
    harness.runner.stop();
  });
});

describe('canPrefetchExpansion', () => {
  it('çevrimdışı sağlayıcıda ve AI kapalıyken false döner', () => {
    assert.equal(canPrefetchExpansion(aiSettings), true);
    assert.equal(canPrefetchExpansion(offlineSettings), false);
    assert.equal(canPrefetchExpansion({ ...aiSettings, useAiWhenAvailable: false }), false);
    assert.equal(canPrefetchExpansion(null), false);
  });
});

/**
 * Arka plan yolu AYRI bir üretim borusu DEĞİLDİR: aynı
 * `generateExpansionCards` çağrılır, dolayısıyla eleme boru hattının
 * (karar → ton → tekrar) tamamından geçer. Bu test onu mekanik olarak
 * doğrular; aksi hâlde arka planda uydurma/tekrar kartlar panoya sızardı.
 */
describe('arka plan üretimi eleme boru hattından geçer', () => {
  beforeEach(() => clearExpansionCache());

  it('ton ve tekrar elemesi arka planda da uygulanır', async () => {
    const target = project();
    const provider = {
      model: 'mock',
      async structured({ schema }: { schema: { parse(value: unknown): unknown } }) {
        return schema.parse({
          cards: [
            { id: '1', title: 'Verinin nerede durduğunu göster', description: 'Kullanıcı verisinin yerini görebilsin.', kind: 'feature', effort: 'low', impact: 'high', mvpHint: 'mvp-adayı' },
            { id: '2', title: 'Verinin nerede durduğunu göster', description: 'Kullanıcı verisinin yerini görebilsin.', kind: 'feature', effort: 'low', impact: 'high', mvpHint: 'mvp-adayı' },
            { id: '3', title: 'Tek tıkla dışa aktarma sun', description: 'Dışa aktarma tek adımda olsun.', kind: 'feature', effort: 'medium', impact: 'high', mvpHint: 'mvp-adayı' }
          ]
        });
      }
    };

    const harness = createHarness();
    const runner = createExpansionPrefetch({
      isEnabled: () => true,
      onStatus: () => {},
      generate: (categoryId, { signal, refresh }) =>
        generateExpansionCards(target, categoryId, { settings: aiSettings, provider, signal, refresh })
    });
    harness.runner.stop();

    const result = await runner.requestNow('trust');
    assert.ok(result);
    const titles = result.cards.map(card => card.title);
    assert.equal(
      new Set(titles).size,
      titles.length,
      'arka plan/öncelikli üretim de tekrar elemesinden geçmeli'
    );
    runner.stop();
  });
});

/**
 * ÖLÇÜLEN SORUN. Sıra `[...aiAxes, ...getExpansionCategories(project)]` ile
 * kuruluyordu; kimlik çözümünün sırası (CORE 8 → BY_DOMAIN 5) aynı zamanda
 * ön-yükleme sırası olduğu için alana özel eksenler 9. sıradan başlıyor ve
 * BACKGROUND_PREFETCH_LIMIT = 6 sınırının dışında kalıyordu. Sınır DOĞRUDUR
 * ve değişmez (gerekçesi expansion-prefetch.ts'te ölçülü yazılı); değişen,
 * sınırın İÇİNE hangi eksenlerin girdiğidir.
 */
describe('ön-yükleme sırası sunum sırasını izler', () => {
  const gameProject = () => analyzeIdea('Unity ile bir at sistemi yapmak istiyorum, multiplayer olacak') as ProjectDocumentV5;
  const aiAxis = (id: string): ExpansionCategory =>
    ({ id, label: `AI ${id}`, hint: 'fikre özel', seedTitles: ['a1', 'a2'] });

  /** Panonun kurduğu sıranın birebir aynısı (bkz. IdeaExpansionBoard.tsx). */
  const boardOrder = (axes: ExpansionCategory[]) => {
    const set = getExpansionCategorySet(gameProject());
    return orderExpansionCategoriesForPresentation(
      mergeExpansionCategories(set.categories, [], axes),
      { ideaSpecificIds: axes.map(axis => axis.id), domainSpecificIds: set.domainSpecificIds }
    ).map(category => category.id);
  };

  it('sınırın içine 2 AI ekseni + 4 alana özel eksen girer; genel CORE sıranın sonundadır', async () => {
    const axes = [aiAxis('ai.at-bakimi'), aiAxis('ai.binicilik')];
    const order = boardOrder(axes);
    const harness = createHarness();
    harness.runner.fill(KEY, order);
    await tick();

    for (let index = 0; index < 6; index += 1) {
      harness.finish(harness.state.calls[harness.state.calls.length - 1]);
      await tick();
    }

    assert.deepEqual(
      harness.state.calls,
      ['ai.at-bakimi', 'ai.binicilik', 'game-loop', 'simulated-state', 'network-authority', 'input-and-feel'],
      'arka plan sınırı fikre özel ve alana özel eksenlerle dolmalı'
    );
    assert.equal(harness.state.calls.includes('trust'), false, 'genel CORE ekseni sınırın içine girmemeli');
    harness.runner.stop();
  });

  it('sınırın dışında kalan CORE kategorisi KAYBOLMAZ: tıklanınca yine üretilir', async () => {
    const order = boardOrder([]);
    const harness = createHarness();
    harness.runner.fill(KEY, order);
    await tick();

    const clicked = harness.runner.requestNow('trust');
    await tick();
    harness.finish('trust');
    const result = await clicked;

    assert.ok(result, 'sınırın dışındaki kategori tıklamayla üretilebilmeli');
    assert.equal(result.categoryId, 'trust');
    harness.runner.stop();
  });
});
