import { WORKFLOW_STAGES } from './stages.js';

export const TRANSITION_RULES = {
    [WORKFLOW_STAGES.IDEA_CAPTURED]: {
        target: WORKFLOW_STAGES.PROFILE_DRAFTED,
        check: (state) => {
            if (!state.identity || !state.identity.summary || state.identity.summary.length < 5) {
                return { allowed: false, reason: "Proje özeti veya problem tanımı bulunamadı." };
            }
            if (!state.profile || (state.profile.domains.length === 0 && state.profile.uncertainties.length === 0)) {
                return { allowed: false, reason: "Profil alanlarında en az bir alan veya belirsizlik tanımlanmalıdır." };
            }
            return { allowed: true };
        }
    },
    [WORKFLOW_STAGES.PROFILE_DRAFTED]: {
        target: WORKFLOW_STAGES.DISCOVERY_IN_PROGRESS,
        check: (state) => {
            if (!state.profile || state.profile.uncertainties.length === 0) {
                return { allowed: false, reason: "Keşif aşamasına geçmek için en az bir adet belirsizlik sorusu listelenmelidir." };
            }
            return { allowed: true };
        }
    },
    [WORKFLOW_STAGES.DISCOVERY_IN_PROGRESS]: {
        target: WORKFLOW_STAGES.MVP_DEFINED,
        check: (state) => {
            if (!state.decisions || state.decisions.length === 0) {
                return { allowed: false, reason: "MVP sınırlarını çizmek için en az bir adet mimari karar alınmalıdır." };
            }
            return { allowed: true };
        }
    },
    [WORKFLOW_STAGES.MVP_DEFINED]: {
        target: WORKFLOW_STAGES.REQUIREMENTS_DRAFTED,
        check: (state) => {
            if (!state.scope || state.scope.mustHave.length === 0) {
                return { allowed: false, reason: "Must Have (Olmazsa Olmaz) kapsam listesi tanımlanmalıdır." };
            }
            if (!state.scope.outOfScope || state.scope.outOfScope.length === 0) {
                return { allowed: false, reason: "Proje sınırları için kapsam dışı (Out of Scope) alanları belirlenmelidir." };
            }
            return { allowed: true };
        }
    },
    [WORKFLOW_STAGES.REQUIREMENTS_DRAFTED]: {
        target: WORKFLOW_STAGES.TECH_OPTIONS_READY,
        check: (state) => {
            if (!state.requirements || (state.requirements.functional.length === 0 && state.requirements.nonFunctional.length === 0)) {
                return { allowed: false, reason: "Gereksinim analizi için fonksiyonel veya fonksiyonel olmayan gereksinimler yazılmalıdır." };
            }
            return { allowed: true };
        }
    },
    [WORKFLOW_STAGES.TECH_OPTIONS_READY]: {
        target: WORKFLOW_STAGES.TECH_STACK_SELECTED,
        check: (state) => {
            const hasTechDecision = state.decisions && state.decisions.some(d => 
                d.title.toLowerCase().includes('teknoloji') || 
                d.title.toLowerCase().includes('stack') ||
                d.title.toLowerCase().includes('kütüphane') ||
                d.title.toLowerCase().includes('dil')
            );
            if (!hasTechDecision) {
                return { allowed: false, reason: "Teknoloji seçimi karar mekanizması (DEC-002 vb.) tetiklenmelidir." };
            }
            return { allowed: true };
        }
    },
    [WORKFLOW_STAGES.TECH_STACK_SELECTED]: {
        target: WORKFLOW_STAGES.ARCHITECTURE_DRAFTED,
        check: (state) => {
            if (!state.architecture || state.architecture.components.length === 0) {
                return { allowed: false, reason: "Mimari bileşenler ve veri akış diyagram iskeleti hazırlanmalıdır." };
            }
            return { allowed: true };
        }
    },
    [WORKFLOW_STAGES.ARCHITECTURE_DRAFTED]: {
        target: WORKFLOW_STAGES.TASKS_DRAFTED,
        check: (state) => {
            if (!state.tasks || state.tasks.length === 0) {
                return { allowed: false, reason: "Yapay zeka araçlarının yürüteceği adım adım kodlama görevleri (tasks) tanımlanmalıdır." };
            }
            return { allowed: true };
        }
    },
    [WORKFLOW_STAGES.TASKS_DRAFTED]: {
        target: WORKFLOW_STAGES.AGENT_PACKAGE_DRAFTED,
        check: (state) => {
            if (!state.tasks || state.tasks.length === 0) {
                return { allowed: false, reason: "Geliştirme adımları boş olamaz." };
            }
            return { allowed: true };
        }
    },
    [WORKFLOW_STAGES.AGENT_PACKAGE_DRAFTED]: {
        target: WORKFLOW_STAGES.REVIEW_IN_PROGRESS,
        check: (state) => {
            // Checks if subagents exist (which defines AGENT_PACKAGE)
            if (!state.subagents || state.subagents.length === 0) {
                return { allowed: false, reason: "Alt ajan prompt paketi oluşturulmalıdır." };
            }
            return { allowed: true };
        }
    },
    [WORKFLOW_STAGES.REVIEW_IN_PROGRESS]: {
        target: WORKFLOW_STAGES.READY_FOR_EXPORT,
        check: (state) => {
            // Quality review findings should be analyzed
            return { allowed: true };
        }
    },
    [WORKFLOW_STAGES.READY_FOR_EXPORT]: {
        target: WORKFLOW_STAGES.EXPORTED,
        check: (state) => {
            return { allowed: true };
        }
    }
};

export function checkWorkflowTransition(state, currentStage) {
    if (!currentStage) {
        return { allowed: false, reason: "Mevcut aşama tanımsız." };
    }
    const rule = TRANSITION_RULES[currentStage];
    if (!rule) {
        return { allowed: false, reason: `Bilinmeyen workflow aşaması: ${currentStage}` };
    }
    const result = rule.check(state);
    if (result.allowed) {
        return { allowed: true, nextStage: rule.target };
    }
    return result;
}
