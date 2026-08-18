/**
 * Ollama'da kurulu modelleri listeler.
 *
 * Neden gerekiyor: uygulamanın Ollama varsayılanı `llama3.2` ama kullanıcıda
 * o model kurulu olmak zorunda değil. Elle kullanırken tam bunu yaşadım —
 * kurulu tek sohbet modeli `qwen2.5:7b` iken varsayılan `llama3.2` duruyordu
 * ve kullanıcı model adını doğru yazmadan hiçbir tur çalışmıyordu. Ollama
 * kurulu modelleri zaten söylüyor; sormamak için sebep yok.
 *
 * Ağ çağrısı enjekte edilebilir tutuldu ki modül ağsız test edilebilsin.
 */

export interface OllamaModel {
  name: string;
  /** '7.6B' gibi; bilinmiyorsa boş. */
  parameterSize: string;
  /** Modelin bağlam sınırı; bilinmiyorsa null. */
  contextLength: number | null;
}

export type OllamaModelListResult =
  | { ok: true; models: OllamaModel[] }
  | { ok: false; reason: string };

interface RawModel {
  name?: unknown;
  capabilities?: unknown;
  details?: { parameter_size?: unknown; context_length?: unknown } | null;
}

/**
 * Gömme modelleri elenir: sohbet edemezler ve listede görünmeleri kullanıcıyı
 * çalışmayacak bir seçime yönlendirir.
 *
 * `capabilities` alanı olmayan eski Ollama sürümlerinde model **elenmez** —
 * bilgi yokluğunu dışlama gerekçesi saymak, eski kurulumları cezalandırırdı.
 */
function isChatCapable(model: RawModel): boolean {
  if (!Array.isArray(model.capabilities)) return true;
  return model.capabilities.includes('completion');
}

export async function listOllamaModels(
  baseUrl: string,
  options: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {}
): Promise<OllamaModelListResult> {
  const base = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!base) return { ok: false, reason: 'Ollama adresi boş.' };

  const call = options.fetchImpl || fetch;
  let response: Response;
  try {
    response = await call(`${base}/api/tags`, { signal: options.signal });
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: `Ollama'ya ulaşılamadı (${base}). Çalışıyor mu? (${raw})` };
  }

  if (!response.ok) {
    return { ok: false, reason: `Ollama model listesi alınamadı (${response.status}).` };
  }

  let payload: { models?: unknown };
  try {
    payload = await response.json() as { models?: unknown };
  } catch {
    return { ok: false, reason: 'Ollama beklenmedik bir yanıt döndürdü.' };
  }

  if (!Array.isArray(payload.models)) {
    return { ok: false, reason: 'Ollama yanıtında model listesi yok.' };
  }

  const models = (payload.models as RawModel[])
    .filter(model => typeof model?.name === 'string' && model.name.trim())
    .filter(isChatCapable)
    .map(model => ({
      name: String(model.name),
      parameterSize: typeof model.details?.parameter_size === 'string' ? model.details.parameter_size : '',
      contextLength: Number.isFinite(model.details?.context_length) ? Number(model.details?.context_length) : null
    }));

  return { ok: true, models };
}

/** Kurulu model listesinde yoksa kullanıcıya söylenecek uyarı; yoksa null. */
export function missingModelWarning(model: string, models: readonly OllamaModel[]): string | null {
  const wanted = String(model || '').trim();
  if (!wanted || !models.length) return null;
  if (models.some(item => item.name === wanted)) return null;
  return `"${wanted}" Ollama'da kurulu değil. Kurulu modeller: ${models.map(item => item.name).join(', ')}`;
}
