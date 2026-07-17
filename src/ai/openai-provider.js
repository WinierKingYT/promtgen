import { LLMProvider } from './llm-provider.js';
import OpenAI from 'openai';

export class OpenAICompatibleProvider extends LLMProvider {
    constructor(options = {}) {
        super();
        this._baseURL = options.baseURL || 'https://integrate.api.nvidia.com/v1';
        this._model = options.model || 'z-ai/glm-5.2';
    }

    get baseURL() { return this._baseURL; }
    get model() { return this._model; }

    async generateText(promptText, apiKey) {
        if (!apiKey) throw new Error('API Key is required.');
        const openai = new OpenAI({ apiKey, baseURL: this._baseURL });
        const completion = await openai.chat.completions.create({
            model: this._model,
            messages: [{ role: 'user', content: promptText }],
            temperature: 1,
            top_p: 1,
            max_tokens: 16384,
            seed: 42,
            stream: false
        });
        return completion.choices[0]?.message?.content || '';
    }

    async generateStructured(promptText, apiKey) {
        if (!apiKey) throw new Error('API Key is required.');
        const openai = new OpenAI({ apiKey, baseURL: this._baseURL });
        const completion = await openai.chat.completions.create({
            model: this._model,
            messages: [{ role: 'user', content: promptText }],
            temperature: 0.3,
            top_p: 1,
            max_tokens: 16384,
            seed: 42,
            response_format: { type: 'json_object' },
            stream: false
        });
        return completion.choices[0]?.message?.content || '';
    }

    async *generateTextStream(promptText, apiKey) {
        if (!apiKey) throw new Error('API Key is required.');
        const openai = new OpenAI({ apiKey, baseURL: this._baseURL });
        const stream = await openai.chat.completions.create({
            model: this._model,
            messages: [{ role: 'user', content: promptText }],
            temperature: 1,
            top_p: 1,
            max_tokens: 16384,
            seed: 42,
            stream: true
        });
        for await (const chunk of stream) {
            yield chunk.choices[0]?.delta?.content || '';
        }
    }
}
