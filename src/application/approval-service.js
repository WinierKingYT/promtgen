import { ARTIFACT_DEPENDENCIES } from '../domain/artifact-dependencies.js';

export const APPROVAL_KEY_TO_ARTIFACT_PATH = {
    'profile': '/profile',
    'mvpScope': '/scope',
    'requirements': '/requirements',
    'technology': '/decisions',
    'architecture': '/architecture',
    'tasks': '/tasks',
    'finalReview': '/reviews',
    'objectives': '/objectives',
    'scope': '/scope',
    'deliverables': '/deliverables',
    'executionPlan': '/tasks'
};

const PATH_PREFIX_TO_APPROVAL_KEYS = {
    '/profile': ['profile'],
    '/scope': ['scope', 'mvpScope'],
    '/requirements': ['requirements'],
    '/decisions': ['technology'],
    '/architecture': ['architecture'],
    '/tasks': ['tasks', 'executionPlan'],
    '/reviews': ['finalReview'],
    '/objectives': ['objectives'],
    '/deliverables': ['deliverables']
};

export function computeHash(val) {
    const str = JSON.stringify(val || '');
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return (h >>> 0).toString(16);
}

function getArtifactValue(state, path) {
    const parts = path.split('/').filter(p => p !== '');
    let current = state;
    for (const part of parts) {
        if (!current || current[part] === undefined) return null;
        current = current[part];
    }
    return current;
}

export function getArtifactHash(state, path) {
    const val = getArtifactValue(state, path);
    return computeHash(val);
}

export function isApprovalValid(state, approvalKey) {
    if (!state || !state.approvals) return false;
    const approval = state.approvals[approvalKey];
    if (!approval || approval.status !== 'approved') return false;

    const path = APPROVAL_KEY_TO_ARTIFACT_PATH[approvalKey];
    if (!path) return true;

    if (approval.artifactHash === undefined) return true;

    const currentHash = getArtifactHash(state, path);
    return approval.artifactHash === currentHash;
}

export function getApprovalStatus(state, approvalKey) {
    if (!state || !state.approvals) return { status: 'none' };
    const approval = state.approvals[approvalKey];
    if (!approval) return { status: 'none' };
    return {
        status: approval.status,
        artifactHash: approval.artifactHash,
        approvedAt: approval.approvedAt,
        notes: approval.notes
    };
}

export function isApprovalCurrent(state, approvalKey) {
    const approval = state.approvals?.[approvalKey];
    if (!approval || approval.status !== 'approved') return false;
    const path = APPROVAL_KEY_TO_ARTIFACT_PATH[approvalKey];
    if (!path) return true;
    const currentHash = getArtifactHash(state, path);
    return approval.artifactHash === currentHash;
}

export function approveArtifact(state, approvalKey, notes = 'Kullanıcı onayı') {
    const path = APPROVAL_KEY_TO_ARTIFACT_PATH[approvalKey];
    if (!path) {
        if (!state.approvals || state.approvals[approvalKey] === undefined) return state;
    }

    const cloned = JSON.parse(JSON.stringify(state));
    const targetPath = path || '/';
    const hash = targetPath === '/' ? computeHash({ approvedAt: Date.now() }) : getArtifactHash(state, targetPath);
    cloned.approvals[approvalKey] = {
        status: 'approved',
        artifactHash: hash,
        approvedAt: new Date().toISOString(),
        notes
    };
    return cloned;
}

export function rejectArtifact(state, approvalKey, notes = 'Reddedildi') {
    const cloned = JSON.parse(JSON.stringify(state));
    if (cloned.approvals[approvalKey]) {
        cloned.approvals[approvalKey] = {
            status: 'rejected',
            artifactHash: cloned.approvals[approvalKey].artifactHash || null,
            approvedAt: new Date().toISOString(),
            notes
        };
    }
    return cloned;
}

export function invalidateApproval(state, approvalKey) {
    const cloned = JSON.parse(JSON.stringify(state));
    if (cloned.approvals[approvalKey]) {
        cloned.approvals[approvalKey] = null;
    }
    return cloned;
}

export function invalidateApprovalsForPath(state, patchPath) {
    if (!state || !state.approvals) return state;
    const cloned = JSON.parse(JSON.stringify(state));

    const affectedKeys = new Set();

    for (const [prefix, keys] of Object.entries(PATH_PREFIX_TO_APPROVAL_KEYS)) {
        if (patchPath === prefix || patchPath.startsWith(prefix + '/')) {
            for (const key of keys) {
                affectedKeys.add(key);
            }
        }
    }

    for (const key of affectedKeys) {
        if (cloned.approvals[key] !== null && cloned.approvals[key] !== undefined) {
            cloned.approvals[key] = null;
        }
    }

    for (const key of affectedKeys) {
        const downstream = ARTIFACT_DEPENDENCIES[key];
        if (downstream) {
            for (const depKey of downstream) {
                if (cloned.approvals[depKey] !== null && cloned.approvals[depKey] !== undefined) {
                    cloned.approvals[depKey] = null;
                }
            }
        }
    }

    return cloned;
}

function getMatchingApprovalKeys(patchPath) {
    for (const [prefix, keys] of Object.entries(PATH_PREFIX_TO_APPROVAL_KEYS)) {
        if (patchPath === prefix || patchPath.startsWith(prefix + '/')) {
            return keys;
        }
    }
    return [];
}

export function getDownstreamInvalidations(state, patchPath) {
    const matchingKeys = getMatchingApprovalKeys(patchPath);
    if (matchingKeys.length === 0) return [];

    const invalidated = [];
    const seen = new Set();
    for (const key of matchingKeys) {
        const downstream = ARTIFACT_DEPENDENCIES[key];
        if (downstream) {
            for (const depKey of downstream) {
                if (!seen.has(depKey) && state.approvals[depKey] !== null) {
                    invalidated.push(depKey);
                    seen.add(depKey);
                }
            }
        }
    }
    return invalidated;
}
