import { createProjectDocument } from './project-document.js';

/**
 * Migration-only V4 fixture builder. Production code must use ProjectDocumentV5.
 */
export function createLegacyProjectStateV4(options = {}) {
    const legacy = createProjectDocument(options);
    legacy.schemaVersion = 4;
    delete legacy.schemaRevision;
    legacy.suggestionBundles = structuredClone(legacy.proposalStore.bundles);
    delete legacy.proposalStore;
    return legacy;
}

export function isLegacyProjectStateV4(value) {
    return Boolean(value && typeof value === 'object' && value.schemaVersion === 4);
}
