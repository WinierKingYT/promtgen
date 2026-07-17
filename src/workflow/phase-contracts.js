import { UNIVERSAL_PHASES } from './phases.js';
import { isApprovalValid } from '../application/approval-service.js';

export const PHASE_SCHEMA_RULES = {
    '/identity': { type: 'object', required: ['name', 'summary', 'problemStatement', 'desiredOutcome'] },
    '/identity/name': { type: 'string' },
    '/identity/summary': { type: 'string' },
    '/identity/problemStatement': { type: 'string' },
    '/identity/desiredOutcome': { type: 'string' },

    '/profile': { type: 'object', required: ['domains', 'projectModes', 'activatedModules', 'uncertainties'] },
    '/profile/domains': { type: 'array', itemSchema: { type: 'object', required: ['name', 'confidence'] } },
    '/profile/projectModes': { type: 'array', itemSchema: { type: 'string' } },
    '/profile/activatedModules': { type: 'array', itemSchema: { type: 'string' } },
    '/profile/uncertainties': { type: 'array', itemSchema: { type: 'string' } },

    '/objectives': { type: 'array', itemSchema: { type: 'object', required: ['id', 'text'] } },
    '/stakeholders': { type: 'array', itemSchema: { type: 'object', required: ['id', 'name'] } },
    '/constraints': { type: 'array', itemSchema: { type: 'object', required: ['id', 'description'] } },
    '/assumptions': { type: 'array', itemSchema: { type: 'object', required: ['id', 'text', 'confidence', 'status'] } },
    '/decisions': { type: 'array', itemSchema: { type: 'object', required: ['id', 'title', 'decision', 'reason'] } },
    '/risks': { type: 'array', itemSchema: { type: 'object', required: ['id', 'description', 'impact', 'likelihood', 'mitigation'] } },
    '/openQuestions': { type: 'array', itemSchema: { type: 'object', required: ['id', 'question', 'status'] } },

    '/scope': { type: 'object', required: ['mustHave', 'shouldHave', 'couldHave', 'notNow', 'outOfScope'] },
    '/scope/mustHave': { type: 'array', itemSchema: { type: 'string' } },
    '/scope/shouldHave': { type: 'array', itemSchema: { type: 'string' } },
    '/scope/couldHave': { type: 'array', itemSchema: { type: 'string' } },
    '/scope/notNow': { type: 'array', itemSchema: { type: 'string' } },
    '/scope/outOfScope': { type: 'array', itemSchema: { type: 'string' } },

    '/deliverables': { type: 'array', itemSchema: { type: 'object', required: ['id', 'name'] } },
    '/workstreams': { type: 'array', itemSchema: { type: 'object', required: ['id', 'name'] } },
    '/tasks': { type: 'array', itemSchema: { type: 'object', required: ['id', 'title', 'description'] } },
    '/reviews': { type: 'array', itemSchema: { type: 'object', required: ['healthScore', 'findings', 'reviewedAt'] } }
};

export const PHASE_CONTRACTS = {
    [UNIVERSAL_PHASES.IDEA_CAPTURED]: {
        label: 'Fikir Girişi',
        role: 'Proje Başlangıç Analisti',
        instructions: `Kullanıcının proje fikrini analiz et. Kimlik (identity) ve profil (profile) alanlarını doldur. Proje türünü ve olası modülleri belirlemeye başla.`,
        approvalKey: null,
        nextPhase: UNIVERSAL_PHASES.PROJECT_PROFILED,
        completionCheck: (state) => {
            if (!state.identity?.summary || state.identity.summary.length < 5) {
                return { allowed: false, reason: 'Proje özeti gerekli.' };
            }
            return { allowed: true };
        },
        allowedPatchPaths: [
            '/identity', '/identity/*',
            '/profile', '/profile/*',
            '/configuration', '/configuration/*'
        ]
    },

    [UNIVERSAL_PHASES.PROJECT_PROFILED]: {
        label: 'Profil Çıkarma',
        role: 'Proje Profilleyici',
        instructions: `Proje profili oluşturuldu. Kullanıcı onayı sonrası belirsizlikleri netleştirmek için sorular sor. Modülleri aktifleştir.`,
        approvalKey: 'profile',
        nextPhase: UNIVERSAL_PHASES.DISCOVERY_IN_PROGRESS,
        completionCheck: (state) => {
            if (!isApprovalValid(state, 'profile')) {
                return { allowed: false, reason: 'Proje profili onaylanmalıdır.' };
            }
            if (!state.profile?.uncertainties || state.profile.uncertainties.length === 0) {
                return { allowed: false, reason: 'En az bir belirsizlik sorusu listelenmelidir.' };
            }
            return { allowed: true };
        },
        allowedPatchPaths: [
            '/profile', '/profile/*',
            '/objectives', '/objectives/*',
            '/assumptions', '/assumptions/*',
            '/openQuestions', '/openQuestions/*',
            '/decisions', '/decisions/*',
            '/configuration', '/configuration/*'
        ]
    },

    [UNIVERSAL_PHASES.DISCOVERY_IN_PROGRESS]: {
        label: 'Keşif ve Sorular',
        role: 'Keşif Uzmanı',
        instructions: `Proje hedeflerini (objectives), kısıtları (constraints) ve paydaşları (stakeholders) netleştir. Kullanıcıyla derinlemesine soru-cevap yap.`,
        approvalKey: null,
        nextPhase: UNIVERSAL_PHASES.OBJECTIVES_DEFINED,
        completionCheck: (state) => {
            if (!state.objectives || state.objectives.length === 0) {
                return { allowed: false, reason: 'En az bir hedef tanımlanmalıdır.' };
            }
            return { allowed: true };
        },
        allowedPatchPaths: [
            '/objectives', '/objectives/*',
            '/stakeholders', '/stakeholders/*',
            '/constraints', '/constraints/*',
            '/assumptions', '/assumptions/*',
            '/openQuestions', '/openQuestions/*',
            '/decisions', '/decisions/*',
            '/risks', '/risks/*'
        ]
    },

    [UNIVERSAL_PHASES.OBJECTIVES_DEFINED]: {
        label: 'Hedefler',
        role: 'Kapsam Planlayıcı',
        instructions: `Proje kapsamını (scope) netleştir. Nelerin mutlaka yapılması gerektiğini, nelerin olmazsa olmaz olduğunu belirle.`,
        approvalKey: 'objectives',
        nextPhase: UNIVERSAL_PHASES.SCOPE_DEFINED,
        completionCheck: (state) => {
            if (!isApprovalValid(state, 'objectives')) {
                return { allowed: false, reason: 'Hedefler onaylanmalıdır.' };
            }
            return { allowed: true };
        },
        allowedPatchPaths: [
            '/scope', '/scope/*',
            '/assumptions', '/assumptions/*',
            '/decisions', '/decisions/*'
        ]
    },

    [UNIVERSAL_PHASES.SCOPE_DEFINED]: {
        label: 'Kapsam',
        role: 'Çıktı Planlayıcı',
        instructions: `Proje çıktılarını (deliverables) ve iş akışlarını (workstreams) tanımla. Kapsam onaylandıktan sonra projenin somut ürünlerini belirle.`,
        approvalKey: 'scope',
        nextPhase: UNIVERSAL_PHASES.DELIVERABLES_DEFINED,
        completionCheck: (state) => {
            if (!isApprovalValid(state, 'scope')) {
                return { allowed: false, reason: 'Kapsam onaylanmalıdır.' };
            }
            if (!state.scope?.mustHave || state.scope.mustHave.length === 0) {
                return { allowed: false, reason: 'Must Have listesi tanımlanmalıdır.' };
            }
            return { allowed: true };
        },
        allowedPatchPaths: [
            '/deliverables', '/deliverables/*',
            '/workstreams', '/workstreams/*',
            '/decisions', '/decisions/*',
            '/risks', '/risks/*'
        ]
    },

    [UNIVERSAL_PHASES.DELIVERABLES_DEFINED]: {
        label: 'Çıktılar',
        role: 'Uygulama Planlayıcı',
        instructions: `Proje görevlerini (tasks) ve bağımlılıkları (dependencies) oluştur. Aktif modüllere göre detaylandır.`,
        approvalKey: 'deliverables',
        nextPhase: UNIVERSAL_PHASES.EXECUTION_PLAN_DRAFTED,
        completionCheck: (state) => {
            if (!isApprovalValid(state, 'deliverables')) {
                return { allowed: false, reason: 'Çıktılar onaylanmalıdır.' };
            }
            if (!state.deliverables || state.deliverables.length === 0) {
                return { allowed: false, reason: 'En az bir çıktı tanımlanmalıdır.' };
            }
            return { allowed: true };
        },
        allowedPatchPaths: [
            '/tasks', '/tasks/*',
            '/dependencies', '/dependencies/*',
            '/artifacts', '/artifacts/*',
            '/moduleData', '/moduleData/*'
        ]
    },

    [UNIVERSAL_PHASES.EXECUTION_PLAN_DRAFTED]: {
        label: 'Uygulama Planı',
        role: 'Kalite Denetçisi',
        instructions: `Proje planını gözden geçir. Tutarlılık, riskler ve kalite skorunu değerlendir.`,
        approvalKey: 'executionPlan',
        nextPhase: UNIVERSAL_PHASES.REVIEW_IN_PROGRESS,
        completionCheck: (state) => {
            if (!isApprovalValid(state, 'executionPlan')) {
                return { allowed: false, reason: 'Uygulama planı onaylanmalıdır.' };
            }
            if (!state.tasks || state.tasks.length === 0) {
                return { allowed: false, reason: 'Görevler tanımlanmalıdır.' };
            }
            return { allowed: true };
        },
        allowedPatchPaths: [
            '/reviews', '/reviews/*',
            '/artifacts', '/artifacts/*',
            '/tasks', '/tasks/*'
        ]
    },

    [UNIVERSAL_PHASES.REVIEW_IN_PROGRESS]: {
        label: 'Kalite Gözden Geçirme',
        role: 'Kalite Denetçisi',
        instructions: `Tüm planlama tamamlandı. Projenin tutarlılığını ve kalite skorunu denetle.`,
        approvalKey: null,
        nextPhase: UNIVERSAL_PHASES.READY_FOR_EXPORT,
        completionCheck: (state) => {
            return { allowed: true };
        },
        allowedPatchPaths: [
            '/reviews', '/reviews/*'
        ]
    },

    [UNIVERSAL_PHASES.READY_FOR_EXPORT]: {
        label: 'Hazır',
        role: 'Sistem Mimarı',
        instructions: `Proje planlama ve denetim süreci tamamlandı. Proje dosyalarını indirmeye hazırsın.`,
        approvalKey: 'finalReview',
        nextPhase: UNIVERSAL_PHASES.EXPORTED,
        completionCheck: (state) => {
            if (!isApprovalValid(state, 'finalReview')) {
                return { allowed: false, reason: 'Son kalite kontrolü onaylanmalıdır.' };
            }
            return { allowed: true };
        },
        allowedPatchPaths: []
    },

    [UNIVERSAL_PHASES.EXPORTED]: {
        label: 'İndirildi',
        role: 'Sistem Mimarı',
        instructions: 'Proje indirildi.',
        approvalKey: null,
        nextPhase: null,
        completionCheck: (state) => {
            return { allowed: false, reason: 'Proje zaten indirildi.' };
        },
        allowedPatchPaths: []
    }
};

export const PHASE_APPROVAL_KEYS = {};
for (const [phase, contract] of Object.entries(PHASE_CONTRACTS)) {
    if (contract.approvalKey) {
        PHASE_APPROVAL_KEYS[phase] = contract.approvalKey;
    }
}

export const PHASE_REQUIRED_ROOT_PATHS = [
    '/identity',
    '/profile',
    '/objectives',
    '/scope',
    '/deliverables',
    '/approvals'
];

function pathMatchesPattern(path, pattern) {
    if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -2);
        return path === prefix || path.startsWith(prefix + '/');
    }
    return path === pattern;
}

export function isPhasePatchAllowed(phase, path) {
    const contract = PHASE_CONTRACTS[phase];
    if (!contract) return false;
    return contract.allowedPatchPaths.some(pattern => pathMatchesPattern(path, pattern));
}

export function getPhaseApprovalKey(phase) {
    return PHASE_CONTRACTS[phase]?.approvalKey || null;
}

export function getPhaseNext(phase) {
    return PHASE_CONTRACTS[phase]?.nextPhase || null;
}

export function checkPhaseCompletion(state, phase) {
    const contract = PHASE_CONTRACTS[phase];
    if (!contract) return { allowed: false, reason: `Bilinmeyen faz: ${phase}` };
    return contract.completionCheck(state);
}
