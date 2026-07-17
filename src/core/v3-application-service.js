import { getInitialV3State, applyV3StatePatch } from '../state/project-state-v3.js';
import { applyPatchTransaction } from '../application/patch-transaction.js';
import { approveArtifact } from '../application/approval-service.js';
import { checkPhaseTransition } from '../workflow/transitions.js';
import { TraceabilityEngine } from './traceability/traceability-engine.js';
import { NODE_TYPES, EDGE_TYPES } from './traceability/traceability-types.js';
import { ReviewEngine } from './reviewer/review-engine.js';
import { ModuleRegistry } from './modules/module-registry.js';
import { ContributionExecutor } from './modules/contribution-executor.js';
import { getUniversalPack, getSoftwareWebPack, getGamePack, getResearchPack, getSoftwareOfflinePack, getSoftwareAuthPack } from './modules/domain-packs.js';
import { EventLog, EVENT_TYPES } from './state/event-log.js';
import { StateSnapshot } from './state/state-engine.js';
import { StatePrivacy, SENSITIVITY_LEVELS } from './state/state-privacy.js';
import * as DiscoveryEngine from '../discovery/discovery-engine.js';
import * as DecisionEngine from '../decision/decision-engine.js';
import * as ArtifactEngine from '../artifact/artifact-engine.js';
import * as TaskEngine from '../task/task-engine.js';
import * as PromptEngine from '../prompt/prompt-engine.js';

export class V3ProjectApplicationService {
    constructor() {
        this.eventLog = new EventLog();
        this.snapshots = new StateSnapshot();
        this.privacy = new StatePrivacy();
        this.moduleRegistry = new ModuleRegistry();
        this.contributionExecutor = new ContributionExecutor(this.moduleRegistry);
        this.traceability = null;
        this.reviewer = null;
        this._initialized = false;
        this._decisionIndex = {};
        this._taskIndex = {};
        this._promptIndex = {};
    }

    initialize() {
        if (this._initialized) return;
        const packs = [
            getUniversalPack(), getSoftwareWebPack(), getGamePack(),
            getResearchPack(), getSoftwareOfflinePack(), getSoftwareAuthPack()
        ];
        for (const pack of packs) {
            try { this.moduleRegistry.register(pack); } catch {}
        }
        this._initialized = true;
    }

    createProject(draftText, profile) {
        this.initialize();

        const state = getInitialV3State();
        state.identity.name = 'Proje Taslağı';
        state.identity.summary = draftText;
        state.identity.problemStatement = draftText;
        state.profile = profile;
        state.lifecycle.createdAt = new Date().toISOString();
        state.lifecycle.updatedAt = state.lifecycle.createdAt;

        const revision = 1;
        state.revision = revision;

        this.eventLog.log(EVENT_TYPES.STATE_CREATED, {
            description: 'Yeni V3 projesi oluşturuldu',
            data: { phase: state.phase, draftLength: draftText.length }
        }, { revision });

        return state;
    }

    applyPatches(state, patches, expectedRevision) {
        this.initialize();

        if (!state || !patches || patches.length === 0) {
            return { success: true, state, appliedPatches: [], invalidatedApprovals: [], auditEvents: [] };
        }

        const result = applyPatchTransaction({
            state,
            patches,
            stage: state.phase || 'IDEA_CAPTURED',
            expectedRevision
        });

        if (result.success) {
            const revision = result.state.revision;

            for (const patch of result.appliedPatches) {
                const patchObj = patches.find(p => p.id === patch || p.path === patch);
                this.eventLog.log(EVENT_TYPES.ENTITY_UPDATED, {
                    entityId: patch,
                    patchId: patch,
                    data: { path: patchObj?.path, operation: patchObj?.operation }
                }, { revision });
            }

            for (const key of result.invalidatedApprovals) {
                this.eventLog.log(EVENT_TYPES.APPROVAL_INVALIDATED, {
                    approvalKey: key,
                    data: { reason: 'patch_triggered' }
                }, { revision });
            }

            this.traceability = this.buildTraceability(result.state);
            this.reviewer = this.createReviewer(this.traceability);
        }

        return result;
    }

    approvePhase(state, phase) {
        this.initialize();

        const approvalKey = this._getPhaseApprovalKey(phase);
        if (!approvalKey) return { success: false, error: `Onay anahtarı bulunamadı: ${phase}` };

        const newState = approveArtifact(state, approvalKey, 'Kullanıcı onayı');

        this.eventLog.log(EVENT_TYPES.APPROVAL_GRANTED, {
            approvalKey,
            data: { phase }
        }, { revision: newState.revision });

        return { success: true, state: newState };
    }

    runPipeline(state, userMessage = '', options = {}) {
        this.initialize();
        const log = [];
        let currentState = JSON.parse(JSON.stringify(state));

        // 1. Module contributions
        const activeModules = currentState.configuration?.activeModuleIds || [];
        if (activeModules.length > 0) {
            const contribResult = this.contributionExecutor.executeContributions(
                [...activeModules, 'universal'], currentState
            );
            if (contribResult.patches.length > 0) {
                const txResult = applyPatchTransaction({
                    state: currentState,
                    patches: contribResult.patches,
                    stage: currentState.phase,
                    expectedRevision: currentState.revision
                });
                if (txResult.success) {
                    currentState = txResult.state;
                    log.push({ step: 'contributions', patches: contribResult.patches.length });
                }
            }
        }

        // 2. Discovery - detect gaps for current phase
        const gaps = DiscoveryEngine.detectGaps(currentState, currentState.phase);
        const blockingGaps = gaps.filter(g => g.blocksCurrent);
        const readiness = DiscoveryEngine.assessReadiness(currentState, currentState.phase);
        log.push({ step: 'discovery', gaps: gaps.length, blocking: blockingGaps.length, readiness: readiness.ready });

        // 3. Track decisions, tasks, prompts in internal indices
        this._indexEntities(currentState);

        return {
            state: currentState,
            log,
            gaps,
            readiness,
            decisions: currentState.decisions || [],
            tasks: currentState.tasks || [],
            prompts: currentState.prompts || []
        };
    }

    createDecision(state, decisionData) {
        const rev = state.revision;
        const dec = DecisionEngine.createDecision(decisionData, rev);
        const newState = JSON.parse(JSON.stringify(state));
        if (!Array.isArray(newState.decisions)) newState.decisions = [];
        newState.decisions.push(dec);
        newState.revision = rev + 1;
        this.eventLog.log(EVENT_TYPES.ENTITY_UPDATED, {
            entityId: dec.id,
            data: { type: 'decision', title: dec.title }
        }, { revision: newState.revision });
        return { decision: dec, state: newState };
    }

    runDiscovery(state, answerMap = {}) {
        let currentState = JSON.parse(JSON.stringify(state));
        for (const [gapId, answer] of Object.entries(answerMap)) {
            const patchResult = DiscoveryEngine.processDiscoveryAnswer(currentState, gapId, answer, currentState.revision);
            if (patchResult.patches) {
                const txResult = applyPatchTransaction({
                    state: currentState,
                    patches: patchResult.patches,
                    stage: currentState.phase,
                    expectedRevision: currentState.revision
                });
                if (txResult.success) currentState = txResult.state;
            }
        }
        return currentState;
    }

    generateArtifact(state, type, extraContext = {}) {
        const ctx = ArtifactEngine.buildArtifactContextFromState(state, extraContext);
        const result = ArtifactEngine.generateArtifact(type, ctx);
        if (result.error) return { success: false, error: result.error };
        this.eventLog.log(EVENT_TYPES.ENTITY_UPDATED, {
            entityId: result.artifact.id,
            data: { type: 'artifact_generated', artifactType: type }
        }, { revision: state.revision });
        return { success: true, artifact: result.artifact };
    }

    createTask(state, taskData) {
        const rev = state.revision;
        const task = TaskEngine.createTask(taskData, rev);
        const newState = JSON.parse(JSON.stringify(state));
        if (!Array.isArray(newState.tasks)) newState.tasks = [];
        newState.tasks.push(task);
        newState.revision = rev + 1;
        this.eventLog.log(EVENT_TYPES.ENTITY_UPDATED, {
            entityId: task.id,
            data: { type: 'task', title: task.title }
        }, { revision: newState.revision });
        return { task, state: newState };
    }

    createPrompt(state, promptData) {
        const rev = state.revision;
        const prompt = PromptEngine.createPrompt(promptData, rev);
        return { prompt, state };
    }

    _indexEntities(state) {
        if (Array.isArray(state.decisions)) {
            for (const d of state.decisions) this._decisionIndex[d.id] = d;
        }
        if (Array.isArray(state.tasks)) {
            for (const t of state.tasks) this._taskIndex[t.id] = t;
        }
        if (Array.isArray(state.prompts)) {
            for (const p of state.prompts) this._promptIndex[p.id] = p;
        }
    }

    checkAndApplyPhaseTransition(state) {
        this.initialize();

        const currentPhase = state.phase;
        const check = checkPhaseTransition(state, currentPhase);
        if (!check.allowed || check.nextStage === currentPhase) {
            return { success: false, transitioned: false, currentPhase, nextPhase: check.nextStage, reason: check.reason || 'Geçiş koşulları sağlanmadı.' };
        }

        const newState = applyV3StatePatch(state, {
            operation: 'replace',
            path: '/phase',
            value: check.nextStage
        }, true);

        this.eventLog.log(EVENT_TYPES.PHASE_TRANSITION, {
            fromPhase: currentPhase,
            toPhase: check.nextStage,
            data: { reason: check.reason || '' }
        }, { revision: newState.revision });

        return { success: true, transitioned: true, currentPhase, nextPhase: check.nextStage, state: newState };
    }

    buildTraceability(state) {
        this.initialize();
        if (!state) return null;

        const engine = new TraceabilityEngine();
        const g = engine.graph;

        const entitySources = {
            objective: { type: NODE_TYPES.OBJECTIVE, idField: 'id', titleField: 'title', store: 'objectives' },
            stakeholder: { type: NODE_TYPES.STAKEHOLDER, idField: 'id', titleField: 'title', store: 'stakeholders' },
            constraint: { type: NODE_TYPES.CONSTRAINT, idField: 'id', titleField: 'title', store: 'constraints' },
            assumption: { type: NODE_TYPES.ASSUMPTION, idField: 'id', titleField: 'title', store: 'assumptions' },
            decision: { type: NODE_TYPES.DECISION, idField: 'id', titleField: 'title', store: 'decisions' },
            risk: { type: NODE_TYPES.RISK, idField: 'id', titleField: 'title', store: 'risks' },
            openQuestion: { type: NODE_TYPES.OPEN_QUESTION, idField: 'id', titleField: 'title', store: 'openQuestions' },
            deliverable: { type: NODE_TYPES.DELIVERABLE, idField: 'id', titleField: 'title', store: 'deliverables' },
            workstream: { type: NODE_TYPES.WORKSTREAM, idField: 'id', titleField: 'title', store: 'workstreams' },
            task: { type: NODE_TYPES.TASK, idField: 'id', titleField: 'title', store: 'tasks' },
            artifact: { type: NODE_TYPES.ARTIFACT, idField: 'id', titleField: 'title', store: 'artifacts' }
        };

        for (const [, cfg] of Object.entries(entitySources)) {
            const items = state[cfg.store];
            if (Array.isArray(items)) {
                for (const item of items) {
                    const id = item[cfg.idField];
                    if (id) {
                        try { g.addNode(cfg.type, id, item[cfg.titleField] || item.name || id, { ...item }); }
                        catch { /* duplicate - skip */ }
                    }
                }
            }
        }

        if (state.entityStores) {
            const storeArtifacts = state.entityStores.artifact;
            if (Array.isArray(storeArtifacts)) {
                for (const a of storeArtifacts) {
                    if (!g.getNode(a.id)) {
                        try { g.addNode(NODE_TYPES.ARTIFACT, a.id, a.title || a.name || a.id, { ...a }); } catch {}
                    }
                }
            }
            const storeTests = state.entityStores.test;
            if (Array.isArray(storeTests)) {
                for (const t of storeTests) {
                    if (!g.getNode(t.id)) {
                        try { g.addNode(NODE_TYPES.TEST, t.id, t.title || t.name || t.id, { ...t }); } catch {}
                    }
                }
            }
        }

        this._buildEdgesFromReferences(g, state);

        return engine;
    }

    _buildEdgesFromReferences(g, state) {
        const edges = [];

        const tasks = g.getNodesByType(NODE_TYPES.TASK);
        const decisions = g.getNodesByType(NODE_TYPES.DECISION);
        const objectives = g.getNodesByType(NODE_TYPES.OBJECTIVE);
        const artifacts = g.getNodesByType(NODE_TYPES.ARTIFACT);

        for (const task of tasks) {
            const meta = task.metadata || {};
            const inputIds = meta.inputArtifactIds || meta.sourceIds || [];
            const outputIds = meta.outputArtifactIds || [];
            const depTaskIds = meta.dependsOn || meta.dependencyIds || [];

            for (const artId of inputIds) {
                if (g.getNode(artId)) edges.push({ s: task.id, t: artId, type: EDGE_TYPES.CONSUMES });
            }
            for (const artId of outputIds) {
                if (g.getNode(artId)) edges.push({ s: task.id, t: artId, type: EDGE_TYPES.PRODUCES });
            }
            for (const depId of depTaskIds) {
                if (g.getNode(depId)) edges.push({ s: task.id, t: depId, type: EDGE_TYPES.DEPENDS_ON });
            }

            if (meta.sourceEntityIds && Array.isArray(meta.sourceEntityIds)) {
                for (const srcId of meta.sourceEntityIds) {
                    if (g.getNode(srcId)) edges.push({ s: task.id, t: srcId, type: EDGE_TYPES.IMPLEMENTS });
                }
            }
        }

        for (const dec of decisions) {
            const meta = dec.metadata || {};
            if (meta.sourceRequirementIds && Array.isArray(meta.sourceRequirementIds)) {
                for (const reqId of meta.sourceRequirementIds) {
                    if (g.getNode(reqId)) edges.push({ s: dec.id, t: reqId, type: EDGE_TYPES.SUPPORTS });
                }
            }
            if (meta.affectedEntityIds && Array.isArray(meta.affectedEntityIds)) {
                for (const affId of meta.affectedEntityIds) {
                    if (g.getNode(affId)) edges.push({ s: dec.id, t: affId, type: EDGE_TYPES.RELATES_TO });
                }
            }
        }

        for (const art of artifacts) {
            const meta = art.metadata || {};
            if (meta.sourceDecisionIds && Array.isArray(meta.sourceDecisionIds)) {
                for (const decId of meta.sourceDecisionIds) {
                    if (g.getNode(decId)) edges.push({ s: art.id, t: decId, type: EDGE_TYPES.DOCUMENTS });
                }
            }
        }

        for (const obj of objectives) {
            if (obj.metadata?.sourceRequirementIds) {
                for (const reqId of obj.metadata.sourceRequirementIds) {
                    if (g.getNode(reqId)) edges.push({ s: obj.id, t: reqId, type: EDGE_TYPES.REFINES });
                }
            }
        }

        for (const e of edges) {
            try { g.addEdge(e.s, e.t, e.type || EDGE_TYPES.SUPPORTS, { source: 'reference' }); } catch {}
        }
    }

    createReviewer(traceabilityEngine = null) {
        this.initialize();
        const reviewer = new ReviewEngine();
        if (traceabilityEngine) {
            reviewer.setTraceability(traceabilityEngine);
        }
        return reviewer;
    }

    runReview(state, profile = 'standard') {
        this.initialize();

        if (!this.traceability) {
            this.traceability = this.buildTraceability(state);
        }
        if (!this.reviewer) {
            this.reviewer = this.createReviewer(this.traceability);
        }

        const context = this._buildReviewContext(state);
        const report = this.reviewer.runReview(context, profile);

        this.eventLog.log('REVIEW_COMPLETED', {
            data: { profile, health: report.health.overall, findings: report.findings.total }
        }, { revision: state.revision, custom: true });

        return report;
    }

    saveSnapshot(state, label = '') {
        return this.snapshots.create(state, state.revision, label);
    }

    getEventLog(filters = {}) {
        return this.eventLog.getEvents(filters);
    }

    exportStateSafe(state, level = SENSITIVITY_LEVELS.PUBLIC) {
        return this.privacy.getSafeExport(state, level);
    }

    _buildReviewContext(state) {
        return {
            state,
            modules: state.configuration?.activeModuleIds || [],
            activeModules: [...(state.configuration?.activeModuleIds || []), 'universal'],
            objectives: state.objectives || [],
            decisions: state.decisions || [],
            tasks: state.tasks || [],
            artifacts: state.artifacts || [],
            prompts: state.prompts || [],
            approvals: state.approvals || {},
            phase: state.phase,
            traceability: this.traceability
        };
    }

    _getPhaseApprovalKey(phase) {
        const map = {
            PROJECT_PROFILED: 'profile',
            SCOPE_DEFINED: 'scope',
            EXECUTION_PLAN_DRAFTED: 'executionPlan'
        };
        return map[phase] || null;
    }
}
