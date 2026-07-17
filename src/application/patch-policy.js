import { isPatchPathAllowed, validateValueByPath, validateValueBySchema, REQUIRED_ROOT_PATHS } from '../workflow/stage-contracts.js';
import { isPhasePatchAllowed, PHASE_REQUIRED_ROOT_PATHS } from '../workflow/phase-contracts.js';

export const GLOBAL_FORBIDDEN_PATHS = [
    '/phase',
    '/workflowStage',
    '/schemaVersion',
    '/revision',
    '/approvals',
    '/approvals/*',
    '/pendingChangeSet',
    '/pendingChangeSet/*'
];

function pathMatchesPattern(path, pattern) {
    if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -2);
        return path === prefix || path.startsWith(prefix + '/');
    }
    return path === pattern;
}

export function validatePatchProposal(stage, patch, schemaVersion) {
    if (!patch || typeof patch !== 'object') {
        return { valid: false, reason: 'Geçersiz patch nesnesi.' };
    }

    const { operation, path, value } = patch;
    if (!path || typeof path !== 'string') {
        return { valid: false, reason: 'Patch yolu (path) geçerli bir string olmalıdır.' };
    }

    if (!operation || !['add', 'replace', 'remove', 'set'].includes(operation)) {
        return { valid: false, reason: `Geçersiz patch operasyonu: ${operation}` };
    }

    const pathParts = path.split('/').filter(p => p !== '');
    const hasPollution = pathParts.some(part => part === '__proto__' || part === 'constructor' || part === 'prototype');
    if (hasPollution) {
        return { valid: false, reason: `Güvenlik İhlali: Prototype pollution tespiti (${path})` };
    }

    const isGlobalForbidden = GLOBAL_FORBIDDEN_PATHS.some(pattern => pathMatchesPattern(path, pattern));
    if (isGlobalForbidden) {
        return { valid: false, reason: `Güvenlik İhlali: Kritik sistem alanları patch ile değiştirilemez (${path})` };
    }

    if (schemaVersion === 3) {
        if (PHASE_REQUIRED_ROOT_PATHS.includes(path) && operation === 'remove') {
            return { valid: false, reason: `Güvenlik İhlali: Kritik kök alan silinemez (${path})` };
        }
        const isAllowed = isPhasePatchAllowed(stage, path);
        if (!isAllowed) {
            return { valid: false, reason: `Yetki İhlali: '${stage}' fazında '${path}' alanını değiştirmeye izin verilmiyor.` };
        }
    } else {
        if (REQUIRED_ROOT_PATHS.includes(path) && operation === 'remove') {
            return { valid: false, reason: `Güvenlik İhlali: Kritik kök alan silinemez (${path})` };
        }
        const isAllowed = isPatchPathAllowed(stage, path);
        if (!isAllowed) {
            return { valid: false, reason: `Yetki İhlali: '${stage}' aşamasında '${path}' alanını değiştirmeye izin verilmiyor.` };
        }
    }

    if (operation !== 'remove') {
        const schemaCheck = validateValueByPath(path, value);
        if (!schemaCheck.valid) {
            return { valid: false, reason: `Şema İhlali: '${path}' için geçersiz değer tipi. Hata: ${schemaCheck.reason}` };
        }

        const valueSchemaCheck = validateValueBySchema(path, value);
        if (!valueSchemaCheck.valid) {
            return { valid: false, reason: `Değer Şeması İhlali: '${path}' için geçersiz değer. Hata: ${valueSchemaCheck.reason}` };
        }
    }

    return { valid: true };
}

export function validateV3PatchProposal(phase, patch) {
    if (!patch || typeof patch !== 'object') {
        return { valid: false, reason: 'Geçersiz patch nesnesi.' };
    }

    const { operation, path, value } = patch;
    if (!path || typeof path !== 'string') {
        return { valid: false, reason: 'Patch yolu (path) geçerli bir string olmalıdır.' };
    }

    if (!operation || !['add', 'replace', 'remove', 'set'].includes(operation)) {
        return { valid: false, reason: `Geçersiz patch operasyonu: ${operation}` };
    }

    const pathParts = path.split('/').filter(p => p !== '');
    const hasPollution = pathParts.some(part => part === '__proto__' || part === 'constructor' || part === 'prototype');
    if (hasPollution) {
        return { valid: false, reason: `Güvenlik İhlali: Prototype pollution tespiti (${path})` };
    }

    const isGlobalForbidden = GLOBAL_FORBIDDEN_PATHS.some(pattern => pathMatchesPattern(path, pattern));
    if (isGlobalForbidden) {
        return { valid: false, reason: `Güvenlik İhlali: Kritik sistem alanları patch ile değiştirilemez (${path})` };
    }

    if (PHASE_REQUIRED_ROOT_PATHS.includes(path) && operation === 'remove') {
        return { valid: false, reason: `Güvenlik İhlali: Kritik kök alan silinemez (${path})` };
    }

    const isAllowed = isPhasePatchAllowed(phase, path);
    if (!isAllowed) {
        return { valid: false, reason: `Yetki İhlali: '${phase}' fazında '${path}' alanını değiştirmeye izin verilmiyor.` };
    }

    if (operation !== 'remove') {
        const schemaCheck = validateValueByPath(path, value);
        if (!schemaCheck.valid) {
            return { valid: false, reason: `Şema İhlali: '${path}' için geçersiz değer tipi. Hata: ${schemaCheck.reason}` };
        }

        const valueSchemaCheck = validateValueBySchema(path, value);
        if (!valueSchemaCheck.valid) {
            return { valid: false, reason: `Değer Şeması İhlali: '${path}' için geçersiz değer. Hata: ${valueSchemaCheck.reason}` };
        }
    }

    return { valid: true };
}
