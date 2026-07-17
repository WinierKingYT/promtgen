export const INITIAL_APP_STATE = {
    apiKey: "",
    providerCredentials: { gemini: "", nvidia: "", openai: "" },
    selectedProvider: "gemini",
    chatStarted: false,
    activeTab: "pipeline",
    activeSubagentKey: "",
    activeEditor: "cursor",
    stepDepth: 5,
    draftDescription: "",
    projectType: "universal",
    priorities: {
        ui: true,
        security: true,
        performance: true,
        scale: true
    },
    messages: [],
    historyStack: [],
    proposedPatches: [],
    suggestedNextStage: "",
    currentProjectState: null
};

export class AppStateManager {
    constructor() {
        this.state = JSON.parse(JSON.stringify(INITIAL_APP_STATE));
    }

    loadCredentials() {
        try {
            const saved = localStorage.getItem('ai_arch_credentials');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.state.providerCredentials = { ...this.state.providerCredentials, ...parsed };
            }
            const legacy = localStorage.getItem('ai_arch_api_key');
            if (legacy && !this.state.providerCredentials.gemini) {
                this.state.providerCredentials.gemini = legacy;
            }
        } catch (e) {
            console.error("Failed to load credentials", e);
        }
    }

    saveCredential(providerId, key) {
        this.state.providerCredentials[providerId] = key;
        this.state.apiKey = key;
        try {
            localStorage.setItem('ai_arch_credentials', JSON.stringify(this.state.providerCredentials));
        } catch (e) {
            console.error("Failed to save credentials", e);
        }
    }

    getCredential(providerId) {
        return this.state.providerCredentials[providerId] || '';
    }

    loadProvider() {
        try {
            const saved = localStorage.getItem('ai_arch_provider');
            if (saved) {
                this.state.selectedProvider = saved;
            }
        } catch (e) {
            console.error("Failed to load provider", e);
        }
    }

    saveProvider(providerId) {
        this.state.selectedProvider = providerId;
        try {
            localStorage.setItem('ai_arch_provider', providerId);
        } catch (e) {
            console.error("Failed to save provider", e);
        }
    }
}
