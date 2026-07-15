import { getInitialCanonicalState, validateCanonicalState } from './project-state.js';

/**
 * Migrates raw project states to the latest schema version (v2).
 * Ensures agentPackage, approvals, and workflowSuggestion fields are populated.
 * Throws an error on unknown future schema versions or if canonical validation fails.
 * 
 * @param {object} rawState
 * @returns {object} migrated state
 */
export function migrateProjectState(rawState) {
    if (!rawState || typeof rawState !== 'object') {
        return getInitialCanonicalState();
    }

    const state = JSON.parse(JSON.stringify(rawState));
    
    // Set default schemaVersion if missing
    if (state.schemaVersion === undefined) {
        state.schemaVersion = 1;
    }

    // Fail-closed on future/unknown schema versions
    if (state.schemaVersion > 2) {
        throw new Error(`Bilinmeyen/Geleceğe ait şema sürümü tespiti (Versiyon: ${state.schemaVersion}). Yükleme engellendi.`);
    }

    if (state.schemaVersion === 1) {
        // Upgrade v1 -> v2
        state.schemaVersion = 2;

        if (!state.agentPackage || typeof state.agentPackage !== 'object') {
            state.agentPackage = {
                subagents: [],
                rules: {
                    cursor: "",
                    windsurf: "",
                    copilot: ""
                },
                skillMarkdown: "",
                exportTargets: []
            };
        }

        if (!state.workflowSuggestion || typeof state.workflowSuggestion !== 'object') {
            state.workflowSuggestion = {
                stage: null,
                reason: ""
            };
        }

        if (!state.approvals || typeof state.approvals !== 'object') {
            state.approvals = {
                profile: null,
                mvpScope: null,
                requirements: null,
                technology: null,
                architecture: null,
                tasks: null,
                finalReview: null
            };
        }
    }

    // Ensure all v2 fields are absolutely present
    if (state.approvals === undefined) {
        state.approvals = {
            profile: null,
            mvpScope: null,
            requirements: null,
            technology: null,
            architecture: null,
            tasks: null,
            finalReview: null
        };
    }

    if (state.agentPackage === undefined) {
        state.agentPackage = {
            subagents: [],
            rules: {
                cursor: "",
                windsurf: "",
                copilot: ""
            },
            skillMarkdown: "",
            exportTargets: []
        };
    }

    if (state.workflowSuggestion === undefined) {
        state.workflowSuggestion = {
            stage: null,
            reason: ""
        };
    }

    // Run strict validation at the end of migration
    if (!validateCanonicalState(state)) {
        throw new Error("Migrasyon sonrası kanonik şema validasyonu başarısız oldu (Karantina).");
    }

    return state;
}
