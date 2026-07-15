export const INITIAL_APP_STATE = {
    apiKey: "",
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
}
