/**
 * src/prompts/planning-prompt.js
 *
 * Builds the main LLM prompt text for the project planning session.
 * Accepts all dynamic values as parameters; contains no references to
 * global state, making it independently testable.
 */

import { buildProfilePromptBlock } from '../planning/project-profiler.js';
import { buildStageSpecificPrompt } from './prompt-registry.js';

/**
 * @param {object} options
 * @param {string} options.stage
 * @param {string} options.techStack
 * @param {string} options.techVersion
 * @param {string[]} options.activeFocuses - list of active priority keys
 * @param {object|null} options.profile - Canonical profile object
 * @param {number} options.stepDepth
 * @param {string} options.historyText - formatted conversation history
 * @returns {string} complete prompt string
 */
export function buildPlanningPrompt({ stage, techStack, techVersion, activeFocuses, profile, stepDepth, historyText }) {
    // Default to IDEA_CAPTURED if stage is missing/invalid
    const currentStage = stage || 'IDEA_CAPTURED';
    return buildStageSpecificPrompt({
        stage: currentStage,
        techStack,
        techVersion,
        activeFocuses,
        profile,
        stepDepth,
        historyText
    });
}

/**
 * Builds the debug analysis prompt for the hotfix debugger.
 * @param {object} options
 * @param {string} options.projectContext - user's original project description
 * @param {string} options.errorLog
 * @param {string} options.errorCode
 * @returns {string}
 */
export function buildDebugPrompt({ projectContext, errorLog, errorCode }) {
    return `Sen uzman bir yazılım hata gidericisisin (debugger). Kullanıcının projesindeki hatayı analiz ederek, hatanın neden kaynaklandığını açıklayan kısa bir teknik açıklama ve kodlama ajanının hatayı tek seferde çözebilmesi için kopyalayacağı nokta atışı bir düzeltme promptu (hotfix prompt) hazırlamalısın.

PROJE BAĞLAMI: "${projectContext}"
HATA LOGU: "${errorLog}"
HATALI KOD (Varsa): "${errorCode}"

Aşağıdaki JSON formatında yanıt ver:
{
  "explanation": "Hatanın neden kaynaklandığına dair kısa ve net teknik açıklama (Türkçe).",
  "solutionPrompt": "Ajanın hatayı çözmesi için kopyalayıp vereceği detaylı düzeltme promptu (Türkçe)."
}
`;
}
