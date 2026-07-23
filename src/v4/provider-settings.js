import { normalizeProviderSettings } from './provider-url-policy.js';

const STORAGE_KEY = 'promtgen-provider-settings-v1';

export const PROVIDER_CATALOG = Object.freeze([
    { id: 'offline', label: 'Yerel Akıllı Motor', description: 'API anahtarı gerekmez; cihazda deterministik seçenekler üretir.', credentialRequired: false, defaultModel: 'promtgen-local' },
    { id: 'ollama', label: 'Ollama', description: 'Yerel model; proje bağlamı cihazdan çıkmaz.', credentialRequired: false, defaultModel: 'llama3.2', defaultBaseUrl: 'http://127.0.0.1:11434' },
    { id: 'openai', label: 'OpenAI', description: 'Yapılandırılmış planlama seçenekleri üretir.', credentialRequired: true, defaultModel: 'gpt-4.1-mini', defaultBaseUrl: 'https://api.openai.com/v1' },
    { id: 'gemini', label: 'Gemini', description: 'Uzun bağlamlı proje analizi için Google modelleri.', credentialRequired: true, defaultModel: 'gemini-2.5-flash' },
    { id: 'nvidia', label: 'NVIDIA NIM', description: 'OpenAI uyumlu NVIDIA model uç noktası.', credentialRequired: true, defaultModel: 'meta/llama-3.3-70b-instruct', defaultBaseUrl: 'https://integrate.api.nvidia.com/v1' }
]);

export function getProviderMeta(id) { return PROVIDER_CATALOG.find(provider => provider.id === id) || PROVIDER_CATALOG[0]; }

export function getDefaultProviderSettings() {
    const provider = PROVIDER_CATALOG[0];
    return { providerId: provider.id, model: provider.defaultModel, baseUrl: provider.defaultBaseUrl || '', useAiWhenAvailable: true, useLocalMemory: false };
}

export function loadProviderSettings() {
    if (typeof localStorage === 'undefined') return getDefaultProviderSettings();
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        const meta = getProviderMeta(stored?.providerId);
        return normalizeProviderSettings({ ...getDefaultProviderSettings(), ...stored, providerId: meta.id }, meta);
    } catch { return getDefaultProviderSettings(); }
}

export function saveProviderSettings(settings) {
    const meta = getProviderMeta(settings.providerId);
    const safe = normalizeProviderSettings({ ...settings, providerId: meta.id }, meta);
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    return safe;
}
