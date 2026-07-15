import { WORKFLOW_STAGES } from '../workflow/stages.js';

export function getInitialCanonicalState() {
    return {
        schemaVersion: 1,
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
            integrations: []
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
        }
    };
}

export function applyStatePatch(state, patch) {
    if (!patch || !patch.operation || !patch.path) return state;

    const cloned = JSON.parse(JSON.stringify(state));
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
        'openQuestions', 'architecture', 'tasks', 'documents', 'agentPackage', 'workflowSuggestion'
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

export function validateProjectData(parsed) {
    const valid = {};
    if (!parsed || typeof parsed !== 'object') parsed = {};
    
    // Normalize prompts
    valid.prompts = Array.isArray(parsed.prompts) ? parsed.prompts.map(p => ({
        title: typeof p.title === 'string' ? p.title : 'Başlıksız Adım',
        description: typeof p.description === 'string' ? p.description : '',
        recommendedModel: typeof p.recommendedModel === 'string' ? p.recommendedModel : 'Claude 3.5 Sonnet',
        content: typeof p.content === 'string' ? p.content : '',
        developerNotes: typeof p.developerNotes === 'string' ? p.developerNotes : '',
        injectNotes: p.injectNotes !== false,
        subSteps: Array.isArray(p.subSteps) ? p.subSteps.map(s => ({
            title: typeof s.title === 'string' ? s.title : 'Alt Başlık',
            content: typeof s.content === 'string' ? s.content : ''
        })) : []
    })) : [];

    // Normalize docs
    const d = parsed.docs || {};
    valid.docs = {
        brief: typeof d.brief === 'string' ? d.brief : '',
        requirements: typeof d.requirements === 'string' ? d.requirements : '',
        architecture: typeof d.architecture === 'string' ? d.architecture : '',
        tech_stack: typeof d.tech_stack === 'string' ? d.tech_stack : '',
        risks: typeof d.risks === 'string' ? d.risks : '',
        state_md: typeof d.state_md === 'string' ? d.state_md : ''
    };

    // Normalize decisions
    valid.decisions = Array.isArray(parsed.decisions) ? parsed.decisions.map((dec, i) => ({
        id: typeof dec.id === 'string' ? dec.id : `DEC-00${i+1}`,
        title: typeof dec.title === 'string' ? dec.title : 'Karar Başlığı',
        decision: typeof dec.decision === 'string' ? dec.decision : '',
        reason: typeof dec.reason === 'string' ? dec.reason : ''
    })) : [];

    // Normalize assumptions
    valid.assumptions = Array.isArray(parsed.assumptions) ? parsed.assumptions.map((asm, i) => ({
        id: typeof asm.id === 'string' ? asm.id : `ASM-00${i+1}`,
        text: typeof asm.text === 'string' ? asm.text : '',
        confidence: typeof asm.confidence === 'string' ? asm.confidence : 'medium',
        status: typeof asm.status === 'string' ? asm.status : 'active'
    })) : [];

    // Normalize risks
    valid.risks = Array.isArray(parsed.risks) ? parsed.risks.map((r, i) => ({
        id: typeof r.id === 'string' ? r.id : `RSK-00${i+1}`,
        title: typeof r.title === 'string' ? r.title : '',
        probability: typeof r.probability === 'string' ? r.probability : 'medium',
        impact: typeof r.impact === 'string' ? r.impact : 'medium',
        mitigation: typeof r.mitigation === 'string' ? r.mitigation : ''
    })) : [];

    // Normalize openQuestions
    valid.openQuestions = Array.isArray(parsed.openQuestions) ? parsed.openQuestions.map((q, i) => ({
        id: typeof q.id === 'string' ? q.id : `Q-00${i+1}`,
        question: typeof q.question === 'string' ? q.question : '',
        importance: typeof q.importance === 'string' ? q.importance : 'medium'
    })) : [];

    // Normalize findings
    valid.findings = Array.isArray(parsed.findings) ? parsed.findings.map((f, i) => ({
        id: typeof f.id === 'string' ? f.id : `FND-00${i+1}`,
        title: typeof f.title === 'string' ? f.title : 'Bulgu',
        severity: typeof f.severity === 'string' ? f.severity : 'info',
        message: typeof f.message === 'string' ? f.message : '',
        mitigation: typeof f.mitigation === 'string' ? f.mitigation : ''
    })) : [];

    // Clamped Health Score
    let score = parseInt(parsed.healthScore);
    if (isNaN(score)) score = 85;
    valid.healthScore = Math.max(0, Math.min(100, score));

    // Normalize subagents (UI data only)
    valid.subagents = Array.isArray(parsed.subagents) ? parsed.subagents.map(s => ({
        key: typeof s.key === 'string' ? s.key : 'subagent',
        role: typeof s.role === 'string' ? s.role : 'Ajan',
        filename: typeof s.filename === 'string' ? s.filename : 'agent.txt',
        prompt: typeof s.prompt === 'string' ? s.prompt : ''
    })) : [];

    // Normalize fileTree
    valid.fileTree = Array.isArray(parsed.fileTree) ? parsed.fileTree.map(f => ({
        path: typeof f.path === 'string' ? f.path : 'unknown.txt',
        type: typeof f.type === 'string' ? f.type : 'file',
        description: typeof f.description === 'string' ? f.description : ''
    })) : [];

    valid.mermaidCode = typeof parsed.mermaidCode === 'string' ? parsed.mermaidCode : 'graph TD\n    A[Proje] --> B[Modüller]';
    valid.skillMarkdown = typeof parsed.skillMarkdown === 'string' ? parsed.skillMarkdown : '';
    valid.cursorRules = typeof parsed.cursorRules === 'string' ? parsed.cursorRules : '';
    valid.windsurfRules = typeof parsed.windsurfRules === 'string' ? parsed.windsurfRules : '';
    valid.copilotRules = typeof parsed.copilotRules === 'string' ? parsed.copilotRules : '';
    valid.stateMarkdown = typeof parsed.stateMarkdown === 'string' ? parsed.stateMarkdown : '';

    // Normalize identity
    const idObj = parsed.identity || {};
    valid.identity = {
        name: typeof idObj.name === 'string' ? idObj.name : '',
        summary: typeof idObj.summary === 'string' ? idObj.summary : '',
        problem: typeof idObj.problem === 'string' ? idObj.problem : '',
        desiredOutcome: typeof idObj.desiredOutcome === 'string' ? idObj.desiredOutcome : ''
    };

    // Normalize scope
    const scObj = parsed.scope || {};
    valid.scope = {
        mustHave: Array.isArray(scObj.mustHave) ? scObj.mustHave.map(x => String(x)) : [],
        shouldHave: Array.isArray(scObj.shouldHave) ? scObj.shouldHave.map(x => String(x)) : [],
        couldHave: Array.isArray(scObj.couldHave) ? scObj.couldHave.map(x => String(x)) : [],
        notNow: Array.isArray(scObj.notNow) ? scObj.notNow.map(x => String(x)) : [],
        outOfScope: Array.isArray(scObj.outOfScope) ? scObj.outOfScope.map(x => String(x)) : []
    };

    // Normalize requirements
    const reqObj = parsed.requirements || {};
    valid.requirements = {
        functional: Array.isArray(reqObj.functional) ? reqObj.functional.map(x => String(x)) : [],
        nonFunctional: Array.isArray(reqObj.nonFunctional) ? reqObj.nonFunctional.map(x => String(x)) : [],
        domainSpecific: Array.isArray(reqObj.domainSpecific) ? reqObj.domainSpecific.map(x => String(x)) : []
    };

    // Normalize architecture
    const archObj = parsed.architecture || {};
    valid.architecture = {
        components: Array.isArray(archObj.components) ? archObj.components.map(x => String(x)) : [],
        dataFlows: Array.isArray(archObj.dataFlows) ? archObj.dataFlows.map(x => String(x)) : [],
        integrations: Array.isArray(archObj.integrations) ? archObj.integrations.map(x => String(x)) : []
    };

    valid.suggestedNextStage = typeof parsed.suggestedNextStage === 'string' ? parsed.suggestedNextStage : '';

    return valid;
}

export function syncAIResponseToCanonicalState(state, projectFiles) {
    let currentProjectState = state ? JSON.parse(JSON.stringify(state)) : getInitialCanonicalState();

    const patch = (path, value) => {
        if (value === undefined || value === null) return;
        if (Array.isArray(value) && value.length === 0) return;
        if (typeof value === 'string' && value.trim() === '') return;
        currentProjectState = applyStatePatch(currentProjectState, {
            operation: 'replace',
            path,
            value
        });
    };

    // Identity
    if (projectFiles.identity) {
        if (projectFiles.identity.name) patch('/identity/name', projectFiles.identity.name);
        if (projectFiles.identity.summary) patch('/identity/summary', projectFiles.identity.summary);
        if (projectFiles.identity.problem) patch('/identity/problem', projectFiles.identity.problem);
        if (projectFiles.identity.desiredOutcome) patch('/identity/desiredOutcome', projectFiles.identity.desiredOutcome);
    }

    // Scope
    if (projectFiles.scope) {
        if (Array.isArray(projectFiles.scope.mustHave) && projectFiles.scope.mustHave.length > 0)
            patch('/scope/mustHave', projectFiles.scope.mustHave);
        if (Array.isArray(projectFiles.scope.shouldHave) && projectFiles.scope.shouldHave.length > 0)
            patch('/scope/shouldHave', projectFiles.scope.shouldHave);
        if (Array.isArray(projectFiles.scope.couldHave) && projectFiles.scope.couldHave.length > 0)
            patch('/scope/couldHave', projectFiles.scope.couldHave);
        if (Array.isArray(projectFiles.scope.notNow) && projectFiles.scope.notNow.length > 0)
            patch('/scope/notNow', projectFiles.scope.notNow);
        if (Array.isArray(projectFiles.scope.outOfScope) && projectFiles.scope.outOfScope.length > 0)
            patch('/scope/outOfScope', projectFiles.scope.outOfScope);
    }

    // Requirements
    if (projectFiles.requirements) {
        if (Array.isArray(projectFiles.requirements.functional) && projectFiles.requirements.functional.length > 0)
            patch('/requirements/functional', projectFiles.requirements.functional);
        if (Array.isArray(projectFiles.requirements.nonFunctional) && projectFiles.requirements.nonFunctional.length > 0)
            patch('/requirements/nonFunctional', projectFiles.requirements.nonFunctional);
        if (Array.isArray(projectFiles.requirements.domainSpecific) && projectFiles.requirements.domainSpecific.length > 0)
            patch('/requirements/domainSpecific', projectFiles.requirements.domainSpecific);
    }

    // Decisions, assumptions, risks, openQuestions
    if (Array.isArray(projectFiles.decisions) && projectFiles.decisions.length > 0)
        patch('/decisions', projectFiles.decisions);
    if (Array.isArray(projectFiles.assumptions) && projectFiles.assumptions.length > 0)
        patch('/assumptions', projectFiles.assumptions);
    if (Array.isArray(projectFiles.risks) && projectFiles.risks.length > 0)
        patch('/risks', projectFiles.risks);
    if (Array.isArray(projectFiles.openQuestions) && projectFiles.openQuestions.length > 0)
        patch('/openQuestions', projectFiles.openQuestions);

    // Architecture
    if (projectFiles.architecture) {
        if (Array.isArray(projectFiles.architecture.components) && projectFiles.architecture.components.length > 0)
            patch('/architecture/components', projectFiles.architecture.components);
        if (Array.isArray(projectFiles.architecture.dataFlows) && projectFiles.architecture.dataFlows.length > 0)
            patch('/architecture/dataFlows', projectFiles.architecture.dataFlows);
        if (Array.isArray(projectFiles.architecture.integrations) && projectFiles.architecture.integrations.length > 0)
            patch('/architecture/integrations', projectFiles.architecture.integrations);
    }

    // Tasks (from prompts array)
    if (Array.isArray(projectFiles.prompts) && projectFiles.prompts.length > 0) {
        const tasks = projectFiles.prompts.map((p, idx) => ({
            id: `TASK-${(idx + 1).toString().padStart(3, '0')}`,
            title: p.title,
            description: p.description
        }));
        patch('/tasks', tasks);
    }

    // Documents
    if (projectFiles.docs) {
        const docs = Object.keys(projectFiles.docs).map(key => ({
            name: key,
            content: projectFiles.docs[key]
        }));
        if (docs.length > 0) patch('/documents', docs);
    }

    // Agent Package
    const agentPackage = {};
    let hasAgentData = false;
    if (Array.isArray(projectFiles.subagents) && projectFiles.subagents.length > 0) {
        agentPackage.subagents = projectFiles.subagents;
        hasAgentData = true;
    }
    if (typeof projectFiles.skillMarkdown === 'string' && projectFiles.skillMarkdown.trim()) {
        agentPackage.skillMarkdown = projectFiles.skillMarkdown;
        hasAgentData = true;
    }
    if (projectFiles.cursorRules || projectFiles.windsurfRules || projectFiles.copilotRules) {
        agentPackage.rules = {
            cursor: projectFiles.cursorRules || '',
            windsurf: projectFiles.windsurfRules || '',
            copilot: projectFiles.copilotRules || ''
        };
        hasAgentData = true;
    }
    if (hasAgentData) {
        const currentPkg = currentProjectState.agentPackage || {};
        patch('/agentPackage', { ...currentPkg, ...agentPackage });
    }

    // Suggested Next Stage -> advisory only
    if (projectFiles.suggestedNextStage) {
        patch('/workflowSuggestion', {
            stage: projectFiles.suggestedNextStage,
            reason: "AI suggested stage transition"
        });
    }

    return currentProjectState;
}
