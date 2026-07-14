import { LLMProvider } from './llm-provider.js';
import { GoogleGenerativeAI } from 'https://esm.run/@google/generative-ai';

export class GeminiProvider extends LLMProvider {
    async generateText(promptText, apiKey) {
        if (!apiKey) throw new Error("API Key is required.");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(promptText);
        return result.response.text();
    }

    async generateStructured(promptText, apiKey) {
        if (!apiKey) throw new Error("API Key is required.");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });
        const result = await model.generateContent(promptText);
        return result.response.text();
    }
}
