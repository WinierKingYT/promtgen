import { WORKFLOW_STAGES } from '../workflow/stages.js';
import { validatePatchProposal } from '../application/patch-policy.js';
import { invalidateApprovalsForPath } from '../application/approval-service.js';

export function getInitialCanonicalState() {
    return {
        schemaVersion: 2,
        revision: 1,
        workflowStage: WORKFLOW_STAGES.IDEA_CAPTURED,
        identity: {
            name: "",
            summary: "",
            problem: "",
            desiredOutcome: ""
        },
        profile: {
            domains: [],
            platforms: [],
            interfaces: [],
            capabilities: [],
            uncertainties: []
        },
        scope: {
            mustHave: [],
            shouldHave: [],
            couldHave: [],
            notNow: [],
            outOfScope: []
        },
        requirements: {
            functional: [],
            nonFunctional: [],
            domainSpecific: []
        },
        decisions: [],
        assumptions: [],
        risks: [],
        openQuestions: [],
        architecture: {
            components: [],
            dataFlows: [],
            integrations: [],
            mermaidCode: ""
        },
        tasks: [],
        documents: [],
        reviews: [],
        agentPackage: {
            subagents: [],
            rules: {
                cursor: "",
                windsurf: "",
                copilot: ""
            },
            skillMarkdown: "",
            exportTargets: []
        },
        workflowSuggestion: {
            stage: null,
            reason: ""
        },
        approvals: {
            profile: null,
            mvpScope: null,
            requirements: null,
            technology: null,
            architecture: null,
            tasks: null,
            finalReview: null
        }
    };
}

export function applyStatePatch(state, patch, isSystem = false) {
    if (!patch || !patch.operation || !patch.path) return state;

    // Apply patch policy validation if not system-initiated
    if (!isSystem) {
        const policyCheck = validatePatchProposal(state.workflowStage, patch);
        if (!policyCheck.valid) {
            console.warn("Blocked patch application due to policy violation:", policyCheck.reason, patch);
            return state;
        }
    }

    let cloned = JSON.parse(JSON.stringify(state));
    cloned = invalidateApprovalsForPath(cloned, patch.path);
    const pathParts = patch.path.split('/').filter(p => p !== '');

    // Prevent Prototype Pollution
    const polluted = pathParts.some(part => part === '__proto__' || part === 'constructor' || part === 'prototype');
    if (polluted) {
        console.warn("Blocked prototype pollution path attempt:", patch.path);
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

export function validateCanonicalState(state) {
    if (!state || typeof state !== 'object') return false;
    const requiredKeys = [
        'schemaVersion', 'revision', 'workflowStage', 'identity', 'profile',
        'scope', 'requirements', 'decisions', 'assumptions', 'risks',
        'openQuestions', 'architecture', 'tasks', 'documents', 'agentPackage', 'workflowSuggestion', 'approvals'
    ];
    for (const key of requiredKeys) {
        if (state[key] === undefined) return false;
    }

    if (typeof state.revision !== 'number' || state.revision <= 0) return false;
    if (!Array.isArray(state.profile.domains)) return false;

    // Check agentPackage structure (Fix #2)
    if (!state.agentPackage || typeof state.agentPackage !== 'object') return false;
    if (!Array.isArray(state.agentPackage.subagents)) return false;
    if (!state.agentPackage.rules || typeof state.agentPackage.rules !== 'object') return false;
    if (typeof state.agentPackage.rules.cursor !== 'string') return false;
    if (typeof state.agentPackage.rules.windsurf !== 'string') return false;
    if (typeof state.agentPackage.rules.copilot !== 'string') return false;
    if (typeof state.agentPackage.skillMarkdown !== 'string') return false;

    // Check workflowSuggestion structure
    if (!state.workflowSuggestion || typeof state.workflowSuggestion !== 'object') return false;
    if (state.workflowSuggestion.stage !== null && typeof state.workflowSuggestion.stage !== 'string') return false;
    if (typeof state.workflowSuggestion.reason !== 'string') return false;

    // Check approvals structure
    if (!state.approvals || typeof state.approvals !== 'object') return false;
    const approvalKeys = ['profile', 'mvpScope', 'requirements', 'technology', 'architecture', 'tasks', 'finalReview'];
    for (const k of approvalKeys) {
        const app = state.approvals[k];
        if (app !== null) {
            if (typeof app !== 'object') return false;
            if (app.status !== 'approved' && app.status !== 'rejected') return false;
            if (typeof app.revision !== 'number') return false;
            if (typeof app.approvedAt !== 'string') return false;
            if (typeof app.notes !== 'string') return false;
        }
    }

    // Check domains confidence values
    for (const d of state.profile.domains) {
        if (typeof d.confidence !== 'number' || d.confidence < 0 || d.confidence > 1) {
            return false;
        }
    }

    // Check ID uniqueness
    const ids = new Set();
    const listsToCheck = [state.decisions, state.assumptions, state.risks, state.openQuestions];
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

export function validateProjectData(parsed, stage = null) {
    const valid = {
        proposedPatches: [],
        suggestedNextStage: "",
        chatResponse: ""
    };
    if (!parsed || typeof parsed !== 'object') parsed = {};

    valid.chatResponse = typeof parsed.chatResponse === 'string' ? parsed.chatResponse : '';
    valid.suggestedNextStage = typeof parsed.suggestedNextStage === 'string' ? parsed.suggestedNextStage : '';

    if (Array.isArray(parsed.proposedPatches)) {
        valid.proposedPatches = parsed.proposedPatches.map((p, i) => ({
            id: typeof p.id === 'string' ? p.id : `patch_${i + 1}_${Date.now()}`,
            operation: ['add', 'replace', 'remove', 'set'].includes(p.operation) ? p.operation : 'replace',
            path: typeof p.path === 'string' ? p.path : '',
            value: p.value,
            reason: typeof p.reason === 'string' ? p.reason : 'Plan değişikliği'
        })).filter(p => {
            if (p.path === '') return false;
            if (stage) {
                const check = validatePatchProposal(stage, p);
                if (!check.valid) {
                    console.warn(`Blocked invalid proposed patch for stage ${stage}:`, check.reason, p);
                    return false;
                }
            }
            return true;
        });
    } else {
        // BACKWARDS COMPATIBILITY: Auto-convert old schema to proposed patches
        const patches = [];
        
        if (parsed.identity) {
            patches.push({
                operation: 'replace',
                path: '/identity',
                value: parsed.identity,
                reason: 'Proje kimliği tanımlandı.'
            });
        }
        if (parsed.scope) {
            patches.push({
                operation: 'replace',
                path: '/scope',
                value: parsed.scope,
                reason: 'Proje kapsamı (MVP) güncellendi.'
            });
        }
        if (parsed.requirements) {
            patches.push({
                operation: 'replace',
                path: '/requirements',
                value: parsed.requirements,
                reason: 'Gereksinim listesi güncellendi.'
            });
        }
        if (Array.isArray(parsed.decisions)) {
            patches.push({
                operation: 'replace',
                path: '/decisions',
                value: parsed.decisions,
                reason: 'Mimari ve teknoloji kararları eklendi.'
            });
        }
        if (Array.isArray(parsed.assumptions)) {
            patches.push({
                operation: 'replace',
                path: '/assumptions',
                value: parsed.assumptions,
                reason: 'Proje varsayımları eklendi.'
            });
        }
        if (Array.isArray(parsed.risks)) {
            patches.push({
                operation: 'replace',
                path: '/risks',
                value: parsed.risks,
                reason: 'Risk matrisi güncellendi.'
            });
        }
        if (Array.isArray(parsed.openQuestions)) {
            patches.push({
                operation: 'replace',
                path: '/openQuestions',
                value: parsed.openQuestions,
                reason: 'Açık sorular listelendi.'
            });
        }
        if (parsed.architecture) {
            const arch = parsed.architecture;
            patches.push({
                operation: 'replace',
                path: '/architecture',
                value: {
                    components: Array.isArray(arch.components) ? arch.components : [],
                    dataFlows: Array.isArray(arch.dataFlows) ? arch.dataFlows : [],
                    integrations: Array.isArray(arch.integrations) ? arch.integrations : [],
                    mermaidCode: parsed.mermaidCode || ""
                },
                reason: 'Sistem mimari bileşenleri kurgulandı.'
            });
        }
        if (Array.isArray(parsed.prompts)) {
            const tasks = parsed.prompts.map((p, idx) => ({
                id: `TASK-${(idx + 1).toString().padStart(3, '0')}`,
                title: p.title,
                description: p.description,
                recommendedModel: p.recommendedModel || 'Claude 3.5 Sonnet',
                content: p.content || ''
            }));
            patches.push({
                operation: 'replace',
                path: '/tasks',
                value: tasks,
                reason: 'AI kodlama adımları oluşturuldu.'
            });
        }
        if (parsed.docs) {
            const docs = Object.keys(parsed.docs).map(key => ({
                name: key,
                content: parsed.docs[key]
            }));
            patches.push({
                operation: 'replace',
                path: '/documents',
                value: docs,
                reason: 'Proje dökümantasyonu güncellendi.'
            });
        }
        if (Array.isArray(parsed.findings) || parsed.healthScore) {
            patches.push({
                operation: 'replace',
                path: '/reviews',
                value: [{
                    healthScore: typeof parsed.healthScore === 'number' ? parsed.healthScore : 85,
                    findings: Array.isArray(parsed.findings) ? parsed.findings : [],
                    reviewedAt: new Date().toISOString()
                }],
                reason: 'Kalite ve tutarlılık analizi tamamlandı.'
            });
        }
        const agentPackage = {
            subagents: Array.isArray(parsed.subagents) ? parsed.subagents : [],
            rules: {
                cursor: parsed.cursorRules || "",
                windsurf: parsed.windsurfRules || "",
                copilot: parsed.copilotRules || ""
            },
            skillMarkdown: parsed.skillMarkdown || "",
            exportTargets: []
        };
        if (agentPackage.subagents.length > 0 || agentPackage.skillMarkdown || agentPackage.rules.cursor) {
            patches.push({
                operation: 'replace',
                path: '/agentPackage',
                value: agentPackage,
                reason: 'Alt ajan rol tanımları ve editör kuralları paketlendi.'
            });
        }

        valid.proposedPatches = patches.map((p, i) => ({
            id: `patch_${i + 1}_${Date.now()}`,
            ...p
        })).filter(p => {
            if (stage) {
                const check = validatePatchProposal(stage, p);
                if (!check.valid) {
                    console.warn(`Blocked invalid backwards compatibility patch for stage ${stage}:`, check.reason, p);
                    return false;
                }
            }
            return true;
        });
    }

    return valid;
}

export function syncAIResponseToCanonicalState(state, approvedPatches, suggestedNextStage = null) {
    let currentProjectState = state ? JSON.parse(JSON.stringify(state)) : getInitialCanonicalState();

    if (Array.isArray(approvedPatches)) {
        for (const patch of approvedPatches) {
            currentProjectState = applyStatePatch(currentProjectState, patch, true);
        }
    }

    if (suggestedNextStage) {
        currentProjectState = applyStatePatch(currentProjectState, {
            operation: 'replace',
            path: '/workflowSuggestion',
            value: {
                stage: suggestedNextStage,
                reason: "AI suggested stage transition"
            }
        }, true);
    }

    return currentProjectState;
}
