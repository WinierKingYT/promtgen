import { WORKFLOW_STAGES } from './stages.js';
import { isApprovalValid } from '../application/approval-service.js';

export const SCHEMA_RULES = {
    '/identity': { type: 'object', required: ['name', 'summary', 'problem', 'desiredOutcome'] },
    '/identity/name': { type: 'string' },
    '/identity/summary': { type: 'string' },
    '/identity/problem': { type: 'string' },
    '/identity/desiredOutcome': { type: 'string' },
    
    '/profile': { type: 'object', required: ['domains', 'platforms', 'interfaces', 'capabilities', 'uncertainties'] },
    '/profile/domains': { type: 'array', itemSchema: { type: 'object', required: ['name', 'confidence'] } },
    '/profile/platforms': { type: 'array', itemSchema: { type: 'string' } },
    '/profile/interfaces': { type: 'array', itemSchema: { type: 'string' } },
    '/profile/capabilities': { type: 'array', itemSchema: { type: 'string' } },
    '/profile/uncertainties': { type: 'array', itemSchema: { type: 'string' } },
    
    '/scope': { type: 'object', required: ['mustHave', 'shouldHave', 'couldHave', 'notNow', 'outOfScope'] },
    '/scope/mustHave': { type: 'array', itemSchema: { type: 'string' } },
    '/scope/shouldHave': { type: 'array', itemSchema: { type: 'string' } },
    '/scope/couldHave': { type: 'array', itemSchema: { type: 'string' } },
    '/scope/notNow': { type: 'array', itemSchema: { type: 'string' } },
    '/scope/outOfScope': { type: 'array', itemSchema: { type: 'string' } },
    
    '/requirements': { type: 'object', required: ['functional', 'nonFunctional', 'domainSpecific'] },
    '/requirements/functional': { type: 'array', itemSchema: { type: 'string' } },
    '/requirements/nonFunctional': { type: 'array', itemSchema: { type: 'string' } },
    '/requirements/domainSpecific': { type: 'array', itemSchema: { type: 'string' } },
    
    '/decisions': { type: 'array', itemSchema: { type: 'object', required: ['id', 'title', 'decision', 'reason'] } },
    '/assumptions': { type: 'array', itemSchema: { type: 'object', required: ['id', 'text', 'confidence', 'status'] } },
    '/risks': { type: 'array', itemSchema: { type: 'object', required: ['id', 'description', 'impact', 'likelihood', 'mitigation'] } },
    '/openQuestions': { type: 'array', itemSchema: { type: 'object', required: ['id', 'question', 'status'] } },
    
    '/architecture': { type: 'object', required: ['components', 'dataFlows', 'integrations', 'mermaidCode'] },
    '/architecture/components': { type: 'array', itemSchema: { type: 'string' } },
    '/architecture/dataFlows': { type: 'array', itemSchema: { type: 'string' } },
    '/architecture/integrations': { type: 'array', itemSchema: { type: 'string' } },
    '/architecture/mermaidCode': { type: 'string' },
    
    '/tasks': { type: 'array', itemSchema: { type: 'object', required: ['id', 'title', 'description'] } },
    
    '/agentPackage': { type: 'object', required: ['subagents', 'rules', 'skillMarkdown', 'exportTargets'] },
    '/agentPackage/subagents': { type: 'array', itemSchema: { type: 'object', required: ['name', 'role', 'instructions'] } },
    '/agentPackage/rules': { type: 'object', required: ['cursor', 'windsurf', 'copilot'] },
    '/agentPackage/rules/cursor': { type: 'string' },
    '/agentPackage/rules/windsurf': { type: 'string' },
    '/agentPackage/rules/copilot': { type: 'string' },
    '/agentPackage/skillMarkdown': { type: 'string' },
    '/agentPackage/exportTargets': { type: 'array', itemSchema: { type: 'string' } },
    
    '/reviews': { type: 'array', itemSchema: { type: 'object', required: ['healthScore', 'findings', 'reviewedAt'] } }
};

export const STAGE_CONTRACTS = {
    [WORKFLOW_STAGES.IDEA_CAPTURED]: {
        label: 'Fikir Girişi',
        role: "Proje Başlangıç Analisti",
        instructions: `Görevin kullanıcının yazdığı proje fikrini analiz etmek ve uygun proje profili (identity, domains, platforms, capabilities) oluşturmaktır. Fikrin detaylarını tam olarak anlamak için cana yakın bir tonda yanıt ver ve varsa eksik noktaları sormaya başla.`,
        focusFields: "identity ve profile alanları.",
        schemaNotes: `Yalnızca identity (name, summary, problem, desiredOutcome) ve profile (domains, platforms, capabilities, uncertainties) alanları için proposedPatches dön.`,
        approvalKey: null,
        nextStage: WORKFLOW_STAGES.PROFILE_DRAFTED,
        completionCheck: (state) => {
            if (!state.identity || !state.identity.summary || state.identity.summary.length < 5) {
                return { allowed: false, reason: "Proje özeti veya problem tanımı bulunamadı." };
            }
            if (!state.profile || (state.profile.domains.length === 0 && state.profile.uncertainties.length === 0)) {
                return { allowed: false, reason: "Profil alanlarında en az bir alan veya belirsizlik tanımlanmalıdır." };
            }
            return { allowed: true };
        },
        allowedPatchPaths: [
            '/identity', '/identity/*',
            '/profile', '/profile/*'
        ]
    },
    
    [WORKFLOW_STAGES.PROFILE_DRAFTED]: {
        label: 'Profil Taslağı',
        role: "Gereksinim Keşif Ajanı (Discovery Specialist)",
        instructions: `Proje profili oluşturuldu ve kullanıcı tarafından onaylandı. Şimdi bu profile göre belirsizlikleri (uncertainties) netleştirmek için kullanıcıyla derinlemesine bir soru-cevap seansı yap. Maksimum 2 adet nokta atışı soru sor ve kullanıcı yanıt verdikçe bu belirsizlikleri çözmek için kararlar (decisions) veya varsayımlar (assumptions) eklemeyi/değiştirmeyi teklif et.`,
        focusFields: "decisions, assumptions ve openQuestions alanları.",
        schemaNotes: `Yalnızca decisions, assumptions ve openQuestions alanları için proposedPatches üret.`,
        approvalKey: 'profile',
        nextStage: WORKFLOW_STAGES.DISCOVERY_IN_PROGRESS,
        completionCheck: (state) => {
            if (!isApprovalValid(state, 'profile')) {
                return { allowed: false, reason: "Proje profili onaylanmalıdır (approvals.profile.status === 'approved')." };
            }
            if (!state.profile || state.profile.uncertainties.length === 0) {
                return { allowed: false, reason: "Keşif aşamasına geçmek için en az bir adet belirsizlik sorusu listelenmelidir." };
            }
            return { allowed: true };
        },
        allowedPatchPaths: [
            '/decisions', '/decisions/*',
            '/assumptions', '/assumptions/*',
            '/openQuestions', '/openQuestions/*',
            '/profile/uncertainties', '/profile/uncertainties/*'
        ]
    },

    [WORKFLOW_STAGES.DISCOVERY_IN_PROGRESS]: {
        label: 'Keşif ve Sorular',
        role: "MVP Kapsam Planlayıcısı (MVP Scope Planner)",
        instructions: `Şimdi projenin MVP (Minimum Viable Product) kapsamını netleştirme zamanı. Kullanıcıyla neyin mutlaka olması gerektiği (mustHave), neyin kapsam dışı kalacağı (outOfScope) ve neyin daha sonra yapılabileceğini (notNow) tartış ve listeyi karara bağla.`,
        focusFields: "scope (mustHave, shouldHave, couldHave, notNow, outOfScope) alanı.",
        schemaNotes: `Yalnızca scope alanları için proposedPatches üret.`,
        approvalKey: null,
        nextStage: WORKFLOW_STAGES.MVP_DEFINED,
        completionCheck: (state) => {
            if (!state.decisions || state.decisions.length === 0) {
                return { allowed: false, reason: "MVP sınırlarını çizmek için en az bir adet mimari karar alınmalıdır." };
            }
            return { allowed: true };
        },
        allowedPatchPaths: [
            '/scope', '/scope/*'
        ]
    },

    [WORKFLOW_STAGES.MVP_DEFINED]: {
        label: 'MVP Kapsamı',
        role: "Gereksinim Analisti (Requirement Analyst)",
        instructions: `MVP kapsamı onaylandı. Şimdi bu kapsamı gerçekleştirecek fonksiyonel (functional) ve fonksiyonel olmayan (nonFunctional) detaylı gereksinimleri çıkart. Gereksinimlerin açık, test edilebilir ve net olmasına özen göster.`,
        focusFields: "requirements (functional, nonFunctional, domainSpecific) alanı.",
        schemaNotes: `Yalnızca requirements alanları için proposedPatches üret.`,
        approvalKey: 'mvpScope',
        nextStage: WORKFLOW_STAGES.REQUIREMENTS_DRAFTED,
        completionCheck: (state) => {
            if (!isApprovalValid(state, 'mvpScope')) {
                return { allowed: false, reason: "MVP kapsamı onaylanmalıdır (approvals.mvpScope.status === 'approved')." };
            }
            if (!state.scope || state.scope.mustHave.length === 0) {
                return { allowed: false, reason: "Must Have (Olmazsa Olmaz) kapsam listesi tanımlanmalıdır." };
            }
            if (!state.scope.outOfScope || state.scope.outOfScope.length === 0) {
                return { allowed: false, reason: "Proje sınırları için kapsam dışı (Out of Scope) alanları belirlenmelidir." };
            }
            return { allowed: true };
        },
        allowedPatchPaths: [
            '/requirements', '/requirements/*'
        ]
    },

    [WORKFLOW_STAGES.REQUIREMENTS_DRAFTED]: {
        label: 'Gereksinim Belgesi',
        role: "Teknoloji Değerlendiricisi (Technology Evaluator)",
        instructions: `Gereksinimler onaylandı. Bu projenin hedeflerine ve teknoloji yığınına uygun alternatif kütüphaneleri, dilleri ve mimari yaklaşımları değerlendir. Karar matrisi olarak decisions listesine detaylı bir teknoloji değerlendirmesi (örn: DEC-002: Veritabanı Seçimi, state yönetimi vb.) ekle.`,
        focusFields: "decisions (teknoloji kararları) ve assumptions alanları.",
        schemaNotes: `Yalnızca decisions ve assumptions alanları için proposedPatches üret.`,
        approvalKey: 'requirements',
        nextStage: WORKFLOW_STAGES.TECH_OPTIONS_READY,
        completionCheck: (state) => {
            if (!isApprovalValid(state, 'requirements')) {
                return { allowed: false, reason: "Gereksinimler onaylanmalıdır (approvals.requirements.status === 'approved')." };
            }
            if (!state.requirements || (state.requirements.functional.length === 0 && state.requirements.nonFunctional.length === 0)) {
                return { allowed: false, reason: "Gereksinim analizi için fonksiyonel veya fonksiyonel olmayan gereksinimler yazılmalıdır." };
            }
            return { allowed: true };
        },
        allowedPatchPaths: [
            '/decisions', '/decisions/*',
            '/assumptions', '/assumptions/*',
            '/openQuestions', '/openQuestions/*'
        ]
    },

    [WORKFLOW_STAGES.TECH_OPTIONS_READY]: {
        label: 'Teknoloji Seçenekleri',
        role: "Teknoloji Karar Ajanı (Technology Evaluator)",
        instructions: `Kullanıcıyla değerlendirilen teknoloji alternatifleri arasından nihai seçimi yapmasını sağla. Kararı resmileştirip state'e işle.`,
        focusFields: "decisions (teknoloji kararları) alanı.",
        schemaNotes: `Yalnızca decisions alanları için proposedPatches üret.`,
        approvalKey: null,
        nextStage: WORKFLOW_STAGES.TECH_STACK_SELECTED,
        completionCheck: (state) => {
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
        },
        allowedPatchPaths: [
            '/decisions', '/decisions/*'
        ]
    },

    [WORKFLOW_STAGES.TECH_STACK_SELECTED]: {
        label: 'Teknoloji Seçimi',
        role: "Mimari Tasarımcı (Architecture Planner)",
        instructions: `Nihai teknoloji yığını seçildi. Şimdi projenin mimari bileşenlerini (components), veri akışlarını (dataFlows) ve entegrasyonlarını (integrations) kurgula. Sağlıklı bir modüler yapı öner.`,
        focusFields: "architecture (components, dataFlows, integrations) alanı.",
        schemaNotes: `Yalnızca architecture alanları için proposedPatches üret.`,
        approvalKey: 'technology',
        nextStage: WORKFLOW_STAGES.ARCHITECTURE_DRAFTED,
        completionCheck: (state) => {
            if (!isApprovalValid(state, 'technology')) {
                return { allowed: false, reason: "Teknoloji seçimi onaylanmalıdır (approvals.technology.status === 'approved')." };
            }
            return { allowed: true };
        },
        allowedPatchPaths: [
            '/architecture', '/architecture/*'
        ]
    },

    [WORKFLOW_STAGES.ARCHITECTURE_DRAFTED]: {
        label: 'Mimari Tasarım',
        role: "Görev Ayrıştırıcısı (Task Decomposer)",
        instructions: `Mimari onaylandı. Şimdi Cursor veya Windsurf gibi yapay zeka kodlama araçlarının okuyabileceği mantıksal, sıralı adım adım kodlama görevlerini (tasks) oluştur. Her adımın kabul kriterlerini açıkça belirt.`,
        focusFields: "tasks alanı.",
        schemaNotes: `Yalnızca tasks alanları için proposedPatches üret.`,
        approvalKey: 'architecture',
        nextStage: WORKFLOW_STAGES.TASKS_DRAFTED,
        completionCheck: (state) => {
            if (!isApprovalValid(state, 'architecture')) {
                return { allowed: false, reason: "Proje mimarisi onaylanmalıdır (approvals.architecture.status === 'approved')." };
            }
            if (!state.architecture || state.architecture.components.length === 0) {
                return { allowed: false, reason: "Mimari bileşenler ve veri akış diyagram iskeleti hazırlanmalıdır." };
            }
            return { allowed: true };
        },
        allowedPatchPaths: [
            '/tasks', '/tasks/*'
        ]
    },

    [WORKFLOW_STAGES.TASKS_DRAFTED]: {
        label: 'Görev Planı',
        role: "Alt Ajan Paketleyici (Agent Package Generator)",
        instructions: `Görev planı onaylandı. Bu projenin türüne ve mimarisine en uygun 3 adet dinamik alt ajanı (subagents) tanımla ve bunlara özel editör kurallarını (rules: cursor, windsurf, copilot) ve SKILL.md içeriğini hazırla.`,
        focusFields: "agentPackage (subagents, rules, skillMarkdown) alanı.",
        schemaNotes: `Yalnızca agentPackage (subagents, rules, skillMarkdown) alanları için proposedPatches üret.`,
        approvalKey: 'tasks',
        nextStage: WORKFLOW_STAGES.AGENT_PACKAGE_DRAFTED,
        completionCheck: (state) => {
            if (!isApprovalValid(state, 'tasks')) {
                return { allowed: false, reason: "Görev planı onaylanmalıdır (approvals.tasks.status === 'approved')." };
            }
            if (!state.tasks || state.tasks.length === 0) {
                return { allowed: false, reason: "Geliştirme adımları boş olamaz." };
            }
            return { allowed: true };
        },
        allowedPatchPaths: [
            '/agentPackage', '/agentPackage/*'
        ]
    },

    [WORKFLOW_STAGES.AGENT_PACKAGE_DRAFTED]: {
        label: 'Ajan Paketleme',
        role: "Kalite Denetçisi (Consistency Reviewer)",
        instructions: `Alt ajan paketleri hazırlandı. Şimdi projenin tutarlılığını, risklerini ve kalite skorunu denetle. Bulguları (findings) ve nihai kalite skorunu (healthScore) üreterek projeyi export edilmeye hazır hale getir.`,
        focusFields: "reviews (findings, healthScore) alanı.",
        schemaNotes: `Yalnızca reviews alanları için proposedPatches üret.`,
        approvalKey: null,
        nextStage: WORKFLOW_STAGES.REVIEW_IN_PROGRESS,
        completionCheck: (state) => {
            if (!state.agentPackage || !Array.isArray(state.agentPackage.subagents) || state.agentPackage.subagents.length === 0) {
                return { allowed: false, reason: "Alt ajan prompt paketi (agentPackage.subagents) oluşturulmalıdır." };
            }
            return { allowed: true };
        },
        allowedPatchPaths: [
            '/reviews', '/reviews/*'
        ]
    },

    [WORKFLOW_STAGES.REVIEW_IN_PROGRESS]: {
        label: 'Kalite Gözden Geçirme',
        role: "Kalite Denetçisi (Consistency Reviewer)",
        instructions: `Tüm planlama tamamlandı. Şimdi projenin tutarlılığını, risklerini ve kalite skorunu denetle. Bulguları (findings) ve nihai kalite skorunu (healthScore) üreterek projeyi export edilmeye hazır hale getir.`,
        focusFields: "reviews (findings, healthScore) alanı.",
        schemaNotes: `Yalnızca reviews alanları için proposedPatches üret.`,
        approvalKey: null,
        nextStage: WORKFLOW_STAGES.READY_FOR_EXPORT,
        completionCheck: (state) => {
            return { allowed: true };
        },
        allowedPatchPaths: [
            '/reviews', '/reviews/*'
        ]
    },

    [WORKFLOW_STAGES.READY_FOR_EXPORT]: {
        label: 'Hazır',
        role: "Sistem Mimarı",
        instructions: `Proje planlama ve denetim süreci tamamlandı. Proje dosyalarınızı indirmeye hazırsınız.`,
        focusFields: "Hiçbir alan güncellenemez.",
        schemaNotes: `Bu aşamada proposedPatches üretilemez.`,
        approvalKey: 'finalReview',
        nextStage: WORKFLOW_STAGES.EXPORTED,
        completionCheck: (state) => {
            if (!isApprovalValid(state, 'finalReview')) {
                return { allowed: false, reason: "Son kalite kontrolü onaylanmalıdır (approvals.finalReview.status === 'approved')." };
            }
            return { allowed: true };
        },
        allowedPatchPaths: []
    },

    [WORKFLOW_STAGES.EXPORTED]: {
        label: 'İndirildi',
        role: "Sistem Mimarı",
        instructions: `Proje indirildi.`,
        focusFields: "Hiçbir alan güncellenemez.",
        schemaNotes: `Bu aşamada proposedPatches üretilemez.`,
        approvalKey: null,
        nextStage: null,
        completionCheck: (state) => {
            return { allowed: false, reason: "Proje zaten indirildi." };
        },
        allowedPatchPaths: []
    }
};

/**
 * Checks if a patch path matches a pattern.
 */
function pathMatchesPattern(path, pattern) {
    if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -2);
        return path === prefix || path.startsWith(prefix + '/');
    }
    return path === pattern;
}

/**
 * Checks if a patch is allowed under a stage.
 */
export function isPatchPathAllowed(stage, path) {
    const contract = STAGE_CONTRACTS[stage];
    if (!contract) return false;
    return contract.allowedPatchPaths.some(pattern => pathMatchesPattern(path, pattern));
}

/**
 * Validate values type and requirements dynamically.
 */
export function validateValueByPath(path, value) {
    // 1. Try to find direct schema
    const directSchema = SCHEMA_RULES[path];
    if (directSchema) {
        return checkType(value, directSchema);
    }
    
    // 2. Check if it's an array item (e.g., /profile/domains/0 or /profile/domains/-)
    const parts = path.split('/').filter(p => p !== '');
    if (parts.length >= 2) {
        const lastPart = parts[parts.length - 1];
        const isArrayIndex = lastPart === '-' || !isNaN(parseInt(lastPart));
        if (isArrayIndex) {
            const parentPath = '/' + parts.slice(0, -1).join('/');
            const parentSchema = SCHEMA_RULES[parentPath];
            if (parentSchema && parentSchema.type === 'array' && parentSchema.itemSchema) {
                return checkType(value, parentSchema.itemSchema);
            }
        }
    }
    
    return { valid: true };
}

function checkType(value, schema) {
    if (!schema) return { valid: true };
    const { type, required, itemSchema } = schema;
    
    if (type === 'string') {
        if (typeof value !== 'string') return { valid: false, reason: `Beklenen tip string, alınan tip ${typeof value}` };
    } else if (type === 'number') {
        if (typeof value !== 'number' || isNaN(value)) return { valid: false, reason: `Beklenen tip number, alınan tip ${typeof value}` };
    } else if (type === 'boolean') {
        if (typeof value !== 'boolean') return { valid: false, reason: `Beklenen tip boolean, alınan tip ${typeof value}` };
    } else if (type === 'array') {
        if (!Array.isArray(value)) return { valid: false, reason: `Beklenen tip array, alınan tip ${typeof value}` };
        if (itemSchema) {
            for (let i = 0; i < value.length; i++) {
                const itemCheck = checkType(value[i], itemSchema);
                if (!itemCheck.valid) return { valid: false, reason: `Dizi elemanı [${i}] validation hatası: ${itemCheck.reason}` };
            }
        }
    } else if (type === 'object') {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            return { valid: false, reason: `Beklenen tip object, alınan tip ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value}` };
        }
        if (required) {
            for (const key of required) {
                if (value[key] === undefined) {
                    return { valid: false, reason: `Nesne için gerekli '${key}' alanı eksik.` };
                }
            }
        }
    }
    return { valid: true };
}
