export const MODULE_STATUS = {
    DETECTED: 'detected',
    PROPOSED: 'proposed',
    ACTIVE: 'active',
    DISABLED: 'disabled',
    REJECTED: 'rejected',
    REQUIRED: 'required',
    CONFLICTED: 'conflicted'
};

export const MODULE_CATEGORIES = {
    CORE: 'core',
    DOMAIN: 'domain',
    PLATFORM: 'platform',
    CAPABILITY: 'capability',
    COMPLIANCE: 'compliance',
    WORKFLOW: 'workflow'
};

export const CONTRIBUTION_TYPES = [
    'stateSchema', 'discovery', 'decisions', 'artifacts',
    'tasks', 'prompts', 'traceability', 'reviewer', 'exporters'
];

export function createModuleManifest(overrides = {}) {
    return {
        id: overrides.id || '',
        name: overrides.name || '',
        version: overrides.version || '1.0.0',
        category: overrides.category || MODULE_CATEGORIES.DOMAIN,
        parentModule: overrides.parentModule || null,
        description: overrides.description || '',
        activation: overrides.activation || { signals: [], minimumConfidence: 0.5 },
        dependencies: overrides.dependencies || [],
        optionalDependencies: overrides.optionalDependencies || [],
        conflictsWith: overrides.conflictsWith || [],
        contributions: overrides.contributions || {}
    };
}

export const UNIVERSAL_MODULES = ['universal', 'planning', 'decisions', 'artifacts', 'tasks', 'traceability', 'reviewer'];

export function getCoreModules() {
    return UNIVERSAL_MODULES;
}
