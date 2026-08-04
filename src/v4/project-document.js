export const PLANNING_PHASES = Object.freeze({
    IDEA_EXPANSION: 'IDEA_EXPANSION',
    DISCOVERY: 'DISCOVERY',
    IDEA_LAB: 'IDEA_LAB',
    CONCEPT_CONFIRMATION: 'CONCEPT_CONFIRMATION',
    SHAPING: 'SHAPING',
    DESIGN: 'DESIGN',
    PLANNING: 'PLANNING',
    REVIEW: 'REVIEW',
    READY: 'READY'
});

export const PHASE_REGISTRY = Object.freeze([
    { id: PLANNING_PHASES.IDEA_EXPANSION, label: 'Fikri Büyüt', description: 'Kısa fikri seçeneklerle genişlet ve netleştir.' },
    { id: PLANNING_PHASES.DISCOVERY, label: 'Fikri Al', description: 'Ham düşünceyi ve vizyonu tanımla.' },
    { id: PLANNING_PHASES.IDEA_LAB, label: 'Fikir Laboratuvarı', description: 'Alternatif yaklaşımları, deneyimi ve sınırları tartış.' },
    { id: PLANNING_PHASES.CONCEPT_CONFIRMATION, label: 'Konsept Özeti', description: 'Özeti ve kararları inceleyip onayla.' },
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
        version: 3,
        calculationProfile: 'legacy-unverified',
        status: 'blocked',
        score: 0,
        dimensions: { completeness: 0, consistency: 100, traceability: 0, riskCoverage: 0, implementationReadiness: 0 },
        dimensionWeights: { completeness: 20, consistency: 20, traceability: 25, riskCoverage: 15, implementationReadiness: 20 },
        dimensionLabels: { completeness: 'Tamlık', consistency: 'Tutarlılık', traceability: 'İzlenebilirlik', riskCoverage: 'Risk kapsamı', implementationReadiness: 'Uygulamaya hazırlık' },
        dimensionEvidence: Object.fromEntries(
            ['completeness', 'consistency', 'traceability', 'riskCoverage', 'implementationReadiness']
                .map(dimension => [dimension, { earned: 0, possible: 0, passed: 0, warning: 0, blocked: 0 }])
        ),
        checks: [],
        nextActions: [],
        qualityGate: {
            passed: false,
            blockingCheckIds: ['legacy.unverified'],
            conditions: [{
                id: 'readiness-calculation',
                label: 'Readiness kanıtı güncel',
                passed: false,
                message: 'Canonical plan için Readiness 3.0 henüz hesaplanmadı.',
                checkIds: []
            }]
        },
        blockers: ['Proje fikri henüz analiz edilmedi.'],
        warnings: [],
        evidenceHash: 'legacy-unverified',
        calculatedAtRevision: revision
    };
}

export function createProjectDocument({ idea, name = 'Yeni Proje', outputLanguage = 'tr', profile = null, planningDepth = null } = {}) {
    const createdAt = now();
    const depth = planningDepth || {
        recommended: 'standard', selected: 'standard', overridden: false,
        rationale: 'Ölçek değerlendirmesi henüz yapılmadı.',
        signals: { score: 0, features: 0, integrations: 0, sensitiveData: false, multiPlatform: false, scaleIntent: false, uncertainty: 1 }
    };
    const initialIdea = String(idea || '').trim();
    const state = {
        schemaVersion: 5,
        schemaRevision: 5,
        id: projectId(),
        documentRevision: 1,
        canonicalRevision: 1,
        lifecycle: { status: 'active', activePhase: PLANNING_PHASES.DISCOVERY, createdAt, updatedAt: createdAt, finalizedAt: null },
        identity: { name, originalIdea: initialIdea, summary: initialIdea, desiredOutcome: '', outputLanguage },
        planningDepth: depth,
        profile: profile || { domains: [], platforms: [], importedContext: [] },
        sections: createPlanSections(depth.selected, 1),
        proposalStore: { bundles: [] },
        objectives: [], requirements: [], decisions: [], assumptions: [], risks: [], tasks: [], testCases: [], milestones: [], traceLinks: [], agentPrompts: [], researchQuestions: [], sources: [], evidence: [], reviewFindings: [], simulationRuns: [], openQuestions: [],
        messages: initialIdea ? [{ id: `msg-${Date.now()}`, role: 'user', content: initialIdea, createdAt }] : [],
        readiness: createInitialReadiness(1),
        revisions: [], exports: [], commandLog: [], executionSessions: [], dismissedSuggestionFingerprints: [],
        ideaLabSession: { status: 'active', approaches: [], ideaNotes: [], candidateDecisions: [], candidateRisks: [] },
        ideaDocumentRevisions: [],
        sourceIdeaRevisionId: null,
        sourceIdeaRevisionNumber: null,
        planAlignment: {
            status: 'aligned',
            sourceIdeaRevisionId: null,
            sourceIdeaRevisionNumber: null,
            currentIdeaRevisionId: null,
            currentIdeaRevisionNumber: null,
            changedFields: [],
            affectedSections: [],
            reason: 'Canonical plan henüz fikir belgesinden üretilmedi.',
            detectedAt: null,
            reviewedAt: null,
            deferredAt: null
        },
        ideaDiscussion: { mode: 'explore', records: [], updatedAt: createdAt },
        impactAnalyses: [], planningScenarios: [], sectionPatchProposals: [], implementationEvidencePackages: [],
        modules: { active: [{ id: 'core.planning', version: '1.0.0', enabledAtRevision: 1, config: {} }], dismissed: [], localManifests: [] }, metadata: { canonicalModelVersion: 1 }
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
    next.documentRevision += 1;
    next.canonicalRevision += 1;
    next.lifecycle.updatedAt = now();
    return next;
}

export function validateProjectDocument(state) {
    const errors = [];
    if (!state || typeof state !== 'object') return { valid: false, errors: ['Proje durumu nesne olmalı.'] };
    if (state.schemaVersion !== 5) errors.push('schemaVersion 5 olmalı.');
    if (state.schemaRevision !== 5) errors.push('schemaRevision 5 olmalı.');
    if (!state.id || typeof state.id !== 'string') errors.push('Proje kimliği eksik.');
    if (!Number.isInteger(state.documentRevision) || state.documentRevision < 1) errors.push('documentRevision pozitif tam sayı olmalı.');
    if (!Number.isInteger(state.canonicalRevision) || state.canonicalRevision < 1) errors.push('canonicalRevision pozitif tam sayı olmalı.');
    if (state.canonicalRevision > state.documentRevision) errors.push('canonicalRevision documentRevision değerini aşamaz.');
    if (!state.identity?.originalIdea) errors.push('Başlangıç fikri eksik.');
    if (!state.planningDepth?.selected || !REQUIRED_BY_DEPTH[state.planningDepth.selected]) errors.push('Planlama derinliği geçersiz.');
    if (!state.sections || typeof state.sections !== 'object') errors.push('Plan bölümleri eksik.');
    for (const id of getRequiredSections(state.planningDepth?.selected)) {
        if (!state.sections?.[id]) errors.push(`Zorunlu plan bölümü eksik: ${id}`);
    }
    if (!Array.isArray(state.proposalStore?.bundles)) errors.push('Öneri deposu geçersiz.');
    if (!Array.isArray(state.revisions)) errors.push('Sürüm geçmişi dizi olmalı.');
    if (!Array.isArray(state.ideaDocumentRevisions)) {
        errors.push('Fikir belgesi sürüm geçmişi dizi olmalı.');
    } else {
        const revisionNumbers = new Set();
        for (const revision of state.ideaDocumentRevisions) {
            if (!revision?.id || !Number.isInteger(revision.number) || revision.number < 1) errors.push('Fikir belgesi sürümü kimlik ve pozitif sıra numarası taşımalı.');
            if (revisionNumbers.has(revision?.number)) errors.push(`Fikir belgesi sürüm numarası benzersiz değil: ${revision.number}`);
            revisionNumbers.add(revision?.number);
            if (!revision?.snapshot?.summary || !revision?.snapshot?.mvpTarget) errors.push(`Fikir belgesi sürüm içeriği eksik: ${revision?.id || 'boş'}`);
            if (revision?.status === 'converted' && !Number.isInteger(revision.convertedCanonicalRevision)) errors.push(`Dönüştürülen fikir sürümünün canonical revision kanıtı eksik: ${revision.id}`);
        }
    }
    const alignment = state.planAlignment;
    if (!alignment || !['aligned', 'stale', 'review_required'].includes(alignment.status)) {
        errors.push('Fikir-plan hizalama durumu geçersiz.');
    } else {
        if (!Array.isArray(alignment.changedFields) || !Array.isArray(alignment.affectedSections)) {
            errors.push('Fikir-plan hizalama etki alanları dizi olmalı.');
        }
        if (state.sourceIdeaRevisionId !== alignment.sourceIdeaRevisionId || state.sourceIdeaRevisionNumber !== alignment.sourceIdeaRevisionNumber) {
            errors.push('Canonical plan kaynak fikir sürümü ile hizalama kaydı uyuşmuyor.');
        }
        if (alignment.sourceIdeaRevisionId && !state.ideaDocumentRevisions.some(revision => revision.id === alignment.sourceIdeaRevisionId)) {
            errors.push('Canonical planın kaynak fikir sürümü bulunamadı.');
        }
        if (alignment.status !== 'aligned' && (!alignment.changedFields.length || !alignment.affectedSections.length || !alignment.detectedAt)) {
            errors.push('Güncelliğini yitirmiş planın değişiklik ve etki kanıtı eksik.');
        }
    }
    if (!Array.isArray(state.commandLog)) errors.push('Command log dizi olmalı.');
    if (state.readiness?.version !== 3) errors.push('Readiness sözleşmesi version 3 olmalı.');
    if (!['readiness-3.0', 'legacy-unverified'].includes(state.readiness?.calculationProfile)) errors.push('Readiness hesaplama profili geçersiz.');
    if (!['blocked', 'needs_review', 'ready'].includes(state.readiness?.status)) errors.push('Readiness durumu geçersiz.');
    if (typeof state.readiness?.evidenceHash !== 'string' || !state.readiness.evidenceHash) errors.push('Readiness kanıt parmak izi eksik.');
    if (!state.readiness?.qualityGate || typeof state.readiness.qualityGate.passed !== 'boolean' || !Array.isArray(state.readiness.qualityGate.conditions)) {
        errors.push('Readiness kalite kapısı geçersiz.');
    }
    if (!state.readiness?.dimensionEvidence || Object.values(state.readiness.dimensionEvidence).some(item => !item || item.earned < 0 || item.possible < 0)) {
        errors.push('Readiness boyut kanıtı geçersiz.');
    }
    if (!Array.isArray(state.readiness?.checks)) errors.push('Readiness kanıt kontrolleri dizi olmalı.');
    if (state.readiness?.checks?.some(check => !check.id || !['passed', 'warning', 'blocked'].includes(check.status))) {
        errors.push('Readiness kanıt kontrolü geçersiz.');
    }
    if (!Array.isArray(state.readiness?.nextActions)) errors.push('Readiness sonraki eylemleri dizi olmalı.');
    if (state.readiness?.nextActions?.some(action => !action.checkId || !['critical', 'recommended'].includes(action.priority))) {
        errors.push('Readiness sonraki eylemi geçersiz.');
    }
    const conceptSummary = state.ideaLabSession?.conceptSummary;
    if (conceptSummary) {
        // Alanlar her zaman string olmalıdır, ancak yalnız kullanıcı konsepti
        // onayladığında dolu olmaları gerekir. Boş alan, henüz netleşmemiş bir
        // bilgiyi dürüstçe temsil eder; sistem bu alanları kendiliğinden
        // dolduramayacağı için (bkz. analyzeIdea) doluluk şartı ancak onay
        // anında anlamlıdır.
        for (const field of ['summary', 'targetUser', 'problemStatement', 'currentAlternative', 'desiredOutcome', 'mvpTarget']) {
            if (typeof conceptSummary[field] !== 'string') errors.push(`Konsept yorum alanı geçersiz: ${field}`);
            else if (conceptSummary.userConfirmed && !conceptSummary[field].trim()) errors.push(`Konsept yorum alanı eksik: ${field}`);
        }
        if (!Number.isInteger(conceptSummary.interpretationConfidence) || conceptSummary.interpretationConfidence < 0 || conceptSummary.interpretationConfidence > 100) {
            errors.push('Konsept yorum güveni 0-100 arasında tam sayı olmalı.');
        }
        for (const field of ['confidenceRationale', 'confirmedFeatures', 'outOfScope', 'technicalApproaches', 'openQuestions', 'knownRisks']) {
            if (!Array.isArray(conceptSummary[field])) errors.push(`Konsept liste alanı geçersiz: ${field}`);
        }
        if (conceptSummary.userConfirmed && (conceptSummary.openQuestions.length || !conceptSummary.confirmedFeatures.length || !conceptSummary.outOfScope.length)) {
            errors.push('Onaylanmış konseptte açık soru bulunamaz; MVP içi ve kapsam dışı listeler boş olamaz.');
        }
    }
    if (!state.ideaDiscussion || !Array.isArray(state.ideaDiscussion.records)) {
        errors.push('Fikir tartışma kayıtları geçersiz.');
    } else {
        const validModes = new Set(['explore', 'challenge', 'compare', 'clarify']);
        const validKinds = new Set(['decision', 'hypothesis', 'risk', 'question']);
        const validStatuses = new Set(['pending', 'accepted', 'deferred', 'rejected']);
        if (!validModes.has(state.ideaDiscussion.mode)) errors.push('Fikir tartışma modu geçersiz.');
        for (const record of state.ideaDiscussion.records) {
            if (!record?.id || !record.text) errors.push('Fikir tartışma kaydı kimlik ve metin taşımalı.');
            if (!validKinds.has(record?.kind)) errors.push(`Fikir tartışma kayıt türü geçersiz: ${record?.kind || 'boş'}`);
            if (!validStatuses.has(record?.status)) errors.push(`Fikir tartışma kayıt durumu geçersiz: ${record?.status || 'boş'}`);
            if (!Array.isArray(record?.history)) errors.push('Fikir tartışma düzenleme geçmişi dizi olmalı.');
            if (record?.kind === 'question' && record?.status === 'accepted' && !record.answer) {
                errors.push(`Kabul edilen açık soru cevap taşımalı: ${record.id}`);
            }
        }
    }
    if (!state.modules || !Array.isArray(state.modules.active) || !Array.isArray(state.modules.localManifests)) errors.push('Modül durumu geçersiz.');
    if (!Array.isArray(state.executionSessions)) errors.push('Execution session kayıtları dizi olmalı.');
    if (!Array.isArray(state.impactAnalyses)) {
        errors.push('Etki analizleri dizi olmalı.');
    } else {
        for (const impact of state.impactAnalyses) {
            if (!impact?.id || !impact.userRequest) errors.push('Etki analizi kimlik ve istek taşımalı.');
            if (!Number.isInteger(impact?.baseCanonicalRevision) || impact.baseCanonicalRevision < 1) errors.push(`Etki analizi kaynak canonical revision geçersiz: ${impact?.id || 'boş'}`);
            if (!Array.isArray(impact?.entityEffects) || !Array.isArray(impact?.changedEntityIds)) errors.push(`Etki analizi izlenebilirlik verisi geçersiz: ${impact?.id || 'boş'}`);
            if (impact?.status === 'accepted' && !impact.resolvedAt) errors.push(`Uygulanmış etki analizinin çözüm zamanı eksik: ${impact.id}`);
        }
    }
    if (!Array.isArray(state.planningScenarios)) {
        errors.push('Plan senaryoları dizi olmalı.');
    } else {
        const validScenarioStatuses = new Set(['draft', 'selected', 'discarded', 'merged']);
        for (const scenario of state.planningScenarios) {
            if (!scenario?.id || !scenario.name) errors.push('Plan senaryosu kimlik ve ad taşımalı.');
            if (!Number.isInteger(scenario?.baseCanonicalRevision) || scenario.baseCanonicalRevision < 1) errors.push(`Senaryo kaynak revision geçersiz: ${scenario?.id || 'boş'}`);
            if (!Array.isArray(scenario?.decisions) || scenario.decisions.length === 0) errors.push(`Senaryonun alternatif kararı eksik: ${scenario?.id || 'boş'}`);
            if (!validScenarioStatuses.has(scenario?.status)) errors.push(`Senaryo durumu geçersiz: ${scenario?.status || 'boş'}`);
            if (scenario?.status === 'merged' && (!scenario.mergedAt || !scenario.impactAnalysisId)) errors.push(`Birleştirilmiş senaryo kanıtı eksik: ${scenario.id}`);
        }
    }
    if (!Array.isArray(state.sectionPatchProposals)) {
        errors.push('Plan bölüm patch önerileri dizi olmalı.');
    } else {
        const validPatchStatuses = new Set(['pending', 'accepted', 'edited', 'deferred', 'rejected', 'stale']);
        for (const proposal of state.sectionPatchProposals) {
            if (!proposal?.id || !proposal.impactAnalysisId || !proposal.sectionId) errors.push('Bölüm patch önerisi kimlik, etki analizi ve bölüm taşımalı.');
            if (!state.sections?.[proposal?.sectionId]) errors.push(`Patch hedef plan bölümü bulunamadı: ${proposal?.sectionId || 'boş'}`);
            if (!Number.isInteger(proposal?.baseCanonicalRevision) || proposal.baseCanonicalRevision < 1) errors.push(`Patch kaynak revision geçersiz: ${proposal?.id || 'boş'}`);
            if (!validPatchStatuses.has(proposal?.status)) errors.push(`Patch durumu geçersiz: ${proposal?.status || 'boş'}`);
            if (!proposal?.provenance?.runId || !proposal?.provenance?.schemaId) errors.push(`Patch provenance eksik: ${proposal?.id || 'boş'}`);
        }
    }
    if (!Array.isArray(state.implementationEvidencePackages)) {
        errors.push('Uygulama kanıt paketleri dizi olmalı.');
    } else {
        const validEvidenceStatuses = new Set(['review_required', 'accepted', 'rejected', 'stale']);
        for (const evidencePackage of state.implementationEvidencePackages) {
            if (!evidencePackage?.id || !evidencePackage.taskId || !evidencePackage.summary) errors.push('Uygulama kanıt paketi kimlik, görev ve özet taşımalı.');
            if (!state.tasks?.some(task => task.id === evidencePackage?.taskId)) errors.push(`Kanıt paketinin görevi bulunamadı: ${evidencePackage?.taskId || 'boş'}`);
            if (!Number.isInteger(evidencePackage?.baseCanonicalRevision) || evidencePackage.baseCanonicalRevision < 1) errors.push(`Kanıt paketi kaynak revision geçersiz: ${evidencePackage?.id || 'boş'}`);
            if (!Array.isArray(evidencePackage?.changedFiles) || !Array.isArray(evidencePackage?.testRuns) || !Array.isArray(evidencePackage?.acceptanceEvidence)) errors.push(`Kanıt paketi uygulama verisi geçersiz: ${evidencePackage?.id || 'boş'}`);
            if (!validEvidenceStatuses.has(evidencePackage?.status)) errors.push(`Kanıt paketi durumu geçersiz: ${evidencePackage?.status || 'boş'}`);
            if (!evidencePackage?.review?.outcome || !Array.isArray(evidencePackage?.review?.findings)) errors.push(`Kanıt paketi inceleme sonucu eksik: ${evidencePackage?.id || 'boş'}`);
        }
    }
    for (const key of ['objectives', 'requirements', 'decisions', 'assumptions', 'risks', 'tasks', 'testCases', 'milestones', 'traceLinks', 'agentPrompts', 'researchQuestions', 'sources', 'evidence', 'reviewFindings', 'simulationRuns', 'exports']) {
        if (!Array.isArray(state[key])) errors.push(`${key} dizi olmalı.`);
    }
    validateEntityInvariants(state, errors);
    return { valid: errors.length === 0, errors };
}

function validateEntityInvariants(state, errors) {
    const collections = ['objectives', 'requirements', 'decisions', 'assumptions', 'risks', 'tasks', 'testCases', 'milestones', 'traceLinks', 'agentPrompts'];
    const allIds = new Set();
    const idsByType = new Map();
    for (const key of collections) {
        const ids = new Set();
        for (const entity of state[key] || []) {
            if (!entity?.id || typeof entity.id !== 'string') {
                errors.push(`${key} içinde kimliği eksik kayıt var.`);
                continue;
            }
            if (allIds.has(entity.id)) errors.push(`Entity kimliği benzersiz değil: ${entity.id}`);
            allIds.add(entity.id);
            ids.add(entity.id);
        }
        idsByType.set(key, ids);
    }

    for (const requirement of state.requirements || []) {
        if (requirement.status === 'accepted' && (!Array.isArray(requirement.acceptanceCriteria) || requirement.acceptanceCriteria.length === 0)) {
            errors.push(`Kabul edilmiş gereksinimin kabul kriteri eksik: ${requirement.id}`);
        }
    }
    for (const decision of state.decisions || []) {
        if (decision.status === 'accepted' && !String(decision.rationale || '').trim()) {
            errors.push(`Kabul edilmiş kararın gerekçesi eksik: ${decision.id}`);
        }
    }
    for (const task of state.tasks || []) {
        const contract = task.contract;
        if (contract?.version !== 2 || !String(contract?.objective || '').trim()) {
            errors.push(`Görev sözleşmesi V2 eksik: ${task.id}`);
        } else {
            if (!Array.isArray(contract.inScope) || contract.inScope.length === 0) errors.push(`Görev kapsamı eksik: ${task.id}`);
            if (!Array.isArray(contract.outOfScope) || contract.outOfScope.length === 0) errors.push(`Görev kapsam dışı listesi eksik: ${task.id}`);
            if (!['requires_inventory', 'inferred', 'confirmed'].includes(contract.filePolicy?.status)) errors.push(`Görev dosya politikası geçersiz: ${task.id}`);
            if (!Array.isArray(contract.filePolicy?.forbiddenPaths) || contract.filePolicy.forbiddenPaths.length === 0) errors.push(`Görev yasak dosya yolları eksik: ${task.id}`);
            if (!Array.isArray(contract.verification?.testCaseIds) || !Array.isArray(contract.verification?.commands)) errors.push(`Görev doğrulama sözleşmesi geçersiz: ${task.id}`);
            if (contract.filePolicy?.status === 'confirmed' && contract.filePolicy.allowedPaths.length === 0) errors.push(`Onaylı görev dosya kapsamı boş: ${task.id}`);
            if (contract.verification?.requiresCommandDiscovery === false && contract.verification.commands.length === 0) errors.push(`Görev doğrulama komutu eksik: ${task.id}`);
            for (const testCaseId of contract.verification?.testCaseIds || []) {
                if (!idsByType.get('testCases')?.has(testCaseId)) errors.push(`Görev sözleşmesi var olmayan teste bağlı: ${task.id} → ${testCaseId}`);
            }
            if (!Array.isArray(contract.expectedOutputs) || contract.expectedOutputs.length === 0) errors.push(`Görev beklenen çıktıları eksik: ${task.id}`);
            if (!Array.isArray(contract.completionEvidence) || contract.completionEvidence.length === 0) errors.push(`Görev tamamlanma kanıtı eksik: ${task.id}`);
            if (!String(contract.rollbackPlan || '').trim()) errors.push(`Görev geri alma planı eksik: ${task.id}`);
        }
        for (const requirementId of task.requirementIds || []) {
            const requirement = (state.requirements || []).find(item => item.id === requirementId);
            if (!requirement || requirement.status !== 'accepted') {
                errors.push(`Görev kabul edilmiş olmayan gereksinime bağlı: ${task.id} → ${requirementId}`);
            }
        }
    }
    const traceTypeMap = {
        objective: 'objectives', requirement: 'requirements', decision: 'decisions',
        risk: 'risks', task: 'tasks', test: 'testCases', milestone: 'milestones', prompt: 'agentPrompts'
    };
    const allowedRelations = new Set(['supports', 'implements', 'verifies', 'validated_by', 'mitigates', 'depends_on', 'derived_from', 'drives', 'supersedes']);
    for (const link of state.traceLinks || []) {
        const fromCollection = traceTypeMap[link.fromType];
        const toCollection = traceTypeMap[link.toType];
        if (!fromCollection || !idsByType.get(fromCollection)?.has(link.fromId)) errors.push(`Trace başlangıcı bulunamadı: ${link.id}`);
        if (!toCollection || !idsByType.get(toCollection)?.has(link.toId)) errors.push(`Trace hedefi bulunamadı: ${link.id}`);
        if (!allowedRelations.has(link.relation)) errors.push(`Trace ilişkisi geçersiz: ${link.id}`);
    }
}
