const CANONICAL_MODEL_VERSION = 1;

function text(value, fallback = '') {
    return typeof value === 'string' ? value.trim() : fallback;
}

function list(value) {
    return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}

function entityId(prefix, value, index) {
    if (value?.id && typeof value.id === 'string') return value.id;
    return `${prefix}-${index + 1}`;
}

export function normalizeObjective(value = {}, index = 0) {
    const source = typeof value === 'string' ? { title: value } : value;
    return {
        id: entityId('obj', source, index),
        title: text(source.title || source.description || source.text, `Hedef ${index + 1}`),
        description: text(source.description || source.text),
        metric: text(source.metric),
        target: text(source.target),
        priority: ['must', 'should', 'could'].includes(source.priority) ? source.priority : 'should',
        status: ['draft', 'accepted', 'achieved'].includes(source.status) ? source.status : 'draft',
        sourceSuggestionIds: list(source.sourceSuggestionIds)
    };
}

export function normalizeRequirement(value = {}, index = 0) {
    const source = typeof value === 'string' ? { statement: value } : value;
    return {
        id: entityId('req', source, index),
        title: text(source.title || source.statement || source.description, `Gereksinim ${index + 1}`),
        statement: text(source.statement || source.description || source.text || source.title),
        kind: ['functional', 'quality', 'constraint'].includes(source.kind) ? source.kind : 'functional',
        priority: ['must', 'should', 'could'].includes(source.priority) ? source.priority : 'should',
        acceptanceCriteria: list(source.acceptanceCriteria),
        sourceObjectiveIds: list(source.sourceObjectiveIds),
        sourceSuggestionIds: list(source.sourceSuggestionIds),
        status: ['draft', 'accepted', 'implemented', 'verified'].includes(source.status) ? source.status : 'draft'
    };
}

export function normalizeDecision(value = {}, index = 0) {
    const source = typeof value === 'string' ? { decision: value } : value;
    return {
        id: entityId('dec', source, index),
        title: text(source.title || source.decision, `Karar ${index + 1}`),
        decision: text(source.decision || source.description || source.title),
        rationale: text(source.rationale || source.reason),
        alternatives: list(source.alternatives),
        consequences: list(source.consequences),
        status: ['proposed', 'accepted', 'superseded'].includes(source.status) ? source.status : 'accepted',
        sourceSuggestionId: text(source.sourceSuggestionId),
        affectedSectionIds: list(source.affectedSectionIds || source.affectedSections)
    };
}

export function normalizeAssumption(value = {}, index = 0) {
    const source = typeof value === 'string' ? { statement: value } : value;
    return {
        id: entityId('asm', source, index),
        statement: text(source.statement || source.description || source.text),
        confidence: ['low', 'medium', 'high'].includes(source.confidence) ? source.confidence : 'medium',
        validationPlan: text(source.validationPlan),
        status: ['open', 'validated', 'invalidated'].includes(source.status) ? source.status : 'open'
    };
}

export function normalizeRisk(value = {}, index = 0) {
    const source = typeof value === 'string' ? { title: value } : value;
    return {
        id: entityId('risk', source, index),
        title: text(source.title || source.description, `Risk ${index + 1}`),
        description: text(source.description || source.title),
        probability: ['low', 'medium', 'high'].includes(source.probability) ? source.probability : 'medium',
        impact: ['low', 'medium', 'high'].includes(source.impact) ? source.impact : 'medium',
        mitigation: text(source.mitigation),
        owner: text(source.owner),
        status: ['open', 'mitigated', 'accepted'].includes(source.status) ? source.status : 'open',
        sourceSuggestionId: text(source.sourceSuggestionId)
    };
}

export function normalizeTask(value = {}, index = 0) {
    const source = typeof value === 'string' ? { title: value } : value;
    return {
        id: entityId('task', source, index),
        title: text(source.title || source.description, `Görev ${index + 1}`),
        description: text(source.description),
        status: ['backlog', 'ready', 'in_progress', 'blocked', 'done'].includes(source.status) ? source.status : 'backlog',
        priority: ['must', 'should', 'could'].includes(source.priority) ? source.priority : 'should',
        effort: ['low', 'medium', 'high'].includes(source.effort) ? source.effort : 'medium',
        dependencies: list(source.dependencies),
        requirementIds: list(source.requirementIds),
        acceptanceCriteria: list(source.acceptanceCriteria),
        verificationIds: list(source.verificationIds)
    };
}

export function normalizeTestCase(value = {}, index = 0) {
    const source = typeof value === 'string' ? { title: value } : value;
    return {
        id: entityId('test', source, index),
        title: text(source.title || source.description, `Test ${index + 1}`),
        kind: ['unit', 'integration', 'e2e', 'security', 'acceptance'].includes(source.kind) ? source.kind : 'acceptance',
        preconditions: list(source.preconditions),
        steps: list(source.steps),
        expectedResult: text(source.expectedResult),
        requirementIds: list(source.requirementIds),
        status: ['draft', 'ready', 'passed', 'failed'].includes(source.status) ? source.status : 'draft'
    };
}

export function normalizeMilestone(value = {}, index = 0) {
    const source = typeof value === 'string' ? { title: value } : value;
    return {
        id: entityId('milestone', source, index),
        title: text(source.title, `Kilometre taşı ${index + 1}`),
        outcome: text(source.outcome || source.description),
        taskIds: list(source.taskIds),
        targetDate: text(source.targetDate),
        status: ['planned', 'active', 'complete'].includes(source.status) ? source.status : 'planned'
    };
}

export function normalizeTraceLink(value = {}, index = 0) {
    const source = typeof value === 'object' && value ? value : {};
    return {
        id: entityId('trace', source, index),
        fromType: text(source.fromType), fromId: text(source.fromId),
        toType: text(source.toType), toId: text(source.toId),
        relation: text(source.relation, 'supports')
    };
}

export function normalizeAgentPrompt(value = {}, index = 0) {
    const source = typeof value === 'object' && value ? value : {};
    return {
        id: entityId('prompt', source, index),
        role: ['planner', 'implementer', 'reviewer', 'verifier'].includes(source.role) ? source.role : 'implementer',
        title: text(source.title, `Ajan promptu ${index + 1}`),
        instructions: text(source.instructions),
        taskIds: list(source.taskIds),
        dependsOnPromptIds: list(source.dependsOnPromptIds),
        expectedOutputs: list(source.expectedOutputs),
        status: ['draft', 'ready', 'used', 'verified'].includes(source.status) ? source.status : 'draft'
    };
}

export function normalizeResearchQuestion(value = {}, index = 0) {
    const source = typeof value === 'string' ? { question: value } : value;
    return {
        id: entityId('research-question', source, index),
        question: text(source.question || source.title),
        rationale: text(source.rationale),
        priority: ['low', 'medium', 'high'].includes(source.priority) ? source.priority : 'medium',
        status: ['proposed', 'active', 'answered', 'dismissed'].includes(source.status) ? source.status : 'proposed',
        affectedSectionIds: list(source.affectedSectionIds)
    };
}

export function normalizeResearchSource(value = {}, index = 0) {
    const source = typeof value === 'object' && value ? value : {};
    return {
        id: entityId('source', source, index),
        title: text(source.title, `Kaynak ${index + 1}`),
        url: text(source.url),
        publisher: text(source.publisher),
        sourceType: ['primary', 'secondary', 'unknown'].includes(source.sourceType) ? source.sourceType : 'unknown',
        accessedAt: text(source.accessedAt),
        status: ['candidate', 'approved', 'rejected'].includes(source.status) ? source.status : 'candidate',
        questionIds: list(source.questionIds)
    };
}

export function normalizeEvidence(value = {}, index = 0) {
    const source = typeof value === 'object' && value ? value : {};
    return {
        id: entityId('evidence', source, index),
        claim: text(source.claim),
        summary: text(source.summary),
        sourceId: text(source.sourceId),
        questionId: text(source.questionId),
        confidence: ['low', 'medium', 'high'].includes(source.confidence) ? source.confidence : 'medium',
        affectedSectionIds: list(source.affectedSectionIds),
        status: ['proposed', 'accepted', 'superseded'].includes(source.status) ? source.status : 'proposed'
    };
}

export function normalizeReviewFinding(value = {}, index = 0) {
    const source = typeof value === 'object' && value ? value : {};
    return {
        id: entityId('finding', source, index),
        ruleId: text(source.ruleId, 'REVIEW-UNKNOWN'),
        category: text(source.category, 'quality'),
        severity: ['info', 'low', 'medium', 'high', 'critical'].includes(source.severity) ? source.severity : 'medium',
        title: text(source.title, `Bulgu ${index + 1}`),
        description: text(source.description),
        recommendation: text(source.recommendation),
        entityIds: list(source.entityIds),
        sectionIds: list(source.sectionIds),
        status: ['open', 'resolved', 'accepted_risk', 'false_positive'].includes(source.status) ? source.status : 'open'
    };
}

export function normalizeSimulationRun(value = {}, index = 0) {
    const source = typeof value === 'object' && value ? value : {};
    return {
        id: entityId('simulation', source, index),
        scenario: text(source.scenario, 'delivery'),
        title: text(source.title, `Simülasyon ${index + 1}`),
        status: ['passed', 'warning', 'failed'].includes(source.status) ? source.status : 'warning',
        summary: text(source.summary),
        checks: Array.isArray(source.checks) ? source.checks.map(check => ({ id: text(check.id), label: text(check.label), passed: Boolean(check.passed), detail: text(check.detail) })) : [],
        createdAt: text(source.createdAt),
        projectRevision: Number(source.projectRevision || 0)
    };
}

export function normalizeExecutionSession(value = {}, index = 0) {
    const source = typeof value === 'object' && value ? value : {};
    return {
        id: entityId('execution', source, index),
        adapterId: ['codex', 'generic'].includes(source.adapterId) ? source.adapterId : 'generic',
        sourceRevision: Number(source.sourceRevision || 0),
        status: ['proposed', 'prepared', 'running', 'completed', 'failed', 'cancelled', 'external'].includes(source.status) ? source.status : 'proposed',
        worktreeLabel: text(source.worktreeLabel),
        steps: Array.isArray(source.steps) ? source.steps.map(step => ({
            role: ['planner', 'implementer', 'reviewer', 'verifier'].includes(step.role) ? step.role : 'planner',
            risk: ['low', 'medium', 'high'].includes(step.risk) ? step.risk : 'medium',
            status: ['pending', 'running', 'completed', 'failed', 'cancelled'].includes(step.status) ? step.status : 'pending',
            exitCode: Number.isInteger(step.exitCode) ? step.exitCode : null,
            outputSummary: text(step.outputSummary).slice(0, 2000),
            startedAt: text(step.startedAt), completedAt: text(step.completedAt)
        })) : [],
        createdAt: text(source.createdAt), updatedAt: text(source.updatedAt)
    };
}

export function normalizeProjectStateV4(project) {
    if (!project || typeof project !== 'object') return project;
    const next = structuredClone(project);
    next.objectives = (next.objectives || []).map(normalizeObjective);
    next.requirements = (next.requirements || []).map(normalizeRequirement);
    next.decisions = (next.decisions || []).map(normalizeDecision);
    next.assumptions = (next.assumptions || []).map(normalizeAssumption);
    next.risks = (next.risks || []).map(normalizeRisk);
    next.tasks = (next.tasks || []).map(normalizeTask);
    next.testCases = (next.testCases || []).map(normalizeTestCase);
    next.milestones = (next.milestones || []).map(normalizeMilestone);
    next.traceLinks = (next.traceLinks || []).map(normalizeTraceLink);
    next.agentPrompts = (next.agentPrompts || []).map(normalizeAgentPrompt);
    next.researchQuestions = (next.researchQuestions || []).map(normalizeResearchQuestion);
    next.sources = (next.sources || []).map(normalizeResearchSource);
    next.evidence = (next.evidence || []).map(normalizeEvidence);
    next.reviewFindings = (next.reviewFindings || []).map(normalizeReviewFinding);
    next.simulationRuns = (next.simulationRuns || []).map(normalizeSimulationRun);
    next.modules = {
        active: Array.isArray(next.modules?.active) ? next.modules.active.map(item => ({ id: text(item.id), version: text(item.version), enabledAtRevision: Number(item.enabledAtRevision || 0), config: item.config && typeof item.config === 'object' ? item.config : {} })).filter(item => item.id) : [],
        dismissed: list(next.modules?.dismissed),
        localManifests: Array.isArray(next.modules?.localManifests) ? next.modules.localManifests : []
    };
    next.executionSessions = (next.executionSessions || []).map(normalizeExecutionSession);
    next.exports = Array.isArray(next.exports) ? next.exports : [];
    next.metadata = { ...(next.metadata || {}), canonicalModelVersion: CANONICAL_MODEL_VERSION };
    return next;
}

export { CANONICAL_MODEL_VERSION };
