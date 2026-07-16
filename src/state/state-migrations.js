import { getInitialCanonicalState, validateCanonicalState } from './project-state.js';
import { getInitialV3State, validateV3State, legacyMigrateToV3 } from './project-state-v3.js';

const MIGRATIONS = [
    { from: 1, to: 2, fn: migrateV1toV2 },
    { from: 2, to: 3, fn: migrateV2toV3 }
];

export function migrateProjectState(rawState) {
    if (!rawState || typeof rawState !== 'object') {
        return { success: true, state: getInitialV3State(), migrationsApplied: ['fresh-start-v3'] };
    }

    if (rawState.schemaVersion === 3) {
        const valid = validateV3State(rawState);
        if (!valid) {
            return {
                success: false,
                recoveryState: getInitialV3State(),
                originalState: rawState,
                errors: ['v3 state validasyonu başarısız.']
            };
        }
        return { success: true, state: JSON.parse(JSON.stringify(rawState)), migrationsApplied: [] };
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
            recoveryState: getInitialV3State(),
            originalState: rawState,
            errors: [`Bilinmeyen/Geleceğe ait şema sürümü (v${state.schemaVersion}). Yükleme engellendi.`]
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
            sourcePhase: state.phase || null,
            suggestedNextPhase: null,
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
        if (!validateV3State(state)) {
            errors.push('Migrasyon sonrası validasyon başarısız oldu.');
        }
    } catch (err) {
        errors.push(`Validasyon hatası: ${err.message}`);
    }

    if (errors.length > 0) {
        return {
            success: false,
            recoveryState: getInitialV3State(),
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
            rules: { cursor: '', windsurf: '', copilot: '' },
            skillMarkdown: '',
            exportTargets: []
        };
    }
    if (!state.workflowSuggestion || typeof state.workflowSuggestion !== 'object') {
        state.workflowSuggestion = { stage: null, reason: '' };
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
    const v3 = legacyMigrateToV3(state);

    state.schemaVersion = 3;
    state.phase = v3.phase;
    state.projectId = v3.projectId;
    state.lifecycle = v3.lifecycle;
    state.configuration = v3.configuration;
    state.entityStores = v3.entityStores;
    state.stageHistory = v3.stageHistory;
    state.metadata = v3.metadata;

    delete state.workflowStage;

    state.identity = v3.identity;
    state.objectives = v3.objectives;
    state.stakeholders = v3.stakeholders;
    state.constraints = v3.constraints;
    state.scope = v3.scope;
    state.deliverables = v3.deliverables;
    state.workstreams = v3.workstreams;
    state.tasks = v3.tasks;
    state.dependencies = v3.dependencies;
    state.artifacts = v3.artifacts;
    state.approvals = v3.approvals;
    state.moduleData = v3.moduleData;
    state.profile = v3.profile;

    delete state.requirements;
    delete state.architecture;
    delete state.agentPackage;
    delete state.workflowSuggestion;

    if (!state.documents) state.documents = [];
    if (!state.reviews) state.reviews = [];
    if (!state.eventLog) state.eventLog = [];

    if (!state.pendingChangeSet) {
        state.pendingChangeSet = {
            baseRevision: 0,
            sourcePhase: state.phase || null,
            suggestedNextPhase: null,
            patches: [],
            rejectedPatches: [],
            editedPatches: [],
            createdAt: null,
            approvalStatus: 'pending'
        };
    }
}
