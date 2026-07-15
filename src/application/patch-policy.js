import { WORKFLOW_STAGES } from '../workflow/stages.js';

export const PATCH_POLICY_BY_STAGE = {
    [WORKFLOW_STAGES.IDEA_CAPTURED]: [
        '/identity',
        '/identity/*',
        '/profile',
        '/profile/*'
    ],
    [WORKFLOW_STAGES.PROFILE_DRAFTED]: [
        '/decisions',
        '/decisions/*',
        '/assumptions',
        '/assumptions/*',
        '/openQuestions',
        '/openQuestions/*',
        '/profile/uncertainties',
        '/profile/uncertainties/*'
    ],
    [WORKFLOW_STAGES.DISCOVERY_IN_PROGRESS]: [
        '/scope',
        '/scope/*'
    ],
    [WORKFLOW_STAGES.MVP_DEFINED]: [
        '/requirements',
        '/requirements/*'
    ],
    [WORKFLOW_STAGES.REQUIREMENTS_DRAFTED]: [
        '/decisions',
        '/decisions/*',
        '/assumptions',
        '/assumptions/*',
        '/openQuestions',
        '/openQuestions/*'
    ],
    [WORKFLOW_STAGES.TECH_OPTIONS_READY]: [
        '/decisions',
        '/decisions/*'
    ],
    [WORKFLOW_STAGES.TECH_STACK_SELECTED]: [
        '/architecture',
        '/architecture/*'
    ],
    [WORKFLOW_STAGES.ARCHITECTURE_DRAFTED]: [
        '/tasks',
        '/tasks/*'
    ],
    [WORKFLOW_STAGES.TASKS_DRAFTED]: [
        '/agentPackage',
        '/agentPackage/*'
    ],
    [WORKFLOW_STAGES.AGENT_PACKAGE_DRAFTED]: [
        '/reviews',
        '/reviews/*'
    ],
    [WORKFLOW_STAGES.REVIEW_IN_PROGRESS]: [
        '/reviews',
        '/reviews/*'
    ],
    [WORKFLOW_STAGES.READY_FOR_EXPORT]: [],
    [WORKFLOW_STAGES.EXPORTED]: []
};

// Paths that are strictly forbidden from being modified by AI patches in any stage
export const GLOBAL_FORBIDDEN_PATHS = [
    '/workflowStage',
    '/schemaVersion',
    '/revision',
    '/approvals',
    '/approvals/*',
    '/workflowSuggestion',
    '/workflowSuggestion/*'
];

/**
 * Checks if a given patch path matches a policy pattern.
 * Supports exact matches and wildcards (e.g., '/identity/*' matches '/identity/name')
 */
export function pathMatchesPattern(path, pattern) {
    if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -2);
        return path === prefix || path.startsWith(prefix + '/');
    }
    return path === pattern;
}

/**
 * Validates a single JSON Patch proposal against the current workflow stage's policy.
 * @param {string} stage - Current workflow stage
 * @param {object} patch - The patch object (operation, path, value)
 * @returns {object} { valid: boolean, reason?: string }
 */
export function validatePatchProposal(stage, patch) {
    if (!patch || typeof patch !== 'object') {
        return { valid: false, reason: "Geçersiz patch nesnesi." };
    }

    const { operation, path } = patch;
    if (!path || typeof path !== 'string') {
        return { valid: false, reason: "Patch yolu (path) geçerli bir string olmalıdır." };
    }

    if (!operation || !['add', 'replace', 'remove', 'set'].includes(operation)) {
        return { valid: false, reason: `Geçersiz patch operasyonu: ${operation}` };
    }

    // 1. Prototype Pollution Check
    const pathParts = path.split('/').filter(p => p !== '');
    const hasPollution = pathParts.some(part => part === '__proto__' || part === 'constructor' || part === 'prototype');
    if (hasPollution) {
        return { valid: false, reason: `Güvenlik İhlali: Prototype pollution tespiti (${path})` };
    }

    // 2. Global Forbidden Paths Check
    const isGlobalForbidden = GLOBAL_FORBIDDEN_PATHS.some(pattern => pathMatchesPattern(path, pattern));
    if (isGlobalForbidden) {
        return { valid: false, reason: `Güvenlik İhlali: Kritik sistem alanları patch ile değiştirilemez (${path})` };
    }

    // 3. Stage-Specific Policy Check
    const allowedPatterns = PATCH_POLICY_BY_STAGE[stage];
    if (!allowedPatterns) {
        return { valid: false, reason: `Bilinmeyen veya tanımsız workflow aşaması: ${stage}` };
    }

    const isAllowed = allowedPatterns.some(pattern => pathMatchesPattern(path, pattern));
    if (!isAllowed) {
        return { 
            valid: false, 
            reason: `Yetki İhlali: '${stage}' aşamasında '${path}' alanını değiştirmeye izin verilmiyor.` 
        };
    }

    return { valid: true };
}
