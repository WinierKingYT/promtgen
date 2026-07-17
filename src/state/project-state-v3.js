import { UNIVERSAL_PHASES } from '../workflow/phases.js';
import { MODULE_NAMES, MODULE_REGISTRY, getModuleDataTemplate } from '../core/modules.js';
import { validateV3PatchProposal } from '../application/patch-policy.js';
import { invalidateApprovalsForPath } from '../application/approval-service.js';
import { buildStoreArrays, ENTITY_PREFIXES } from '../core/entity-store.js';

const ENTITY_STORE_TYPES = Object.keys(ENTITY_PREFIXES);

export function getInitialV3State() {
    return {
        schemaVersion: 3,
        revision: 1,
        phase: UNIVERSAL_PHASES.IDEA_CAPTURED,
        projectId: null,

        lifecycle: {
            status: 'active',
            createdAt: null,
            updatedAt: null
        },

        configuration: {
            language: 'tr',
            planningDepth: 'standard',
            exportMode: 'complete',
            activeModuleIds: [],
            privacyMode: 'local_private'
        },

        identity: {
            name: '',
            summary: '',
            problemStatement: '',
            desiredOutcome: ''
        },

        profile: {
            domains: [],
            projectModes: [],
            activatedModules: [],
            uncertainties: []
        },

        entityStores: buildStoreArrays(ENTITY_STORE_TYPES),

        objectives: [],
        stakeholders: [],
        constraints: [],
        assumptions: [],
        decisions: [],
        risks: [],
        openQuestions: [],

        scope: {
            mustHave: [],
            shouldHave: [],
            couldHave: [],
            notNow: [],
            outOfScope: []
        },

        deliverables: [],
        workstreams: [],
        tasks: [],
        dependencies: [],
        artifacts: [],

        approvals: {
            profile: null,
            objectives: null,
            scope: null,
            deliverables: null,
            executionPlan: null,
            finalReview: null
        },

        reviews: [],
        eventLog: [],

        pendingChangeSet: {
            baseRevision: 0,
            sourcePhase: null,
            suggestedNextPhase: null,
            patches: [],
            rejectedPatches: [],
            editedPatches: [],
            createdAt: null,
            approvalStatus: 'pending'
        },

        documents: [],

        moduleData: {
            software: null,
            game: null,
            research: null,
            business: null,
            content: null
        },

        stageHistory: [],
        metadata: {}
    };
}

export function activateModule(state, moduleName) {
    const cloned = JSON.parse(JSON.stringify(state));
    if (!cloned.profile.activatedModules.includes(moduleName)) {
        cloned.profile.activatedModules.push(moduleName);
    }
    if (!cloned.moduleData[moduleName]) {
        cloned.moduleData[moduleName] = getModuleDataTemplate(moduleName);
    }
    return cloned;
}

export function getModuleData(state, moduleName) {
    if (!state || !state.moduleData) return null;
    return state.moduleData[moduleName] || null;
}

export function ensureModuleData(state, moduleName) {
    if (!state || !state.moduleData) return state;
    if (!state.moduleData[moduleName]) {
        return activateModule(state, moduleName);
    }
    if (!state.profile?.activatedModules?.includes(moduleName)) {
        return activateModule(state, moduleName);
    }
    return state;
}

export function ensureApproval(state, approvalKey) {
    const cloned = JSON.parse(JSON.stringify(state));
    if (!cloned.approvals[approvalKey]) {
        cloned.approvals[approvalKey] = null;
    }
    return cloned;
}

export function applyV3StatePatch(state, patch, isSystem = false) {
    if (!patch || !patch.operation || !patch.path) return state;

    if (!isSystem) {
        const policyCheck = validateV3PatchProposal(state.phase, patch);
        if (!policyCheck.valid) {
            console.warn('Blocked patch application due to policy violation:', policyCheck.reason, patch);
            return state;
        }
    }

    let cloned = JSON.parse(JSON.stringify(state));
    if (cloned.approvals) {
        cloned = invalidateApprovalsForPath(cloned, patch.path);
    }
    const pathParts = patch.path.split('/').filter(p => p !== '');

    const polluted = pathParts.some(part => part === '__proto__' || part === 'constructor' || part === 'prototype');
    if (polluted) {
        console.warn('Blocked prototype pollution path attempt:', patch.path);
        return state;
    }

    let current = cloned;
    for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (current[part] === undefined) {
            current[part] = {};
        }
        current = current[part];
    }

    const lastPart = pathParts[pathParts.length - 1];

    if (patch.operation === 'add' || patch.operation === 'set') {
        if (Array.isArray(current)) {
            if (lastPart === '-') {
                current.push(patch.value);
            } else {
                const idx = parseInt(lastPart);
                if (!isNaN(idx)) {
                    current.splice(idx, 0, patch.value);
                }
            }
        } else {
            current[lastPart] = patch.value;
        }
    } else if (patch.operation === 'replace') {
        if (Array.isArray(current)) {
            const idx = parseInt(lastPart);
            if (!isNaN(idx) && idx >= 0 && idx < current.length) {
                current[idx] = patch.value;
            }
        } else {
            current[lastPart] = patch.value;
        }
    } else if (patch.operation === 'remove') {
        if (Array.isArray(current)) {
            const idx = parseInt(lastPart);
            if (!isNaN(idx) && idx >= 0 && idx < current.length) {
                current.splice(idx, 1);
            }
        } else {
            delete current[lastPart];
        }
    }

    cloned.revision += 1;
    return cloned;
}

export function validateV3State(state) {
    if (!state || typeof state !== 'object') return false;
    const requiredKeys = [
        'schemaVersion', 'revision', 'phase', 'identity', 'profile',
        'entityStores',
        'objectives', 'stakeholders', 'constraints', 'assumptions',
        'decisions', 'risks', 'openQuestions', 'scope',
        'deliverables', 'workstreams', 'tasks', 'dependencies', 'artifacts',
        'approvals', 'reviews', 'eventLog', 'pendingChangeSet',
        'documents', 'moduleData',
        'lifecycle', 'configuration', 'projectId',
        'stageHistory', 'metadata'
    ];
    for (const key of requiredKeys) {
        if (state[key] === undefined) return false;
    }

    if (typeof state.revision !== 'number' || state.revision <= 0) return false;
    if (!Array.isArray(state.profile.domains)) return false;
    if (typeof state.identity?.name !== 'string') return false;
    if (typeof state.identity?.summary !== 'string') return false;

    if (typeof state.configuration?.language !== 'string') return false;
    if (state.lifecycle?.status !== 'active' && state.lifecycle?.status !== 'archived') return false;

    if (!state.entityStores || typeof state.entityStores !== 'object') return false;

    if (!state.approvals || typeof state.approvals !== 'object') return false;
    const approvalKeys = ['profile', 'objectives', 'scope', 'deliverables', 'executionPlan', 'finalReview'];
    for (const k of approvalKeys) {
        const app = state.approvals[k];
        if (app !== null) {
            if (typeof app !== 'object') return false;
            if (app.status !== 'approved' && app.status !== 'rejected') return false;
            if (typeof app.artifactHash !== 'string' && typeof app.revision !== 'number') return false;
            if (typeof app.approvedAt !== 'string') return false;
            if (typeof app.notes !== 'string') return false;
        }
    }

    for (const d of state.profile.domains) {
        if (typeof d.confidence !== 'number' || d.confidence < 0 || d.confidence > 1) return false;
    }

    if (!state.pendingChangeSet || typeof state.pendingChangeSet !== 'object') return false;
    if (typeof state.pendingChangeSet.baseRevision !== 'number') return false;
    if (!Array.isArray(state.pendingChangeSet.patches)) return false;
    if (!Array.isArray(state.eventLog)) return false;
    if (!state.moduleData || typeof state.moduleData !== 'object') return false;

    const ids = new Set();
    const listsToCheck = [state.decisions, state.assumptions, state.risks, state.openQuestions, state.objectives, state.stakeholders, state.deliverables, state.workstreams];
    for (const list of listsToCheck) {
        if (Array.isArray(list)) {
            for (const item of list) {
                if (item && item.id) {
                    if (ids.has(item.id)) return false;
                    ids.add(item.id);
                }
            }
        }
    }

    return true;
}

export function legacyMigrateToV3(v2State) {
    if (!v2State) return getInitialV3State();
    const v3 = getInitialV3State();

    v3.revision = v2State.revision || 1;
    v3.projectId = v2State.projectId || null;

    v3.lifecycle.status = 'active';
    v3.lifecycle.createdAt = v2State.createdAt || null;
    v3.lifecycle.updatedAt = v2State.updatedAt || null;

    v3.identity = {
        name: v2State.identity?.name || '',
        summary: v2State.identity?.summary || '',
        problemStatement: v2State.identity?.problemStatement || v2State.identity?.problem || '',
        desiredOutcome: v2State.identity?.desiredOutcome || ''
    };

    v3.scope = v2State.scope || v3.scope;

    if (v2State.profile) {
        v3.profile.domains = v2State.profile.domains || [];
        v3.profile.uncertainties = v2State.profile.uncertainties || [];
        v3.profile.projectModes = v2State.profile.platforms || [];
    }

    function migrateArray(arr, type, idField, titleField) {
        if (!Array.isArray(arr)) return [];
        return arr.map((item, i) => ({
            id: item.id || `${ENTITY_PREFIXES[type]}-${i + 1}`,
            entityType: type,
            title: item[titleField] || item.title || '',
            description: item.description || item.text || '',
            status: 'draft',
            priority: item.priority || 'medium',
            sourceModule: 'universal',
            source: { type: 'migration', sourceId: null, evidenceType: 'direct_fact' },
            sensitivity: 'internal',
            version: 1,
            createdAtRevision: v3.revision,
            updatedAtRevision: v3.revision,
            tags: [],
            ...item
        }));
    }

    const entityMap = {
        objectives: 'objective', decisions: 'decision', assumptions: 'assumption',
        risks: 'risk', openQuestions: 'openQuestion', stakeholders: 'stakeholder',
        constraints: 'constraint', deliverables: 'deliverable', workstreams: 'workstream',
        tasks: 'task', dependencies: 'dependency', artifacts: 'artifact'
    };

    for (const [key, etype] of Object.entries(entityMap)) {
        if (v2State[key]) {
            const migrated = migrateArray(v2State[key], etype, 'id', 'title');
            v3[key] = migrated;
            v3.entityStores[etype] = migrated;
        }
    }

    if (v2State.requirements) {
        const reqs = [];
        const reqEntities = [];
        let reqIndex = 0;
        for (const category of ['functional', 'nonFunctional', 'domainSpecific']) {
            if (Array.isArray(v2State.requirements[category])) {
                v2State.requirements[category].forEach((r) => {
                    reqIndex++;
                    reqs.push({ id: `OBJ-${reqIndex}`, text: r, source: category });
                    reqEntities.push({
                        id: `REQ-${String(reqIndex).padStart(3, '0')}`,
                        entityType: 'requirement',
                        text: r, title: r, category,
                        description: '', status: 'draft', priority: 'medium',
                        sourceModule: 'universal',
                        source: { type: 'migration', sourceId: null, evidenceType: 'direct_fact' },
                        sensitivity: 'internal', version: 1,
                        createdAtRevision: v3.revision, updatedAtRevision: v3.revision, tags: []
                    });
                });
            }
        }
        v3.objectives = reqs;
        v3.entityStores.objective = reqs.map((r, i) => ({
            ...r, entityType: 'objective', title: r.text,
            description: '', status: 'draft', priority: 'medium',
            sourceModule: 'universal',
            source: { type: 'migration', sourceId: null, evidenceType: 'direct_fact' },
            sensitivity: 'internal', version: 1,
            createdAtRevision: v3.revision, updatedAtRevision: v3.revision, tags: []
        }));
        v3.entityStores.requirement = reqEntities;
    }

    v3.documents = v2State.documents || [];

    if (v2State.approvals) {
        const map = {
            profile: 'profile', mvpScope: 'scope', requirements: 'deliverables',
            technology: 'deliverables', architecture: 'deliverables',
            tasks: 'executionPlan', finalReview: 'finalReview'
        };
        for (const [oldKey, newKey] of Object.entries(map)) {
            if (v2State.approvals[oldKey] !== undefined) {
                v3.approvals[newKey] = v2State.approvals[oldKey];
            }
        }
    }

    if (v2State.architecture) {
        v3.moduleData.software = {
            platforms: v2State.profile?.platforms || [],
            technologyOptions: [], selectedStack: [],
            architecture: {
                components: v2State.architecture.components || [],
                dataFlows: v2State.architecture.dataFlows || [],
                integrations: v2State.architecture.integrations || []
            },
            dataModel: [], apiContracts: [], fileBlueprints: [], testStrategy: {}
        };
        if (!v3.profile.activatedModules.includes('software')) {
            v3.profile.activatedModules.push('software');
        }
    }

    if (v2State.agentPackage) {
        v3.documents.push({ name: 'agentPackage', content: JSON.stringify(v2State.agentPackage) });
    }

    if (v3.profile.activatedModules.length === 0) {
        v3.profile.activatedModules.push('software');
    }

    const phaseMap = {
        IDEA_CAPTURED: 'IDEA_CAPTURED', PROFILE_DRAFTED: 'PROJECT_PROFILED',
        DISCOVERY_IN_PROGRESS: 'DISCOVERY_IN_PROGRESS', MVP_DEFINED: 'SCOPE_DEFINED',
        REQUIREMENTS_DRAFTED: 'OBJECTIVES_DEFINED', TECH_OPTIONS_READY: 'EXECUTION_PLAN_DRAFTED',
        TECH_STACK_SELECTED: 'EXECUTION_PLAN_DRAFTED', ARCHITECTURE_DRAFTED: 'DELIVERABLES_DEFINED',
        TASKS_DRAFTED: 'EXECUTION_PLAN_DRAFTED', AGENT_PACKAGE_DRAFTED: 'EXECUTION_PLAN_DRAFTED',
        REVIEW_IN_PROGRESS: 'REVIEW_IN_PROGRESS', READY_FOR_EXPORT: 'READY_FOR_EXPORT',
        EXPORTED: 'EXPORTED'
    };
    v3.phase = phaseMap[v2State.workflowStage] || 'IDEA_CAPTURED';

    v3.reviews = v2State.reviews || [];
    v3.stageHistory = v2State.stageHistory || [];
    v3.eventLog = v2State.eventLog || [];

    if (v2State.configuration) {
        v3.configuration = { ...v3.configuration, ...v2State.configuration };
    }
    v3.configuration.activeModuleIds = v3.profile.activatedModules;

    v3.pendingChangeSet.baseRevision = v3.revision;
    if (v2State.pendingChangeSet) {
        v3.pendingChangeSet.patches = v2State.pendingChangeSet.patches || [];
        v3.pendingChangeSet.rejectedPatches = v2State.pendingChangeSet.rejectedPatches || [];
        v3.pendingChangeSet.editedPatches = v2State.pendingChangeSet.editedPatches || [];
        v3.pendingChangeSet.approvalStatus = v2State.pendingChangeSet.approvalStatus || 'pending';
    }

    return v3;
}
