import { getInitialV3State, applyV3StatePatch } from '../state/project-state-v3.js';
import { applyPatchTransaction } from '../application/patch-transaction.js';
import { approveArtifact } from '../application/approval-service.js';
import { checkPhaseTransition } from '../workflow/transitions.js';
import { getPhaseNext } from '../workflow/phase-contracts.js';
import { TraceabilityEngine } from './traceability/traceability-engine.js';
import { NODE_TYPES, EDGE_TYPES } from './traceability/traceability-types.js';
import { ReviewEngine } from './reviewer/review-engine.js';
import { ModuleRegistry } from './modules/module-registry.js';
import { ContributionExecutor } from './modules/contribution-executor.js';
import { getUniversalPack, getSoftwareWebPack, getGamePack, getResearchPack, getSoftwareOfflinePack, getSoftwareAuthPack, getSoftwarePack, getSoftwareAiPack, getPrivacyPack, getGameMultiplayerPack, getGameProceduralPack, getResearchQualitativePack, getResearchQuantitativePack, getDataAnalysisPack, getCloudOnlyPack } from './modules/domain-packs.js';
import { EventLog, EVENT_TYPES } from './state/event-log.js';
import { StateSnapshot } from './state/state-engine.js';
import { StatePrivacy, SENSITIVITY_LEVELS } from './state/state-privacy.js';
import { normalizeAIResponse, createEmptyResponse } from '../ai/chat-contract.js';
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
            getUniversalPack(), getSoftwarePack(), getSoftwareWebPack(), getGamePack(),
            getResearchPack(), getSoftwareOfflinePack(), getSoftwareAuthPack(),
            getSoftwareAiPack(), getPrivacyPack(), getGameMultiplayerPack(),
            getGameProceduralPack(), getResearchQualitativePack(), getResearchQuantitativePack(),
            getDataAnalysisPack(), getCloudOnlyPack()
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

        const domainIds = (profile.domains || []).map(d => d.id || d.name).filter(Boolean);
        const techIds = (profile.techStack || []).map(t => t.id || t.name).filter(Boolean);
        state.configuration = state.configuration || {};
        state.configuration.suggestedModuleIds = [...new Set([...(state.configuration.suggestedModuleIds || []), ...domainIds, ...techIds])];
        state.configuration.activeModuleIds = ['universal'];

        const revision = 1;
        state.revision = revision;

        this.eventLog.log(EVENT_TYPES.STATE_CREATED, {
            description: 'Yeni V3 projesi oluşturuldu',
            data: { phase: state.phase, draftLength: draftText.length, suggestedModuleIds: state.configuration.suggestedModuleIds }
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
        const patch = { operation: 'add', path: '/decisions/-', value: dec, id: `create-decision-${dec.id}` };
        const txResult = applyPatchTransaction({
            state: JSON.parse(JSON.stringify(state)),
            patches: [patch],
            stage: state.phase,
            expectedRevision: rev
        });
        if (!txResult.success) {
            return { decision: dec, state, error: txResult.error };
        }
        this.eventLog.log(EVENT_TYPES.ENTITY_UPDATED, {
            entityId: dec.id,
            data: { type: 'decision', title: dec.title }
        }, { revision: txResult.state.revision });
        return { decision: dec, state: txResult.state };
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
        const artifact = result.artifact;
        const patch = { operation: 'add', path: '/artifacts/-', value: artifact, id: `create-artifact-${artifact.id}` };
        const txResult = applyPatchTransaction({
            state: JSON.parse(JSON.stringify(state)),
            patches: [patch],
            stage: state.phase,
            expectedRevision: state.revision
        });
        if (!txResult.success) {
            return { success: false, artifact, error: txResult.error };
        }
        this.eventLog.log(EVENT_TYPES.ENTITY_UPDATED, {
            entityId: artifact.id,
            data: { type: 'artifact_generated', artifactType: type }
        }, { revision: txResult.state.revision });
        return { success: true, artifact, state: txResult.state };
    }

    createTask(state, taskData) {
        const rev = state.revision;
        const task = TaskEngine.createTask(taskData, rev);
        const patch = { operation: 'add', path: '/tasks/-', value: task, id: `create-task-${task.id}` };
        const txResult = applyPatchTransaction({
            state: JSON.parse(JSON.stringify(state)),
            patches: [patch],
            stage: state.phase,
            expectedRevision: rev
        });
        if (!txResult.success) {
            return { task, state, error: txResult.error };
        }
        this.eventLog.log(EVENT_TYPES.ENTITY_UPDATED, {
            entityId: task.id,
            data: { type: 'task', title: task.title }
        }, { revision: txResult.state.revision });
        return { task, state: txResult.state };
    }

    createPrompt(state, promptData) {
        const rev = state.revision;
        const prompt = PromptEngine.createPrompt(promptData, rev);
        const patch = { operation: 'add', path: '/prompts/-', value: prompt, id: `create-prompt-${prompt.id}` };
        const txResult = applyPatchTransaction({
            state: JSON.parse(JSON.stringify(state)),
            patches: [patch],
            stage: state.phase,
            expectedRevision: rev
        });
        if (!txResult.success) {
            return { prompt, state, error: txResult.error };
        }
        this.eventLog.log(EVENT_TYPES.ENTITY_UPDATED, {
            entityId: prompt.id,
            data: { type: 'prompt', title: prompt.title }
        }, { revision: txResult.state.revision });
        return { prompt, state: txResult.state };
    }

    processTurn({ state, userMessage = '', aiResponse = null, expectedRevision } = {}) {
        this.initialize();
        if (!state) return { success: false, error: 'State gerekli' };

        const log = [];
        const originalRevision = expectedRevision !== undefined ? expectedRevision : state.revision;

        // 1. Normalize AI response (handles both legacy and V3 formats)
        const normalized = aiResponse ? normalizeAIResponse(aiResponse) : createEmptyResponse();

        // 2. Validate response schema
        const validationErrors = this._validateProposal(normalized);
        if (validationErrors.length > 0) {
            return {
                success: false,
                error: `AI yanıtı geçersiz: ${validationErrors.join('; ')}`,
                normalized,
                validationErrors,
                state
            };
        }

        const patches = normalized.proposedPatches || [];
        log.push({ step: 'normalize', patches: patches.length });

        // 3. Discovery: detect gaps without modifying state
        let gaps = [];
        let readiness = null;
        let discoveryPatches = [];
        try {
            gaps = DiscoveryEngine.detectGaps(state, state.phase);
            readiness = DiscoveryEngine.assessReadiness(state, state.phase);

            // If user message is provided, try to interpret as gap answer
            if (userMessage && gaps.length > 0) {
                const answeredGap = this._matchMessageToGap(userMessage, gaps, state);
                if (answeredGap) {
                    const answerResult = DiscoveryEngine.processDiscoveryAnswer(
                        state, answeredGap.id, userMessage, originalRevision
                    );
                    if (answerResult.patches && answerResult.patches.length > 0) {
                        discoveryPatches = answerResult.patches;
                    }
                }
            }
        } catch (e) {
            console.warn('Discovery error:', e);
        }
        log.push({ step: 'discovery', gaps: gaps.length, discoveryPatches: discoveryPatches.length });

        // 5. Build pending proposals (DO NOT modify state)
        const pendingProposals = {
            baseRevision: originalRevision,
            patches: [...patches, ...discoveryPatches],
            decisions: normalized.proposedDecisions || [],
            artifacts: normalized.proposedArtifacts || [],
            tasks: normalized.proposedTasks || [],
            traceLinks: normalized.proposedTraceLinks || [],
            actions: normalized.suggestedActions || [],
            suggestedPhaseTransition: normalized.suggestedPhaseTransition || null,
            createdAt: new Date().toISOString()
        };

        this.eventLog.log('PROPOSAL_CREATED', {
            data: {
                userMessageLength: userMessage.length,
                patches: pendingProposals.patches.length,
                decisions: pendingProposals.decisions.length,
                tasks: pendingProposals.tasks.length,
                traceLinks: pendingProposals.traceLinks.length,
                discoveryPatches: discoveryPatches.length
            }
        }, { revision: originalRevision, custom: true });

        return {
            success: true,
            state,
            normalized,
            pendingProposals,
            gaps,
            readiness,
            log
        };
    }

    _matchMessageToGap(userMessage, gaps, state) {
        const msg = userMessage.toLowerCase();

        // Score each gap by keyword match
        let bestGap = null;
        let bestScore = 0;

        for (const gap of gaps) {
            let score = 0;
            const keywords = (gap.keywords || []).concat(
                gap.question ? [gap.question] : [],
                gap.field ? [gap.field] : []
            ).map(k => k.toLowerCase());

            for (const kw of keywords) {
                if (msg.includes(kw)) {
                    score += kw.length;
                }
            }

            // Direct ID match
            if (msg.includes(gap.id.toLowerCase())) {
                score += 50;
            }

            if (score > bestScore) {
                bestScore = score;
                bestGap = gap;
            }
        }

        return bestGap;
    }

    acceptProposalBundle(state, pendingProposals, expectedRevision) {
        this.initialize();
        if (!state) return { success: false, error: 'State gerekli' };
        if (!pendingProposals) return { success: false, error: 'pendingProposals gerekli' };

        // 1. Base revision check
        const baseRev = pendingProposals.baseRevision;
        if (expectedRevision !== undefined && expectedRevision !== baseRev) {
            return { success: false, error: `Revision uyuşmazlığı: beklenen ${expectedRevision}, mevcut ${state.revision}` };
        }

        // 2. Validate all proposal items (including stage transition)
        const validation = this._validateProposalBundle(pendingProposals, state);
        if (!validation.valid) {
            return { success: false, error: `Proposal doğrulama hatası: ${validation.errors.join('; ')}`, state };
        }

        // 3. Build patches with deterministic IDs from non-phase items
        const allPatches = [...(pendingProposals.patches || [])];
        let patchSeq = Date.now();

        for (const dec of (pendingProposals.decisions || [])) {
            allPatches.push({ operation: 'add', path: '/decisions/-', value: dec, id: `dec-${dec.id || patchSeq++}` });
        }
        for (const art of (pendingProposals.artifacts || [])) {
            allPatches.push({ operation: 'add', path: '/artifacts/-', value: art, id: `art-${art.id || patchSeq++}` });
        }
        for (const task of (pendingProposals.tasks || [])) {
            allPatches.push({ operation: 'add', path: '/tasks/-', value: task, id: `task-${task.id || patchSeq++}` });
        }
        for (const link of (pendingProposals.traceLinks || [])) {
            if (link.source && link.target) {
                allPatches.push({
                    operation: 'add',
                    path: '/entityStores/traceLink/-',
                    value: { source: link.source, target: link.target, type: link.type || 'implements', id: `TL-${patchSeq++}` },
                    id: `tl-${patchSeq++}`
                });
            }
        }

        // 4. Apply all patches (normal items first) in single transaction
        let currentState = JSON.parse(JSON.stringify(state));

        if (allPatches.length > 0) {
            const txResult = applyPatchTransaction({
                state: currentState,
                patches: allPatches,
                stage: currentState.phase,
                expectedRevision: baseRev
            });

            if (!txResult.success) {
                return { success: false, error: txResult.error, state };
            }
            currentState = txResult.state;

            // 5. Event logging for normal items
            for (const key of (txResult.invalidatedApprovals || [])) {
                this.eventLog.log(EVENT_TYPES.APPROVAL_INVALIDATED, {
                    approvalKey: key, data: { reason: 'proposal_accepted' }
                }, { revision: currentState.revision });
            }

            this.eventLog.log('PROPOSAL_ACCEPTED', {
                data: {
                    patches: allPatches.length,
                    decisions: (pendingProposals.decisions || []).length,
                    tasks: (pendingProposals.tasks || []).length,
                    traceLinks: (pendingProposals.traceLinks || []).length
                }
            }, { revision: currentState.revision, custom: true });
        }

        const result = {
            success: true,
            state: currentState,
            appliedPatches: [],
            invalidatedApprovals: []
        };

        // 6. Handle stage transition after normal items
        if (pendingProposals.suggestedPhaseTransition) {
            const phaseResult = this.acceptPhaseTransition(
                currentState,
                pendingProposals.suggestedPhaseTransition,
                currentState.revision
            );
            if (!phaseResult.success) {
                return { success: false, error: `Aşama geçişi başarısız: ${phaseResult.error}`, state: currentState };
            }
            currentState = phaseResult.state;
            result.state = currentState;
            result.phaseTransition = { from: phaseResult.fromPhase, to: phaseResult.toPhase };
        }

        // 7. Rebuild traceability and reviewer
        this.traceability = this.buildTraceability(currentState);
        this.reviewer = this.createReviewer(this.traceability);

        return result;
    }

    _validateProposalBundle(pendingProposals, state) {
        const errors = [];
        const seenIds = new Set();

        // Validate patches
        for (const patch of (pendingProposals.patches || [])) {
            if (!patch.operation || !['add', 'replace', 'remove', 'set'].includes(patch.operation)) {
                errors.push(`Patch geçersiz operasyon: ${patch.id || patch.path}`);
            }
            if (!patch.path || typeof patch.path !== 'string') {
                errors.push(`Patch yolu eksik: ${patch.id || '?'}`);
            }
            if (patch.id) {
                if (seenIds.has(patch.id)) errors.push(`Patch ID çakışıyor: ${patch.id}`);
                seenIds.add(patch.id);
            }
        }

        // Validate decisions
        for (const dec of (pendingProposals.decisions || [])) {
            if (!dec.id) errors.push(`Karar ID eksik`);
            if (seenIds.has(dec.id)) errors.push(`Karar ID çakışıyor: ${dec.id}`);
            if (dec.id) seenIds.add(dec.id);
            if (typeof dec.title !== 'string' || !dec.title) errors.push(`Karar başlığı eksik: ${dec.id || '?'}`);
            if (typeof dec.decision !== 'string' || !dec.decision) errors.push(`Karar metni eksik: ${dec.id || '?'}`);
            if (typeof dec.reason !== 'string' || !dec.reason) errors.push(`Karar gerekçesi eksik: ${dec.id || '?'}`);
            if (state.decisions?.some(d => d.id === dec.id)) errors.push(`Karar ID state'te zaten mevcut: ${dec.id}`);
        }

        // Validate artifacts
        for (const art of (pendingProposals.artifacts || [])) {
            if (!art.id) errors.push(`Çıktı ID eksik`);
            if (seenIds.has(art.id)) errors.push(`Çıktı ID çakışıyor: ${art.id}`);
            if (art.id) seenIds.add(art.id);
            if (typeof art.title !== 'string' || !art.title) errors.push(`Çıktı başlığı eksik: ${art.id || '?'}`);
            if (state.artifacts?.some(a => a.id === art.id)) errors.push(`Çıktı ID state'te zaten mevcut: ${art.id}`);
        }

        // Validate tasks
        for (const task of (pendingProposals.tasks || [])) {
            if (!task.id) errors.push(`Görev ID eksik`);
            if (seenIds.has(task.id)) errors.push(`Görev ID çakışıyor: ${task.id}`);
            if (task.id) seenIds.add(task.id);
            if (typeof task.title !== 'string' || !task.title) errors.push(`Görev başlığı eksik: ${task.id || '?'}`);
            if (typeof task.description !== 'string' || !task.description) errors.push(`Görev açıklaması eksik: ${task.id || '?'}`);
            const criteria = task.acceptanceCriteria;
            const hasCriteria = Array.isArray(criteria) ? criteria.length > 0 : (typeof criteria === 'string' && !!criteria);
            if (!hasCriteria) errors.push(`Görev kabul kriterleri eksik: ${task.id || '?'}`);
            if (state.tasks?.some(t => t.id === task.id)) errors.push(`Görev ID state'te zaten mevcut: ${task.id}`);
        }

        // Validate trace links
        const validEdgeTypes = new Set(Object.values(EDGE_TYPES));
        const previewGraph = this._buildPreviewGraph(state, pendingProposals);
        for (const link of (pendingProposals.traceLinks || [])) {
            if (!link.source) errors.push(`Trace link kaynak node ID eksik`);
            if (!link.target) errors.push(`Trace link hedef node ID eksik`);
            const linkId = link.id || `${link.source}→${link.target}`;
            if (seenIds.has(linkId)) errors.push(`Trace link ID çakışıyor: ${linkId}`);
            seenIds.add(linkId);
            if (link.type && !validEdgeTypes.has(link.type)) {
                errors.push(`Geçersiz edge tipi: ${link.type}. Geçerli: ${[...validEdgeTypes].join(', ')}`);
            }
            if (previewGraph && link.source && link.target) {
                const sourceNode = previewGraph.getNode(link.source);
                const targetNode = previewGraph.getNode(link.target);
                if (!sourceNode) errors.push(`Kaynak node bulunamadı: ${link.source}`);
                if (!targetNode) errors.push(`Hedef node bulunamadı: ${link.target}`);
            }
        }

        // Validate actions
        for (const action of (pendingProposals.actions || [])) {
            if (!action.id) errors.push(`Eylem ID eksik`);
            if (action.id && seenIds.has(action.id)) errors.push(`Eylem ID çakışıyor: ${action.id}`);
            if (action.id) seenIds.add(action.id);
            if (!action.action && !action.title) errors.push(`Eylem adı eksik: ${action.id || '?'}`);
        }

        return { valid: errors.length === 0, errors };
    }

    _buildPreviewGraph(state, pendingProposals) {
        const baseTraceability = this.buildTraceability(state);
        if (!baseTraceability) return null;
        const g = baseTraceability.graph;

        for (const dec of (pendingProposals.decisions || [])) {
            if (dec.id) {
                try { g.addNode(NODE_TYPES.DECISION, dec.id, dec.title || dec.id, { ...dec }); }
                catch { /* duplicate - skip */ }
            }
        }
        for (const art of (pendingProposals.artifacts || [])) {
            if (art.id) {
                try { g.addNode(NODE_TYPES.ARTIFACT, art.id, art.title || art.id, { ...art }); }
                catch { /* duplicate - skip */ }
            }
        }
        for (const task of (pendingProposals.tasks || [])) {
            if (task.id) {
                try { g.addNode(NODE_TYPES.TASK, task.id, task.title || task.id, { ...task }); }
                catch { /* duplicate - skip */ }
            }
        }
        for (const patch of (pendingProposals.patches || [])) {
            if (patch.id && patch.path && patch.operation === 'add' && patch.value?.id) {
                try {
                    const inferredType = patch.path.startsWith('/objectives') ? NODE_TYPES.OBJECTIVE
                        : patch.path.startsWith('/decisions') ? NODE_TYPES.DECISION
                        : patch.path.startsWith('/tasks') ? NODE_TYPES.TASK
                        : patch.path.startsWith('/artifacts') ? NODE_TYPES.ARTIFACT
                        : patch.path.startsWith('/stakeholders') ? NODE_TYPES.STAKEHOLDER
                        : patch.path.startsWith('/risks') ? NODE_TYPES.RISK
                        : null;
                    if (inferredType) {
                        g.addNode(inferredType, patch.value.id, patch.value.title || patch.value.name || patch.value.id, { ...patch.value });
                    }
                } catch { /* duplicate - skip */ }
            }
        }

        return g;
    }

    acceptPatches(state, patches, expectedRevision) {
        const bundle = { baseRevision: expectedRevision, patches, decisions: [], artifacts: [], tasks: [], traceLinks: [], actions: [] };
        return this.acceptProposalBundle(state, bundle, expectedRevision);
    }

    acceptAllProposals(state, pendingProposals, expectedRevision) {
        return this.acceptProposalBundle(state, pendingProposals, expectedRevision);
    }

    acceptProposalItem(state, bundle, itemType, itemId, expectedRevision) {
        this.initialize();
        if (!state) return { success: false, error: 'State gerekli' };
        if (!bundle) return { success: false, error: 'pendingProposals gerekli' };

        // 1. Build filtered bundle for just this item
        const item = this._findBundleItem(bundle, itemType, itemId);
        if (!item) return { success: false, error: `${itemType} tipinde '${itemId}' bulunamadı` };

        const singleBundle = {
            baseRevision: bundle.baseRevision,
            patches: itemType === 'patch' ? [item] : [],
            decisions: itemType === 'decision' ? [item] : [],
            artifacts: itemType === 'artifact' ? [item] : [],
            tasks: itemType === 'task' ? [item] : [],
            traceLinks: itemType === 'traceLink' ? [item] : [],
            actions: itemType === 'action' ? [item] : [],
            suggestedPhaseTransition: itemType === 'stageTransition' ? item : null,
            createdAt: bundle.createdAt
        };

        // 2. Accept the single item
        const result = this.acceptProposalBundle(state, singleBundle, expectedRevision);
        if (!result.success) return result;

        // 3. Build remaining proposals with updated revision
        const remaining = this._filterBundleWithout(bundle, itemType, itemId);
        remaining.baseRevision = result.state.revision;
        remaining.createdAt = new Date().toISOString();

        return {
            success: true,
            state: result.state,
            remainingProposals: remaining,
            appliedPatches: result.appliedPatches,
            invalidatedApprovals: result.invalidatedApprovals
        };
    }

    _findBundleItem(bundle, itemType, itemId) {
        const lists = {
            patch: bundle.patches,
            decision: bundle.decisions,
            artifact: bundle.artifacts,
            task: bundle.tasks,
            traceLink: bundle.traceLinks,
            action: bundle.actions
        };
        if (itemType === 'stageTransition') {
            return bundle.suggestedPhaseTransition || null;
        }
        const list = lists[itemType];
        if (!list) return null;
        if (itemType === 'traceLink') {
            return list.find(l => (l.id || `${l.source}→${l.target}`) === itemId) || null;
        }
        return list.find(i => i.id === itemId) || null;
    }

    _filterBundleWithout(bundle, itemType, itemId) {
        const copy = { ...bundle };
        if (itemType === 'patch') {
            copy.patches = (bundle.patches || []).filter(p => p.id !== itemId);
        } else if (itemType === 'decision') {
            copy.decisions = (bundle.decisions || []).filter(d => d.id !== itemId);
        } else if (itemType === 'artifact') {
            copy.artifacts = (bundle.artifacts || []).filter(a => a.id !== itemId);
        } else if (itemType === 'task') {
            copy.tasks = (bundle.tasks || []).filter(t => t.id !== itemId);
        } else if (itemType === 'traceLink') {
            copy.traceLinks = (bundle.traceLinks || []).filter(l => (l.id || `${l.source}→${l.target}`) !== itemId);
        } else if (itemType === 'action') {
            copy.actions = (bundle.actions || []).filter(a => a.id !== itemId);
        } else if (itemType === 'stageTransition') {
            copy.suggestedPhaseTransition = null;
        }
        return copy;
    }

    rejectProposals(state, pendingProposals) {
        return {
            success: true,
            state,
            rejected: {
                patches: pendingProposals.patches?.length || 0,
                decisions: pendingProposals.decisions?.length || 0,
                artifacts: pendingProposals.artifacts?.length || 0,
                tasks: pendingProposals.tasks?.length || 0
            }
        };
    }

    approveSuggestedModules(state, approvedIds, revision) {
        this.initialize();
        if (!state) return { success: false, error: 'State gerekli' };
        if (!Array.isArray(approvedIds) || approvedIds.length === 0) {
            return { success: false, error: 'Onaylanan modül ID listesi gerekli' };
        }

        const current = state.configuration?.activeModuleIds || [];
        const suggested = state.configuration?.suggestedModuleIds || [];

        // Only activate IDs that are registered modules (filter out technology IDs like nodejs, react)
        const toActivate = approvedIds.filter(id =>
            !current.includes(id) &&
            this.moduleRegistry.hasModule(id)
        );

        if (toActivate.length === 0) {
            return { success: true, state, activated: [] };
        }

        // Resolve required dependencies for the selected modules
        const depPlan = this.moduleRegistry.resolveRequiredDependencies(toActivate);
        const allToActivate = [...new Set([...toActivate, ...depPlan.resolved.filter(id => !current.includes(id))])];

        // Detect conflicts
        const conflicts = this.moduleRegistry.detectConflicts(allToActivate);
        if (conflicts.length > 0) {
            return {
                success: false,
                error: `Modül çakışması: ${conflicts.map(c => `${c.moduleA} ⚡ ${c.moduleB}`).join(', ')}`,
                conflicts,
                state
            };
        }

        const remaining = suggested.filter(id => !allToActivate.includes(id));

        // Use patch transaction for activation and suggestion cleanup
        const txResult = applyPatchTransaction({
            state: JSON.parse(JSON.stringify(state)),
            patches: [
                { operation: 'replace', path: '/configuration/activeModuleIds', value: [...current, ...allToActivate], id: 'module-activation' },
                { operation: 'replace', path: '/configuration/suggestedModuleIds', value: remaining, id: 'module-suggested-cleanup' }
            ],
            stage: state.phase,
            expectedRevision: revision !== undefined ? revision : state.revision
        });

        if (!txResult.success) {
            return { success: false, error: txResult.error, state };
        }

        const newState = txResult.state;

        // Run contributions for the new modules (proposal-only)
        let contribPatches = [];
        if (allToActivate.length > 0) {
            try {
                const contribResult = this.contributionExecutor.executeContributions(
                    [...allToActivate, 'universal'], newState
                );
                contribPatches = contribResult.patches || [];
            } catch (e) {
                console.warn('Module contribution error:', e);
            }
        }

        this.eventLog.log('MODULES_ACTIVATED', {
            data: { activated: allToActivate, remaining, contributions: contribPatches.length }
        }, { revision: newState.revision, custom: true });

        // Rebuild traceability
        this.traceability = this.buildTraceability(newState);
        this.reviewer = this.createReviewer(this.traceability);

        return {
            success: true,
            state: newState,
            activated: toActivate,
            contributionPatches: contribPatches
        };
    }

    _validateProposal(normalized) {
        const errors = [];
        if (!normalized.conversationResponse || typeof normalized.conversationResponse.text !== 'string') {
            errors.push('conversationResponse.text eksik veya string değil');
        }
        if (!Array.isArray(normalized.proposedPatches)) {
            errors.push('proposedPatches dizi olmalı');
        } else {
            for (const p of normalized.proposedPatches) {
                if (!p.operation) errors.push(`Patch'te operation eksik: ${p.id || p.path}`);
                if (!p.path) errors.push(`Patch'te path eksik: ${p.id || p.operation}`);
                if (!['add', 'replace', 'remove', 'set'].includes(p.operation)) {
                    errors.push(`Geçersiz patch operation: ${p.operation}`);
                }
            }
        }
        if (!Array.isArray(normalized.proposedDecisions)) {
            errors.push('proposedDecisions dizi olmalı');
        } else {
            for (const d of normalized.proposedDecisions) {
                if (!d.title) errors.push(`Karar başlığı eksik: ${d.id || '?'}`);
                if (!d.decision) errors.push(`Karar metni eksik: ${d.id || '?'}`);
            }
        }
        if (!Array.isArray(normalized.proposedArtifacts)) {
            errors.push('proposedArtifacts dizi olmalı');
        } else {
            for (const a of normalized.proposedArtifacts) {
                if (!a.title) errors.push(`Çıktı başlığı eksik: ${a.id || '?'}`);
            }
        }
        if (!Array.isArray(normalized.proposedTasks)) {
            errors.push('proposedTasks dizi olmalı');
        } else {
            for (const t of normalized.proposedTasks) {
                if (!t.title) errors.push(`Görev başlığı eksik: ${t.id || '?'}`);
                if (!t.description) errors.push(`Görev açıklaması eksik: ${t.id || '?'}`);
                const criteria = t.acceptanceCriteria;
                const hasCriteria = Array.isArray(criteria) ? criteria.length > 0 : (typeof criteria === 'string' && !!criteria);
                if (!hasCriteria) errors.push(`Görev kabul kriterleri eksik: ${t.id || '?'}`);
            }
        }
        if (!Array.isArray(normalized.proposedTraceLinks)) {
            errors.push('proposedTraceLinks dizi olmalı');
        } else {
            for (const l of normalized.proposedTraceLinks) {
                if (!l.source) errors.push(`Trace link kaynak eksik`);
                if (!l.target) errors.push(`Trace link hedef eksik`);
            }
        }
        if (normalized.suggestedActions && !Array.isArray(normalized.suggestedActions)) {
            errors.push('suggestedActions dizi olmalı');
        }
        return errors;
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

        const nextPhase = getPhaseNext(state.phase);
        if (!nextPhase) {
            return { success: false, transitioned: false, currentPhase: state.phase, nextPhase: null, reason: 'Sıradaki faz bulunamadı.' };
        }

        const phaseResult = this.acceptPhaseTransition(state, nextPhase, state.revision);
        if (!phaseResult.success) {
            return { success: false, transitioned: false, currentPhase: state.phase, nextPhase, reason: phaseResult.error };
        }

        return {
            success: true,
            transitioned: true,
            currentPhase: phaseResult.fromPhase,
            nextPhase: phaseResult.toPhase,
            state: phaseResult.state
        };
    }

    advancePhase(state) {
        return this.checkAndApplyPhaseTransition(state);
    }

    acceptPhaseTransition(state, proposedPhase, expectedRevision) {
        this.initialize();
        if (!state) return { success: false, error: 'State gerekli' };
        if (!proposedPhase) return { success: false, error: 'Hedef aşama gerekli' };

        if (expectedRevision !== undefined && expectedRevision !== state.revision) {
            return { success: false, error: `Revision uyuşmazlığı: beklenen ${expectedRevision}, mevcut ${state.revision}` };
        }

        const currentPhase = state.phase;
        const contractNext = getPhaseNext(currentPhase);
        if (contractNext !== proposedPhase) {
            return {
                success: false,
                error: `'${currentPhase}' fazından '${proposedPhase}' fazına geçilemez. Sıradaki: ${contractNext || 'yok'}`
            };
        }

        const check = checkPhaseTransition(state, currentPhase);
        if (!check.allowed || check.nextPhase !== proposedPhase) {
            return {
                success: false,
                error: check.reason || `'${currentPhase}' → '${proposedPhase}' geçiş koşulları sağlanmadı.`,
                transitioned: false
            };
        }

        const newState = applyV3StatePatch(state, {
            operation: 'replace',
            path: '/phase',
            value: proposedPhase
        }, true);

        this.eventLog.log(EVENT_TYPES.PHASE_TRANSITION, {
            fromPhase: currentPhase,
            toPhase: proposedPhase,
            data: { reason: 'user_accepted_stage_transition_proposal' }
        }, { revision: newState.revision });

        this.traceability = this.buildTraceability(newState);
        this.reviewer = this.createReviewer(this.traceability);

        return {
            success: true,
            transitioned: true,
            state: newState,
            fromPhase: currentPhase,
            toPhase: proposedPhase
        };
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
            const esReqs = state.entityStores.requirement;
            if (Array.isArray(esReqs)) {
                for (const r of esReqs) {
                    if (!g.getNode(r.id)) {
                        try { g.addNode(NODE_TYPES.REQUIREMENT, r.id, r.title || r.text || r.name || r.id, { ...r }); } catch {}
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

        const architectureComps = state.moduleData?.software?.architecture?.components;
        if (Array.isArray(architectureComps)) {
            for (const c of architectureComps) {
                const id = c.id || `ARC-${String(architectureComps.indexOf(c) + 1).padStart(3, '0')}`;
                if (!g.getNode(id)) {
                    try { g.addNode(NODE_TYPES.ARCHITECTURE_COMPONENT, id, c.name || c.title || id, { ...c }); } catch {}
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
        const requirements = g.getNodesByType(NODE_TYPES.REQUIREMENT);
        const tests = g.getNodesByType(NODE_TYPES.TEST);
        const archComps = g.getNodesByType(NODE_TYPES.ARCHITECTURE_COMPONENT);

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
                    const srcNode = g.getNode(srcId);
                    if (srcNode) {
                        if (srcNode.type === NODE_TYPES.REQUIREMENT) {
                            edges.push({ s: srcId, t: task.id, type: EDGE_TYPES.IMPLEMENTS });
                        } else {
                            edges.push({ s: task.id, t: srcId, type: EDGE_TYPES.RELATES_TO });
                        }
                    }
                }
            }
        }

        for (const dec of decisions) {
            const meta = dec.metadata || {};
            if (meta.sourceRequirementIds && Array.isArray(meta.sourceRequirementIds)) {
                for (const reqId of meta.sourceRequirementIds) {
                    if (g.getNode(reqId)) edges.push({ s: reqId, t: dec.id, type: EDGE_TYPES.DRIVES });
                }
            }
            if (meta.affectedEntityIds && Array.isArray(meta.affectedEntityIds)) {
                for (const affId of meta.affectedEntityIds) {
                    if (g.getNode(affId)) edges.push({ s: dec.id, t: affId, type: EDGE_TYPES.RELATES_TO });
                }
            }
        }

        for (const req of requirements) {
            const meta = req.metadata || {};
            if (meta.decisionIds && Array.isArray(meta.decisionIds)) {
                for (const decId of meta.decisionIds) {
                    if (g.getNode(decId)) edges.push({ s: req.id, t: decId, type: EDGE_TYPES.DRIVES });
                }
            }
            if (meta.testIds && Array.isArray(meta.testIds)) {
                for (const testId of meta.testIds) {
                    if (g.getNode(testId)) edges.push({ s: req.id, t: testId, type: EDGE_TYPES.VALIDATED_BY });
                }
            }
        }

        for (const comp of archComps) {
            const meta = comp.metadata || {};
            if (meta.sourceDecisionIds && Array.isArray(meta.sourceDecisionIds)) {
                for (const decId of meta.sourceDecisionIds) {
                    if (g.getNode(decId)) edges.push({ s: decId, t: comp.id, type: EDGE_TYPES.DRIVES });
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
            suggestedModules: state.configuration?.suggestedModuleIds || [],
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

    getTraceability(state) {
        this.initialize();
        if (!this.traceability) {
            this.traceability = this.buildTraceability(state || {});
        }
        return this.traceability;
    }

    _getPhaseApprovalKey(phase) {
        const map = {
            PROJECT_PROFILED: 'profile',
            OBJECTIVES_DEFINED: 'objectives',
            SCOPE_DEFINED: 'scope',
            DELIVERABLES_DEFINED: 'deliverables',
            EXECUTION_PLAN_DRAFTED: 'executionPlan',
            READY_FOR_EXPORT: 'finalReview'
        };
        return map[phase] || null;
    }
}
