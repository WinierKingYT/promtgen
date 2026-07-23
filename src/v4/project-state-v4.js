export const PLANNING_PHASES = Object.freeze({
    DISCOVERY: 'DISCOVERY',
    SHAPING: 'SHAPING',
    DESIGN: 'DESIGN',
    PLANNING: 'PLANNING',
    REVIEW: 'REVIEW',
    READY: 'READY'
});

export const PHASE_REGISTRY = Object.freeze([
    { id: PLANNING_PHASES.DISCOVERY, label: 'Fikri Keşfet', description: 'Amaç, kullanıcı ve problem alanını netleştir.' },
    { id: PLANNING_PHASES.SHAPING, label: 'Kapsamı Şekillendir', description: 'Özellikleri, sınırları ve öncelikleri seç.' },
    { id: PLANNING_PHASES.DESIGN, label: 'Çözümü Tasarla', description: 'Mimari ve teknik kararları kesinleştir.' },
    { id: PLANNING_PHASES.PLANNING, label: 'Planı Oluştur', description: 'Görevleri, yol haritasını ve promptları üret.' },
    { id: PLANNING_PHASES.REVIEW, label: 'Kaliteyi İncele', description: 'Eksik, çelişki ve riskleri değerlendir.' },
    { id: PLANNING_PHASES.READY, label: 'Hazır', description: 'Planı finalleştir ve dışa aktar.' }
]);

export const PLAN_SECTION_DEFINITIONS = Object.freeze([
    { id: 'vision', title: 'Vizyon ve Problem', description: 'Projenin amacı, hedef kullanıcısı ve beklenen sonuç.' },
    { id: 'objectives', title: 'Hedefler', description: 'Ölçülebilir ürün ve kullanıcı hedefleri.' },
    { id: 'scope', title: 'Kapsam', description: 'Dahil, ertelenmiş ve kapsam dışı özellikler.' },
    { id: 'requirements', title: 'Gereksinimler', description: 'Fonksiyonel ve kalite gereksinimleri.' },
    { id: 'decisions', title: 'Kararlar', description: 'Seçenekler, gerekçeler ve kabul edilmiş kararlar.' },
    { id: 'architecture', title: 'Mimari', description: 'Bileşenler, veri akışı ve teknik sınırlar.' },
    { id: 'security', title: 'Güvenlik ve Gizlilik', description: 'Tehditler, veri sınıfları ve güvenlik kontrolleri.' },
    { id: 'tasks', title: 'Görevler ve Yol Haritası', description: 'Bağımlı, sıralı ve kabul kriterli geliştirme işleri.' },
    { id: 'risks', title: 'Riskler', description: 'Olasılık, etki ve azaltma planları.' },
    { id: 'testing', title: 'Test Stratejisi', description: 'Birim, entegrasyon, uçtan uca ve kabul testleri.' },
    { id: 'deployment', title: 'Dağıtım', description: 'Ortamlar, yayınlama ve geri alma yaklaşımı.' },
    { id: 'operations', title: 'Operasyon', description: 'Gözlemlenebilirlik, kapasite ve süreklilik.' }
]);

const REQUIRED_BY_DEPTH = Object.freeze({
    quick: ['vision', 'scope', 'tasks'],
    standard: ['vision', 'objectives', 'scope', 'requirements', 'architecture', 'tasks', 'risks', 'testing'],
    advanced: ['vision', 'objectives', 'scope', 'requirements', 'decisions', 'architecture', 'security', 'tasks', 'risks', 'testing', 'deployment'],
    enterprise: PLAN_SECTION_DEFINITIONS.map(section => section.id)
});

function now() { return new Date().toISOString(); }
function projectId() { return `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

export function getRequiredSections(depth) {
    return [...(REQUIRED_BY_DEPTH[depth] || REQUIRED_BY_DEPTH.standard)];
}

export function createPlanSections(depth = 'standard', revision = 1) {
    const required = new Set(getRequiredSections(depth));
    return Object.fromEntries(PLAN_SECTION_DEFINITIONS.map(definition => [definition.id, {
        ...definition,
        content: '',
        items: [],
        status: 'empty',
        required: required.has(definition.id),
        warnings: [],
        sourceSuggestionIds: [],
        updatedAtRevision: revision
    }]));
}

export function createInitialReadiness(revision = 1) {
    return {
        score: 0,
        dimensions: { completeness: 0, consistency: 100, traceability: 0, riskCoverage: 0, implementationReadiness: 0 },
        blockers: ['Proje fikri henüz analiz edilmedi.'],
        warnings: [],
        calculatedAtRevision: revision
    };
}

export function createProjectStateV4({ idea, name = 'Yeni Proje', outputLanguage = 'tr', profile = null, planningDepth = null } = {}) {
    const createdAt = now();
    const depth = planningDepth || {
        recommended: 'standard', selected: 'standard', overridden: false,
        rationale: 'Ölçek değerlendirmesi henüz yapılmadı.',
        signals: { score: 0, features: 0, integrations: 0, sensitiveData: false, multiPlatform: false, scaleIntent: false, uncertainty: 1 }
    };
    const initialIdea = String(idea || '').trim();
    const state = {
        schemaVersion: 4,
        id: projectId(),
        revision: 1,
        lifecycle: { status: 'active', activePhase: PLANNING_PHASES.DISCOVERY, createdAt, updatedAt: createdAt, finalizedAt: null },
        identity: { name, originalIdea: initialIdea, summary: initialIdea, desiredOutcome: '', outputLanguage },
        planningDepth: depth,
        profile: profile || { domains: [], platforms: [], importedContext: [] },
        sections: createPlanSections(depth.selected, 1),
        suggestionBundles: [],
        objectives: [], requirements: [], decisions: [], assumptions: [], risks: [], tasks: [], testCases: [], milestones: [], traceLinks: [], agentPrompts: [], researchQuestions: [], sources: [], evidence: [], reviewFindings: [], simulationRuns: [], openQuestions: [],
        messages: initialIdea ? [{ id: `msg-${Date.now()}`, role: 'user', content: initialIdea, createdAt }] : [],
        readiness: createInitialReadiness(1),
        revisions: [], exports: [], executionSessions: [], dismissedSuggestionFingerprints: [], modules: { active: [{ id: 'core.planning', version: '1.0.0', enabledAtRevision: 1, config: {} }], dismissed: [], localManifests: [] }, metadata: { canonicalModelVersion: 1 }
    };
    if (initialIdea) {
        state.sections.vision.content = initialIdea;
        state.sections.vision.status = 'draft';
    }
    return state;
}

export function applyDepthSelection(state, selected, overridden = true) {
    const next = structuredClone(state);
    next.planningDepth.selected = selected;
    next.planningDepth.overridden = overridden;
    const required = new Set(getRequiredSections(selected));
    for (const section of Object.values(next.sections)) {
        section.required = required.has(section.id);
    }
    next.revision += 1;
    next.lifecycle.updatedAt = now();
    return next;
}

export function validateProjectStateV4(state) {
    const errors = [];
    if (!state || typeof state !== 'object') return { valid: false, errors: ['Proje durumu nesne olmalı.'] };
    if (state.schemaVersion !== 4) errors.push('schemaVersion 4 olmalı.');
    if (!state.id || typeof state.id !== 'string') errors.push('Proje kimliği eksik.');
    if (!state.identity?.originalIdea) errors.push('Başlangıç fikri eksik.');
    if (!state.planningDepth?.selected || !REQUIRED_BY_DEPTH[state.planningDepth.selected]) errors.push('Planlama derinliği geçersiz.');
    if (!state.sections || typeof state.sections !== 'object') errors.push('Plan bölümleri eksik.');
    for (const id of getRequiredSections(state.planningDepth?.selected)) {
        if (!state.sections?.[id]) errors.push(`Zorunlu plan bölümü eksik: ${id}`);
    }
    if (!Array.isArray(state.suggestionBundles)) errors.push('Öneri paketleri dizi olmalı.');
    if (!Array.isArray(state.revisions)) errors.push('Sürüm geçmişi dizi olmalı.');
    if (!state.modules || !Array.isArray(state.modules.active) || !Array.isArray(state.modules.localManifests)) errors.push('Modül durumu geçersiz.');
    if (!Array.isArray(state.executionSessions)) errors.push('Execution session kayıtları dizi olmalı.');
    for (const key of ['objectives', 'requirements', 'decisions', 'assumptions', 'risks', 'tasks', 'testCases', 'milestones', 'traceLinks', 'agentPrompts', 'researchQuestions', 'sources', 'evidence', 'reviewFindings', 'simulationRuns', 'exports']) {
        if (!Array.isArray(state[key])) errors.push(`${key} dizi olmalı.`);
    }
    return { valid: errors.length === 0, errors };
}
