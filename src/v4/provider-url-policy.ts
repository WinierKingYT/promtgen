import type { ProviderMeta, ProviderSettings } from './provider-settings.js';

const PROVIDER_ENDPOINTS = Object.freeze({
    ollama: 'http://127.0.0.1:11434',
    openai: 'https://api.openai.com/v1',
    nvidia: 'https://integrate.api.nvidia.com/v1'
});

const PROVIDER_IDS = new Set(['offline', 'ollama', 'openai', 'gemini', 'nvidia']);
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const CONTROL_CHARACTER_PATTERN = new RegExp('[\\u0000-\\u001f\\u007f]');

function cleanModel(value: unknown, fallback: unknown): string {
    const model = String(value || fallback || '').trim();
    if (!model || model.length > 160 || CONTROL_CHARACTER_PATTERN.test(model)) {
        throw new Error('Model adı boş olamaz, 160 karakteri aşamaz veya kontrol karakteri içeremez.');
    }
    return model;
}

export function normalizeProviderBaseUrl(providerId: string, value: string = ''): string {
    if (providerId === 'openai' || providerId === 'nvidia') return PROVIDER_ENDPOINTS[providerId];
    if (providerId !== 'ollama') return '';
    const raw = String(value || PROVIDER_ENDPOINTS.ollama).trim().replace(/\/+$/, '');
    let url: URL;
    try { url = new URL(raw); }
    catch { throw new Error('Ollama API adresi geçerli bir URL olmalı.'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Ollama adresinde yalnız HTTP veya HTTPS kullanılabilir.');
    if (!LOOPBACK_HOSTS.has(url.hostname)) throw new Error('Ollama yalnız bu cihazdaki localhost/loopback adresine bağlanabilir.');
    if (url.username || url.password || url.search || url.hash) throw new Error('Ollama adresi kimlik bilgisi, sorgu veya fragment içeremez.');
    if (url.pathname !== '/' && url.pathname !== '') throw new Error('Ollama adresi yalnız origin içermeli; ek yol kullanılamaz.');
    return url.origin;
}

export function normalizeProviderSettings(settings: Partial<ProviderSettings> = {}, catalogEntry: Partial<ProviderMeta> = {}): ProviderSettings {
    const providerId = PROVIDER_IDS.has(settings.providerId as string) ? (settings.providerId as string) : 'offline';
    return {
        providerId,
        model: cleanModel(settings.model, catalogEntry.defaultModel || (providerId === 'offline' ? 'promtgen-local' : 'default')),
        baseUrl: normalizeProviderBaseUrl(providerId, settings.baseUrl || catalogEntry.defaultBaseUrl || ''),
        useAiWhenAvailable: settings.useAiWhenAvailable !== false,
        useLocalMemory: settings.useLocalMemory === true
    };
}

export function validateProviderSettings(settings: Partial<ProviderSettings> = {}, catalogEntry: Partial<ProviderMeta> = {}):
    | { valid: true; settings: ProviderSettings; error: null }
    | { valid: false; settings: null; error: string } {
    try { return { valid: true, settings: normalizeProviderSettings(settings, catalogEntry), error: null }; }
    catch (error) { return { valid: false, settings: null, error: error instanceof Error ? error.message : 'Geçersiz sağlayıcı ayarı.' }; }
}

// KALDIRILDI: `getFixedProviderEndpoint(providerId)`. Bu export'un tek
// koruyucusu `tests/v4/provider-url-policy-characterization.test.js` idi ve o
// test `.js`→`.ts` dönüşümü sırasında davranışı sabitlemek için yazılmıştı;
// dönüşüm bitti. Üretimde hiçbir çağıranı yoktu -- sabit endpoint'e ihtiyaç
// duyan tek yol zaten `normalizeProviderBaseUrl`, ve o `PROVIDER_ENDPOINTS`'i
// doğrudan okuyor. Geri gerekirse üç satır: `PROVIDER_ENDPOINTS` duruyor.
