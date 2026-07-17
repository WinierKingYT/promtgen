export const NODE_TYPES = {
    OBJECTIVE: 'objective',
    STAKEHOLDER: 'stakeholder',
    CONSTRAINT: 'constraint',
    ASSUMPTION: 'assumption',
    OPEN_QUESTION: 'open_question',
    REQUIREMENT: 'requirement',
    DECISION: 'decision',
    RISK: 'risk',
    DELIVERABLE: 'deliverable',
    WORKSTREAM: 'workstream',
    ARTIFACT: 'artifact',
    ARCHITECTURE_COMPONENT: 'architecture_component',
    FOLDER_BLUEPRINT: 'folder_blueprint',
    FILE_BLUEPRINT: 'file_blueprint',
    TASK: 'task',
    PROMPT: 'prompt',
    AGENT: 'agent',
    TEST: 'test',
    MILESTONE: 'milestone',
    REVIEW_FINDING: 'review_finding',
    APPROVAL: 'approval',
    SOURCE: 'source',
    EVIDENCE: 'evidence',
    RESEARCH_QUESTION: 'research_question',
    HYPOTHESIS: 'hypothesis',
    GAME_MECHANIC: 'game_mechanic',
    GAME_SYSTEM: 'game_system',
    EVENT: 'event'
};

export const NODE_CATEGORIES = {
    [NODE_TYPES.OBJECTIVE]: 'planning',
    [NODE_TYPES.STAKEHOLDER]: 'planning',
    [NODE_TYPES.CONSTRAINT]: 'planning',
    [NODE_TYPES.ASSUMPTION]: 'planning',
    [NODE_TYPES.OPEN_QUESTION]: 'discovery',
    [NODE_TYPES.REQUIREMENT]: 'planning',
    [NODE_TYPES.DECISION]: 'decision',
    [NODE_TYPES.RISK]: 'planning',
    [NODE_TYPES.DELIVERABLE]: 'planning',
    [NODE_TYPES.WORKSTREAM]: 'execution',
    [NODE_TYPES.ARTIFACT]: 'artifact',
    [NODE_TYPES.ARCHITECTURE_COMPONENT]: 'design',
    [NODE_TYPES.FOLDER_BLUEPRINT]: 'design',
    [NODE_TYPES.FILE_BLUEPRINT]: 'design',
    [NODE_TYPES.TASK]: 'execution',
    [NODE_TYPES.PROMPT]: 'execution',
    [NODE_TYPES.AGENT]: 'execution',
    [NODE_TYPES.TEST]: 'quality',
    [NODE_TYPES.MILESTONE]: 'planning',
    [NODE_TYPES.REVIEW_FINDING]: 'quality',
    [NODE_TYPES.APPROVAL]: 'governance',
    [NODE_TYPES.SOURCE]: 'research',
    [NODE_TYPES.EVIDENCE]: 'research',
    [NODE_TYPES.RESEARCH_QUESTION]: 'research',
    [NODE_TYPES.HYPOTHESIS]: 'research',
    [NODE_TYPES.GAME_MECHANIC]: 'design',
    [NODE_TYPES.GAME_SYSTEM]: 'design',
    [NODE_TYPES.EVENT]: 'governance'
};

export const EDGE_TYPES = {
    SUPPORTS: 'supports',
    IMPLEMENTS: 'implements',
    DEPENDS_ON: 'depends_on',
    DERIVED_FROM: 'derived_from',
    CONSTRAINED_BY: 'constrained_by',
    VALIDATED_BY: 'validated_by',
    PRODUCES: 'produces',
    CONSUMES: 'consumes',
    DOCUMENTS: 'documents',
    TESTS: 'tests',
    MITIGATES: 'mitigates',
    BLOCKS: 'blocks',
    CONFLICTS_WITH: 'conflicts_with',
    SUPERSEDES: 'supersedes',
    ASSIGNED_TO: 'assigned_to',
    GENERATED_FROM: 'generated_from',
    BELONGS_TO: 'belongs_to',
    REFINES: 'refines',
    TRIGGERS: 'triggers',
    REVIEWS: 'reviews',
    APPROVES: 'approves',
    RELATES_TO: 'relates_to',
    DRIVES: 'drives'
};

export const EDGE_STRENGTH = {
    REQUIRED: 'required',
    SUPPORTING: 'supporting',
    INFORMATIONAL: 'informational'
};

export const EDGE_SOURCE = {
    DETERMINISTIC_RULE: 'deterministic_rule',
    USER: 'user',
    AI_PROPOSAL: 'ai_proposal',
    MODULE_RULE: 'module_rule',
    ARTIFACT_GENERATOR: 'artifact_generator',
    TASK_GENERATOR: 'task_generator',
    REVIEWER: 'reviewer',
    IMPORTED_FILE: 'imported_file',
    EXTERNAL_SOURCE: 'external_source'
};

export const IMPACT_EFFECTS = {
    INVALIDATE: 'invalidate',
    STALE: 'stale',
    REGENERATE: 'regenerate',
    REVIEW: 'review',
    NO_ACTION: 'no_action'
};

export const IMPACT_SEVERITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

export const CHANGE_TYPES = {
    ADD: 'add',
    REPLACE: 'replace',
    REMOVE: 'remove',
    MODIFY: 'modify'
};

export function getAllNodeTypes() {
    return Object.values(NODE_TYPES);
}

export function getAllEdgeTypes() {
    return Object.values(EDGE_TYPES);
}

export function getAllEdgeStrengths() {
    return Object.values(EDGE_STRENGTH);
}

export function getDefaultImpactRules() {
    return [
        { sourceType: NODE_TYPES.DECISION, edgeType: EDGE_TYPES.DRIVES, targetType: NODE_TYPES.ARCHITECTURE_COMPONENT, effect: IMPACT_EFFECTS.STALE, severity: IMPACT_SEVERITY.HIGH, propagate: true },
        { sourceType: NODE_TYPES.REQUIREMENT, edgeType: EDGE_TYPES.IMPLEMENTS, targetType: NODE_TYPES.TASK, effect: IMPACT_EFFECTS.REVIEW, severity: IMPACT_SEVERITY.HIGH, propagate: false },
        { sourceType: NODE_TYPES.REQUIREMENT, edgeType: EDGE_TYPES.DRIVES, targetType: NODE_TYPES.DECISION, effect: IMPACT_EFFECTS.REVIEW, severity: IMPACT_SEVERITY.HIGH, propagate: true },
        { sourceType: NODE_TYPES.REQUIREMENT, edgeType: EDGE_TYPES.VALIDATED_BY, targetType: NODE_TYPES.TEST, effect: IMPACT_EFFECTS.REVIEW, severity: IMPACT_SEVERITY.MEDIUM, propagate: false },
        { sourceType: NODE_TYPES.DECISION, edgeType: EDGE_TYPES.SUPERSEDES, targetType: NODE_TYPES.DECISION, effect: IMPACT_EFFECTS.INVALIDATE, severity: IMPACT_SEVERITY.CRITICAL, propagate: true },
        { sourceType: NODE_TYPES.OBJECTIVE, edgeType: EDGE_TYPES.REFINES, targetType: NODE_TYPES.REQUIREMENT, effect: IMPACT_EFFECTS.STALE, severity: IMPACT_SEVERITY.HIGH, propagate: true },
        { sourceType: NODE_TYPES.TASK, edgeType: EDGE_TYPES.DEPENDS_ON, targetType: NODE_TYPES.TASK, effect: IMPACT_EFFECTS.INVALIDATE, severity: IMPACT_SEVERITY.HIGH, propagate: false },
        { sourceType: NODE_TYPES.TASK, edgeType: EDGE_TYPES.PRODUCES, targetType: NODE_TYPES.ARTIFACT, effect: IMPACT_EFFECTS.STALE, severity: IMPACT_SEVERITY.MEDIUM, propagate: false },
        { sourceType: NODE_TYPES.ARCHITECTURE_COMPONENT, edgeType: EDGE_TYPES.IMPLEMENTS, targetType: NODE_TYPES.FILE_BLUEPRINT, effect: IMPACT_EFFECTS.STALE, severity: IMPACT_SEVERITY.HIGH, propagate: true },
    ];
}

export function getDefaultMinTraceabilityRules() {
    return [
        { nodeType: NODE_TYPES.REQUIREMENT, minOutgoing: 0, minIncoming: 1, incomingTypes: [EDGE_TYPES.SUPPORTS, EDGE_TYPES.DERIVED_FROM], severity: 'high' },
        { nodeType: NODE_TYPES.DECISION, minOutgoing: 1, minIncoming: 1, severity: 'high' },
        { nodeType: NODE_TYPES.FILE_BLUEPRINT, minOutgoing: 0, minIncoming: 1, severity: 'medium' },
        { nodeType: NODE_TYPES.TASK, minOutgoing: 0, minIncoming: 1, severity: 'high' },
        { nodeType: NODE_TYPES.TEST, minOutgoing: 0, minIncoming: 1, incomingTypes: [EDGE_TYPES.VALIDATED_BY], severity: 'medium' },
    ];
}
