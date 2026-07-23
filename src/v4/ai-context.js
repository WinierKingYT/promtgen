import { z } from 'zod';
import { projectInventoryContext, wrapUntrustedProjectContext } from './project-analyzer.js';
import { normalizeProviderSettings } from './provider-url-policy.js';

const MAX_PROVIDER_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_STRUCTURED_CONTENT_CHARS = 256 * 1024;
const planSectionSchema = z.enum(['vision', 'objectives', 'scope', 'requirements', 'decisions', 'architecture', 'security', 'tasks', 'risks', 'testing', 'deployment', 'operations']);
const shortText = z.string().trim().min(1).max(500);

export const suggestionResponseSchema = z.object({
    summary: z.string().trim().min(1).max(1200),
    options: z.array(z.object({
        kind: z.enum(['feature', 'decision', 'risk', 'question', 'architecture']).default('feature'),
        title: z.string().trim().min(1).max(160), description: z.string().trim().min(1).max(3000),
        pros: z.array(shortText).max(8), cons: z.array(shortText).max(8),
        effort: z.enum(['low', 'medium', 'high']), impact: z.enum(['low', 'medium', 'high']),
        affectedSections: z.array(planSectionSchema).min(1).max(12), recommended: z.boolean()
    }).strict()).min(3).max(5),
    openQuestions: z.array(shortText).max(12).default([])
}).strict();

async function readBoundedJsonResponse(response) {
    const declaredLength = Number(response.headers?.get?.('content-length') || 0);
    if (declaredLength > MAX_PROVIDER_RESPONSE_BYTES) throw new Error('AI sağlayıcı yanıtı 2 MB sınırını aşıyor.');
    if (typeof response.text !== 'function') return response.json();
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_PROVIDER_RESPONSE_BYTES) throw new Error('AI sağlayıcı yanıtı 2 MB sınırını aşıyor.');
    return JSON.parse(text);
}

function parseStructuredContent(value) {
    const text = String(value || '');
    if (text.length > MAX_STRUCTURED_CONTENT_CHARS) throw new Error('AI yapılandırılmış içeriği 256 KB sınırını aşıyor.');
    return JSON.parse(text || '{}');
}

export function buildPlanningContext(project, sectionId = null) {
    const section = sectionId ? project.sections[sectionId] : null;
    return {
        project: { name: project.identity.name, idea: project.identity.originalIdea, summary: project.identity.summary, depth: project.planningDepth.selected },
        phase: project.lifecycle.activePhase,
        acceptedDecisions: project.decisions.filter(item => item.status === 'accepted'),
        openQuestions: project.openQuestions,
        rejectedSuggestions: project.dismissedSuggestionFingerprints,
        importedProject: project.profile?.projectInventory ? wrapUntrustedProjectContext(projectInventoryContext(project.profile.projectInventory)) : null,
        relevantPlan: section ? { [section.id]: section } : Object.fromEntries(Object.values(project.sections).filter(item => item.required).map(item => [item.id, { content: item.content, items: item.items, status: item.status }]))
    };
}

export function redactSensitiveText(text) {
    return String(text || '')
        .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
        .replace(/sk-[a-z0-9_-]{16,}/gi, '[REDACTED_OPENAI_KEY]')
        .replace(/-----BEGIN [^-]+PRIVATE KEY-----[\s\S]*?-----END [^-]+PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]');
}

export function validateSuggestionResponse(value) { return suggestionResponseSchema.parse(value); }

export class OllamaProvider {
    constructor({ baseUrl = 'http://127.0.0.1:11434', model = 'llama3.2' } = {}) { this.baseUrl = baseUrl; this.model = model; }
    get capabilities() { return { structuredOutput: true, streaming: true, contextLimit: 8192, local: true }; }
    async structured({ system, context, signal }) {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: this.model, stream: false, format: 'json', messages: [{ role: 'system', content: system }, { role: 'user', content: redactSensitiveText(JSON.stringify(context)) }] })
        });
        if (!response.ok) throw new Error(`Ollama isteği başarısız (${response.status}).`);
        const data = await readBoundedJsonResponse(response);
        return validateSuggestionResponse(parseStructuredContent(data.message?.content));
    }
}

export class OpenAICompatibleProvider {
    constructor({ id = 'openai', label = 'OpenAI', baseUrl = 'https://api.openai.com/v1', model = 'gpt-4.1-mini', credential = '', local = false } = {}) {
        this.id = id; this.label = label; this.baseUrl = baseUrl; this.model = model; this.credential = credential; this.local = local;
    }
    get capabilities() { return { structuredOutput: true, streaming: true, contextLimit: 128000, local: this.local }; }
    async text({ system, context, signal }) {
        const response = await this.#request({ system, context, signal, structured: false });
        return response.choices?.[0]?.message?.content || '';
    }
    async structured({ system, context, signal }) {
        const response = await this.#request({ system, context, signal, structured: true });
        return validateSuggestionResponse(parseStructuredContent(response.choices?.[0]?.message?.content));
    }
    async #request({ system, context, signal, structured }) {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST', signal, headers: { 'Content-Type': 'application/json', ...(this.credential ? { Authorization: `Bearer ${this.credential}` } : {}) },
            body: JSON.stringify({ model: this.model, messages: [{ role: 'system', content: system }, { role: 'user', content: redactSensitiveText(JSON.stringify(context)) }], ...(structured ? { response_format: { type: 'json_object' } } : {}) })
        });
        if (!response.ok) throw new Error(`${this.label} isteği başarısız (${response.status}).`);
        return readBoundedJsonResponse(response);
    }
}

export class GeminiProvider {
    constructor({ model = 'gemini-2.5-flash', credential = '' } = {}) { this.id = 'gemini'; this.label = 'Gemini'; this.model = model; this.credential = credential; }
    get capabilities() { return { structuredOutput: true, streaming: false, contextLimit: 1000000, local: false }; }
    async structured({ system, context, signal }) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`, {
            method: 'POST', signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.credential },
            body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: redactSensitiveText(JSON.stringify(context)) }] }], generationConfig: { responseMimeType: 'application/json' } })
        });
        if (!response.ok) throw new Error(`Gemini isteği başarısız (${response.status}).`);
        const data = await readBoundedJsonResponse(response);
        return validateSuggestionResponse(parseStructuredContent(data.candidates?.[0]?.content?.parts?.[0]?.text));
    }
}

export function createProvider(id, configuration = {}) {
    if (!['ollama', 'gemini', 'nvidia', 'openai'].includes(id)) throw new Error(`Desteklenmeyen AI sağlayıcısı: ${id}`);
    const normalized = normalizeProviderSettings({ providerId: id, ...configuration }, { defaultModel: configuration.model });
    const safeConfiguration = { ...configuration, model: normalized.model, baseUrl: normalized.baseUrl };
    if (id === 'ollama') return new OllamaProvider(safeConfiguration);
    if (id === 'gemini') return new GeminiProvider(safeConfiguration);
    if (id === 'nvidia') return new OpenAICompatibleProvider({ ...safeConfiguration, id, label: 'NVIDIA NIM' });
    return new OpenAICompatibleProvider({ ...safeConfiguration, id: 'openai', label: 'OpenAI' });
}
