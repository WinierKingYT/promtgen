import { PROVIDER_CATALOG, getProviderMeta } from '../provider-settings.js';

export type ProviderReadinessState =
  | 'ready'
  | 'needs-setup'
  | 'needs-credential'
  | 'unreachable';

export interface ProviderProbeResult {
  ok: boolean;
  errorCode: string | null;
  message: string;
}

export interface ProviderReadinessSettings {
  providerId: string;
  model?: string;
  baseUrl?: string;
  useAiWhenAvailable?: boolean;
}

export interface ProviderSetupOption {
  providerId: string;
  label: string;
  description: string;
  requiresCredential: boolean;
  /** Anahtar gerektirmeyen seçenek; kurulum akışında öne alınır. */
  local: boolean;
}

export interface ProviderReadinessResult {
  state: ProviderReadinessState;
  providerId: string;
  message: string;
  errorCode: string | null;
  /** Kullanıcının seçebileceği sağlayıcılar; anahtarsız olanlar başta. */
  options: ProviderSetupOption[];
  /** Ollama yerelde bulunduğu için otomatik seçildiyse true. */
  autoSelected: boolean;
}

export interface ProviderReadinessDependencies {
  /** testProviderConnection sarmalayıcısı; testte ağ olmadan enjekte edilir. */
  probe(settings: ProviderReadinessSettings, credential: string): Promise<ProviderProbeResult>;
  /** Sağlayıcı için saklanmış kimlik bilgisini döndürür ('' = yok). */
  credentialFor(providerId: string): Promise<string>;
}

const OLLAMA_DEFAULT_BASE_URL = 'http://127.0.0.1:11434';

function setupOptions(): ProviderSetupOption[] {
  return PROVIDER_CATALOG
    .filter(entry => entry.id !== 'offline')
    .map(entry => ({
      providerId: entry.id,
      label: entry.label,
      description: entry.description,
      requiresCredential: Boolean(entry.credentialRequired),
      local: entry.id === 'ollama'
    }))
    .sort((left, right) => Number(left.requiresCredential) - Number(right.requiresCredential));
}

function ollamaSettings(): ProviderReadinessSettings {
  const meta = getProviderMeta('ollama');
  return {
    providerId: 'ollama',
    model: meta.defaultModel,
    baseUrl: meta.defaultBaseUrl || OLLAMA_DEFAULT_BASE_URL
  };
}

/**
 * Uygulama açılışında çalışan AI sağlayıcısı olup olmadığını belirler.
 *
 * Sıra:
 *  1. Yerleşik NVIDIA GLM-5.2 profili dahil yapılandırılmış gerçek sağlayıcı doğrulanır.
 *  2. Sağlayıcı kullanıcı tarafından offline bırakıldıysa yereldeki Ollama yoklanır — kurulu ve
 *     çalışıyorsa anahtar istemeden kullanılabilir.
 *  3. O da yoksa kullanıcıya kurulum seçenekleri sunulur.
 *
 * Ağ çağrısı yapmaz; probe enjekte edilir.
 */
export async function evaluateProviderReadiness(
  settings: ProviderReadinessSettings | null | undefined,
  dependencies: ProviderReadinessDependencies
): Promise<ProviderReadinessResult> {
  const options = setupOptions();
  const configuredId = settings?.providerId || 'offline';
  const aiDisabled = settings?.useAiWhenAvailable === false;
  const hasRealProvider = configuredId !== 'offline' && !aiDisabled;

  if (hasRealProvider) {
    const meta = getProviderMeta(configuredId);
    const credential = await dependencies.credentialFor(configuredId);
    if (meta.credentialRequired && !credential) {
      return {
        state: 'needs-credential',
        providerId: configuredId,
        message: `${meta.label} seçili ancak API anahtarı girilmemiş.`,
        errorCode: 'missing-credential',
        options,
        autoSelected: false
      };
    }
    const probe = await dependencies.probe(settings as ProviderReadinessSettings, credential);
    if (probe.ok) {
      return {
        state: 'ready',
        providerId: configuredId,
        message: `${meta.label} bağlantısı doğrulandı.`,
        errorCode: null,
        options,
        autoSelected: false
      };
    }
    return {
      state: 'unreachable',
      providerId: configuredId,
      message: probe.message,
      errorCode: probe.errorCode,
      options,
      autoSelected: false
    };
  }

  // Anahtar gerektirmeyen yol: yerel Ollama zaten kuruluysa kullanıcıya hiç
  // kurulum adımı göstermeden hazır hale geliriz.
  const local = ollamaSettings();
  const localProbe = await dependencies.probe(local, '');
  if (localProbe.ok) {
    return {
      state: 'ready',
      providerId: 'ollama',
      message: 'Yerelde çalışan Ollama bulundu ve seçildi; proje bağlamı cihazdan çıkmaz.',
      errorCode: null,
      options,
      autoSelected: true
    };
  }

  return {
    state: 'needs-setup',
    providerId: 'offline',
    message: 'Yerleşik GLM-5.2 kullanılamıyor; fikir geliştirme yerel ve deterministik motorla devam edecek.',
    errorCode: null,
    options,
    autoSelected: false
  };
}

/** Kapı geçildi mi? Yalnız `ready` durumu AI'lı akışa izin verir. */
export function providerGateOpen(result: ProviderReadinessResult): boolean {
  return result.state === 'ready';
}

/** Kullanıcıya gösterilecek düzeltici adım. */
export function providerRecoveryHint(result: ProviderReadinessResult): string {
  switch (result.state) {
    case 'ready':
      return '';
    case 'needs-credential':
      return result.providerId === 'nvidia'
        ? 'Yerleşik GLM-5.2 için NVIDIA API anahtarını bir kez gir. Masaüstünde anahtar işletim sistemi kasasında saklanır ve plan belgesine yazılmaz.'
        : 'Sağlayıcı ayarlarından API anahtarını gir. Anahtar cihazda saklanır, plan belgesine yazılmaz.';
    case 'unreachable':
      return recoveryForErrorCode(result.errorCode);
    default:
      return 'Ollama kuruluysa çalıştır, ya da NVIDIA / Gemini / OpenAI için bir API anahtarı gir.';
  }
}

function recoveryForErrorCode(errorCode: string | null): string {
  switch (errorCode) {
    case 'authentication':
      return 'API anahtarı reddedildi; sağlayıcı panelinden yeni bir anahtar üret.';
    case 'endpoint':
      return 'Model adı veya adres bulunamadı; model kimliğini doğrula.';
    case 'rate_limit':
      return 'Sağlayıcı istek sınırına ulaşıldı; bir süre bekle veya kotayı artır.';
    case 'provider':
      return 'Sağlayıcı geçici olarak kullanılamıyor; kısa süre sonra tekrar dene.';
    case 'configuration':
      return 'Adres politikayı ihlal ediyor; Ollama için yalnız localhost adresine izin verilir.';
    case 'timeout':
      return 'Bağlantı zaman aşımına uğradı; yerel modelde donanım sınırı olabilir.';
    default:
      return 'Ağ bağlantısını ve güvenlik duvarı ayarlarını kontrol et.';
  }
}
