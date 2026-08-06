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
  mvpHint: 'mvp-adayı' | 'sonraya';
}

/**
 * Yalnız keşif panosunun AI yolunu ayakta tutar: `/api/chat` çağrılarından
 * idea-expansion prompt'unu taşıyanlar şemadan geçen bir yanıt alır, geri
 * kalan görevler `stubReadyProvider`'daki gibi düşürülüp yerel kural motoruna
 * geri düşer. Böylece testte görülen kartlar yalnız model yolundan gelebilir;
 * seedTitles fallback'i aynı içeriği üretemez.
 */
export async function stubExpansionProvider(page: Page, cards: StubbedExpansionCard[]): Promise<void> {
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
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: { content: JSON.stringify({ cards }) } })
    });
  });
}
