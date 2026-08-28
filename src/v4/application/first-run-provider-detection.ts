/**
 * İlk çalıştırmada yerelde çalışan Ollama'yı tercih eder.
 *
 * Neden gerekiyor: uygulama "Local-first · Hesap gerektirmez" diye
 * pazarlanıyor ama varsayılan sağlayıcı bulut NVIDIA profili. Ollama zaten
 * kurulu ve `127.0.0.1:11434`'te çalışıyorsa kullanıcı hâlâ ayarları elle
 * açıp Ollama'yı seçmek zorunda kalıyordu -- bu, ürünün kendi vaadiyle
 * çelişiyordu.
 *
 * Kurallar:
 *  - Yalnız hiçbir ayar kaydedilmemişken çalışır: kullanıcının bilinçli
 *    seçimi (NVIDIA veya offline dahil) hiçbir zaman ezilmez.
 *  - Taban adresi `normalizeProviderBaseUrl` üzerinden geçer; SSRF koruması
 *    (yalnız localhost/127.0.0.1/[::1], kimlik bilgisi/yol/sorgu yok) bu
 *    yolda da geçerlidir -- ayrı bir "kısayol" adres üretilmez.
 *  - Ollama'da hiç model yoksa otomatik seçim yapılmaz: modelsiz bir
 *    sağlayıcı kullanılamaz, varsayılan sağlayıcı değişmeden kalır.
 *  - Kısa bir zaman aşımı ile sınırlıdır; açılışı asla bloklamaz ve hata
 *    kullanıcıya yüzeye çıkmaz -- sonuç `null` olur, mevcut varsayılan sürer.
 */

import type { OllamaModelListResult } from '../ai/ollama-models.js';
import { getProviderMeta, type ProviderSettings } from '../provider-settings.js';
import { normalizeProviderBaseUrl, normalizeProviderSettings } from '../provider-url-policy.js';

const DEFAULT_PROBE_TIMEOUT_MS = 2000;

export interface FirstRunDetectionDeps {
  /** localStorage'da zaten bir sağlayıcı ayarı var mı? */
  hasSavedSettings(): boolean;
  /** Ağ çağrısını yapan enjekte edilebilir sınır; testte ağsız çalışır. */
  listModels(baseUrl: string, options: { signal?: AbortSignal }): Promise<OllamaModelListResult>;
  /** Yoklamanın en fazla ne kadar süreceği; açılışı bloklamamak için kısa tutulur. */
  timeoutMs?: number;
}

/**
 * Kaydedilmiş ayar yoksa yerel Ollama'yı yoklar ve sunucunun gerçekten
 * bildirdiği bir modeli seçer. Ollama yoksa, yavaşsa, hata verirse veya hiç
 * model bildirmiyorsa `null` döner -- çağıran mevcut varsayılanı korur.
 */
export async function detectFirstRunProviderSettings(
  deps: FirstRunDetectionDeps
): Promise<ProviderSettings | null> {
  if (deps.hasSavedSettings()) return null;

  const baseUrl = normalizeProviderBaseUrl('ollama', '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS);
  try {
    const result = await deps.listModels(baseUrl, { signal: controller.signal });
    if (!result.ok || result.models.length === 0) return null;
    return normalizeProviderSettings(
      { providerId: 'ollama', model: result.models[0].name, baseUrl },
      getProviderMeta('ollama')
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
