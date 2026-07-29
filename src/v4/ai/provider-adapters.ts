import { discoverySchema } from './schemas/schemas.js';
import { normalizeProviderSettings } from '../provider-url-policy.js';
import { redactSensitiveData } from '../security/secret-guard.js';

const MAX_PROVIDER_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_STRUCTURED_CONTENT_CHARS = 256 * 1024;

export interface StructuredProvider {
  model?: string;
  structured(input: {
    system: string;
    context: unknown;
    schema: { parse(value: unknown): unknown };
    signal?: AbortSignal;
  }): Promise<unknown>;
}

interface BoundedJsonResponse {
  headers?: { get(name: string): string | null };
  text?: () => Promise<string>;
  json?: () => Promise<unknown>;
}

async function readBoundedJsonResponse(response: BoundedJsonResponse): Promise<unknown> {
  const declaredLength = Number(response.headers?.get('content-length') || 0);
  if (declaredLength > MAX_PROVIDER_RESPONSE_BYTES) throw new Error('AI sağlayıcı yanıtı 2 MB sınırını aşıyor.');
  if (typeof response.text !== 'function') {
    if (typeof response.json !== 'function') throw new Error('AI sağlayıcı yanıtı okunamıyor.');
    return response.json();
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_PROVIDER_RESPONSE_BYTES) {
    throw new Error('AI sağlayıcı yanıtı 2 MB sınırını aşıyor.');
  }
  return JSON.parse(text);
}

function parseStructuredContent(value: unknown): unknown {
  const text = String(value || '');
  if (text.length > MAX_STRUCTURED_CONTENT_CHARS) throw new Error('AI yapılandırılmış içeriği 256 KB sınırını aşıyor.');
  return JSON.parse(text || '{}');
}

export function redactSensitiveText(text: string): string {
  return redactSensitiveData(text).redactedText;
}

export function validateSuggestionResponse(
  value: unknown,
  schema: { parse(value: unknown): unknown } = discoverySchema
): unknown {
  return schema.parse(value);
}

export class OllamaProvider implements StructuredProvider {
  readonly baseUrl: string;
  readonly model: string;

  constructor({ baseUrl = 'http://127.0.0.1:11434', model = 'llama3.2' } = {}) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  get capabilities() {
    return { structuredOutput: true, streaming: true, contextLimit: 8192, local: true };
  }

  async structured({ system, context, schema, signal }: Parameters<StructuredProvider['structured']>[0]) {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        format: 'json',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: redactSensitiveText(JSON.stringify(context)) }
        ]
      })
    });
    if (!response.ok) throw new Error(`Ollama isteği başarısız (${response.status}).`);
    const data = await readBoundedJsonResponse(response) as { message?: { content?: string } };
    return validateSuggestionResponse(parseStructuredContent(data.message?.content), schema);
  }
}

interface OpenAICompatibleConfiguration {
  id?: string;
  label?: string;
  baseUrl?: string;
  model?: string;
  credential?: string;
  local?: boolean;
}

export class OpenAICompatibleProvider implements StructuredProvider {
  readonly id: string;
  readonly label: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly credential: string;
  readonly local: boolean;

  constructor({
    id = 'openai',
    label = 'OpenAI',
    baseUrl = 'https://api.openai.com/v1',
    model = 'gpt-4.1-mini',
    credential = '',
    local = false
  }: OpenAICompatibleConfiguration = {}) {
    this.id = id;
    this.label = label;
    this.baseUrl = baseUrl;
    this.model = model;
    this.credential = credential;
    this.local = local;
  }

  get capabilities() {
    return { structuredOutput: true, streaming: true, contextLimit: 128000, local: this.local };
  }

  async text({ system, context, signal }: { system: string; context: unknown; signal?: AbortSignal }): Promise<string> {
    const response = await this.request({ system, context, signal, structured: false });
    return response.choices?.[0]?.message?.content || '';
  }

  async structured({ system, context, schema, signal }: Parameters<StructuredProvider['structured']>[0]) {
    const response = await this.request({ system, context, signal, structured: true });
    return validateSuggestionResponse(parseStructuredContent(response.choices?.[0]?.message?.content), schema);
  }

  private async request({
    system,
    context,
    signal,
    structured
  }: {
    system: string;
    context: unknown;
    signal?: AbortSignal;
    structured: boolean;
  }): Promise<{ choices?: Array<{ message?: { content?: string } }> }> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(this.credential ? { Authorization: `Bearer ${this.credential}` } : {})
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: redactSensitiveText(JSON.stringify(context)) }
        ],
        ...(structured ? { response_format: { type: 'json_object' } } : {})
      })
    });
    if (!response.ok) throw new Error(`${this.label} isteği başarısız (${response.status}).`);
    return await readBoundedJsonResponse(response) as { choices?: Array<{ message?: { content?: string } }> };
  }
}

export class GeminiProvider implements StructuredProvider {
  readonly id = 'gemini';
  readonly label = 'Gemini';
  readonly model: string;
  readonly credential: string;

  constructor({ model = 'gemini-2.5-flash', credential = '' } = {}) {
    this.model = model;
    this.credential = credential;
  }

  get capabilities() {
    return { structuredOutput: true, streaming: false, contextLimit: 1_000_000, local: false };
  }

  async structured({ system, context, schema, signal }: Parameters<StructuredProvider['structured']>[0]) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
      {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.credential },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: redactSensitiveText(JSON.stringify(context)) }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      }
    );
    if (!response.ok) throw new Error(`Gemini isteği başarısız (${response.status}).`);
    const data = await readBoundedJsonResponse(response) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return validateSuggestionResponse(parseStructuredContent(data.candidates?.[0]?.content?.parts?.[0]?.text), schema);
  }
}

export function createProvider(
  id: string,
  configuration: { model?: string; baseUrl?: string; credential?: string } = {}
): StructuredProvider {
  if (!['ollama', 'gemini', 'nvidia', 'openai'].includes(id)) {
    throw new Error(`Desteklenmeyen AI sağlayıcısı: ${id}`);
  }
  const normalized = normalizeProviderSettings(
    { providerId: id, ...configuration },
    { defaultModel: configuration.model }
  );
  const safeConfiguration = {
    ...configuration,
    model: normalized.model,
    baseUrl: normalized.baseUrl
  };
  if (id === 'ollama') return new OllamaProvider(safeConfiguration);
  if (id === 'gemini') return new GeminiProvider(safeConfiguration);
  if (id === 'nvidia') {
    return new OpenAICompatibleProvider({ ...safeConfiguration, id, label: 'NVIDIA NIM' });
  }
  return new OpenAICompatibleProvider({ ...safeConfiguration, id: 'openai', label: 'OpenAI' });
}
