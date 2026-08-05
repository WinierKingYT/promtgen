import type { ProviderSettings } from '../provider-settings.js';
import { validateProviderSettings } from '../provider-url-policy.js';

export interface ProviderConnectionResult {
  ok: boolean;
  message: string;
  providerId: string;
  latencyMs: number;
  errorCode: string | null;
  checkedAt: string;
}

function result(
  settings: Pick<ProviderSettings, 'providerId'>,
  startedAt: number,
  ok: boolean,
  message: string,
  errorCode: string | null = null
): ProviderConnectionResult {
  return {
    ok,
    message,
    errorCode,
    providerId: settings.providerId,
    latencyMs: Math.max(0, Date.now() - startedAt),
    checkedAt: new Date().toISOString()
  };
}

/**
 * Sağlayıcıların model listesi biçimleri farklıdır:
 *   Gemini  -> { models: [{ name: "models/gemini-2.5-flash" }] }
 *   OpenAI  -> { data:   [{ id:   "gpt-4.1-mini" }] }
 *   Ollama  -> { models: [{ name: "llama3.2:latest" }] }
 * Okunamayan bir gövde sessizce boş liste döner; model denetimi o durumda
 * atlanır ve bağlantı testi eski davranışına düşer (yanlış negatif üretmez).
 */
async function listModelNames(response: { json?: () => Promise<unknown> }): Promise<string[]> {
  if (typeof response.json !== 'function') return [];
  try {
    const body = await response.json() as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
      data?: Array<{ id?: string }>;
    };
    return [
      // Listede olmak yetmez: model generateContent'i desteklemiyorsa üretim
      // çağrısı 404 döner. Yalnız gerçekten kullanılabilir modeller sayılır.
      ...(body.models || [])
        .filter(item => !item?.supportedGenerationMethods || item.supportedGenerationMethods.includes('generateContent'))
        .map(item => String(item?.name || '')),
      ...(body.data || []).map(item => String(item?.id || ''))
    ].filter(Boolean);
  } catch {
    return [];
  }
}

/** Hata mesajında gösterilecek birkaç somut model adı; kullanıcı kopyalayıp yapıştırabilsin. */
function suggestModels(models: string[]): string[] {
  return models.map(name => name.replace(/^models\//, '')).slice(0, 4);
}

/** "models/gemini-2.5-flash" ve "llama3.2:latest" gibi ön/son ekleri tolere eder. */
function modelMatches(listed: string, configured: string): boolean {
  const strip = (value: string) => value.replace(/^models\//, '').split(':')[0].trim().toLowerCase();
  return strip(listed) === strip(configured);
}

function describeFailure(status: number): { code: string; message: string } {
  if (status === 401 || status === 403) return { code: 'authentication', message: `Kimlik bilgisi reddedildi (${status}).` };
  if (status === 404) return { code: 'endpoint', message: 'API adresi veya model endpointi bulunamadı (404).' };
  if (status === 429) return { code: 'rate_limit', message: 'Sağlayıcı istek sınırına ulaştı (429).' };
  if (status >= 500) return { code: 'provider', message: `Sağlayıcı geçici olarak kullanılamıyor (${status}).` };
  return { code: 'http', message: `Bağlantı kurulamadı (${status}).` };
}

export async function testProviderConnection(
  input: Partial<ProviderSettings> & Pick<ProviderSettings, 'providerId' | 'model' | 'baseUrl'>,
  credential = '',
  signal?: AbortSignal
): Promise<ProviderConnectionResult> {
  const startedAt = Date.now();
  if (input.providerId === 'offline') return result(input, startedAt, true, 'Yerel akıllı motor hazır.');
  const validation = validateProviderSettings(input, { defaultModel: input.model });
  if (!validation.valid) return result(input, startedAt, false, validation.error, 'configuration');
  const settings = validation.settings;
  const headers: Record<string, string> = {};
  if (credential) {
    if (settings.providerId === 'gemini') headers['x-goog-api-key'] = credential;
    else headers.Authorization = `Bearer ${credential}`;
  }
  const url = settings.providerId === 'ollama'
    ? `${settings.baseUrl || 'http://127.0.0.1:11434'}/api/tags`
    : settings.providerId === 'gemini'
      ? 'https://generativelanguage.googleapis.com/v1beta/models'
      : `${settings.baseUrl}/models`;
  const controller = signal ? null : new AbortController();
  const requestSignal = signal || controller?.signal;
  const timeout = controller ? setTimeout(() => controller.abort(), 10_000) : null;
  try {
    const response = await fetch(url, { headers, signal: requestSignal });
    if (!response.ok) {
      const failure = describeFailure(response.status);
      return result(settings, startedAt, false, failure.message, failure.code);
    }
    // Liste isteği yalnız kimlik bilgisini doğrular. Seçili model o listede
    // yoksa üretim çağrısı 404 döner ve kullanıcı "bağlantı doğrulandı"
    // gördüğü hâlde hiçbir öneri alamaz. Model adı burada da denetlenir.
    const models = await listModelNames(response);
    if (!models.length) {
      // Liste okunamadı: kimlik bilgisi doğrulandı ama model denetlenemedi.
      // "Model doğrulandı" demek burada yanlış olurdu; kullanıcı üretim
      // sırasında 404 alıp neden olduğunu anlayamazdı.
      return result(
        settings,
        startedAt,
        true,
        'Kimlik bilgisi doğrulandı. Model listesi okunamadığı için "' + settings.model + '" ayrıca denetlenemedi.'
      );
    }
    if (settings.model && !models.some(name => modelMatches(name, settings.model))) {
      return result(
        settings,
        startedAt,
        false,
        `Kimlik bilgisi geçerli ancak "${settings.model}" modeli bu hesapta üretim için kullanılamıyor. Kullanılabilir: ${suggestModels(models).join(', ')}`,
        'endpoint'
      );
    }
    return result(settings, startedAt, true, 'Bağlantı, kimlik bilgisi ve model doğrulandı.');
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return result(
      settings,
      startedAt,
      false,
      aborted ? 'Bağlantı zaman aşımına uğradı.' : 'Ağ veya CORS nedeniyle sağlayıcıya ulaşılamadı.',
      aborted ? 'timeout' : 'network'
    );
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
