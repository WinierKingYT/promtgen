import { LLMProvider } from './llm-provider.js';
import OpenAI from 'openai';

export class OpenAICompatibleProvider extends LLMProvider {
    constructor(options = {}) {
        super();
        this._baseURL = options.baseURL || 'https://integrate.api.nvidia.com/v1';
        this._model = options.model || 'deepseek-ai/deepseek-v4-pro';
        this._jsonMode = options.jsonMode !== false;
        this._extraBody = options.extraBody || null;
        this._topP = options.topP !== undefined ? options.topP : 0.95;
    }

    get baseURL() { return this._baseURL; }
    get model() { return this._model; }

    _buildParams(messages, opts = {}) {
        const params = {
            model: this._model,
            messages,
            temperature: opts.temperature ?? 1,
            top_p: this._topP,
            max_tokens: opts.maxTokens ?? 16384,
            seed: opts.seed ?? 42,
            stream: opts.stream ?? false
        };
        if (opts.jsonMode && this._jsonMode) {
            params.response_format = { type: 'json_object' };
        }
        if (this._extraBody) {
            params.extraBody = this._extraBody;
        }
        return params;
    }

    async generateText(promptText, apiKey) {
        if (!apiKey) throw new Error('API Key is required.');
        const openai = new OpenAI({ apiKey, baseURL: this._baseURL });
        const params = this._buildParams(
            [{ role: 'user', content: promptText }],
            { temperature: 1, stream: false }
        );
        const completion = await openai.chat.completions.create(params);
        return completion.choices[0]?.message?.content || '';
    }

    async generateStructured(promptText, apiKey) {
        if (!apiKey) throw new Error('API Key is required.');
        const openai = new OpenAI({ apiKey, baseURL: this._baseURL });
        const params = this._buildParams(
            [{ role: 'user', content: promptText }],
            { temperature: 0.3, jsonMode: true, stream: false }
        );
        const completion = await openai.chat.completions.create(params);
        return completion.choices[0]?.message?.content || '';
    }

    async *generateTextStream(promptText, apiKey) {
        if (!apiKey) throw new Error('API Key is required.');
        const openai = new OpenAI({ apiKey, baseURL: this._baseURL });
        const params = this._buildParams(
            [{ role: 'user', content: promptText }],
            { temperature: 1, stream: true }
        );
        const stream = await openai.chat.completions.create(params);
        for await (const chunk of stream) {
            yield chunk.choices[0]?.delta?.content || '';
        }
    }
}
