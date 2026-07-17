import { GeminiProvider } from './gemini-provider.js';
import { OpenAICompatibleProvider } from './openai-provider.js';

const PROVIDER_IDS = {
    GEMINI: 'gemini',
    NVIDIA: 'nvidia',
    OPENAI: 'openai',
    OFFLINE: 'offline'
};

const PROVIDER_META = {
    [PROVIDER_IDS.GEMINI]: { label: 'Gemini (Google)', keyRequired: true, defaultKeyHint: 'AIza...' },
    [PROVIDER_IDS.NVIDIA]: { label: 'NVIDIA NIM', keyRequired: true, defaultKeyHint: 'nvapi...' },
    [PROVIDER_IDS.OPENAI]: { label: 'OpenAI Uyumlu', keyRequired: true, defaultKeyHint: 'sk-...' },
    [PROVIDER_IDS.OFFLINE]: { label: 'Çevrimdışı (Simülasyon)', keyRequired: false, defaultKeyHint: '' }
};

export class ProviderRegistry {
    constructor() {
        this._providers = new Map();
        this._registerDefaults();
    }

    _registerDefaults() {
        this.register(PROVIDER_IDS.GEMINI, new GeminiProvider(), PROVIDER_META[PROVIDER_IDS.GEMINI]);
        this.register(PROVIDER_IDS.NVIDIA, new OpenAICompatibleProvider({
            baseURL: 'https://integrate.api.nvidia.com/v1',
            model: 'z-ai/glm-5.2'
        }), PROVIDER_META[PROVIDER_IDS.NVIDIA]);
        this.register(PROVIDER_IDS.OPENAI, new OpenAICompatibleProvider({
            baseURL: 'https://api.openai.com/v1',
            model: 'gpt-4o'
        }), PROVIDER_META[PROVIDER_IDS.OPENAI]);
    }

    register(id, provider, meta = {}) {
        if (this._providers.has(id)) throw new Error(`Provider zaten kayıtlı: ${id}`);
        this._providers.set(id, { provider, meta: { id, ...meta } });
    }

    getProvider(id) {
        const entry = this._providers.get(id);
        return entry ? entry.provider : null;
    }

    getMeta(id) {
        const entry = this._providers.get(id);
        return entry ? entry.meta : null;
    }

    getAllProviders() {
        return [...this._providers.entries()].map(([id, entry]) => ({ id, ...entry.meta }));
    }

    async generateText(providerId, promptText, apiKey) {
        const provider = this.getProvider(providerId);
        if (!provider) throw new Error(`Provider bulunamadı: ${providerId}`);
        return provider.generateText(promptText, apiKey);
    }

    async generateStructured(providerId, promptText, apiKey) {
        const provider = this.getProvider(providerId);
        if (!provider) throw new Error(`Provider bulunamadı: ${providerId}`);
        return provider.generateStructured(promptText, apiKey);
    }

    generateTextStream(providerId, promptText, apiKey) {
        const provider = this.getProvider(providerId);
        if (!provider) throw new Error(`Provider bulunamadı: ${providerId}`);
        return provider.generateTextStream(promptText, apiKey);
    }
}

export { PROVIDER_IDS, PROVIDER_META };
