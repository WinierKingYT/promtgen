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
    return result(settings, startedAt, true, 'Bağlantı ve kimlik bilgisi doğrulandı.');
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
