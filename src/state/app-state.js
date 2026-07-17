export const INITIAL_APP_STATE = {
    apiKey: "",
    selectedProvider: "gemini",
    chatStarted: false,
    activeTab: "pipeline",
    activeSubagentKey: "",
    activeEditor: "cursor",
    stepDepth: 5, // Default standard depth
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
    proposedPatches: [], // Active AI proposed patches awaiting approval
    suggestedNextStage: "", // AI suggested workflow stage transition
    currentProjectState: null // Will hold the Canonical Project State
};

export class AppStateManager {
    constructor() {
        this.state = JSON.parse(JSON.stringify(INITIAL_APP_STATE));
    }

    loadApiKey() {
        try {
            const saved = localStorage.getItem('ai_arch_api_key');
            if (saved) {
                this.state.apiKey = saved;
            }
        } catch (e) {
            console.error("Failed to load api key from localstorage", e);
        }
    }

    saveApiKey(key) {
        this.state.apiKey = key;
        try {
            localStorage.setItem('ai_arch_api_key', key);
        } catch (e) {
            console.error("Failed to save api key to localstorage", e);
        }
    }

    loadProvider() {
        try {
            const saved = localStorage.getItem('ai_arch_provider');
            if (saved) {
                this.state.selectedProvider = saved;
            }
        } catch (e) {
            console.error("Failed to load provider from localstorage", e);
        }
    }

    saveProvider(providerId) {
        this.state.selectedProvider = providerId;
        try {
            localStorage.setItem('ai_arch_provider', providerId);
        } catch (e) {
            console.error("Failed to save provider to localstorage", e);
        }
    }
}
