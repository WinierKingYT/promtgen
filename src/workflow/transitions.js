import { STAGE_CONTRACTS } from './stage-contracts.js';
import { checkPhaseCompletion, getPhaseNext } from './phase-contracts.js';

export function checkPhaseTransition(state, currentPhase) {
    if (!currentPhase) {
        return { allowed: false, reason: 'Mevcut faz tanımsız.' };
    }
    const result = checkPhaseCompletion(state, currentPhase);
    if (result.allowed) {
        return { allowed: true, nextPhase: getPhaseNext(currentPhase) };
    }
    return result;
}

export function checkWorkflowTransition(state, currentStage) {
    if (!currentStage) {
        return { allowed: false, reason: 'Mevcut aşama tanımsız.' };
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
