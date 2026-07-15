import { validatePatchProposal } from './patch-policy.js';
import { applyStatePatch as applyStatePatchV2, validateCanonicalState as validateV2 } from '../state/project-state.js';
import { applyV3StatePatch as applyStatePatchV3, validateV3State as validateV3 } from '../state/project-state-v3.js';
import { invalidateApprovalsForPath, getDownstreamInvalidations } from './approval-service.js';

function isV3(state) {
    return state && state.schemaVersion === 3;
}

function applyPatch(state, patch, isSystem) {
    return isV3(state) ? applyStatePatchV3(state, patch, isSystem) : applyStatePatchV2(state, patch, isSystem);
}

function validateState(state) {
    return isV3(state) ? validateV3(state) : validateV2(state);
}

export function applyPatchTransaction({ state, patches, stage, expectedRevision }) {
    if (!state) {
        return { success: false, state: null, error: { code: 'NO_STATE', message: 'Geçersiz durum: State bulunamadı.' } };
    }

    if (expectedRevision !== undefined && expectedRevision !== null) {
        if (state.revision !== expectedRevision) {
            return {
                success: false,
                state,
                error: {
                    code: 'STALE_REVISION',
                    message: `Bayat Değişiklik Çakışması: Beklenen revizyon ${expectedRevision}, mevcut revizyon ${state.revision}.`
                },
                appliedPatches: [],
                invalidatedApprovals: [],
                auditEvents: []
            };
        }
    }

    if (!Array.isArray(patches) || patches.length === 0) {
        return { success: true, state, appliedPatches: [], invalidatedApprovals: [], auditEvents: [] };
    }

    for (let i = 0; i < patches.length; i++) {
        const patch = patches[i];
        const check = validatePatchProposal(stage, patch);
        if (!check.valid) {
            return {
                success: false,
                state,
                error: {
                    code: 'INVALID_PATCH_VALUE',
                    patchId: patch.id || `PAT-${String(i + 1).padStart(3, '0')}`,
                    message: check.reason
                },
                appliedPatches: [],
                invalidatedApprovals: [],
                auditEvents: []
            };
        }
    }

    let transactionState = JSON.parse(JSON.stringify(state));
    const appliedPatches = [];
    const allInvalidated = new Set();
    let revisionBefore = transactionState.revision;

    try {
        for (const patch of patches) {
            transactionState = applyPatch(transactionState, patch, true);

            const downstream = getDownstreamInvalidations(transactionState, patch.path);
            downstream.forEach(k => allInvalidated.add(k));

            transactionState = invalidateApprovalsForPath(transactionState, patch.path);

            appliedPatches.push(patch.id || patch.path);
        }
    } catch (err) {
        return {
            success: false,
            state,
            error: {
                code: 'APPLICATION_ERROR',
                message: `Yama Uygulama Hatası: ${err.message}`
            },
            appliedPatches: [],
            invalidatedApprovals: [],
            auditEvents: []
        };
    }

    const isValidCanonical = validateState(transactionState);
    if (!isValidCanonical) {
        return {
            success: false,
            state,
            error: {
                code: 'CANONICAL_VIOLATION',
                message: 'Nihai kanonik durum doğrulanamadı. Değişiklikler şema bütünlüğünü bozuyor.'
            },
            appliedPatches: [],
            invalidatedApprovals: [],
            auditEvents: []
        };
    }

    const invalidatedApprovals = [...allInvalidated];

    const auditEvents = appliedPatches.map((patchId, i) => ({
        type: 'PATCH_APPLIED',
        patchId,
        path: patches[i]?.path,
        operation: patches[i]?.operation,
        timestamp: new Date().toISOString()
    }));

    if (invalidatedApprovals.length > 0) {
        auditEvents.push({
            type: 'APPROVALS_INVALIDATED',
            keys: invalidatedApprovals,
            timestamp: new Date().toISOString()
        });
    }

    return {
        success: true,
        state: transactionState,
        appliedPatches,
        invalidatedApprovals,
        auditEvents
    };
}
