export const EVENT_TYPES = {
    PROJECT_CREATED: 'PROJECT_CREATED',
    AI_PATCHES_PROPOSED: 'AI_PATCHES_PROPOSED',
    PATCH_EDITED: 'PATCH_EDITED',
    PATCH_ACCEPTED: 'PATCH_ACCEPTED',
    PATCH_REJECTED: 'PATCH_REJECTED',
    PATCH_TRANSACTION_COMMITTED: 'PATCH_TRANSACTION_COMMITTED',
    APPROVAL_GRANTED: 'APPROVAL_GRANTED',
    APPROVAL_INVALIDATED: 'APPROVAL_INVALIDATED',
    WORKFLOW_ADVANCED: 'WORKFLOW_ADVANCED',
    PROJECT_EXPORTED: 'PROJECT_EXPORTED'
};

let _eventCounter = 0;

export function createEvent(type, projectId, revisionBefore, revisionAfter, payload = {}) {
    _eventCounter++;
    const id = `EVT-${String(_eventCounter).padStart(5, '0')}`;
    return {
        id,
        type,
        projectId,
        revisionBefore,
        revisionAfter,
        payload,
        createdAt: new Date().toISOString()
    };
}
