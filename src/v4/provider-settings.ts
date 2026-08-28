import { normalizeProviderSettings } from './provider-url-policy.js';

const STORAGE_KEY = 'promtgen-provider-settings-v1';
export const DEFAULT_PROVIDER_ID = 'nvidia';
export const BUILT_IN_NVIDIA_MODEL = 'z-ai/glm-5.2';
const LEGACY_NVIDIA_DEFAULTS = new Set(['meta/llama-3.3-70b-instruct', 'deepseek-ai/deepseek-v4-pro']);

export interface ProviderMeta {
    id: string;
    label: string;
    description: string;
    credentialRequired: boolean;
    defaultModel: string;
    defaultBaseUrl?: string;
    builtIn?: boolean;
}

export const PROVIDER_CATALOG: readonly ProviderMeta[] = Object.freeze([
    { id: 'nvidia', label: 'NVIDIA NIM · GLM-5.2', description: 'PromtGen’in yerleşik bulut AI profili; fikir tartışma ve uzun bağlamlı planlama için hazırdır.', credentialRequired: true, defaultModel: BUILT_IN_NVIDIA_MODEL, defaultBaseUrl: 'https://integrate.api.nvidia.com/v1', builtIn: true },
    { id: 'offline', label: 'Yerel Akıllı Motor', description: 'API anahtarı gerekmez; cihazda deterministik seçenekler üretir.', credentialRequired: false, defaultModel: 'promtgen-local' },
    { id: 'ollama', label: 'Ollama', description: 'Yerel model; proje bağlamı cihazdan çıkmaz.', credentialRequired: false, defaultModel: 'llama3.2', defaultBaseUrl: 'http://127.0.0.1:11434' },
    { id: 'openai', label: 'OpenAI', description: 'Yapılandırılmış planlama seçenekleri üretir.', credentialRequired: true, defaultModel: 'gpt-4.1-mini', defaultBaseUrl: 'https://api.openai.com/v1' },
    { id: 'gemini', label: 'Gemini', description: 'Uzun bağlamlı proje analizi için Google modelleri.', credentialRequired: true, defaultModel: 'gemini-2.5-flash' }
]);

export interface ProviderSettings {
    providerId: string;
    model: string;
    baseUrl: string;
    useAiWhenAvailable: boolean;
    useLocalMemory: boolean;
}

export function getProviderMeta(id?: string): ProviderMeta {
    // PROVIDER_CATALOG always contains an entry whose id === DEFAULT_PROVIDER_ID
    // ('nvidia'), so the fallback `find` always succeeds. `Array#find`'s
    // declared `T | undefined` return type can't express that static
    // invariant, so it is asserted here once, at this single boundary.
    return (PROVIDER_CATALOG.find(provider => provider.id === id) || PROVIDER_CATALOG.find(provider => provider.id === DEFAULT_PROVIDER_ID)) as ProviderMeta;
}

export function getDefaultProviderSettings(): ProviderSettings {
    const provider = getProviderMeta(DEFAULT_PROVIDER_ID);
    return { providerId: provider.id, model: provider.defaultModel, baseUrl: provider.defaultBaseUrl || '', useAiWhenAvailable: true, useLocalMemory: false };
}

export function upgradeProviderSettings(stored: Partial<ProviderSettings> | null | undefined): ProviderSettings {
    const meta = getProviderMeta(stored?.providerId);
    const storedModel = stored?.model;
    const model = meta.id === 'nvidia' && (!storedModel || LEGACY_NVIDIA_DEFAULTS.has(storedModel))
        ? meta.defaultModel
        : storedModel;
    return normalizeProviderSettings({ ...getDefaultProviderSettings(), ...stored, model, providerId: meta.id }, meta);
}

export function loadProviderSettings(): ProviderSettings {
    if (typeof localStorage === 'undefined') return getDefaultProviderSettings();
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        return upgradeProviderSettings(stored);
    } catch { return getDefaultProviderSettings(); }
}

/**
 * Localde hiçbir sağlayıcı ayarı henüz kaydedilmemiş mi? İlk çalıştırma
 * tespiti (bkz. first-run-provider-detection.ts) yalnız bu true iken devreye
 * girer -- kullanıcının bilinçli seçimi asla ezilmez.
 */
export function hasSavedProviderSettings(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) !== null;
}

export function saveProviderSettings(settings: ProviderSettings): ProviderSettings {
    const meta = getProviderMeta(settings.providerId);
    const safe = normalizeProviderSettings({ ...settings, providerId: meta.id }, meta);
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    return safe;
}
