export const REVIEW_CATEGORIES = {
    SCHEMA: 'schema',
    DISCOVERY: 'discovery',
    SCOPE: 'scope',
    DECISION: 'decision',
    ARTIFACT: 'artifact',
    WORKSPACE: 'workspace',
    TASK: 'task',
    PROMPT: 'prompt',
    TEST_VALIDATION: 'test_validation',
    APPROVAL: 'approval',
    EXPORT: 'export',
    TRACEABILITY: 'traceability',
    RISK: 'risk',
    CONSISTENCY: 'consistency',
    MODULE_SPECIFIC: 'module_specific'
};

export const SEVERITY = {
    INFO: 'info',
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

export const SEVERITY_ORDER = ['info', 'low', 'medium', 'high', 'critical'];
export const SEVERITY_PENALTY = { info: 0, low: 1, medium: 4, high: 10, critical: 25 };
export const SEVERITY_WEIGHT = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

export const FINDING_STATUS = {
    OPEN: 'open',
    ACKNOWLEDGED: 'acknowledged',
    FIX_PROPOSED: 'fix_proposed',
    IN_PROGRESS: 'in_progress',
    RESOLVED: 'resolved',
    DISMISSED: 'dismissed',
    FALSE_POSITIVE: 'false_positive',
    SUPERSEDED: 'superseded'
};

export const READINESS_LEVELS = [
    { id: 'idea_ready', label: 'Idea Ready', minHealth: 0, requiredCategories: [] },
    { id: 'discovery_ready', label: 'Discovery Ready', minHealth: 30, requiredCategories: ['discovery'] },
    { id: 'planning_ready', label: 'Planning Ready', minHealth: 50, requiredCategories: ['discovery', 'scope', 'decision'] },
    { id: 'blueprint_ready', label: 'Blueprint Ready', minHealth: 60, requiredCategories: ['artifact', 'workspace'] },
    { id: 'implementation_ready', label: 'Implementation Ready', minHealth: 70, requiredCategories: ['task', 'traceability'] },
    { id: 'agent_ready', label: 'Agent Ready', minHealth: 80, requiredCategories: ['prompt', 'task'] },
    { id: 'export_ready', label: 'Export Ready', minHealth: 85, requiredCategories: ['export', 'approval'] }
];

export const GATES = {
    PLAN_ONLY: 'plan_only',
    BLUEPRINT: 'blueprint',
    AGENT_READY: 'agent_ready',
    COMPLETE: 'complete'
};

export const GATE_CONFIG = {
    [GATES.PLAN_ONLY]: {
        maxCritical: 1, maxHigh: 5, requiredCategories: ['discovery', 'scope'],
        minHealth: 40, label: 'Plan Only Export'
    },
    [GATES.BLUEPRINT]: {
        maxCritical: 0, maxHigh: 3, requiredCategories: ['artifact', 'workspace'],
        minHealth: 60, label: 'Blueprint Export'
    },
    [GATES.AGENT_READY]: {
        maxCritical: 0, maxHigh: 2, requiredCategories: ['prompt', 'task', 'traceability'],
        minHealth: 75, label: 'Agent Ready Export'
    },
    [GATES.COMPLETE]: {
        maxCritical: 0, maxHigh: 0, requiredCategories: ['export', 'approval'],
        minHealth: 85, label: 'Complete Package Export'
    }
};

export const HEALTH_CATEGORIES = [
    { key: 'discovery', label: 'Discovery Completeness', weight: 0.10 },
    { key: 'scope', label: 'Scope Quality', weight: 0.10 },
    { key: 'decisions', label: 'Decision Quality', weight: 0.10 },
    { key: 'artifacts', label: 'Artifact Completeness', weight: 0.15 },
    { key: 'tasks', label: 'Task Readiness', weight: 0.15 },
    { key: 'prompts', label: 'Prompt Readiness', weight: 0.10 },
    { key: 'traceability', label: 'Traceability Coverage', weight: 0.15 },
    { key: 'validation', label: 'Validation Coverage', weight: 0.08 },
    { key: 'risks', label: 'Risk Management', weight: 0.03 },
    { key: 'approvals', label: 'Approval Freshness', weight: 0.04 }
];

export const CRITICAL_CAPS = [
    { condition: { category: 'schema', minSeverity: 'critical' }, maxScore: 20, message: 'Schema kritik hata içeriyor' },
    { condition: { category: 'consistency' }, maxScore: 55, message: 'Tutarlılık sorunları var' },
    { condition: { category: 'scope', minSeverity: 'high' }, maxScore: 65, message: 'Kapsam sorunları var' }
];
