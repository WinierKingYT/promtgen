import type { Page } from '@playwright/test';

const PROVIDER_SETTINGS_KEY = 'promtgen-provider-settings-v1';

const READY_OLLAMA_SETTINGS = {
  providerId: 'ollama',
  model: 'llama3.2',
  baseUrl: 'http://127.0.0.1:11434',
  useAiWhenAvailable: true,
  useLocalMemory: false
};

/**
 * Sağlayıcı kapısı üretimde çalışan bir AI bağlantısı ister; bu olmadan
 * "Fikri geliştir" kilitlidir. E2E'de gerçek bir model çalıştırmak yerine:
 *
 *  - Bağlantı yoklaması (`/api/tags`) başarılı döner  -> kapı açılır.
 *  - Model çağrısı (`/api/chat`) düşürülür            -> akış deterministik
 *    biçimde yerel kural motoruna geri düşer, yani kapı eklenmeden önceki
 *    davranışın aynısı ölçülür.
 *
 * Uygulama kodunda test'e özel hiçbir kaçış yolu yoktur; yalnız ağ katmanı
 * taklit edilir.
 */
export async function stubReadyProvider(page: Page): Promise<void> {
  await page.route('**/api/tags', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ models: [{ name: 'llama3.2' }] })
  }));
  await page.route('**/api/chat', route => route.abort());
  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      window.localStorage.setItem(key, value);
    },
    { key: PROVIDER_SETTINGS_KEY, value: JSON.stringify(READY_OLLAMA_SETTINGS) }
  );
}

/** idea-expansion prompt'unu diğer görevlerden ayıran değişmez cümle. */
const EXPANSION_PROMPT_MARK = 'Şu tek kategori için öneri üret';

export interface StubbedExpansionCard {
  id: string;
  title: string;
  description: string;
  kind: 'feature' | 'decision' | 'risk' | 'question' | 'architecture';
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  deliveryHorizon: 'core' | 'later';
}

/**
 * Yalnız keşif panosunun AI yolunu ayakta tutar: `/api/chat` çağrılarından
 * idea-expansion prompt'unu taşıyanlar şemadan geçen bir yanıt alır, geri
 * kalan görevler `stubReadyProvider`'daki gibi düşürülüp yerel kural motoruna
 * geri düşer. Böylece testte görülen kartlar yalnız model yolundan gelebilir;
 * seedTitles fallback'i aynı içeriği üretemez.
 */
export interface ExpansionStubOptions {
  /**
   * Sahte yanıtın geciktirileceği süre. Varsayılan 0 -- eski çağıranlar
   * etkilenmez. Gecikme, arka plan doldurmasının ARA durumlarını (sırada /
   * hazırlanıyor) ölçülebilir kılmak için var: gerçek üretimde kategori başına
   * ~25 saniye süren bu durumlar sahte sağlayıcıda anında geçip gidiyor ve
   * hiç sınanamıyorlardı.
   */
  delayMs?: number;
}

export async function stubExpansionProvider(
  page: Page,
  cards: StubbedExpansionCard[],
  options: ExpansionStubOptions = {}
): Promise<void> {
  await stubReadyProvider(page);
  await page.route('**/api/chat', async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
      return;
    }
    if (!(request.postData() || '').includes(EXPANSION_PROMPT_MARK)) {
      await route.fallback();
      return;
    }
    if (options.delayMs) await new Promise(resolve => setTimeout(resolve, options.delayMs));
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: { content: JSON.stringify({ cards }) } })
    });
  });
}

/**
 * İstemden kategori etiketini söker. İstem satırı değişmez biçimde
 * `Şu tek kategori için öneri üret: "<etiket>" — <ipucu>` (bkz.
 * ai/tasks/idea-expansion.ts).
 *
 * Gövde bir JSON dizesidir: istemdeki tırnaklar oraya `\"` olarak yazılır.
 * Bu yüzden ÖNCE kaçış çözülür -- ilk sürüm bunu atlamıştı ve etiket hiçbir
 * zaman eşleşmeyip her kategori dolgu kartlarını alıyordu.
 */
function readCategoryLabel(body: string): string {
  const match = /Şu tek kategori için öneri üret: "([^"]*)"/.exec(body.replace(/\\"/g, '"'));
  return match ? match[1] : '';
}

/**
 * Kategori BAŞINA ayrı kart listesi döndürür.
 *
 * NEDEN GEREKLİ: `stubExpansionProvider` her kategori için AYNI listeyi
 * döndürüyor. Pano bölümler arası tekrarları artık eliyor (bkz.
 * expansion-section-dedup.ts), yani o sahte sağlayıcıyla ikinci bölümden
 * sonrası bilerek boş kalıyor -- doğru davranış, ama "her başlığın KENDİ
 * önerileri var" iddiasını ölçemez hâle geliyor. Bu sağlayıcı o iddiayı
 * ölçmek için var: gerçek modelin yaptığı gibi her başlığa farklı kart verir.
 *
 * Haritada olmayan kategoriler sabit bir dolgu listesi alır: şema en az üç
 * kart istiyor ve arka plan sırasındaki her kategori bir sonuca bağlanmalı.
 * Dolgu kartları kasten hep aynıdır -- onların bölümleri elemeye takılır ve
 * bu testlerde iddia konusu değildir.
 */
const FILLER_CARDS: StubbedExpansionCard[] = [
  {
    id: 'filler-1',
    title: 'Klavye kısayolları',
    description: 'Sık kullanılan işlemler tuş takımından yapılabilsin.',
    kind: 'feature',
    effort: 'low',
    impact: 'low',
    deliveryHorizon: 'later'
  },
  {
    id: 'filler-2',
    title: 'Tabloları dosyaya aktarma',
    description: 'Listeler CSV biçiminde indirilebilsin.',
    kind: 'feature',
    effort: 'medium',
    impact: 'low',
    deliveryHorizon: 'later'
  },
  {
    id: 'filler-3',
    title: 'Koyu görünüm',
    description: 'Gece saatlerinde göz yormayan bir tema bulunsun.',
    kind: 'feature',
    effort: 'low',
    impact: 'medium',
    deliveryHorizon: 'later'
  }
];

export async function stubExpansionProviderByCategory(
  page: Page,
  cardsByCategoryLabel: Record<string, StubbedExpansionCard[]>,
  options: ExpansionStubOptions = {}
): Promise<void> {
  await stubReadyProvider(page);
  await page.route('**/api/chat', async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
      return;
    }
    const body = request.postData() || '';
    if (!body.includes(EXPANSION_PROMPT_MARK)) {
      await route.fallback();
      return;
    }
    const cards = cardsByCategoryLabel[readCategoryLabel(body)] || FILLER_CARDS;
    if (options.delayMs) await new Promise(resolve => setTimeout(resolve, options.delayMs));
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: { content: JSON.stringify({ cards }) } })
    });
  });
}

/** idea-axes prompt'unu diğer görevlerden ayıran değişmez cümle. */
const AXES_PROMPT_MARK = 'en fazla 3 genişletme ekseni';

export interface StubbedIdeaAxis {
  label: string;
  hint: string;
}

/**
 * Tier 3 (fikre özel eksen) VE idea-expansion yolunu birlikte ayakta tutar:
 * idea-axes prompt'u eksen listesini, idea-expansion prompt'u (yalnız
 * `axisId` ile eşleşen çağrıda) kartları döner. Diğer tüm görevler
 * `stubReadyProvider`'daki gibi düşürülür. Bu, panonun kullanıcı hiçbir
 * kategoriye tıklamadan otomatik önerdiği ekseni test etmek için gerekir.
 */
export async function stubIdeaAxesAndExpansionProvider(
  page: Page,
  axes: StubbedIdeaAxis[],
  cards: StubbedExpansionCard[]
): Promise<void> {
  await stubReadyProvider(page);
  await page.route('**/api/chat', async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
      return;
    }
    const body = request.postData() || '';
    if (body.includes(AXES_PROMPT_MARK)) {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: { content: JSON.stringify({ axes }) } })
      });
      return;
    }
    if (body.includes(EXPANSION_PROMPT_MARK)) {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: { content: JSON.stringify({ cards }) } })
      });
      return;
    }
    await route.fallback();
  });
}
