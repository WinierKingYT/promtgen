export const APPROVAL_KEY_TO_ARTIFACT_PATH = {
    'profile': '/profile',
    'mvpScope': '/scope',
    'requirements': '/requirements',
    'technology': '/decisions',
    'architecture': '/architecture',
    'tasks': '/tasks',
    'finalReview': '/reviews'
};

const PATH_PREFIX_TO_APPROVAL_KEY = {
    '/profile': 'profile',
    '/scope': 'mvpScope',
    '/requirements': 'requirements',
    '/decisions': 'technology',
    '/architecture': 'architecture',
    '/tasks': 'tasks',
    '/reviews': 'finalReview'
};

/**
 * Synchronously computes a 32-bit FNV-1a hash of any JavaScript value/object.
 * Used to detect content changes of planning artifacts.
 * 
 * @param {any} val - Value to hash
 * @returns {string} hex hash
 */
export function computeHash(val) {
    const str = JSON.stringify(val || "");
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return (h >>> 0).toString(16);
}

/**
 * Resolves the state sub-object at a given path.
 */
function getArtifactValue(state, path) {
    const parts = path.split('/').filter(p => p !== '');
    let current = state;
    for (const part of parts) {
        if (!current || current[part] === undefined) return null;
        current = current[part];
    }
    return current;
}

/**
 * Computes hash of the artifact value in the canonical state.
 */
export function getArtifactHash(state, path) {
    const val = getArtifactValue(state, path);
    return computeHash(val);
}

/**
 * Checks if a specific approval in the state is valid and matches the current artifact contents.
 * 
 * @param {object} state - Project canonical state
 * @param {string} approvalKey - Key under state.approvals
 * @returns {boolean} true if approved and hash matches, false otherwise
 */
export function isApprovalValid(state, approvalKey) {
    if (!state || !state.approvals) return false;
    const approval = state.approvals[approvalKey];
    if (!approval || approval.status !== 'approved') return false;

    const path = APPROVAL_KEY_TO_ARTIFACT_PATH[approvalKey];
    if (!path) return true; // If not mapped, assume valid

    // Backwards compatibility for legacy approvals loaded without a hash
    if (approval.artifactHash === undefined) return true;

    const currentHash = getArtifactHash(state, path);
    return approval.artifactHash === currentHash;
}

/**
 * Automatically invalidates approvals in the state if a patch path modifies their associated artifacts.
 * Returns the modified state with invalidated approvals set to null.
 * 
 * @param {object} state - Project canonical state
 * @param {string} patchPath - Path that was modified by a patch
 * @returns {object} updated state
 */
export function invalidateApprovalsForPath(state, patchPath) {
    if (!state || !state.approvals) return state;
    const cloned = JSON.parse(JSON.stringify(state));

    // Check which approval keys need to be invalidated
    for (const [prefix, key] of Object.entries(PATH_PREFIX_TO_APPROVAL_KEY)) {
        if (patchPath === prefix || patchPath.startsWith(prefix + '/')) {
            if (cloned.approvals[key] !== null) {
                console.log(`[Approval Invalidation] Path '${patchPath}' modified. Invalidating approval for '${key}'.`);
                cloned.approvals[key] = null;
            }
        }
    }

    return cloned;
}
