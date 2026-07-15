import { getInitialCanonicalState, validateCanonicalState } from './project-state.js';

const MIGRATIONS = [
    { from: 1, to: 2, fn: migrateV1toV2 },
    { from: 2, to: 3, fn: migrateV2toV3 }
];

export function migrateProjectState(rawState) {
    if (!rawState || typeof rawState !== 'object') {
        return { success: true, state: getInitialCanonicalState(), migrationsApplied: ['fresh-start'] };
    }

    const state = JSON.parse(JSON.stringify(rawState));
    const errors = [];
    const migrationsApplied = [];

    if (state.schemaVersion === undefined) {
        state.schemaVersion = 1;
    }

    if (state.schemaVersion > 3) {
        return {
            success: false,
            recoveryState: getInitialCanonicalState(),
            originalState: rawState,
            errors: [`Bilinmeyen/Geleceğe ait şema sürümü tespiti (Versiyon: ${state.schemaVersion}). Yükleme engellendi.`]
        };
    }

    let currentVersion = state.schemaVersion;
    while (currentVersion < 3) {
        const migration = MIGRATIONS.find(m => m.from === currentVersion);
        if (!migration) break;
        try {
            migration.fn(state);
            migrationsApplied.push(`v${migration.from}-to-v${migration.to}`);
            currentVersion = migration.to;
            state.schemaVersion = currentVersion;
        } catch (err) {
            errors.push(`Migrasyon v${currentVersion} -> v${currentVersion + 1} başarısız: ${err.message}`);
            break;
        }
    }

    if (!state.pendingChangeSet) {
        state.pendingChangeSet = {
            baseRevision: 0,
            sourceStage: null,
            suggestedNextStage: null,
            patches: [],
            rejectedPatches: [],
            editedPatches: [],
            createdAt: null,
            approvalStatus: 'pending'
        };
    }

    if (!state.eventLog) {
        state.eventLog = [];
    }

    if (!state.documents) {
        state.documents = [];
    }

    try {
        if (!validateCanonicalState(state)) {
            errors.push("Migrasyon sonrası kanonik şema validasyonu başarısız oldu.");
        }
    } catch (err) {
        errors.push(`Validasyon hatası: ${err.message}`);
    }

    if (errors.length > 0) {
        return {
            success: false,
            recoveryState: getInitialCanonicalState(),
            originalState: rawState,
            errors
        };
    }

    return {
        success: true,
        state,
        migrationsApplied
    };
}

function migrateV1toV2(state) {
    if (!state.agentPackage || typeof state.agentPackage !== 'object') {
        state.agentPackage = {
            subagents: [],
            rules: { cursor: "", windsurf: "", copilot: "" },
            skillMarkdown: "",
            exportTargets: []
        };
    }

    if (!state.workflowSuggestion || typeof state.workflowSuggestion !== 'object') {
        state.workflowSuggestion = { stage: null, reason: "" };
    }

    if (!state.approvals || typeof state.approvals !== 'object') {
        state.approvals = {
            profile: null, mvpScope: null, requirements: null,
            technology: null, architecture: null, tasks: null, finalReview: null
        };
    }

    if (!state.documents) {
        state.documents = [];
    }
}

function migrateV2toV3(state) {
    if (!state.pendingChangeSet || typeof state.pendingChangeSet !== 'object') {
        state.pendingChangeSet = {
            baseRevision: 0,
            sourceStage: null,
            suggestedNextStage: null,
            patches: [],
            rejectedPatches: [],
            editedPatches: [],
            createdAt: null,
            approvalStatus: 'pending'
        };
    }

    if (!state.eventLog || !Array.isArray(state.eventLog)) {
        state.eventLog = [];
    }

    if (!state.documents) {
        state.documents = [];
    }
}
