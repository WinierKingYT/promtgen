import { validatePatchProposal } from './patch-policy.js';
import { applyStatePatch, validateCanonicalState } from '../state/project-state.js';

/**
 * Executes a transaction of multiple JSON patches on the canonical project state.
 * Performs validation of the stage policy, value schemas, revision alignment, 
 * and strict canonical validation. Rolls back completely on any failure.
 * 
 * @param {object} options
 * @param {object} options.state - Current canonical state
 * @param {object[]} options.patches - List of patches to apply
 * @param {string} options.stage - Current workflow stage
 * @param {number} [options.expectedRevision] - Optional expected revision count to prevent stale updates
 * @returns {object} { success: boolean, state: object, error?: string }
 */
export function applyPatchTransaction({ state, patches, stage, expectedRevision }) {
    if (!state) {
        return { success: false, error: "Geçersiz durum: State bulunamadı." };
    }

    // 1. Expected Revision check (Conflict prevention)
    if (expectedRevision !== undefined && expectedRevision !== null) {
        if (state.revision !== expectedRevision) {
            return { 
                success: false, 
                error: `Bayat Değişiklik Çakışması: Beklenen revizyon ${expectedRevision}, mevcut revizyon ${state.revision}. Lütfen sayfayı yenileyip tekrar deneyin.`,
                state 
            };
        }
    }

    if (!Array.isArray(patches) || patches.length === 0) {
        return { success: true, state };
    }

    // Clone state for transaction rollback isolation
    let transactionState = JSON.parse(JSON.stringify(state));

    // 2. Validate all patches first (Atomic pre-check)
    for (const patch of patches) {
        const check = validatePatchProposal(stage, patch);
        if (!check.valid) {
            return {
                success: false,
                error: `Yama Doğrulama Hatası (Path: ${patch.path}): ${check.reason}`,
                state
            };
        }
    }

    // 3. Apply patches one by one
    try {
        for (const patch of patches) {
            // Apply as system-approved since we pre-validated
            transactionState = applyStatePatch(transactionState, patch, true);
        }
    } catch (err) {
        return {
            success: false,
            error: `Yama Uygulama Hatası: ${err.message}`,
            state
        };
    }

    // 4. Strict Canonical Schema Validation on the resulting state
    const isValidCanonical = validateCanonicalState(transactionState);
    if (!isValidCanonical) {
        return {
            success: false,
            error: "Nihai kanonik durum doğrulanamadı. Değişiklikler şema bütünlüğünü bozuyor.",
            state
        };
    }

    return {
        success: true,
        state: transactionState
    };
}
