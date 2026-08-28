import { applyDepthSelection, createProjectDocument, getRequiredSections, PLANNING_PHASES } from './project-document.js';
import { normalizeAssumption, normalizeDecision, normalizeObjective, normalizeRequirement, normalizeRisk, normalizeTask } from './canonical-entities.js';
import { createInitialConceptInterpretation, getConceptAgreementGate } from './application/idea-discussion-service.js';
import { calculateReadiness } from './application/readiness-service.js';
import type {
    ExpansionDimension,
    PlanChangePreview,
    PlanningDepth,
    PlanningDepthLevel,
    PlanningPhase,
    PlanSection,
    ProjectDocumentV5,
    RevisionComparison,
    SuggestionBundle,
    SuggestionItem,
    SuggestionStatus
} from './contracts.js';

type ImportedContextItem = ProjectDocumentV5['profile']['importedContext'][number];
type RevisionReference = string | number;
// `resolveRevisionState` may return the live project itself (full ProjectDocumentV5,
// includes `revisions`) or a historical snapshot pulled from `PlanRevision.snapshot`
// (which is `Omit<ProjectDocumentV5, 'revisions'>` -- a revision's own snapshot never
// embeds the full revision list to avoid unbounded nesting). Every call site here only
// reads fields the two variants share, so the union is safe to use as-is.
type RevisionSnapshot = ProjectDocumentV5 | Omit<ProjectDocumentV5, 'revisions'>;
type PlanSectionSnapshot = Pick<PlanSection, 'title' | 'content' | 'items' | 'status'>;

interface SectionChangeAccumulator {
    sectionId: string;
    title: string;
    additions: string[];
    unchanged: string[];
    sourceSuggestionIds: string[];
}

export interface AnalyzeIdeaOptions {
    name?: string;
    outputLanguage?: 'tr' | 'en';
    profile?: ProjectDocumentV5['profile'];
    importedContext?: ImportedContextItem[];
}

export type PlanningDepthAssessment = PlanningDepth;

interface SuggestionInput {
    kind: SuggestionItem['kind'];
    title: string;
    description: string;
    pros: string[];
    cons: string[];
    effort: SuggestionItem['effort'];
    impact: SuggestionItem['impact'];
    affectedSections: string[];
    recommended?: boolean;
    dependencies?: string[];
}

const DEPTH_ORDER: PlanningDepthLevel[] = ['quick', 'standard', 'advanced', 'enterprise'];
const SECTION_PHASE: Record<string, PlanningPhase> = {
    vision: PLANNING_PHASES.DISCOVERY, objectives: PLANNING_PHASES.SHAPING, scope: PLANNING_PHASES.SHAPING,
    requirements: PLANNING_PHASES.SHAPING, decisions: PLANNING_PHASES.DESIGN, architecture: PLANNING_PHASES.DESIGN,
    security: PLANNING_PHASES.DESIGN, tasks: PLANNING_PHASES.PLANNING, risks: PLANNING_PHASES.REVIEW,
    testing: PLANNING_PHASES.PLANNING, deployment: PLANNING_PHASES.PLANNING, operations: PLANNING_PHASES.REVIEW
};
const SECTION_DEPENDENTS: Record<string, string[]> = {
    vision: ['objectives', 'scope', 'requirements', 'architecture', 'tasks', 'testing'],
    objectives: ['scope', 'requirements', 'tasks', 'testing'],
    scope: ['requirements', 'architecture', 'tasks', 'risks', 'testing', 'deployment'],
    requirements: ['architecture', 'security', 'tasks', 'testing'],
    decisions: ['architecture', 'security', 'tasks', 'deployment', 'operations'],
    architecture: ['security', 'tasks', 'testing', 'deployment', 'operations'],
    security: ['testing', 'deployment', 'operations'],
    tasks: ['testing', 'deployment']
};

function now(): string { return new Date().toISOString(); }
function id(prefix: string): string { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function contains(text: string, words: string[]): boolean { return words.some(word => text.includes(word)); }

export function assessPlanningDepth(idea: string, importedContext: ImportedContextItem[] = []): PlanningDepthAssessment {
    const text = `${idea || ''} ${importedContext.map(item => item.summary || item.name || '').join(' ')}`.toLowerCase();
    const integrations = (text.match(/api|entegrasyon|integration|stripe|ödeme|payment|oauth|webhook|third.party/g) || []).length;
    const featureSeparators = (text.match(/,| ve | ile | ayrıca | aynı zamanda |;|\n/g) || []).length;
    const features = Math.max(1, Math.min(20, featureSeparators + 1));
    const sensitiveData = contains(text, ['ödeme', 'payment', 'sağlık', 'health', 'kişisel veri', 'auth', 'kimlik', 'finans', 'bank']);
    const platformMatches = ['web', 'mobil', 'mobile', 'desktop', 'masaüstü', 'ios', 'android', 'cli'].filter(token => text.includes(token));
    const multiPlatform = new Set(platformMatches).size > 1;
    const scaleIntent = contains(text, ['milyon', 'enterprise', 'kurumsal', 'global', 'yüksek trafik', 'multi tenant', 'çok kiracılı', 'devasa']);
    const uncertainty = contains(text, ['bilmiyorum', 'emin değilim', 'fark etmez', 'kararsızım']) ? 3 : (text.length < 80 ? 2 : 1);
    const score = Math.min(100, features * 4 + integrations * 7 + (sensitiveData ? 18 : 0) + (multiPlatform ? 14 : 0) + (scaleIntent ? 24 : 0) + uncertainty * 5);
    const recommended = score < 25 ? 'quick' : score < 50 ? 'standard' : score < 75 ? 'advanced' : 'enterprise';
    const reasons: string[] = [];
    if (features > 5) reasons.push(`${features} ayrı özellik sinyali`);
    if (integrations) reasons.push(`${integrations} entegrasyon sinyali`);
    if (sensitiveData) reasons.push('hassas veri veya güvenlik ihtiyacı');
    if (multiPlatform) reasons.push('çoklu platform hedefi');
    if (scaleIntent) reasons.push('yüksek ölçek hedefi');
    if (!reasons.length) reasons.push('dar ve net başlangıç kapsamı');
    return {
        recommended, selected: recommended, overridden: false,
        rationale: `${recommended.toUpperCase()} önerildi: ${reasons.join(', ')}.`,
        signals: { score, features, integrations, sensitiveData, multiPlatform, scaleIntent, uncertainty }
    };
}

export function analyzeIdea(idea: string, options: AnalyzeIdeaOptions = {}): ProjectDocumentV5 {
    const planningDepth = assessPlanningDepth(idea, options.importedContext || []);
    const project = createProjectDocument({
        idea,
        name: options.name || inferProjectName(idea),
        outputLanguage: options.outputLanguage || 'tr',
        planningDepth,
        profile: options.profile || inferProfile(idea, options.importedContext || [])
    });
    // Very short/vague idea (< 50 chars) -> route to Idea Amplifier before Discovery
    const isShortIdea = String(idea || '').trim().length < 50;
    if (isShortIdea) {
        project.lifecycle.activePhase = PLANNING_PHASES.IDEA_EXPANSION;
    } else {
        // Deliberately no eager conceptSummary here: createInitialConceptInterpretation()
        // fabricates full-length "meaningful" text for every field from just the raw idea
        // text, which made buildIdeaCoachState() treat the idea as fully clarified before
        // a real conversation happened (activeStep jumped straight to 'approval' on
        // project creation). ensureIdeaCoachWorkspace() seeds it empty on first use instead,
        // same as the short-idea path. proposeNextOptions() only reads identity/sections,
        // not conceptSummary, so the suggestion bundle is unaffected.
        project.proposalStore.bundles.push(proposeNextOptions(project));
    }
    return recalculateReadiness(project);
}

export function applyIdeaExpansion(
    project: ProjectDocumentV5,
    { answers = {}, dimensions = [] }: { answers?: Record<string, string>; dimensions?: ExpansionDimension[] } = {}
): ProjectDocumentV5 {
    // Build enriched idea text from dimension answers
    const parts: string[] = [];
    for (const dim of dimensions) {
        const answer = String(answers[dim.id] || '').trim();
        if (answer) parts.push(answer);
    }
    const originalIdea = String(project.identity.originalIdea || '').trim();
    const expandedIdea = parts.length
        ? `${originalIdea} — ${parts.join(', ')}`
        : originalIdea;

    const next = structuredClone(project);
    next.identity.originalIdea = expandedIdea;
    next.identity.name = inferProjectName(expandedIdea);
    next.ideaExpansionSession = {
        originalIdea,
        answers,
        expandedIdea,
        dimensions
    };
    next.lifecycle.activePhase = PLANNING_PHASES.DISCOVERY;
    // `ideaLabSession` is typed optional (legacy documents predate it), but
    // `createProjectDocument` always seeds one -- this mirrors that default rather
    // than asserting the field away, so a document that genuinely lacks it still
    // gets a valid session instead of a runtime crash.
    next.ideaLabSession = next.ideaLabSession || { status: 'active', approaches: [], ideaNotes: [], candidateDecisions: [], candidateRisks: [] };
    next.ideaLabSession.conceptSummary = createInitialConceptInterpretation(next);
    next.lifecycle.updatedAt = new Date().toISOString();
    next.proposalStore.bundles.push(proposeNextOptions(next));
    return recalculateReadiness(next);
}

function inferProjectName(idea: string): string {
    const clean = String(idea || '').replace(/[.!?].*$/, '').trim();
    if (!clean) return 'Yeni Proje';
    return clean.split(/\s+/).slice(0, 5).join(' ').replace(/^./, char => char.toUpperCase());
}

function inferProfile(idea: string, importedContext: ImportedContextItem[]): ProjectDocumentV5['profile'] {
    const text = String(idea || '').toLowerCase();
    const domainMap: Array<[string, string[]]> = [
        ['game', ['oyun', 'game', 'unity', 'godot']], ['mobile', ['mobil', 'mobile', 'android', 'ios']],
        ['web', ['web', 'site', 'saas', 'browser', 'tarayıcı']], ['backend', ['api', 'backend', 'server', 'veritabanı']],
        ['ai', ['yapay zeka', ' ai ', 'llm', 'agent']], ['desktop', ['masaüstü', 'desktop', 'tauri', 'electron']],
        ['research', ['araştırma', 'research', 'tez', 'literatür', 'deney']], ['content', ['içerik', 'content', 'podcast', 'kitap', 'yayın']],
        ['business', ['iş planı', 'business', 'operasyon', 'pazar', 'müşteri']], ['event', ['etkinlik', 'event', 'konferans', 'workshop', 'festival']]
    ];
    const domains = domainMap.filter(([, tokens]) => tokens.some(token => ` ${text} `.includes(token))).map(([name]) => ({ name, confidence: 0.8 }));
    if (!domains.length) domains.push({ name: 'unknown', confidence: 0.3 });
    const platforms: string[] = [];
    if (/web|browser|tarayıcı/.test(text)) platforms.push('web');
    if (/mobil|mobile|android|ios/.test(text)) platforms.push('mobile');
    if (/masaüstü|desktop|tauri|electron/.test(text)) platforms.push('desktop');
    return { domains, platforms, importedContext };
}

function suggestion({ kind, title, description, pros, cons, effort, impact, affectedSections, recommended = false, dependencies = [] }: SuggestionInput): SuggestionItem {
    const fingerprint = `${kind}:${title}`.toLocaleLowerCase('tr-TR').replace(/\s+/g, '-');
    return {
        id: id('suggestion'), fingerprint, kind, title, description, pros, cons, effort, impact,
        recommended, recommendationReason: recommended ? 'Mevcut fikir ve ölçek sinyalleriyle en dengeli seçenek.' : '',
        affectedSections, dependencies, status: 'pending'
    };
}

export function proposeNextOptions(project: ProjectDocumentV5, options: { direction?: string } = {}): SuggestionBundle {
    const dismissed = new Set(project.dismissedSuggestionFingerprints || []);
    const seen = new Set(project.proposalStore.bundles.flatMap(bundle => bundle.items).map(item => item.fingerprint));
    const ideaText = project.identity.originalIdea || 'Yeni Proje';
    const text = ideaText.toLowerCase();
    const direction = String(options.direction || '').trim();
    const directionText = direction ? `"${direction.slice(0, 50)}"` : `"${ideaText.slice(0, 40)}"`;

    const emptySectionIds = Object.entries(project.sections || {})
        .filter(([, s]) => s.required && !s.content && (!s.items || s.items.length === 0))
        .map(([sectionId]) => sectionId);

    const isGame = /oyun|s&box|unity|godot|unreal|engine|at|mount|fizik|arcade|yaratık|entity/.test(text);
    const isWebSaaS = /web|saas|e-ticaret|site|dashboard|portal|react|next|api|backend|veritabanı/.test(text);
    const isMobile = /mobil|mobile|ios|android|flutter|react native|app/.test(text);

    const candidates: SuggestionItem[] = [
        // Direction-driven candidate
        ...(direction ? [
            suggestion({
                kind: 'decision',
                title: `${directionText} odağında ana kararı netleştir`,
                description: `Kullanıcı yönlendirmesi doğrultusunda ${directionText} kapsamını canonical plana dahil et.`,
                pros: ['İstenilen hedefi odağa alır', 'Geliştirici yönlendirmesini uygular'],
                cons: ['İkincil hedefleri erteleyebilir'],
                effort: 'medium', impact: 'high',
                affectedSections: ['scope', 'requirements', 'decisions'],
                recommended: true
            })
        ] : []),

        // Context-driven domain candidates (feature first, decision second)
        suggestion({
            kind: 'feature',
            title: `Çekirdek kullanıcı akışını tanımla ("${ideaText.slice(0, 25)}")`,
            description: `Kullanıcının başlangıçtan hedef sonuca kadar izleyeceği ana akışı kapsamın merkezi yap.`,
            pros: ['MVP sınırını netleştirir', 'Görev üretimini kolaylaştırır'],
            cons: ['İstisna akışları sonraya bırakır'],
            effort: 'low', impact: 'high',
            affectedSections: ['vision', 'scope', 'requirements'],
            recommended: true
        }),

        suggestion({
            kind: 'decision',
            title: isMobile ? `Local-first veri & çevrimdışı senkronizasyon` : `Veri depolama & yerel durum stratejisi`,
            description: `Verinin cihazda mı, bulutta mı veya hibrit mi tutulacağını kararlaştır.`,
            pros: ['Mimari belirsizliği azaltır', 'Gizlilik sınırını belirler'],
            cons: ['Erken teknoloji kararı gerektirir'],
            effort: 'medium', impact: 'high',
            affectedSections: ['decisions', 'architecture', 'security'],
            recommended: true
        }),

        // Missing section specific candidates
        ...(emptySectionIds.includes('scope') ? [
            suggestion({
                kind: 'feature',
                title: `"${ideaText.slice(0, 30)}" için MVP sınırını çiz`,
                description: `İlk sürümde yer alacak temel işlevleri ve kapsam dışı bırakılacak özellikleri netleştir.`,
                pros: ['Aşırı planlamayı önler', 'MVP teslim süresini kısaltır'],
                cons: ['İkincil istekleri sonraya bırakır'],
                effort: 'low', impact: 'high',
                affectedSections: ['scope', 'objectives'],
                recommended: true
            })
        ] : []),

        ...(emptySectionIds.includes('architecture') ? [
            suggestion({
                kind: 'architecture',
                title: isGame ? `Server-Authority & Ağ Senkronizasyon Mimarisi` : (isWebSaaS ? `Modüler API & Veritabanı Mimarisi` : `Katmanlı Sistem & Bileşen Mimarisi`),
                description: isGame ? `Oyuncu ve nesne durumlarının sunucu yetkisinde senkronize edildiği mimari modeli seç.` : `Sistem bileşenlerini ve veri akışını modüler katmanlara böl.`,
                pros: ['Mimari belirsizlikleri giderir', 'Sürdürülebilirlik sağlar'],
                cons: ['Erken tasarım düşüncesi ister'],
                effort: 'medium', impact: 'high',
                affectedSections: ['architecture', 'decisions', 'security'],
                recommended: true
            })
        ] : []),

        ...(emptySectionIds.includes('security') ? [
            suggestion({
                kind: 'risk',
                title: `Hassas veri & yetkilendirme sınırlarını belirle`,
                description: `Yetki modeli, gizli verilerin korunması ve erişim kısıtlarını canonical plana ekle.`,
                pros: ['Güvenlik açıklarını önceden kapatır'],
                cons: ['Ek yetki doğrulama kodu gerektirir'],
                effort: 'medium', impact: 'high',
                affectedSections: ['security', 'architecture', 'requirements']
            })
        ] : []),

        suggestion({
            kind: 'risk',
            title: `Proje sürümleri ve geri alma politikası`,
            description: `Kabul edilen her büyük değişikliği sürümleyip önceki plana dönüş imkânı ekle.`,
            pros: ['Denemeyi güvenli kılar', 'Plan evrimini görünür yapar'],
            cons: ['Durum yönetimini büyütür'],
            effort: 'medium', impact: 'high',
            affectedSections: ['scope', 'requirements', 'tasks']
        }),

        suggestion({
            kind: 'feature',
            title: `İlk sürüm kabul ve başarı kriteri`,
            description: `İlk sürümün başarılı sayılması için tek bir ölçülebilir kullanıcı sonucunu belirle.`,
            pros: ['Önceliklendirmeyi sadeleştirir', 'Kabul testine dönüşür'],
            cons: ['İkincil hedefleri sonraya bırakır'],
            effort: 'low', impact: 'high',
            affectedSections: ['objectives', 'testing'],
            recommended: true
        })
    ];

    let items = candidates.filter(item => !dismissed.has(item.fingerprint) && !seen.has(item.fingerprint)).slice(0, 5);

    if (items.length < 3) {
        const round = project.proposalStore.bundles.length + 1;
        const dynamic: SuggestionItem[] = [
            suggestion({ kind: 'question', title: `Tur ${round}: ${ideaText.slice(0, 30)} kullanıcı değerini doğrula`, description: direction ? `"${direction.slice(0, 50)}" odağında en önemli sonucu kesinleştir.` : 'Bu turda en önemli kullanıcı sonucunu ve onu kanıtlayacak gözlemi kesinleştir.', pros: ['Ürün odağını korur'], cons: ['Kullanıcı araştırması gerektirebilir'], effort: 'low', impact: 'high', affectedSections: ['vision', 'objectives'] }),
            suggestion({ kind: 'risk', title: `Tur ${round}: ${ideaText.slice(0, 30)} en pahalı varsayımını test et`, description: 'Yanlış çıkarsa mimariyi veya kapsamı en çok değiştirecek varsayım için erken doğrulama görevi ekle.', pros: ['Geç yeniden çalışmayı azaltır'], cons: ['Kısa prototip gerekebilir'], effort: 'medium', impact: 'high', affectedSections: ['risks', 'tasks', 'testing'] }),
            suggestion({ kind: 'decision', title: `Tur ${round}: Sonraki kilometre taşını seç`, description: 'Bir sonraki uygulanabilir kilometre taşının çıktısını ve kabul kriterini belirle.', pros: ['Planı eyleme dönüştürür'], cons: ['Daha sonraki işleri erteler'], effort: 'low', impact: 'high', affectedSections: ['tasks', 'scope'], recommended: true })
        ];
        items = [...items, ...dynamic].slice(0, 5);
    }
    return { id: id('bundle'), title: direction ? `“${direction.slice(0, 64)}” odağında sıradaki kararlar` : 'Sıradaki etkili geliştirmeler', phase: project.lifecycle.activePhase, status: 'open', createdAt: now(), items, source: { type: 'local', providerId: 'offline' } };
}

export function updateSuggestionStatus(project: ProjectDocumentV5, bundleId: string, suggestionId: string, status: SuggestionStatus, editedDescription: string = ''): ProjectDocumentV5 {
    const next = structuredClone(project);
    const bundle = next.proposalStore.bundles.find(item => item.id === bundleId);
    const item = bundle?.items.find(entry => entry.id === suggestionId);
    if (!bundle || !item) return next;
    item.status = status;
    if (editedDescription.trim()) item.editedDescription = editedDescription.trim();
    if (status === 'rejected') next.dismissedSuggestionFingerprints.push(item.fingerprint);
    bundle.decisionComplete = bundle.items.every(entry => entry.status !== 'pending');
    bundle.status = 'open';
    next.lifecycle.updatedAt = now();
    return next;
}

function approvedItems(bundle: SuggestionBundle | undefined): SuggestionItem[] {
    return bundle?.items.filter(item => item.status === 'accepted' || item.status === 'edited') || [];
}

export function previewApprovedChanges(project: ProjectDocumentV5, bundleId: string): PlanChangePreview {
    const bundle = project.proposalStore.bundles.find(item => item.id === bundleId);
    if (!bundle) return { canApply: false, reason: 'Öneri paketi bulunamadı.', acceptedCount: 0, pendingCount: 0, sections: [], records: { decisions: 0, risks: 0 }, nextRevision: project.canonicalRevision };
    const accepted = approvedItems(bundle);
    const sectionChanges = new Map<string, SectionChangeAccumulator>();
    for (const item of accepted) {
        const description = item.editedDescription || item.description;
        for (const sectionId of item.affectedSections) {
            const section = project.sections[sectionId];
            if (!section) continue;
            let change = sectionChanges.get(sectionId);
            if (!change) {
                change = { sectionId, title: section.title, additions: [], unchanged: [], sourceSuggestionIds: [] };
                sectionChanges.set(sectionId, change);
            }
            const target = section.items.includes(description) ? change.unchanged : change.additions;
            if (!target.includes(description)) target.push(description);
            if (!change.sourceSuggestionIds.includes(item.id)) change.sourceSuggestionIds.push(item.id);
        }
    }
    const pendingCount = bundle.items.filter(item => item.status === 'pending').length;
    return {
        canApply: pendingCount === 0,
        reason: pendingCount ? `${pendingCount} seçenek hâlâ karar bekliyor.` : '',
        acceptedCount: accepted.length,
        pendingCount,
        sections: [...sectionChanges.values()],
        records: {
            decisions: accepted.filter(item => item.kind === 'decision' || item.kind === 'architecture').length,
            risks: accepted.filter(item => item.kind === 'risk').length
        },
        nextRevision: accepted.length ? project.canonicalRevision + 1 : project.canonicalRevision
    };
}

export function applyApprovedChanges(project: ProjectDocumentV5, bundleId: string): ProjectDocumentV5 {
    const next = structuredClone(project);
    const bundle = next.proposalStore.bundles.find(item => item.id === bundleId);
    if (!bundle) return project;
    if (bundle.items.some(item => item.status === 'pending')) return project;
    const accepted = approvedItems(bundle);
    if (!accepted.length) {
        bundle.status = 'resolved';
        bundle.decisionComplete = true;
        next.lifecycle.updatedAt = now();
        return recalculateReadiness(next);
    }
    const affected = new Set<string>();
    for (const item of accepted) {
        const description = item.editedDescription || item.description;
        for (const sectionId of item.affectedSections) {
            const section = next.sections[sectionId];
            if (!section) continue;
            if (!section.items.includes(description)) section.items.push(description);
            section.status = section.items.length >= 2 || section.content ? 'draft' : 'draft';
            section.sourceSuggestionIds.push(item.id);
            affected.add(sectionId);
        }
        if (item.kind === 'decision' || item.kind === 'architecture') next.decisions.push(normalizeDecision({
            id: id('decision'), title: item.title, decision: description,
            rationale: item.recommendationReason || item.pros.join('; ') || 'Kullanıcı tarafından öneri paketinden kabul edildi.',
            status: 'accepted', sourceSuggestionId: item.id, affectedSectionIds: item.affectedSections
        }));
        if (item.kind === 'risk') next.risks.push(normalizeRisk({ id: id('risk'), title: item.title, description, status: 'open', sourceSuggestionId: item.id }));
        if (item.kind === 'feature' && item.affectedSections.includes('objectives')) next.objectives.push(normalizeObjective({ id: id('objective'), title: item.title, description, status: 'accepted', sourceSuggestionIds: [item.id] }));
        if (item.kind === 'feature' && item.affectedSections.includes('requirements')) next.requirements.push(normalizeRequirement({
            id: id('requirement'), title: item.title, statement: description,
            acceptanceCriteria: [`${item.title} davranışı doğrulanabilir bir kabul testini geçmeli.`],
            status: 'accepted', sourceSuggestionIds: [item.id]
        }));
        if (item.kind === 'feature' && item.affectedSections.includes('tasks')) next.tasks.push(normalizeTask({ id: id('task'), title: item.title, description, status: 'backlog', sourceSuggestionIds: [item.id] }));
    }
    next.documentRevision += 1;
    next.canonicalRevision += 1;
    for (const sectionId of affected) next.sections[sectionId].updatedAtRevision = next.canonicalRevision;
    next.lifecycle.activePhase = inferNextPhase(next);
    next.lifecycle.updatedAt = now();
    bundle.status = 'resolved';
    bundle.decisionComplete = true;
    createRevision(next, `Öneri paketi uygulandı: ${bundle.title}`, accepted.map(item => item.id), [...affected]);
    return recalculateReadiness(next);
}

function inferNextPhase(project: ProjectDocumentV5): PlanningPhase {
    const required = getRequiredSections(project.planningDepth.selected);
    const firstIncomplete = required.find(sectionId => project.sections[sectionId]?.status === 'empty');
    return firstIncomplete ? (SECTION_PHASE[firstIncomplete] || PLANNING_PHASES.SHAPING) : PLANNING_PHASES.REVIEW;
}

export function updatePlanSection(project: ProjectDocumentV5, sectionId: string, { content, items }: { content?: string; items?: string[] } = {}): ProjectDocumentV5 {
    const next = structuredClone(project);
    const section = next.sections[sectionId];
    if (!section) return project;
    if (typeof content === 'string') section.content = content.trim();
    if (Array.isArray(items)) section.items = items.map(String).map(item => item.trim()).filter(Boolean);
    section.status = section.content || section.items.length ? 'draft' : 'empty';
    next.documentRevision += 1;
    next.canonicalRevision += 1;
    section.updatedAtRevision = next.canonicalRevision;
    for (const dependentId of SECTION_DEPENDENTS[sectionId] || []) {
        const dependent = next.sections[dependentId];
        if (!dependent || (!dependent.content && !dependent.items.length)) continue;
        dependent.status = 'stale';
        const warning = `${section.title} değiştiği için bu bölüm yeniden doğrulanmalı.`;
        if (!dependent.warnings.includes(warning)) dependent.warnings.push(warning);
    }
    next.lifecycle.updatedAt = now();
    createRevision(next, `${section.title} güncellendi`, [], [sectionId]);
    return recalculateReadiness(next);
}

export function overridePlanningDepth(project: ProjectDocumentV5, selected: PlanningDepthLevel): ProjectDocumentV5 {
    if (!DEPTH_ORDER.includes(selected)) return project;
    const next = recalculateReadiness(applyDepthSelection(project, selected, true));
    createRevision(next, `Plan derinliği ${selected} olarak değiştirildi`, [], getRequiredSections(selected));
    return next;
}

export function recalculateReadiness(project: ProjectDocumentV5): ProjectDocumentV5 {
    const next = structuredClone(project);
    const result = calculateReadiness(next);
    next.metadata = { ...(next.metadata || {}), traceability: { revision: next.canonicalRevision, stats: result.traceability.stats, coverage: result.traceability.coverage, health: result.traceability.health } };
    next.readiness = result.readiness;
    return next;
}

export function finalizePlan(project: ProjectDocumentV5): { success: boolean; project: ProjectDocumentV5; blockers: string[] } {
    // No `force` override here, and none is coming back: the old `.d.ts` sidecar
    // declared `finalizePlan(project, force?: boolean)`, but the actual implementation
    // had already dropped `force` in 2acd7ba ("harden guided planning and readiness
    // gates") -- the sidecar simply never caught up, so the type lied about an override
    // that could never happen (`Workspace.tsx` passed `finalizePlan(project, false)`,
    // which always was, and remains, a no-op). This isn't an oversight to restore:
    // tests/v4/readiness-service.test.ts asserts `finalizePlan(result, true).success`
    // is `false` when hard blockers are present ("Kritik tamamlanma kapıları force ile
    // atlanamamalı" -- critical completion gates must not be skippable with force), and
    // there is no "force finalize" affordance anywhere in the UI (FinalizePlanDialog
    // only ever displays blockers). Blocked means blocked.
    const next = recalculateReadiness(project);
    if (next.readiness.blockers.length) return { success: false, project: next, blockers: next.readiness.blockers };
    next.lifecycle.status = 'finalized';
    next.lifecycle.activePhase = PLANNING_PHASES.READY;
    next.lifecycle.finalizedAt = now();
    next.lifecycle.updatedAt = now();
    next.documentRevision += 1;
    next.canonicalRevision += 1;
    createRevision(next, next.readiness.warnings.length ? 'Plan uyarılar değerlendirilerek finalleştirildi' : 'Plan finalleştirildi', [], []);
    return { success: true, project: next, blockers: [] };
}

export function reopenPlan(project: ProjectDocumentV5): ProjectDocumentV5 {
    const next = structuredClone(project);
    next.lifecycle.status = 'active';
    next.lifecycle.activePhase = PLANNING_PHASES.SHAPING;
    next.lifecycle.finalizedAt = null;
    next.lifecycle.updatedAt = now();
    next.documentRevision += 1;
    next.canonicalRevision += 1;
    for (const section of Object.values(next.sections)) if (section.status === 'ready') section.status = 'draft';
    createRevision(next, 'Plan yeniden geliştirmeye açıldı', [], []);
    return next;
}

export function addExplorationMessage(project: ProjectDocumentV5, role: 'user' | 'assistant', content: string): ProjectDocumentV5 {
    const next = structuredClone(project);
    next.messages.push({ id: id('msg'), role, content: String(content || '').trim(), createdAt: now() });
    next.lifecycle.updatedAt = now();
    return next;
}

function resolveRevisionState(project: ProjectDocumentV5, reference: RevisionReference): RevisionSnapshot | null {
    if (reference === 'current' || reference === project.canonicalRevision || reference == null) return project;
    const candidates = project.revisions.filter(revision => revision.id === reference || revision.number === Number(reference));
    return candidates.at(-1)?.snapshot || null;
}

function lines(value: string): string[] {
    return String(value || '').replace(/\r\n/g, '\n').split('\n');
}

export function diffTextLines(before: string = '', after: string = ''): Array<{ type: 'equal' | 'added' | 'removed'; text: string }> {
    const left = lines(before);
    const right = lines(after);
    const table = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
    for (let i = left.length - 1; i >= 0; i -= 1) {
        for (let j = right.length - 1; j >= 0; j -= 1) table[i][j] = left[i] === right[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
    const changes: Array<{ type: 'equal' | 'added' | 'removed'; text: string }> = [];
    let i = 0; let j = 0;
    while (i < left.length || j < right.length) {
        if (i < left.length && j < right.length && left[i] === right[j]) { changes.push({ type: 'equal', text: left[i] }); i += 1; j += 1; }
        else if (j < right.length && (i === left.length || table[i][j + 1] > table[i + 1][j])) { changes.push({ type: 'added', text: right[j] }); j += 1; }
        else { changes.push({ type: 'removed', text: left[i] }); i += 1; }
    }
    return changes;
}

export function comparePlanRevisions(project: ProjectDocumentV5, fromReference: RevisionReference, toReference: RevisionReference = 'current'): RevisionComparison {
    const from = resolveRevisionState(project, fromReference);
    const to = resolveRevisionState(project, toReference);
    if (!from || !to) return { valid: false, reason: 'Karşılaştırılacak revision bulunamadı.', from: null, to: null, sections: [], summary: { changedSections: 0, addedLines: 0, removedLines: 0, addedItems: 0, removedItems: 0 } };
    const sectionIds = new Set([...Object.keys(from.sections || {}), ...Object.keys(to.sections || {})]);
    const sections: RevisionComparison['sections'] = [];
    const summary = { changedSections: 0, addedLines: 0, removedLines: 0, addedItems: 0, removedItems: 0 };
    for (const sectionId of sectionIds) {
        const before: PlanSectionSnapshot = from.sections?.[sectionId] || { title: sectionId, content: '', items: [], status: 'empty' };
        const after: PlanSectionSnapshot = to.sections?.[sectionId] || { title: sectionId, content: '', items: [], status: 'empty' };
        const content = diffTextLines(before.content, after.content);
        const addedItems = (after.items || []).filter(item => !(before.items || []).includes(item));
        const removedItems = (before.items || []).filter(item => !(after.items || []).includes(item));
        const addedLines = content.filter(line => line.type === 'added' && line.text).length;
        const removedLines = content.filter(line => line.type === 'removed' && line.text).length;
        if (!addedLines && !removedLines && !addedItems.length && !removedItems.length && before.status === after.status) continue;
        sections.push({ sectionId, title: after.title || before.title, beforeStatus: before.status, afterStatus: after.status, content, addedItems, removedItems });
        summary.changedSections += 1; summary.addedLines += addedLines; summary.removedLines += removedLines;
        summary.addedItems += addedItems.length; summary.removedItems += removedItems.length;
    }
    return {
        valid: true,
        from: { revision: from.canonicalRevision, label: `r${from.canonicalRevision}` },
        to: { revision: to.canonicalRevision, label: `r${to.canonicalRevision}` },
        sections, summary
        // `metadataChanges` (planningDepth/lifecycleStatus before-after) used to be
        // computed here but was never part of the `RevisionComparison` contract and has
        // zero consumers anywhere in the repo (RevisionHistoryDialog only reads `valid`,
        // `summary`, `sections`) -- dropped rather than smuggled through with a cast.
    };
}

export function captureCurrentRevision(project: ProjectDocumentV5, summary: string = 'Proje başlangıcı'): ProjectDocumentV5 {
    if (project.revisions.some(revision => revision.number === project.canonicalRevision)) return project;
    const next = structuredClone(project);
    createRevision(next, summary, [], Object.keys(next.sections || {}).filter(sectionId => next.sections[sectionId].content || next.sections[sectionId].items.length));
    return next;
}

export function restorePlanRevision(project: ProjectDocumentV5, reference: RevisionReference): { success: boolean; project: ProjectDocumentV5; reason: string; restoredFromRevision?: number } {
    const snapshot = resolveRevisionState(project, reference);
    if (!snapshot || snapshot === project) return { success: false, project, reason: 'Geri yüklenecek geçmiş revision bulunamadı.' };
    const comparison = comparePlanRevisions(project, 'current', reference);
    const next = structuredClone(project);
    next.identity = structuredClone(snapshot.identity);
    next.planningDepth = structuredClone(snapshot.planningDepth);
    next.profile = structuredClone(snapshot.profile);
    next.sections = structuredClone(snapshot.sections);
    next.decisions = structuredClone(snapshot.decisions || []);
    next.tasks = structuredClone(snapshot.tasks || []);
    next.risks = structuredClone(snapshot.risks || []);
    next.openQuestions = structuredClone(snapshot.openQuestions || []);
    next.ideaDiscussion = structuredClone(snapshot.ideaDiscussion || project.ideaDiscussion);
    next.documentRevision = project.documentRevision + 1;
    next.canonicalRevision = project.canonicalRevision + 1;
    next.lifecycle = { ...next.lifecycle, status: 'active', activePhase: snapshot.lifecycle?.activePhase || PLANNING_PHASES.SHAPING, finalizedAt: null, updatedAt: now() };
    next.exports = structuredClone(project.exports || []);
    next.revisions = structuredClone(project.revisions || []);
    next.messages = structuredClone(project.messages || []);
    next.proposalStore = { bundles: structuredClone(project.proposalStore?.bundles || []) };
    next.commandLog = structuredClone(project.commandLog || []);
    next.dismissedSuggestionFingerprints = structuredClone(project.dismissedSuggestionFingerprints || []);
    next.metadata = { ...structuredClone(project.metadata || {}), restoredFromRevision: snapshot.canonicalRevision };
    for (const section of Object.values(next.sections)) if (comparison.sections.some(change => change.sectionId === section.id)) section.updatedAtRevision = next.canonicalRevision;
    const recalculated = recalculateReadiness(next);
    createRevision(recalculated, `r${snapshot.canonicalRevision} sürümünden geri yüklendi`, [], comparison.sections.map(section => section.sectionId));
    return { success: true, project: recalculated, reason: '', restoredFromRevision: snapshot.canonicalRevision };
}

function createRevision(project: ProjectDocumentV5, summary: string, acceptedSuggestionIds: string[], affectedSections: string[]): void {
    const snapshotSource = structuredClone(project);
    snapshotSource.revisions = [];
    project.revisions.push({ id: id('revision'), number: project.canonicalRevision, createdAt: now(), summary, acceptedSuggestionIds, affectedSections, snapshot: snapshotSource });
}

export function confirmConceptSummary(project: ProjectDocumentV5): ProjectDocumentV5 {
    const next = structuredClone(project);
    const ideaLabSession = next.ideaLabSession;
    if (!ideaLabSession || !ideaLabSession.conceptSummary) {
        throw new Error('Onaylanacak bir konsept özeti bulunamadı.');
    }
    const summary = ideaLabSession.conceptSummary;

    const agreementGate = getConceptAgreementGate(next);
    if (!agreementGate.ready) {
        throw new Error(`${agreementGate.unresolvedCount} yorum, kapsam veya fikir kaydı henüz tamamlanmadı.`);
    }

    summary.userConfirmed = true;
    summary.confirmedAt = now();
    ideaLabSession.status = 'confirmed';

    // Populate Canonical Entities from Concept Summary
    if (summary.summary && next.sections.vision) {
        // Boş alan YAZILMAZ; aşama modelindeki belgede bu dört yorum alanı yok
        // ve satırlar koşulsuz yazıldığında vizyona "Hedef kullanıcı: undefined"
        // düşüyordu. Kullanıcının kurmadığı cümleyi ona atfetmemenin yazma
        // tarafındaki karşılığı budur.
        next.sections.vision.content = [
            summary.summary,
            summary.targetUser ? `Hedef kullanıcı: ${summary.targetUser}` : '',
            summary.problemStatement ? `Problem: ${summary.problemStatement}` : '',
            summary.currentAlternative ? `Mevcut çözüm: ${summary.currentAlternative}` : '',
            summary.desiredOutcome ? `Beklenen sonuç: ${summary.desiredOutcome}` : ''
        ].filter(Boolean).join('\n\n');
        next.sections.vision.status = 'draft';
    }
    if (summary.confirmedFeatures && next.sections.scope) {
        next.sections.scope.items = [...new Set([...next.sections.scope.items, ...summary.confirmedFeatures])];
        // Boş alan YAZILMAZ. Aşama modelindeki belgede `mvpTarget` yok (V3 o
        // soruyu sormuyor) ve satır koşulsuz yazıldığında plana
        // "MVP hedefi: undefined" düşüyordu.
        next.sections.scope.content = [
            summary.mvpTarget ? `MVP hedefi: ${summary.mvpTarget}` : '',
            summary.outOfScope.length
                ? `Kapsam dışı:\n${summary.outOfScope.map(item => `- ${item}`).join('\n')}`
                : ''
        ].filter(Boolean).join('\n\n');
        next.sections.scope.status = 'draft';
    }
    next.identity.summary = summary.summary;
    next.identity.desiredOutcome = summary.desiredOutcome;
    if (summary.technicalApproaches && next.sections.architecture) {
        next.sections.architecture.items = [...new Set([...next.sections.architecture.items, ...summary.technicalApproaches])];
        next.sections.architecture.status = 'draft';
    }
    if (summary.knownRisks && next.sections.risks) {
        next.sections.risks.items = [...new Set([...next.sections.risks.items, ...summary.knownRisks])];
        next.sections.risks.status = 'draft';
        for (const riskTitle of summary.knownRisks) {
            if (!next.risks.some(r => r.title === riskTitle)) {
                next.risks.push(normalizeRisk({ id: id('risk'), title: riskTitle, description: 'Konsept aşamasında tespit edilen risk', status: 'open', sourceSuggestionId: '' }));
            }
        }
    }

    for (const record of agreementGate.accepted) {
        if (record.kind === 'decision' && !next.decisions.some(item => item.decision === record.text)) {
            next.decisions.push(normalizeDecision({
                id: id('decision'),
                title: record.text,
                decision: record.text,
                rationale: record.rationale || record.note || 'Fikir tartışması sırasında kullanıcı tarafından kabul edildi.',
                status: 'accepted',
                sourceSuggestionId: record.sourceBundleId,
                affectedSectionIds: ['decisions', 'architecture']
            }));
        }
        if (record.kind === 'risk' && !next.risks.some(item => item.title === record.text)) {
            next.risks.push(normalizeRisk({
                id: id('risk'),
                title: record.text,
                description: record.note || 'Fikir tartışması sırasında kullanıcı tarafından kabul edilen risk.',
                status: 'open',
                sourceSuggestionId: record.sourceBundleId
            }));
        }
        if (record.kind === 'hypothesis' && !next.assumptions.some(item => item.statement === record.text)) {
            next.assumptions.push(normalizeAssumption({
                id: id('assumption'),
                statement: record.text,
                confidence: 'medium',
                validationPlan: record.validationPlan || 'Planlama sırasında kanıtla veya geçersiz kıl.',
                status: 'open'
            }));
        }
    }

    next.lifecycle.activePhase = PLANNING_PHASES.SHAPING;
    next.lifecycle.updatedAt = now();
    next.documentRevision += 1;
    next.canonicalRevision += 1;

    const recalculated = recalculateReadiness(next);
    createRevision(recalculated, 'Konsept özeti onaylandı ve canonical plan başlatıldı', [], ['vision', 'scope', 'architecture', 'risks']);
    return recalculated;
}

export function applyExtensionModules(project: ProjectDocumentV5, extensionPackageNames: string[] = []): ProjectDocumentV5 {
    const next = structuredClone(project);
    if (!Array.isArray(extensionPackageNames) || !extensionPackageNames.length) return project;

    const added: string[] = [];
    for (const pkgName of extensionPackageNames) {
        const taskTitle = `[Modül] ${pkgName} Geliştirmesi`;
        if (!next.tasks.some(t => t.title === taskTitle)) {
            next.tasks.push(normalizeTask({
                id: id('task'),
                title: taskTitle,
                description: `İsteğe bağlı ${pkgName} geliştirme paketi entegrasyonu`,
                status: 'backlog',
                sourceSuggestionIds: []
            }));
            added.push(pkgName);
        }
    }

    if (!added.length) return project;

    if (next.sections.scope) {
        next.sections.scope.items.push(...added.map(name => `İsteğe Bağlı Modül: ${name}`));
        next.sections.scope.status = 'draft';
    }

    next.documentRevision += 1;
    next.canonicalRevision += 1;
    next.lifecycle.updatedAt = now();

    const recalculated = recalculateReadiness(next);
    createRevision(recalculated, `İsteğe bağlı modüller eklendi: ${added.join(', ')}`, [], ['scope', 'tasks']);
    return recalculated;
}

export function runConceptSimulation(project: ProjectDocumentV5, approachId: string): {
    riskCount: number;
    taskEstimate: number;
    completenessScore: number;
} {
    const session = project.ideaLabSession;
    if (!session) return { riskCount: 1, taskEstimate: 5, completenessScore: 70 };

    const approach = (session.approaches || []).find(a => a.id === approachId) || session.approaches?.[0];
    const riskCount = approach?.risks?.length || 2;
    const effortScore = approach?.metrics?.effortScore || (approach?.effort === 'high' ? 5 : approach?.effort === 'medium' ? 3 : 1);
    const taskEstimate = effortScore * 4 + 3;
    const completenessScore = Math.min(95, 60 + (approach?.pros?.length || 0) * 10);

    return { riskCount, taskEstimate, completenessScore };
}
