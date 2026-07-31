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
