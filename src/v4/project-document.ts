import { createStageApproval } from './application/project-stages.js';
import type {
  PlanningPhase,
  PlanningDepth,
  PlanningDepthLevel,
  PlanSection,
  ProjectDocumentV5,
  ReadinessResult,
  ReadinessDimension,
  ReadinessDimensionEvidence
} from './contracts.js';

export const PLANNING_PHASES: Readonly<Record<PlanningPhase, PlanningPhase>> = Object.freeze({
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

export interface PhaseRegistryEntry {
  id: PlanningPhase;
  label: string;
  description: string;
}

export const PHASE_REGISTRY: readonly PhaseRegistryEntry[] = Object.freeze([
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

export interface PlanSectionDefinition {
  id: string;
  title: string;
  description: string;
}

export const PLAN_SECTION_DEFINITIONS: readonly PlanSectionDefinition[] = Object.freeze([
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

const REQUIRED_BY_DEPTH: Readonly<Record<PlanningDepthLevel, string[]>> = Object.freeze({
    quick: ['vision', 'scope', 'tasks'],
    standard: ['vision', 'objectives', 'scope', 'requirements', 'architecture', 'tasks', 'risks', 'testing'],
    advanced: ['vision', 'objectives', 'scope', 'requirements', 'decisions', 'architecture', 'security', 'tasks', 'risks', 'testing', 'deployment'],
    enterprise: PLAN_SECTION_DEFINITIONS.map(section => section.id)
});

function now(): string { return new Date().toISOString(); }
function projectId(): string { return `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

/** Type guard: is `value` one of the four known planning depth levels? */
function isPlanningDepthLevel(value: unknown): value is PlanningDepthLevel {
    return value === 'quick' || value === 'standard' || value === 'advanced' || value === 'enterprise';
}

export function getRequiredSections(depth?: string | null): string[] {
    const key = isPlanningDepthLevel(depth) ? depth : 'standard';
    return [...REQUIRED_BY_DEPTH[key]];
}

export function createPlanSections(depth: PlanningDepthLevel = 'standard', revision = 1): Record<string, PlanSection> {
    const required = new Set(getRequiredSections(depth));
    return Object.fromEntries(PLAN_SECTION_DEFINITIONS.map((definition): [string, PlanSection] => [definition.id, {
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

export function createInitialReadiness(revision = 1): ReadinessResult {
    const dimensionEvidence: Record<ReadinessDimension, ReadinessDimensionEvidence> = {
        completeness: { earned: 0, possible: 0, passed: 0, warning: 0, blocked: 0 },
        consistency: { earned: 0, possible: 0, passed: 0, warning: 0, blocked: 0 },
        traceability: { earned: 0, possible: 0, passed: 0, warning: 0, blocked: 0 },
        riskCoverage: { earned: 0, possible: 0, passed: 0, warning: 0, blocked: 0 },
        implementationReadiness: { earned: 0, possible: 0, passed: 0, warning: 0, blocked: 0 }
    };
    return {
        version: 3,
        calculationProfile: 'legacy-unverified',
        status: 'blocked',
        score: 0,
        dimensions: { completeness: 0, consistency: 100, traceability: 0, riskCoverage: 0, implementationReadiness: 0 },
        dimensionWeights: { completeness: 20, consistency: 20, traceability: 25, riskCoverage: 15, implementationReadiness: 20 },
        dimensionLabels: { completeness: 'Tamlık', consistency: 'Tutarlılık', traceability: 'İzlenebilirlik', riskCoverage: 'Risk kapsamı', implementationReadiness: 'Uygulamaya hazırlık' },
        dimensionEvidence,
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

export interface CreateProjectDocumentOptions {
  /**
   * Optional at runtime (destructured with no default, tolerated as
   * `undefined` via `String(idea || '').trim()`); the previous `.d.ts`
   * wrongly declared this required — fixed to match actual behavior.
   */
  idea?: string;
  name?: string;
  outputLanguage?: 'tr' | 'en';
  profile?: ProjectDocumentV5['profile'] | null;
  planningDepth?: PlanningDepth | null;
}

export function createProjectDocument(options: CreateProjectDocumentOptions = {}): ProjectDocumentV5 {
    const { idea, name = 'Yeni Proje', outputLanguage = 'tr', profile = null, planningDepth = null } = options;
    const createdAt = now();
    const depth: PlanningDepth = planningDepth || {
        recommended: 'standard', selected: 'standard', overridden: false,
        rationale: 'Ölçek değerlendirmesi henüz yapılmadı.',
        signals: { score: 0, features: 0, integrations: 0, sensitiveData: false, multiPlatform: false, scaleIntent: false, uncertainty: 1 }
    };
    const initialIdea = String(idea || '').trim();
    const state: ProjectDocumentV5 = {
        schemaVersion: 5,
        schemaRevision: 7,
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
        ideaDesign: {
            approval: createStageApproval(),
            concerns: [],
            concernDecisions: [],
            framing: { kind: 'unknown', domain: '', environment: '', source: 'inferred' },
            openQuestions: []
        },
        solutionDesign: {
            approval: createStageApproval(),
            concerns: [],
            concernDecisions: [],
            candidates: [],
            legacyApproaches: [],
            platform: '',
            openQuestions: []
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

export function applyDepthSelection(state: ProjectDocumentV5, selected: PlanningDepthLevel, overridden = true): ProjectDocumentV5 {
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

// ---------------------------------------------------------------------------
// validateProjectDocument — runtime structural validator
// ---------------------------------------------------------------------------
//
// This validator's whole job is to check documents that may be malformed,
// partial, or written by an older schema version, so its input is honestly
// `unknown` (matching the previous hand-authored `.d.ts`). `Loose` plus the
// small `toRecord`/`toArray`/`isOneOf`/`isIntegerValue` helpers below give the
// compiler real visibility into "is this a record / array / string / valid
// enum value" at every access, which is the actual granularity this function
// operates at — a full `Partial<ProjectDocumentV5>` typing was considered and
// rejected because it would assert literal-type guarantees (e.g.
// `schemaVersion: 5`) about data this function exists specifically to doubt.

type Loose = Record<string, unknown>;

function toRecord(value: unknown): Loose | undefined {
    return typeof value === 'object' && value !== null ? (value as Loose) : undefined;
}

function toArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function isIntegerValue(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value);
}

function isPositiveInteger(value: unknown): value is number {
    return isIntegerValue(value) && value >= 1;
}

function isOneOf(value: unknown, options: readonly string[]): boolean {
    return typeof value === 'string' && options.includes(value);
}

function isValidDimensionEvidenceEntry(value: unknown): boolean {
    const entry = toRecord(value);
    return !!entry && typeof entry.earned === 'number' && entry.earned >= 0 && typeof entry.possible === 'number' && entry.possible >= 0;
}

function validateSchemaAndIdentity(doc: Loose, errors: string[]): void {
    if (doc.schemaVersion !== 5) errors.push('schemaVersion 5 olmalı.');
    if (doc.schemaRevision !== 7) errors.push('schemaRevision 7 olmalı.');
    if (!doc.id || typeof doc.id !== 'string') errors.push('Proje kimliği eksik.');
    if (!isPositiveInteger(doc.documentRevision)) errors.push('documentRevision pozitif tam sayı olmalı.');
    if (!isPositiveInteger(doc.canonicalRevision)) errors.push('canonicalRevision pozitif tam sayı olmalı.');
    if (isIntegerValue(doc.canonicalRevision) && isIntegerValue(doc.documentRevision) && doc.canonicalRevision > doc.documentRevision) {
        errors.push('canonicalRevision documentRevision değerini aşamaz.');
    }
    const identity = toRecord(doc.identity);
    if (!identity?.originalIdea) errors.push('Başlangıç fikri eksik.');
}

function validatePlanningDepthAndSections(doc: Loose, errors: string[]): void {
    const planningDepth = toRecord(doc.planningDepth);
    const selected = planningDepth?.selected;
    if (!isPlanningDepthLevel(selected)) errors.push('Planlama derinliği geçersiz.');
    if (!doc.sections || typeof doc.sections !== 'object') errors.push('Plan bölümleri eksik.');
    const sections = toRecord(doc.sections);
    const requiredDepthKey = typeof selected === 'string' ? selected : undefined;
    for (const id of getRequiredSections(requiredDepthKey)) {
        if (!sections?.[id]) errors.push(`Zorunlu plan bölümü eksik: ${id}`);
    }
}

function validateTopLevelCollections(doc: Loose, errors: string[]): void {
    const proposalStore = toRecord(doc.proposalStore);
    if (!Array.isArray(proposalStore?.bundles)) errors.push('Öneri deposu geçersiz.');
    if (!Array.isArray(doc.revisions)) errors.push('Sürüm geçmişi dizi olmalı.');
    if (!Array.isArray(doc.commandLog)) errors.push('Command log dizi olmalı.');
}

function validateIdeaDocumentRevisions(doc: Loose, errors: string[]): void {
    if (!Array.isArray(doc.ideaDocumentRevisions)) {
        errors.push('Fikir belgesi sürüm geçmişi dizi olmalı.');
        return;
    }
    const revisionNumbers = new Set<unknown>();
    for (const revisionRaw of doc.ideaDocumentRevisions) {
        const revision = toRecord(revisionRaw);
        const number = revision?.number;
        if (!revision?.id || !isPositiveInteger(number)) {
            errors.push('Fikir belgesi sürümü kimlik ve pozitif sıra numarası taşımalı.');
        }
        if (revisionNumbers.has(number)) errors.push(`Fikir belgesi sürüm numarası benzersiz değil: ${number}`);
        revisionNumbers.add(number);
        // Anlık görüntü yapısal olarak bulunmalıdır, ancak içeriği boş
        // olabilir: conceptSummary alanları kullanıcı doldurana kadar boş
        // başlar (bkz. analyzeIdea / ensureIdeaCoachWorkspace). Erken
        // sürümler netleşmemiş bir fikrin dürüst kaydıdır. Doluluk şartı
        // yalnız plana dönüştürülmüş sürümler için anlamlıdır.
        const snapshot = toRecord(revision?.snapshot);
        const summary = snapshot?.summary;
        const firstReleaseTarget = snapshot?.firstReleaseTarget;
        if (typeof summary !== 'string' || typeof firstReleaseTarget !== 'string') {
            errors.push(`Fikir belgesi sürüm anlık görüntüsü geçersiz: ${revision?.id || 'boş'}`);
        } else if (revision?.status === 'converted' && (!summary.trim() || !firstReleaseTarget.trim())) {
            errors.push(`Fikir belgesi sürüm içeriği eksik: ${revision?.id || 'boş'}`);
        }
        if (revision && revision.status === 'converted' && !isIntegerValue(revision.convertedCanonicalRevision)) {
            errors.push(`Dönüştürülen fikir sürümünün canonical revision kanıtı eksik: ${revision.id}`);
        }
    }
}

function validatePlanAlignment(doc: Loose, errors: string[]): void {
    const alignment = toRecord(doc.planAlignment);
    if (!alignment || !isOneOf(alignment.status, ['aligned', 'stale', 'review_required'])) {
        errors.push('Fikir-plan hizalama durumu geçersiz.');
        return;
    }
    const changedFields = alignment.changedFields;
    const affectedSections = alignment.affectedSections;
    if (!Array.isArray(changedFields) || !Array.isArray(affectedSections)) {
        errors.push('Fikir-plan hizalama etki alanları dizi olmalı.');
    }
    if (doc.sourceIdeaRevisionId !== alignment.sourceIdeaRevisionId || doc.sourceIdeaRevisionNumber !== alignment.sourceIdeaRevisionNumber) {
        errors.push('Canonical plan kaynak fikir sürümü ile hizalama kaydı uyuşmuyor.');
    }
    if (alignment.sourceIdeaRevisionId && !toArray(doc.ideaDocumentRevisions).some(revisionRaw => toRecord(revisionRaw)?.id === alignment.sourceIdeaRevisionId)) {
        errors.push('Canonical planın kaynak fikir sürümü bulunamadı.');
    }
    if (alignment.status !== 'aligned' && (!toArray(changedFields).length || !toArray(affectedSections).length || !alignment.detectedAt)) {
        errors.push('Güncelliğini yitirmiş planın değişiklik ve etki kanıtı eksik.');
    }
}

function validateReadiness(doc: Loose, errors: string[]): void {
    const readiness = toRecord(doc.readiness);
    if (readiness?.version !== 3) errors.push('Readiness sözleşmesi version 3 olmalı.');
    if (!isOneOf(readiness?.calculationProfile, ['readiness-3.0', 'legacy-unverified'])) errors.push('Readiness hesaplama profili geçersiz.');
    if (!isOneOf(readiness?.status, ['blocked', 'needs_review', 'ready'])) errors.push('Readiness durumu geçersiz.');
    if (typeof readiness?.evidenceHash !== 'string' || !readiness.evidenceHash) errors.push('Readiness kanıt parmak izi eksik.');
    const qualityGate = toRecord(readiness?.qualityGate);
    if (!qualityGate || typeof qualityGate.passed !== 'boolean' || !Array.isArray(qualityGate.conditions)) {
        errors.push('Readiness kalite kapısı geçersiz.');
    }
    const dimensionEvidence = toRecord(readiness?.dimensionEvidence);
    if (!dimensionEvidence || Object.values(dimensionEvidence).some(item => !isValidDimensionEvidenceEntry(item))) {
        errors.push('Readiness boyut kanıtı geçersiz.');
    }
    if (!Array.isArray(readiness?.checks)) errors.push('Readiness kanıt kontrolleri dizi olmalı.');
    if (Array.isArray(readiness?.checks) && readiness.checks.some(check => {
        const item = toRecord(check);
        return !item?.id || !isOneOf(item?.status, ['passed', 'warning', 'blocked']);
    })) {
        errors.push('Readiness kanıt kontrolü geçersiz.');
    }
    if (!Array.isArray(readiness?.nextActions)) errors.push('Readiness sonraki eylemleri dizi olmalı.');
    if (Array.isArray(readiness?.nextActions) && readiness.nextActions.some(action => {
        const item = toRecord(action);
        return !item?.checkId || !isOneOf(item?.priority, ['critical', 'recommended']);
    })) {
        errors.push('Readiness sonraki eylemi geçersiz.');
    }
}

function validateConceptSummary(doc: Loose, errors: string[]): void {
    const ideaLabSession = toRecord(doc.ideaLabSession);
    const conceptSummary = toRecord(ideaLabSession?.conceptSummary);
    if (!conceptSummary) return;
    // Alanlar her zaman string olmalıdır, ancak yalnız kullanıcı konsepti
    // onayladığında dolu olmaları gerekir. Boş alan, henüz netleşmemiş bir
    // bilgiyi dürüstçe temsil eder; sistem bu alanları kendiliğinden
    // dolduramayacağı için (bkz. analyzeIdea) doluluk şartı ancak onay
    // anında anlamlıdır.
    for (const field of ['summary', 'targetUser', 'problemStatement', 'currentAlternative', 'desiredOutcome', 'firstReleaseTarget'] as const) {
        const fieldValue = conceptSummary[field];
        if (typeof fieldValue !== 'string') errors.push(`Konsept yorum alanı geçersiz: ${field}`);
        else if (conceptSummary.userConfirmed && !fieldValue.trim()) errors.push(`Konsept yorum alanı eksik: ${field}`);
    }
    const interpretationConfidence = conceptSummary.interpretationConfidence;
    if (!isIntegerValue(interpretationConfidence) || interpretationConfidence < 0 || interpretationConfidence > 100) {
        errors.push('Konsept yorum güveni 0-100 arasında tam sayı olmalı.');
    }
    for (const field of ['confidenceRationale', 'confirmedFeatures', 'outOfScope', 'technicalApproaches', 'openQuestions', 'knownRisks'] as const) {
        if (!Array.isArray(conceptSummary[field])) errors.push(`Konsept liste alanı geçersiz: ${field}`);
    }
    if (conceptSummary.userConfirmed) {
        const openQuestions = toArray(conceptSummary.openQuestions);
        const confirmedFeatures = toArray(conceptSummary.confirmedFeatures);
        const outOfScope = toArray(conceptSummary.outOfScope);
        if (openQuestions.length || !confirmedFeatures.length || !outOfScope.length) {
            errors.push('Onaylanmış konseptte açık soru bulunamaz; kapsam içi ve kapsam dışı listeler boş olamaz.');
        }
    }
}

function validateIdeaDiscussion(doc: Loose, errors: string[]): void {
    const ideaDiscussion = toRecord(doc.ideaDiscussion);
    const records = ideaDiscussion?.records;
    if (!ideaDiscussion || !Array.isArray(records)) {
        errors.push('Fikir tartışma kayıtları geçersiz.');
        return;
    }
    const validModes = ['explore', 'challenge', 'compare', 'clarify'];
    const validKinds = ['decision', 'hypothesis', 'risk', 'question'];
    const validStatuses = ['pending', 'accepted', 'deferred', 'rejected'];
    if (!isOneOf(ideaDiscussion.mode, validModes)) errors.push('Fikir tartışma modu geçersiz.');
    for (const recordRaw of records) {
        const record = toRecord(recordRaw);
        if (!record?.id || !record?.text) errors.push('Fikir tartışma kaydı kimlik ve metin taşımalı.');
        if (!isOneOf(record?.kind, validKinds)) errors.push(`Fikir tartışma kayıt türü geçersiz: ${record?.kind || 'boş'}`);
        if (!isOneOf(record?.status, validStatuses)) errors.push(`Fikir tartışma kayıt durumu geçersiz: ${record?.status || 'boş'}`);
        if (!Array.isArray(record?.history)) errors.push('Fikir tartışma düzenleme geçmişi dizi olmalı.');
        if (record?.kind === 'question' && record?.status === 'accepted' && !record.answer) {
            errors.push(`Kabul edilen açık soru cevap taşımalı: ${record.id}`);
        }
    }
}

function validateModulesAndSessions(doc: Loose, errors: string[]): void {
    const modules = toRecord(doc.modules);
    if (!modules || !Array.isArray(modules.active) || !Array.isArray(modules.localManifests)) errors.push('Modül durumu geçersiz.');
    if (!Array.isArray(doc.executionSessions)) errors.push('Execution session kayıtları dizi olmalı.');
}

function validateImpactAnalyses(doc: Loose, errors: string[]): void {
    if (!Array.isArray(doc.impactAnalyses)) {
        errors.push('Etki analizleri dizi olmalı.');
        return;
    }
    for (const impactRaw of doc.impactAnalyses) {
        const impact = toRecord(impactRaw);
        if (!impact?.id || !impact?.userRequest) errors.push('Etki analizi kimlik ve istek taşımalı.');
        if (!isPositiveInteger(impact?.baseCanonicalRevision)) errors.push(`Etki analizi kaynak canonical revision geçersiz: ${impact?.id || 'boş'}`);
        if (!Array.isArray(impact?.entityEffects) || !Array.isArray(impact?.changedEntityIds)) errors.push(`Etki analizi izlenebilirlik verisi geçersiz: ${impact?.id || 'boş'}`);
        if (impact?.status === 'accepted' && !impact.resolvedAt) errors.push(`Uygulanmış etki analizinin çözüm zamanı eksik: ${impact.id}`);
    }
}

function validatePlanningScenarios(doc: Loose, errors: string[]): void {
    if (!Array.isArray(doc.planningScenarios)) {
        errors.push('Plan senaryoları dizi olmalı.');
        return;
    }
    const validScenarioStatuses = ['draft', 'selected', 'discarded', 'merged'];
    for (const scenarioRaw of doc.planningScenarios) {
        const scenario = toRecord(scenarioRaw);
        if (!scenario?.id || !scenario?.name) errors.push('Plan senaryosu kimlik ve ad taşımalı.');
        if (!isPositiveInteger(scenario?.baseCanonicalRevision)) errors.push(`Senaryo kaynak revision geçersiz: ${scenario?.id || 'boş'}`);
        const decisions = scenario?.decisions;
        if (!Array.isArray(decisions) || decisions.length === 0) errors.push(`Senaryonun alternatif kararı eksik: ${scenario?.id || 'boş'}`);
        if (!isOneOf(scenario?.status, validScenarioStatuses)) errors.push(`Senaryo durumu geçersiz: ${scenario?.status || 'boş'}`);
        if (scenario?.status === 'merged' && (!scenario.mergedAt || !scenario.impactAnalysisId)) errors.push(`Birleştirilmiş senaryo kanıtı eksik: ${scenario.id}`);
    }
}

function validateSectionPatchProposals(doc: Loose, errors: string[]): void {
    if (!Array.isArray(doc.sectionPatchProposals)) {
        errors.push('Plan bölüm patch önerileri dizi olmalı.');
        return;
    }
    const validPatchStatuses = ['pending', 'accepted', 'edited', 'deferred', 'rejected', 'stale'];
    const sections = toRecord(doc.sections);
    for (const proposalRaw of doc.sectionPatchProposals) {
        const proposal = toRecord(proposalRaw);
        if (!proposal?.id || !proposal?.impactAnalysisId || !proposal?.sectionId) errors.push('Bölüm patch önerisi kimlik, etki analizi ve bölüm taşımalı.');
        const sectionId = proposal?.sectionId;
        if (typeof sectionId !== 'string' || !sections?.[sectionId]) errors.push(`Patch hedef plan bölümü bulunamadı: ${proposal?.sectionId || 'boş'}`);
        if (!isPositiveInteger(proposal?.baseCanonicalRevision)) errors.push(`Patch kaynak revision geçersiz: ${proposal?.id || 'boş'}`);
        if (!isOneOf(proposal?.status, validPatchStatuses)) errors.push(`Patch durumu geçersiz: ${proposal?.status || 'boş'}`);
        const provenance = toRecord(proposal?.provenance);
        if (!provenance?.runId || !provenance?.schemaId) errors.push(`Patch provenance eksik: ${proposal?.id || 'boş'}`);
    }
}

function validateImplementationEvidencePackages(doc: Loose, errors: string[]): void {
    if (!Array.isArray(doc.implementationEvidencePackages)) {
        errors.push('Uygulama kanıt paketleri dizi olmalı.');
        return;
    }
    const validEvidenceStatuses = ['review_required', 'accepted', 'rejected', 'stale'];
    const tasks = toArray(doc.tasks);
    for (const evidencePackageRaw of doc.implementationEvidencePackages) {
        const evidencePackage = toRecord(evidencePackageRaw);
        if (!evidencePackage?.id || !evidencePackage?.taskId || !evidencePackage?.summary) errors.push('Uygulama kanıt paketi kimlik, görev ve özet taşımalı.');
        const hasTask = tasks.some(taskRaw => toRecord(taskRaw)?.id === evidencePackage?.taskId);
        if (!hasTask) errors.push(`Kanıt paketinin görevi bulunamadı: ${evidencePackage?.taskId || 'boş'}`);
        if (!isPositiveInteger(evidencePackage?.baseCanonicalRevision)) errors.push(`Kanıt paketi kaynak revision geçersiz: ${evidencePackage?.id || 'boş'}`);
        if (!Array.isArray(evidencePackage?.changedFiles) || !Array.isArray(evidencePackage?.testRuns) || !Array.isArray(evidencePackage?.acceptanceEvidence)) {
            errors.push(`Kanıt paketi uygulama verisi geçersiz: ${evidencePackage?.id || 'boş'}`);
        }
        if (!isOneOf(evidencePackage?.status, validEvidenceStatuses)) errors.push(`Kanıt paketi durumu geçersiz: ${evidencePackage?.status || 'boş'}`);
        const review = toRecord(evidencePackage?.review);
        if (!review?.outcome || !Array.isArray(review?.findings)) errors.push(`Kanıt paketi inceleme sonucu eksik: ${evidencePackage?.id || 'boş'}`);
    }
}

const TOP_LEVEL_COLLECTION_KEYS = [
    'objectives', 'requirements', 'decisions', 'assumptions', 'risks', 'tasks', 'testCases',
    'milestones', 'traceLinks', 'agentPrompts', 'researchQuestions', 'sources', 'evidence',
    'reviewFindings', 'simulationRuns', 'exports'
] as const;

function validateCollectionArrays(doc: Loose, errors: string[]): void {
    for (const key of TOP_LEVEL_COLLECTION_KEYS) {
        if (!Array.isArray(doc[key])) errors.push(`${key} dizi olmalı.`);
    }
}

const ENTITY_ID_COLLECTION_KEYS = [
    'objectives', 'requirements', 'decisions', 'assumptions', 'risks', 'tasks', 'testCases',
    'milestones', 'traceLinks', 'agentPrompts'
] as const;

function validateEntityInvariants(doc: Loose, errors: string[]): void {
    const allIds = new Set<string>();
    const idsByType = new Map<string, Set<string>>();
    for (const key of ENTITY_ID_COLLECTION_KEYS) {
        const ids = new Set<string>();
        for (const entityRaw of toArray(doc[key])) {
            const entity = toRecord(entityRaw);
            const id = entity?.id;
            if (typeof id !== 'string' || !id) {
                errors.push(`${key} içinde kimliği eksik kayıt var.`);
                continue;
            }
            if (allIds.has(id)) errors.push(`Entity kimliği benzersiz değil: ${id}`);
            allIds.add(id);
            ids.add(id);
        }
        idsByType.set(key, ids);
    }

    for (const requirementRaw of toArray(doc.requirements)) {
        const requirement = toRecord(requirementRaw);
        const acceptanceCriteria = requirement?.acceptanceCriteria;
        if (requirement?.status === 'accepted' && (!Array.isArray(acceptanceCriteria) || acceptanceCriteria.length === 0)) {
            errors.push(`Kabul edilmiş gereksinimin kabul kriteri eksik: ${requirement.id}`);
        }
    }
    for (const decisionRaw of toArray(doc.decisions)) {
        const decision = toRecord(decisionRaw);
        if (decision?.status === 'accepted' && !String(decision.rationale || '').trim()) {
            errors.push(`Kabul edilmiş kararın gerekçesi eksik: ${decision.id}`);
        }
    }
    const testCaseIds = idsByType.get('testCases');
    const requirementRecords = toArray(doc.requirements).map(toRecord);
    for (const taskRaw of toArray(doc.tasks)) {
        const task = toRecord(taskRaw);
        const contract = toRecord(task?.contract);
        if (contract?.version !== 2 || !String(contract?.objective || '').trim()) {
            errors.push(`Görev sözleşmesi V2 eksik: ${task?.id}`);
        } else {
            const inScope = contract.inScope;
            if (!Array.isArray(inScope) || inScope.length === 0) errors.push(`Görev kapsamı eksik: ${task?.id}`);
            const outOfScope = contract.outOfScope;
            if (!Array.isArray(outOfScope) || outOfScope.length === 0) errors.push(`Görev kapsam dışı listesi eksik: ${task?.id}`);
            const filePolicy = toRecord(contract.filePolicy);
            if (!isOneOf(filePolicy?.status, ['requires_inventory', 'inferred', 'confirmed'])) errors.push(`Görev dosya politikası geçersiz: ${task?.id}`);
            const forbiddenPaths = filePolicy?.forbiddenPaths;
            if (!Array.isArray(forbiddenPaths) || forbiddenPaths.length === 0) errors.push(`Görev yasak dosya yolları eksik: ${task?.id}`);
            const verification = toRecord(contract.verification);
            const verificationTestCaseIds = verification?.testCaseIds;
            const verificationCommands = verification?.commands;
            if (!Array.isArray(verificationTestCaseIds) || !Array.isArray(verificationCommands)) errors.push(`Görev doğrulama sözleşmesi geçersiz: ${task?.id}`);
            const allowedPaths = filePolicy?.allowedPaths;
            if (filePolicy?.status === 'confirmed' && (!Array.isArray(allowedPaths) || allowedPaths.length === 0)) errors.push(`Onaylı görev dosya kapsamı boş: ${task?.id}`);
            if (verification?.requiresCommandDiscovery === false && (!Array.isArray(verificationCommands) || verificationCommands.length === 0)) errors.push(`Görev doğrulama komutu eksik: ${task?.id}`);
            for (const testCaseId of toArray(verificationTestCaseIds)) {
                if (typeof testCaseId !== 'string' || !testCaseIds?.has(testCaseId)) errors.push(`Görev sözleşmesi var olmayan teste bağlı: ${task?.id} → ${testCaseId}`);
            }
            const expectedOutputs = contract.expectedOutputs;
            if (!Array.isArray(expectedOutputs) || expectedOutputs.length === 0) errors.push(`Görev beklenen çıktıları eksik: ${task?.id}`);
            const completionEvidence = contract.completionEvidence;
            if (!Array.isArray(completionEvidence) || completionEvidence.length === 0) errors.push(`Görev tamamlanma kanıtı eksik: ${task?.id}`);
            if (!String(contract.rollbackPlan || '').trim()) errors.push(`Görev geri alma planı eksik: ${task?.id}`);
        }
        for (const requirementId of toArray(task?.requirementIds)) {
            const requirement = requirementRecords.find(item => item?.id === requirementId);
            if (!requirement || requirement.status !== 'accepted') {
                errors.push(`Görev kabul edilmiş olmayan gereksinime bağlı: ${task?.id} → ${requirementId}`);
            }
        }
    }
    const traceTypeMap: Record<string, string> = {
        objective: 'objectives', requirement: 'requirements', decision: 'decisions',
        risk: 'risks', task: 'tasks', test: 'testCases', milestone: 'milestones', prompt: 'agentPrompts'
    };
    const allowedRelations = ['supports', 'implements', 'verifies', 'validated_by', 'mitigates', 'depends_on', 'derived_from', 'drives', 'supersedes'];
    for (const linkRaw of toArray(doc.traceLinks)) {
        const link = toRecord(linkRaw);
        const fromType = link?.fromType;
        const toType = link?.toType;
        const fromCollection = typeof fromType === 'string' ? traceTypeMap[fromType] : undefined;
        const toCollection = typeof toType === 'string' ? traceTypeMap[toType] : undefined;
        const fromId = link?.fromId;
        const toId = link?.toId;
        if (!fromCollection || typeof fromId !== 'string' || !idsByType.get(fromCollection)?.has(fromId)) errors.push(`Trace başlangıcı bulunamadı: ${link?.id}`);
        if (!toCollection || typeof toId !== 'string' || !idsByType.get(toCollection)?.has(toId)) errors.push(`Trace hedefi bulunamadı: ${link?.id}`);
        if (!isOneOf(link?.relation, allowedRelations)) errors.push(`Trace ilişkisi geçersiz: ${link?.id}`);
    }
}

export function validateProjectDocument(state: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const doc = toRecord(state);
    if (!doc) return { valid: false, errors: ['Proje durumu nesne olmalı.'] };

    validateSchemaAndIdentity(doc, errors);
    validatePlanningDepthAndSections(doc, errors);
    validateTopLevelCollections(doc, errors);
    validateIdeaDocumentRevisions(doc, errors);
    validatePlanAlignment(doc, errors);
    validateReadiness(doc, errors);
    validateConceptSummary(doc, errors);
    validateIdeaDiscussion(doc, errors);
    validateModulesAndSessions(doc, errors);
    validateImpactAnalyses(doc, errors);
    validatePlanningScenarios(doc, errors);
    validateSectionPatchProposals(doc, errors);
    validateImplementationEvidencePackages(doc, errors);
    validateCollectionArrays(doc, errors);
    validateEntityInvariants(doc, errors);

    return { valid: errors.length === 0, errors };
}
