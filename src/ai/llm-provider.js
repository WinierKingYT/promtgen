export class LLMProvider {
    async generateText(promptText, apiKey) {
        throw new Error("generateText not implemented");
    }

    async generateStructured(promptText, apiKey) {
        throw new Error("generateStructured not implemented");
    }

    async *generateTextStream(promptText, apiKey) {
        throw new Error("generateTextStream not implemented");
    }
}
