import { STAGE_CONTRACTS } from './stage-contracts.js';

/**
 * Checks if the canonical project state is eligible to transition from currentStage to the next stage.
 * Uses the completionCheck and nextStage mapping defined in the unified STAGE_CONTRACTS.
 * 
 * @param {object} state - Canonical project state
 * @param {string} currentStage - Current workflow stage
 * @returns {object} { allowed: boolean, nextStage?: string, reason?: string }
 */
export function checkWorkflowTransition(state, currentStage) {
    if (!currentStage) {
        return { allowed: false, reason: "Mevcut aşama tanımsız." };
    }
    const contract = STAGE_CONTRACTS[currentStage];
    if (!contract) {
        return { allowed: false, reason: `Bilinmeyen workflow aşaması: ${currentStage}` };
    }
    const result = contract.completionCheck(state);
    if (result.allowed) {
        return { allowed: true, nextStage: contract.nextStage };
    }
    return result;
}
