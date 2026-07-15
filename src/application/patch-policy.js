import { isPatchPathAllowed, validateValueByPath } from '../workflow/stage-contracts.js';

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

const ROOT_FIELDS = [
    '/identity', '/profile', '/scope', '/requirements', '/decisions',
    '/assumptions', '/risks', '/openQuestions', '/architecture', '/tasks',
    '/documents', '/reviews', '/agentPackage', '/workflowSuggestion', '/approvals'
];

/**
 * Checks if a given patch path matches a policy pattern.
 */
function pathMatchesPattern(path, pattern) {
    if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -2);
        return path === prefix || path.startsWith(prefix + '/');
    }
    return path === pattern;
}

/**
 * Validates a single JSON Patch proposal against the current workflow stage's policy.
 * 
 * @param {string} stage - Current workflow stage
 * @param {object} patch - The patch object (operation, path, value)
 * @returns {object} { valid: boolean, reason?: string }
 */
export function validatePatchProposal(stage, patch) {
    if (!patch || typeof patch !== 'object') {
        return { valid: false, reason: "Geçersiz patch nesnesi." };
    }

    const { operation, path, value } = patch;
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

    // 3. Required Root Remove Protection
    if (ROOT_FIELDS.includes(path) && operation === 'remove') {
        return { valid: false, reason: `Güvenlik İhlali: Kritik kök alan silinemez (${path})` };
    }

    // 4. Stage-Specific Policy Check (Allowed Paths)
    const isAllowed = isPatchPathAllowed(stage, path);
    if (!isAllowed) {
        return { 
            valid: false, 
            reason: `Yetki İhlali: '${stage}' aşamasında '${path}' alanını değiştirmeye izin verilmiyor.` 
        };
    }

    // 5. Value Schema Validation (for non-remove operations)
    if (operation !== 'remove') {
        const schemaCheck = validateValueByPath(path, value);
        if (!schemaCheck.valid) {
            return {
                valid: false,
                reason: `Şema İhlali: '${path}' için geçersiz değer tipi. Hata: ${schemaCheck.reason}`
            };
        }
    }

    return { valid: true };
}
