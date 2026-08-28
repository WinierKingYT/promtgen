import { normalizeConcern, normalizeConcernDecision } from './application/concerns.js';
import { STAGE_STATUSES } from './application/project-stages.js';
import { normalizeTechnologyCandidate } from './application/solution-design.js';
import { emptyPlanAlignment, evaluatePlanAlignment } from './domain/idea-plan-alignment.js';
import type {
    AgentPrompt,
    Assumption,
    Concern,
    ConcernDecision,
    Decision,
    DecisionStage,
    Evidence,
    ExecutionSession,
    IdeaDiscussionMode,
    IdeaDocumentRevision,
    IdeaRecordKind,
    IdeaRecordStatus,
    ImpactAnalysis,
    ImplementationEvidencePackage,
    Magnitude,
    Milestone,
    Objective,
    PlanningScenario,
    Priority,
    ProjectDocumentV5,
    ProjectFraming,
    ReadinessDimension,
    ReadinessDimensionEvidence,
    Requirement,
    ResearchQuestion,
    ResearchSource,
    ReviewFinding,
    Risk,
    SectionPatchProposal,
    SimulationRun,
    StageApproval,
    Task,
    TaskContractV2,
    TestCase,
    TraceLink
} from './contracts.js';

const CANONICAL_MODEL_VERSION = 1;

function text(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value.trim() : fallback;
}

function list(value: unknown): string[] {
    return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}

/**
 * `Number(x || 0)` deseninin DÜZELTİLMİŞ karşılığı. Eski desen yalnız
 * FALSY değerlerde `|| 0` korumasına düşer; `'abc'` gibi truthy ama sayısal
 * olmayan bir değer korumayı atlar ve `Number('abc')` sessizce `NaN` döner.
 * `NaN` hiçbir yerde hata fırlatmadan aşağı akışa yayılır (her karşılaştırma
 * `false` döner), bu da bozuk/AI üretimi bir değerin sessizce yanlış
 * davranışa yol açması demektir. Bu yardımcı yalnız GERÇEK sayıları ve
 * SAYISAL string'leri kabul eder (kasıtlı karar: `'7'` gibi sayısal
 * string'ler zararsız olduğu için hâlâ sayıya çevrilir); `NaN`,
 * `Infinity`/`-Infinity`, boş/sayısal-olmayan string, `null`, `undefined`,
 * `boolean`, dizi ve nesne dâhil sonlu bir sayıya çevrilemeyen HER ŞEY
 * `fallback`'e düşer, asla `NaN` dönmez.
 */
function finiteNumber(value: unknown, fallback = 0): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return fallback;
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
}

/**
 * `[...].includes(value)` için tip-güvenli karşılık. Davranış birebir aynı:
 * `value` string değilse zaten hiçbir whitelist elemanına eşit olamaz, o
 * yüzden `typeof value === 'string'` koruması sonucu değiştirmez, yalnız
 * TypeScript'in `value`yi whitelist'in literal birleşim tipine daraltmasını
 * sağlar.
 */
function oneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
    const candidates: readonly string[] = options;
    return typeof value === 'string' && candidates.includes(value);
}

function entityId(prefix: string, value: { id?: unknown } | undefined, index: number): string {
    if (value?.id && typeof value.id === 'string') return value.id;
    return `${prefix}-${index + 1}`;
}

// `Objective` sözleşmesinde olmayan `text` alanı, eski çağıranların hâlâ
// gönderebildiği bir takma ad. `Record<string, unknown>` yerine yalnız bu tek
// alanı ekleyen dar bir kesişim kullanılıyor: aksi hâlde gerçek bir
// `Objective` değeri (ör. `(next.objectives || []).map(normalizeObjective)`
// çağrısındaki dizi elemanları) parametre tipine atanamaz hâle gelirdi --
// `Objective` arayüzünde index imzası yok, `Record<string, unknown>` onu ister.
type ObjectiveInput = Partial<Objective> & { text?: unknown };

export function normalizeObjective(value: string | ObjectiveInput = {}, index = 0): Objective {
    const source: ObjectiveInput = typeof value === 'string' ? { title: value } : value;
    return {
        id: entityId('obj', source, index),
        title: text(source.title || source.description || source.text, `Hedef ${index + 1}`),
        description: text(source.description || source.text),
        metric: text(source.metric),
        target: text(source.target),
        priority: oneOf<Priority>(source.priority, ['must', 'should', 'could']) ? source.priority : 'should',
        status: oneOf<Objective['status']>(source.status, ['draft', 'accepted', 'achieved']) ? source.status : 'draft',
        sourceSuggestionIds: list(source.sourceSuggestionIds)
    };
}

type RequirementInput = Partial<Requirement> & { description?: unknown; text?: unknown };

export function normalizeRequirement(value: string | RequirementInput = {}, index = 0): Requirement {
    const source: RequirementInput = typeof value === 'string' ? { statement: value } : value;
    return {
        id: entityId('req', source, index),
        title: text(source.title || source.statement || source.description, `Gereksinim ${index + 1}`),
        statement: text(source.statement || source.description || source.text || source.title),
        kind: oneOf<Requirement['kind']>(source.kind, ['functional', 'quality', 'constraint']) ? source.kind : 'functional',
        priority: oneOf<Priority>(source.priority, ['must', 'should', 'could']) ? source.priority : 'should',
        acceptanceCriteria: list(source.acceptanceCriteria),
        sourceObjectiveIds: list(source.sourceObjectiveIds),
        sourceSuggestionIds: list(source.sourceSuggestionIds),
        status: oneOf<Requirement['status']>(source.status, ['draft', 'accepted', 'implemented', 'verified']) ? source.status : 'draft'
    };
}

type DecisionInput = Partial<Decision> & { description?: unknown; reason?: unknown; affectedSections?: unknown };

export function normalizeDecision(value: string | DecisionInput = {}, index = 0): Decision {
    const source: DecisionInput = typeof value === 'string' ? { decision: value } : value;
    return {
        id: entityId('dec', source, index),
        title: text(source.title || source.decision, `Karar ${index + 1}`),
        decision: text(source.decision || source.description || source.title),
        rationale: text(source.rationale || source.reason),
        alternatives: list(source.alternatives),
        consequences: list(source.consequences),
        status: oneOf<Decision['status']>(source.status, ['proposed', 'accepted', 'superseded']) ? source.status : 'accepted',
        sourceSuggestionId: text(source.sourceSuggestionId),
        affectedSectionIds: list(source.affectedSectionIds || source.affectedSections),
        // V3 aşama sınıflandırması. Eski belgelerden gelen kararlar SESSIZCE
        // sınıflandırılmaz: AI tahminiyle "bu fikir kararı, şu teknik karar"
        // demek, kullanıcının hiç vermediği bir kararı ona atfetmek olurdu.
        stage: oneOf<DecisionStage>(source.stage, ['idea', 'technical', 'legacy-unclassified'])
            ? source.stage
            : 'legacy-unclassified',
        // Kanıt ve reddedilen alternatifler kalıcılıktan sağ çıkmak ZORUNDA:
        // geçersizleştirme grafiği tamamen `evidence` kenarlarına dayanıyor ve
        // `rejectedAlternatives` olmadan karar bir ADR olmaktan çıkar. Alanlar
        // opsiyonel, çünkü V3 öncesi kararlarda yok; ama varlarsa korunurlar.
        ...(source.evidence ? {
            evidence: {
                ideaDecisionIds: list(source.evidence.ideaDecisionIds),
                ideaConcernIds: list(source.evidence.ideaConcernIds)
            }
        } : {}),
        ...(Array.isArray(source.rejectedAlternatives) ? {
            rejectedAlternatives: source.rejectedAlternatives
                .map(item => ({
                    candidateId: text(item?.candidateId),
                    title: text(item?.title),
                    reason: text(item?.reason)
                }))
                .filter(item => item.title)
        } : {})
    };
}

type AssumptionInput = Partial<Assumption> & { description?: unknown; text?: unknown };

export function normalizeAssumption(value: string | AssumptionInput = {}, index = 0): Assumption {
    const source: AssumptionInput = typeof value === 'string' ? { statement: value } : value;
    return {
        id: entityId('asm', source, index),
        statement: text(source.statement || source.description || source.text),
        confidence: oneOf<Magnitude>(source.confidence, ['low', 'medium', 'high']) ? source.confidence : 'medium',
        validationPlan: text(source.validationPlan),
        status: oneOf<Assumption['status']>(source.status, ['open', 'validated', 'invalidated']) ? source.status : 'open'
    };
}

export function normalizeRisk(value: string | Partial<Risk> = {}, index = 0): Risk {
    const source: Partial<Risk> = typeof value === 'string' ? { title: value } : value;
    return {
        id: entityId('risk', source, index),
        title: text(source.title || source.description, `Risk ${index + 1}`),
        description: text(source.description || source.title),
        probability: oneOf<Magnitude>(source.probability, ['low', 'medium', 'high']) ? source.probability : 'medium',
        impact: oneOf<Magnitude>(source.impact, ['low', 'medium', 'high']) ? source.impact : 'medium',
        mitigation: text(source.mitigation),
        owner: text(source.owner),
        status: oneOf<Risk['status']>(source.status, ['open', 'mitigated', 'accepted']) ? source.status : 'open',
        sourceSuggestionId: text(source.sourceSuggestionId)
    };
}

// `sourceSuggestionIds` `Task` sözleşmesinin bir parçası değil (yalnız
// `Objective`/`Requirement`'ta var), ama bazı çağıranlar (`planning-engine.ts`)
// onu yine de gönderiyor -- orijinal JS bunu sessizce yok sayıyordu, bu tip de
// aynısını yapabilsin diye kabul ediyor.
type TaskInput = Partial<Task> & { sourceSuggestionIds?: unknown };

export function normalizeTask(value: string | TaskInput = {}, index = 0): Task {
    const source: TaskInput = typeof value === 'string' ? { title: value } : value;
    const contract: Partial<TaskContractV2> = source.contract && typeof source.contract === 'object' ? source.contract : {};
    const filePolicy: Partial<TaskContractV2['filePolicy']> = contract.filePolicy && typeof contract.filePolicy === 'object' ? contract.filePolicy : {};
    const verification: Partial<TaskContractV2['verification']> = contract.verification && typeof contract.verification === 'object' ? contract.verification : {};
    const objective = text(contract.objective || source.description || source.title, `Görev ${index + 1}`);
    const inScope = list(contract.inScope);
    const outOfScope = list(contract.outOfScope);
    const allowedPaths = list(filePolicy.allowedPaths);
    const forbiddenPaths = list(filePolicy.forbiddenPaths);
    const testCaseIds = list(verification.testCaseIds || source.verificationIds);
    const commands = list(verification.commands);
    const expectedOutputs = list(contract.expectedOutputs);
    const completionEvidence = list(contract.completionEvidence);
    return {
        id: entityId('task', source, index),
        title: text(source.title || source.description, `Görev ${index + 1}`),
        description: text(source.description),
        status: oneOf<Task['status']>(source.status, ['backlog', 'ready', 'in_progress', 'blocked', 'done']) ? source.status : 'backlog',
        priority: oneOf<Priority>(source.priority, ['must', 'should', 'could']) ? source.priority : 'should',
        effort: oneOf<Magnitude>(source.effort, ['low', 'medium', 'high']) ? source.effort : 'medium',
        dependencies: list(source.dependencies),
        requirementIds: list(source.requirementIds),
        acceptanceCriteria: list(source.acceptanceCriteria),
        verificationIds: list(source.verificationIds),
        contract: {
            version: 2,
            objective,
            inScope: inScope.length ? inScope : [objective],
            outOfScope: outOfScope.length ? outOfScope : ['Canonical görev kapsamı dışındaki değişiklikler'],
            filePolicy: {
                status: oneOf<TaskContractV2['filePolicy']['status']>(filePolicy.status, ['requires_inventory', 'inferred', 'confirmed'])
                    ? filePolicy.status
                    : (allowedPaths.length ? 'inferred' : 'requires_inventory'),
                allowedPaths,
                forbiddenPaths: forbiddenPaths.length
                    ? forbiddenPaths
                    : ['.git/**', '.env*', '**/*.pem', '**/*secret*', 'node_modules/**', 'dist/**', 'target/**']
            },
            verification: {
                testCaseIds,
                commands,
                requiresCommandDiscovery: typeof verification.requiresCommandDiscovery === 'boolean'
                    ? verification.requiresCommandDiscovery
                    : commands.length === 0
            },
            expectedOutputs: expectedOutputs.length
                ? expectedOutputs
                : ['Değiştirilen dosyaların listesi', 'Kabul kriteri ve test kanıtı', 'Kalan riskler'],
            completionEvidence: completionEvidence.length
                ? completionEvidence
                : ['Değişiklik özeti', 'Doğrulama çıktısı'],
            rollbackPlan: text(contract.rollbackPlan, 'Değişiklikleri görev bazlı patch olarak tut; doğrulama başarısızsa yalnız bu görevin patchini geri al.')
        }
    };
}

type TestCaseInput = Partial<TestCase> & { description?: unknown };

export function normalizeTestCase(value: string | TestCaseInput = {}, index = 0): TestCase {
    const source: TestCaseInput = typeof value === 'string' ? { title: value } : value;
    return {
        id: entityId('test', source, index),
        title: text(source.title || source.description, `Test ${index + 1}`),
        kind: oneOf<TestCase['kind']>(source.kind, ['unit', 'integration', 'e2e', 'security', 'acceptance']) ? source.kind : 'acceptance',
        preconditions: list(source.preconditions),
        steps: list(source.steps),
        expectedResult: text(source.expectedResult),
        requirementIds: list(source.requirementIds),
        status: oneOf<TestCase['status']>(source.status, ['draft', 'ready', 'passed', 'failed']) ? source.status : 'draft'
    };
}

type MilestoneInput = Partial<Milestone> & { description?: unknown };

export function normalizeMilestone(value: string | MilestoneInput = {}, index = 0): Milestone {
    const source: MilestoneInput = typeof value === 'string' ? { title: value } : value;
    return {
        id: entityId('milestone', source, index),
        // KASITLI DÜZELTME (eskiden kusurdu): title yalnız `source.title`dan
        // geliyordu, `description`e hiç düşmüyordu - aynı fonksiyonun kendi
        // `outcome` alanı description'a yedeklenirken bile. Kardeş
        // normalizer'lar `normalizeObjective`/`normalizeRisk`, title için
        // `title || description` örüntüsünü kullanıyor; burası artık
        // `normalizeRisk` ile AYNI şekle (öncelik: title, sonra description,
        // ikisi de yoksa `Kilometre taşı N`) getirildi.
        title: text(source.title || source.description, `Kilometre taşı ${index + 1}`),
        outcome: text(source.outcome || source.description),
        taskIds: list(source.taskIds),
        targetDate: text(source.targetDate),
        status: oneOf<Milestone['status']>(source.status, ['planned', 'active', 'complete']) ? source.status : 'planned'
    };
}

export function normalizeTraceLink(value: Partial<TraceLink> = {}, index = 0): TraceLink {
    const source: Partial<TraceLink> = typeof value === 'object' && value ? value : {};
    return {
        id: entityId('trace', source, index),
        fromType: text(source.fromType), fromId: text(source.fromId),
        toType: text(source.toType), toId: text(source.toId),
        relation: text(source.relation, 'supports')
    };
}

export function normalizeAgentPrompt(value: Partial<AgentPrompt> = {}, index = 0): AgentPrompt {
    const source: Partial<AgentPrompt> = typeof value === 'object' && value ? value : {};
    return {
        id: entityId('prompt', source, index),
        role: oneOf<AgentPrompt['role']>(source.role, ['planner', 'implementer', 'reviewer', 'verifier']) ? source.role : 'implementer',
        title: text(source.title, `Ajan promptu ${index + 1}`),
        instructions: text(source.instructions),
        taskIds: list(source.taskIds),
        dependsOnPromptIds: list(source.dependsOnPromptIds),
        expectedOutputs: list(source.expectedOutputs),
        status: oneOf<AgentPrompt['status']>(source.status, ['draft', 'ready', 'used', 'verified']) ? source.status : 'draft'
    };
}

type ResearchQuestionInput = Partial<ResearchQuestion> & { title?: unknown };

export function normalizeResearchQuestion(value: string | ResearchQuestionInput = {}, index = 0): ResearchQuestion {
    const source: ResearchQuestionInput = typeof value === 'string' ? { question: value } : value;
    return {
        id: entityId('research-question', source, index),
        question: text(source.question || source.title),
        rationale: text(source.rationale),
        priority: oneOf<Magnitude>(source.priority, ['low', 'medium', 'high']) ? source.priority : 'medium',
        status: oneOf<ResearchQuestion['status']>(source.status, ['proposed', 'active', 'answered', 'dismissed']) ? source.status : 'proposed',
        affectedSectionIds: list(source.affectedSectionIds)
    };
}

export function normalizeResearchSource(value: Partial<ResearchSource> = {}, index = 0): ResearchSource {
    const source: Partial<ResearchSource> = typeof value === 'object' && value ? value : {};
    return {
        id: entityId('source', source, index),
        title: text(source.title, `Kaynak ${index + 1}`),
        url: text(source.url),
        publisher: text(source.publisher),
        sourceType: oneOf<ResearchSource['sourceType']>(source.sourceType, ['primary', 'secondary', 'unknown']) ? source.sourceType : 'unknown',
        accessedAt: text(source.accessedAt),
        status: oneOf<ResearchSource['status']>(source.status, ['candidate', 'approved', 'rejected']) ? source.status : 'candidate',
        questionIds: list(source.questionIds)
    };
}

export function normalizeEvidence(value: Partial<Evidence> = {}, index = 0): Evidence {
    const source: Partial<Evidence> = typeof value === 'object' && value ? value : {};
    return {
        id: entityId('evidence', source, index),
        claim: text(source.claim),
        summary: text(source.summary),
        sourceId: text(source.sourceId),
        questionId: text(source.questionId),
        confidence: oneOf<Magnitude>(source.confidence, ['low', 'medium', 'high']) ? source.confidence : 'medium',
        affectedSectionIds: list(source.affectedSectionIds),
        status: oneOf<Evidence['status']>(source.status, ['proposed', 'accepted', 'superseded']) ? source.status : 'proposed'
    };
}

export function normalizeReviewFinding(value: Partial<ReviewFinding> = {}, index = 0): ReviewFinding {
    const source: Partial<ReviewFinding> = typeof value === 'object' && value ? value : {};
    return {
        id: entityId('finding', source, index),
        ruleId: text(source.ruleId, 'REVIEW-UNKNOWN'),
        category: text(source.category, 'quality'),
        severity: oneOf<ReviewFinding['severity']>(source.severity, ['info', 'low', 'medium', 'high', 'critical']) ? source.severity : 'medium',
        title: text(source.title, `Bulgu ${index + 1}`),
        description: text(source.description),
        recommendation: text(source.recommendation),
        entityIds: list(source.entityIds),
        sectionIds: list(source.sectionIds),
        status: oneOf<ReviewFinding['status']>(source.status, ['open', 'resolved', 'accepted_risk', 'false_positive']) ? source.status : 'open'
    };
}

export function normalizeSimulationRun(value: Partial<SimulationRun> = {}, index = 0): SimulationRun {
    const source: Partial<SimulationRun> = typeof value === 'object' && value ? value : {};
    return {
        id: entityId('simulation', source, index),
        scenario: text(source.scenario, 'delivery'),
        title: text(source.title, `Simülasyon ${index + 1}`),
        status: oneOf<SimulationRun['status']>(source.status, ['passed', 'warning', 'failed']) ? source.status : 'warning',
        summary: text(source.summary),
        checks: Array.isArray(source.checks) ? source.checks.map(check => ({ id: text(check.id), label: text(check.label), passed: Boolean(check.passed), detail: text(check.detail) })) : [],
        createdAt: text(source.createdAt),
        projectRevision: finiteNumber(source.projectRevision, 0)
    };
}

export function normalizeExecutionSession(value: Partial<ExecutionSession> = {}, index = 0): ExecutionSession {
    const source: Partial<ExecutionSession> = typeof value === 'object' && value ? value : {};
    return {
        id: entityId('execution', source, index),
        adapterId: oneOf<ExecutionSession['adapterId']>(source.adapterId, ['codex', 'generic']) ? source.adapterId : 'generic',
        // KARDEŞ DÜZELTME: bu alan `normalizeSimulationRun.projectRevision` ile
        // BİREBİR AYNI `Number(x || 0)` kusuruna sahipti - bkz. `finiteNumber`
        // yorumu. Aynı görevde kasten düzeltildi (ayrıntı: characterization
        // testlerindeki "kardes kusur" notu).
        sourceRevision: finiteNumber(source.sourceRevision, 0),
        status: oneOf<ExecutionSession['status']>(source.status, ['proposed', 'prepared', 'running', 'completed', 'failed', 'cancelled', 'external']) ? source.status : 'proposed',
        worktreeLabel: text(source.worktreeLabel),
        steps: Array.isArray(source.steps) ? source.steps.map(step => ({
            role: oneOf<ExecutionSession['steps'][number]['role']>(step.role, ['planner', 'implementer', 'reviewer', 'verifier']) ? step.role : 'planner',
            risk: oneOf<Magnitude>(step.risk, ['low', 'medium', 'high']) ? step.risk : 'medium',
            status: oneOf<ExecutionSession['steps'][number]['status']>(step.status, ['pending', 'running', 'completed', 'failed', 'cancelled']) ? step.status : 'pending',
            exitCode: Number.isInteger(step.exitCode) ? (step.exitCode as number) : null,
            outputSummary: text(step.outputSummary).slice(0, 2000),
            startedAt: text(step.startedAt), completedAt: text(step.completedAt)
        })) : [],
        createdAt: text(source.createdAt), updatedAt: text(source.updatedAt)
    };
}

type ImpactAnalysisInput = Partial<ImpactAnalysis> & { baseRevision?: unknown };

export function normalizeImpactAnalysis(value: ImpactAnalysisInput = {}, index = 0): ImpactAnalysis {
    const source: ImpactAnalysisInput = typeof value === 'object' && value ? value : {};
    const effects = Array.isArray(source.entityEffects) ? source.entityEffects.map(effect => ({
        sourceEntityId: text(effect.sourceEntityId),
        sourceType: text(effect.sourceType),
        targetEntityId: text(effect.targetEntityId),
        targetType: text(effect.targetType),
        targetLabel: text(effect.targetLabel || effect.targetEntityId),
        effect: oneOf<ImpactAnalysis['entityEffects'][number]['effect']>(effect.effect, ['invalidate', 'stale', 'regenerate', 'review', 'no_action']) ? effect.effect : 'review',
        severity: oneOf<ImpactAnalysis['entityEffects'][number]['severity']>(effect.severity, ['low', 'medium', 'high', 'critical']) ? effect.severity : 'medium',
        depth: Math.max(0, Number(effect.depth || 0))
    })) : [];
    const contradictions = list(source.contradictions);
    const details = Array.isArray(source.contradictionDetails) ? source.contradictionDetails.map(detail => ({
        decisionId: text(detail.decisionId),
        decisionTitle: text(detail.decisionTitle),
        decisionText: text(detail.decisionText),
        resolution: oneOf<'supersede' | 'keep'>(detail.resolution, ['supersede', 'keep']) ? detail.resolution : null
    })) : [];
    const preview: Partial<ImpactAnalysis['preview']> & { nextRevision?: unknown } = source.preview || {};
    return {
        id: entityId('impact', source, index),
        baseCanonicalRevision: Math.max(1, Number(source.baseCanonicalRevision || source.baseRevision || 1)),
        sourceScenarioId: text(source.sourceScenarioId) || undefined,
        sourceKind: oneOf<NonNullable<ImpactAnalysis['sourceKind']>>(source.sourceKind, ['user_request', 'idea_alignment']) ? source.sourceKind : 'user_request',
        sourceIdeaRevisionId: text(source.sourceIdeaRevisionId) || undefined,
        currentIdeaRevisionId: text(source.currentIdeaRevisionId) || undefined,
        userRequest: text(source.userRequest),
        summary: text(source.summary),
        affectedSections: list(source.affectedSections),
        changedEntityIds: list(source.changedEntityIds),
        entityEffects: effects,
        effectSummary: {
            total: Number(source.effectSummary?.total ?? effects.length),
            byEffect: source.effectSummary?.byEffect && typeof source.effectSummary.byEffect === 'object' ? { ...source.effectSummary.byEffect } : {},
            bySeverity: source.effectSummary?.bySeverity && typeof source.effectSummary.bySeverity === 'object' ? { ...source.effectSummary.bySeverity } : {}
        },
        newTasks: list(source.newTasks),
        architectureImpact: text(source.architectureImpact),
        newRisks: list(source.newRisks),
        contradictions,
        contradictionDetails: details,
        preview: {
            nextCanonicalRevision: Math.max(2, Number(preview.nextCanonicalRevision || preview.nextRevision || Number(source.baseCanonicalRevision || source.baseRevision || 1) + 1)),
            requirementCount: Math.max(0, Number(preview.requirementCount ?? 1)),
            taskCount: Math.max(0, Number(preview.taskCount ?? list(source.newTasks).length)),
            testCount: Math.max(0, Number(preview.testCount ?? 1)),
            riskCount: Math.max(0, Number(preview.riskCount ?? list(source.newRisks).length)),
            traceLinkCount: Math.max(0, Number(preview.traceLinkCount ?? 2))
        },
        status: oneOf<ImpactAnalysis['status']>(source.status, ['proposed', 'accepted', 'rejected', 'stale']) ? source.status : 'proposed',
        createdAt: text(source.createdAt),
        resolvedAt: text(source.resolvedAt) || null
    };
}

type PlanningScenarioInput = Partial<PlanningScenario> & { baseRevision?: unknown };

export function normalizePlanningScenario(value: PlanningScenarioInput = {}, index = 0): PlanningScenario {
    const source: PlanningScenarioInput = typeof value === 'object' && value ? value : {};
    const createdAt = text(source.createdAt, new Date().toISOString());
    const decisions = Array.isArray(source.decisions) ? source.decisions.map((decision, decisionIndex) => ({
        id: text(decision?.id, entityId('scenario-decision', decision || {}, decisionIndex)),
        title: text(decision?.title, `Alternatif karar ${decisionIndex + 1}`),
        decision: text(decision?.decision),
        rationale: text(decision?.rationale),
        affectedSectionIds: list(decision?.affectedSectionIds),
        dependencies: list(decision?.dependencies)
    })).filter(decision => decision.decision) : [];
    const affectedSectionIds = [...new Set(decisions.flatMap(decision => decision.affectedSectionIds))];
    const dependencies = [...new Set(decisions.flatMap(decision => decision.dependencies))];
    return {
        id: entityId('scenario', source, index),
        name: text(source.name, `Plan senaryosu ${index + 1}`),
        description: text(source.description),
        baseCanonicalRevision: Math.max(1, Number(source.baseCanonicalRevision || source.baseRevision || 1)),
        decisions,
        comparison: {
            effortScore: Math.min(5, Math.max(1, Number(source.comparison?.effortScore || 1))),
            riskScore: Math.min(5, Math.max(1, Number(source.comparison?.riskScore || 1))),
            readinessDelta: Math.min(25, Math.max(-25, Number(source.comparison?.readinessDelta || 0))),
            affectedSectionIds: list(source.comparison?.affectedSectionIds).length ? list(source.comparison?.affectedSectionIds) : affectedSectionIds,
            dependencies: list(source.comparison?.dependencies).length ? list(source.comparison?.dependencies) : dependencies
        },
        status: oneOf<PlanningScenario['status']>(source.status, ['draft', 'selected', 'discarded', 'merged']) ? source.status : 'draft',
        createdAt,
        updatedAt: text(source.updatedAt, createdAt),
        mergedAt: text(source.mergedAt) || null,
        impactAnalysisId: text(source.impactAnalysisId) || null
    };
}

type SectionPatchProposalInput = Partial<SectionPatchProposal> & { baseRevision?: unknown };

export function normalizeSectionPatchProposal(value: SectionPatchProposalInput = {}, index = 0): SectionPatchProposal {
    const source: SectionPatchProposalInput = typeof value === 'object' && value ? value : {};
    const createdAt = text(source.createdAt, new Date().toISOString());
    return {
        id: entityId('section-patch', source, index),
        impactAnalysisId: text(source.impactAnalysisId),
        baseCanonicalRevision: Math.max(1, Number(source.baseCanonicalRevision || source.baseRevision || 1)),
        sectionId: text(source.sectionId),
        originalContent: text(source.originalContent),
        proposedContent: text(source.proposedContent),
        editedContent: text(source.editedContent),
        rationale: text(source.rationale),
        warnings: list(source.warnings),
        status: oneOf<SectionPatchProposal['status']>(source.status, ['pending', 'accepted', 'edited', 'deferred', 'rejected', 'stale']) ? source.status : 'pending',
        provenance: {
            runId: text(source.provenance?.runId, `legacy-section-patch-${index + 1}`),
            mode: oneOf<SectionPatchProposal['provenance']['mode']>(source.provenance?.mode, ['cloud-ai', 'local-ai', 'rule-engine', 'fallback']) ? source.provenance.mode : 'rule-engine',
            providerId: text(source.provenance?.providerId) || null,
            model: text(source.provenance?.model) || null,
            promptVersion: text(source.provenance?.promptVersion, '1.0.0'),
            requestedAt: text(source.provenance?.requestedAt, createdAt),
            completedAt: text(source.provenance?.completedAt, createdAt),
            latencyMs: Math.max(0, Number(source.provenance?.latencyMs || 0)),
            retryCount: Math.max(0, Number(source.provenance?.retryCount || 0)),
            fallbackReason: text(source.provenance?.fallbackReason) || null,
            schemaId: text(source.provenance?.schemaId, 'section-regeneration-v1'),
            schemaVersion: Math.max(1, Number(source.provenance?.schemaVersion || 1)),
            inputHash: text(source.provenance?.inputHash, 'not-sent-to-provider')
        },
        createdAt,
        resolvedAt: text(source.resolvedAt) || null
    };
}

export function normalizeImplementationEvidencePackage(value: Partial<ImplementationEvidencePackage> = {}, index = 0): ImplementationEvidencePackage {
    const source: Partial<ImplementationEvidencePackage> = value && typeof value === 'object' ? value : {};
    const createdAt = text(source.createdAt, new Date().toISOString());
    return {
        id: entityId('implementation-evidence', source, index),
        taskId: text(source.taskId),
        baseCanonicalRevision: Math.max(1, Number(source.baseCanonicalRevision || 1)),
        source: oneOf<ImplementationEvidencePackage['source']>(source.source, ['manual', 'codex', 'cursor', 'claude-code', 'other']) ? source.source : 'manual',
        summary: text(source.summary, `Uygulama kanıt paketi ${index + 1}`),
        changedFiles: Array.isArray(source.changedFiles) ? source.changedFiles.map(item => ({
            path: text(item?.path).replaceAll('\\', '/').replace(/^\.\//, ''),
            changeType: oneOf<ImplementationEvidencePackage['changedFiles'][number]['changeType']>(item?.changeType, ['added', 'modified', 'deleted']) ? item.changeType : 'modified',
            note: text(item?.note)
        })).filter(item => item.path) : [],
        testRuns: Array.isArray(source.testRuns) ? source.testRuns.map(item => ({
            command: text(item?.command),
            status: oneOf<ImplementationEvidencePackage['testRuns'][number]['status']>(item?.status, ['passed', 'failed', 'not_run']) ? item.status : 'not_run',
            outputSummary: text(item?.outputSummary)
        })).filter(item => item.command) : [],
        acceptanceEvidence: Array.isArray(source.acceptanceEvidence) ? source.acceptanceEvidence.map(item => ({
            criterion: text(item?.criterion),
            status: oneOf<ImplementationEvidencePackage['acceptanceEvidence'][number]['status']>(item?.status, ['met', 'not_met', 'unclear']) ? item.status : 'unclear',
            evidence: text(item?.evidence)
        })).filter(item => item.criterion) : [],
        remainingIssues: list(source.remainingIssues),
        rollbackNotes: text(source.rollbackNotes),
        review: {
            outcome: oneOf<ImplementationEvidencePackage['review']['outcome']>(source.review?.outcome, ['ready_for_approval', 'needs_changes', 'blocked']) ? source.review.outcome : 'needs_changes',
            findings: list(source.review?.findings),
            reviewedAt: text(source.review?.reviewedAt, createdAt),
            reviewerNote: text(source.review?.reviewerNote)
        },
        status: oneOf<ImplementationEvidencePackage['status']>(source.status, ['review_required', 'accepted', 'rejected', 'stale']) ? source.status : 'review_required',
        createdAt,
        resolvedAt: text(source.resolvedAt) || null
    };
}

/**
 * `normalizeProjectDocument` yalnız BİR belge sürümünün göç edeceğini
 * varsaymaz: canonical belge V2 şemasının `revision` alanını V5'in
 * `documentRevision`/`canonicalRevision` ikilisine göç ederken siler
 * (`delete`), ama eski kayıtlar hâlâ bu alanı taşıyabilir. `ProjectDocumentV5`
 * arayüzü artık `revision`i tanımıyor; bu yardımcı tip yalnızca bu fonksiyonun
 * kendi içindeki göç mantığının o eski alanı okuyup silebilmesi için var.
 */
type ProjectDraft = ProjectDocumentV5 & { revision?: unknown };
type SnapshotDraft = Omit<ProjectDocumentV5, 'revisions'> & { revision?: unknown };

export function normalizeProjectDocument(project: unknown): ProjectDocumentV5 {
    if (!project || typeof project !== 'object') return project as ProjectDocumentV5;
    // Tek gerekçelendirilmiş tip iddiası: `structuredClone` girdinin çalışma
    // zamanı şeklini garanti edemez (eski/bozuk belgeler olabilir), ama bu
    // fonksiyonun tüm sözleşmesi -- 700'den fazla test ve düzinelerce
    // çağıran -- ProjectDocumentV5 üretmek üzerine kurulu. İddia burada, TEK
    // yerde yapılır; aşağıdaki ~250 satır artık gerçek arayüze karşı
    // denetlenir.
    const next: ProjectDraft = structuredClone(project) as ProjectDraft;
    const sourceSchemaRevision = Math.max(1, Number(next.schemaRevision || 1));
    next.schemaVersion = 5;
    next.schemaRevision = 7;
    next.documentRevision = Math.max(1, Number(next.documentRevision || next.revision || 1));
    next.canonicalRevision = Math.max(1, Math.min(next.documentRevision, Number(next.canonicalRevision || next.revision || 1)));
    delete next.revision;
    // Ürün Modeli V3 aşama kapsayıcıları. Eklemeli: hiçbir eski alan
    // silinmiyor, bu yüzden V3 öncesi belgeler yüklenirken bedava göç ediyor.
    const stageApproval = (existing: Partial<StageApproval> | undefined): StageApproval => ({
        // Geçerli durum listesi `project-stages` içinde; kopyalanırsa yeni bir
        // durum eklendiğinde normalleştirme onu sessizce 'draft'a düşürürdü.
        status: oneOf(existing?.status, STAGE_STATUSES) ? existing.status : 'draft',
        approvedAtRevision: Number.isInteger(existing?.approvedAtRevision) ? (existing?.approvedAtRevision as number) : null,
        approvedAt: typeof existing?.approvedAt === 'string' ? existing.approvedAt : null,
        reopenedReason: typeof existing?.reopenedReason === 'string' ? existing.reopenedReason : null
    });
    const concernList = (value: Concern[] | undefined): Concern[] => (Array.isArray(value) ? value.map((item, index) => normalizeConcern(item, index)) : []);
    const concernDecisionList = (value: ConcernDecision[] | undefined): ConcernDecision[] => (Array.isArray(value) ? value.map((item, index) => normalizeConcernDecision(item, index)) : []);
    next.ideaDesign = {
        approval: stageApproval(next.ideaDesign?.approval),
        concerns: concernList(next.ideaDesign?.concerns),
        concernDecisions: concernDecisionList(next.ideaDesign?.concernDecisions),
        framing: {
            kind: oneOf<ProjectFraming['kind']>(next.ideaDesign?.framing?.kind, ['product', 'feature', 'system', 'unknown'])
                ? next.ideaDesign.framing.kind
                : 'unknown',
            domain: typeof next.ideaDesign?.framing?.domain === 'string' ? next.ideaDesign.framing.domain : '',
            environment: typeof next.ideaDesign?.framing?.environment === 'string' ? next.ideaDesign.framing.environment : '',
            // Onaylanmadıysa çıkarım sayılır; AI tahmini kullanıcı kararı yerine geçmez.
            source: next.ideaDesign?.framing?.source === 'confirmed' ? 'confirmed' : 'inferred'
        },
        openQuestions: Array.isArray(next.ideaDesign?.openQuestions) ? next.ideaDesign.openQuestions : []
    };
    next.solutionDesign = {
        approval: stageApproval(next.solutionDesign?.approval),
        concerns: concernList(next.solutionDesign?.concerns),
        concernDecisions: concernDecisionList(next.solutionDesign?.concernDecisions),
        candidates: Array.isArray(next.solutionDesign?.candidates)
            ? next.solutionDesign.candidates.map((item, index) => normalizeTechnologyCandidate(item, index))
            : [],
        legacyApproaches: Array.isArray(next.solutionDesign?.legacyApproaches)
            ? next.solutionDesign.legacyApproaches.filter(item => typeof item === 'string' && item.trim())
            : [],
        platform: typeof next.solutionDesign?.platform === 'string' ? next.solutionDesign.platform : '',
        openQuestions: Array.isArray(next.solutionDesign?.openQuestions) ? next.solutionDesign.openQuestions : []
    };
    const previousReadiness = next.readiness || {};
    const readinessDimensions: ReadinessDimension[] = ['completeness', 'consistency', 'traceability', 'riskCoverage', 'implementationReadiness'];
    const previousChecks = Array.isArray(previousReadiness.checks) ? previousReadiness.checks : [];
    const readinessIsVerified = previousReadiness.version === 3 && previousReadiness.calculationProfile === 'readiness-3.0';
    next.readiness = {
        version: 3,
        calculationProfile: readinessIsVerified ? 'readiness-3.0' : 'legacy-unverified',
        status: readinessIsVerified && oneOf<ProjectDocumentV5['readiness']['status']>(previousReadiness.status, ['blocked', 'needs_review', 'ready'])
            ? previousReadiness.status
            : 'blocked',
        score: Math.max(0, Math.min(100, Number(previousReadiness.score || 0))),
        dimensions: {
            completeness: Number(previousReadiness.dimensions?.completeness || 0),
            consistency: Number(previousReadiness.dimensions?.consistency ?? 100),
            traceability: Number(previousReadiness.dimensions?.traceability || 0),
            riskCoverage: Number(previousReadiness.dimensions?.riskCoverage || 0),
            implementationReadiness: Number(previousReadiness.dimensions?.implementationReadiness || 0)
        },
        dimensionWeights: { completeness: 20, consistency: 20, traceability: 25, riskCoverage: 15, implementationReadiness: 20 },
        dimensionLabels: { completeness: 'Tamlık', consistency: 'Tutarlılık', traceability: 'İzlenebilirlik', riskCoverage: 'Risk kapsamı', implementationReadiness: 'Uygulamaya hazırlık' },
        // `Object.fromEntries` dönüş tipi (`{ [k: string]: T }`) literal anahtar
        // bilgisini kaybeder. `readinessDimensions` sabit ve tüketici bir dizi
        // olduğu için tüm anahtarların varlığı çalışma zamanında garanti; bu
        // tek iddia onu gerçek `Record` tipine geri bağlar.
        dimensionEvidence: Object.fromEntries(readinessDimensions.map(dimension => {
            const relevant = previousChecks.filter(item => item.dimension === dimension);
            const stored = previousReadiness.dimensionEvidence?.[dimension];
            return [dimension, stored || {
                earned: relevant.reduce((total, item) => total + Number(item.earned || 0), 0),
                possible: relevant.reduce((total, item) => total + Number(item.possible || 0), 0),
                passed: relevant.filter(item => item.status === 'passed').length,
                warning: relevant.filter(item => item.status === 'warning').length,
                blocked: relevant.filter(item => item.status === 'blocked').length
            }];
        })) as Record<ReadinessDimension, ReadinessDimensionEvidence>,
        checks: previousChecks,
        nextActions: Array.isArray(previousReadiness.nextActions) ? previousReadiness.nextActions : [],
        qualityGate: readinessIsVerified && previousReadiness.qualityGate
            ? previousReadiness.qualityGate
            : {
                passed: false,
                blockingCheckIds: previousChecks.filter(item => item.status === 'blocked').map(item => item.id),
                conditions: [{
                    id: 'readiness-calculation',
                    label: 'Readiness kanıtı güncel',
                    passed: false,
                    message: 'Eski readiness kaydı Readiness 3.0 ile yeniden hesaplanmalı.',
                    checkIds: []
                }]
            },
        blockers: readinessIsVerified
            ? list(previousReadiness.blockers)
            : ['Canonical plan için Readiness 3.0 yeniden hesaplanmalı.'],
        warnings: list(previousReadiness.warnings),
        evidenceHash: readinessIsVerified && text(previousReadiness.evidenceHash)
            ? text(previousReadiness.evidenceHash)
            : 'legacy-unverified',
        calculatedAtRevision: Math.max(1, Number(previousReadiness.calculatedAtRevision || next.canonicalRevision))
    };
    next.objectives = (next.objectives || []).map(normalizeObjective);
    next.requirements = (next.requirements || []).map(normalizeRequirement);
    next.decisions = (next.decisions || []).map(normalizeDecision);
    next.assumptions = (next.assumptions || []).map(normalizeAssumption);
    next.risks = (next.risks || []).map(normalizeRisk);
    next.tasks = (next.tasks || []).map(normalizeTask);
    next.testCases = (next.testCases || []).map(normalizeTestCase);
    next.milestones = (next.milestones || []).map(normalizeMilestone);
    next.traceLinks = (next.traceLinks || []).map(normalizeTraceLink);
    next.agentPrompts = (next.agentPrompts || []).map(normalizeAgentPrompt);
    next.researchQuestions = (next.researchQuestions || []).map(normalizeResearchQuestion);
    next.sources = (next.sources || []).map(normalizeResearchSource);
    next.evidence = (next.evidence || []).map(normalizeEvidence);
    next.reviewFindings = (next.reviewFindings || []).map(normalizeReviewFinding);
    next.simulationRuns = (next.simulationRuns || []).map(normalizeSimulationRun);
    next.impactAnalyses = (next.impactAnalyses || []).map(normalizeImpactAnalysis);
    next.planningScenarios = (next.planningScenarios || []).map(normalizePlanningScenario);
    next.sectionPatchProposals = (next.sectionPatchProposals || []).map(normalizeSectionPatchProposal);
    next.implementationEvidencePackages = (next.implementationEvidencePackages || []).map(normalizeImplementationEvidencePackage);
    next.ideaDocumentRevisions = Array.isArray(next.ideaDocumentRevisions) ? next.ideaDocumentRevisions.map((revision, index) => ({
        id: text(revision?.id, `idea-revision-${index + 1}`),
        number: Math.max(1, Number(revision?.number || index + 1)),
        documentRevision: Math.max(1, Number(revision?.documentRevision || next.documentRevision)),
        canonicalRevision: Math.max(1, Number(revision?.canonicalRevision || next.canonicalRevision)),
        createdAt: text(revision?.createdAt, next.lifecycle?.updatedAt || next.lifecycle?.createdAt),
        summary: text(revision?.summary, `Fikir belgesi sürüm ${index + 1}`),
        source: oneOf<IdeaDocumentRevision['source']>(revision?.source, ['initial', 'edit', 'discovery', 'restore']) ? revision.source : 'edit',
        status: oneOf<IdeaDocumentRevision['status']>(revision?.status, ['draft', 'converted', 'superseded']) ? revision.status : 'superseded',
        convertedCanonicalRevision: Number.isInteger(revision?.convertedCanonicalRevision) ? (revision?.convertedCanonicalRevision as number) : null,
        restoredFromRevision: Number.isInteger(revision?.restoredFromRevision) ? (revision?.restoredFromRevision as number) : null,
        snapshot: {
            summary: text(revision?.snapshot?.summary),
            targetUser: text(revision?.snapshot?.targetUser),
            problemStatement: text(revision?.snapshot?.problemStatement),
            currentAlternative: text(revision?.snapshot?.currentAlternative),
            desiredOutcome: text(revision?.snapshot?.desiredOutcome),
            confirmedFeatures: list(revision?.snapshot?.confirmedFeatures),
            outOfScope: list(revision?.snapshot?.outOfScope),
            technicalApproaches: list(revision?.snapshot?.technicalApproaches),
            openQuestions: list(revision?.snapshot?.openQuestions),
            knownRisks: list(revision?.snapshot?.knownRisks),
            mvpTarget: text(revision?.snapshot?.mvpTarget)
        }
    })) : [];
    const convertedIdeaRevision = [...next.ideaDocumentRevisions].reverse()
        .find(revision => revision.status === 'converted' && revision.convertedCanonicalRevision !== null);
    next.sourceIdeaRevisionId = text(next.sourceIdeaRevisionId) || convertedIdeaRevision?.id || null;
    next.sourceIdeaRevisionNumber = Number.isInteger(next.sourceIdeaRevisionNumber)
        ? next.sourceIdeaRevisionNumber
        : convertedIdeaRevision?.number || null;
    next.planAlignment = next.sourceIdeaRevisionId
        ? evaluatePlanAlignment(next)
        : {
            ...emptyPlanAlignment(text(next.planAlignment?.reason) || undefined),
            currentIdeaRevisionId: next.ideaDocumentRevisions.at(-1)?.id || null,
            currentIdeaRevisionNumber: next.ideaDocumentRevisions.at(-1)?.number || null
        };
    next.modules = {
        active: Array.isArray(next.modules?.active) ? next.modules.active.map(item => ({ id: text(item.id), version: text(item.version), enabledAtRevision: Number(item.enabledAtRevision || 0), config: item.config && typeof item.config === 'object' ? item.config : {} })).filter(item => item.id) : [],
        dismissed: list(next.modules?.dismissed),
        localManifests: Array.isArray(next.modules?.localManifests) ? next.modules.localManifests : []
    };
    next.executionSessions = (next.executionSessions || []).map(normalizeExecutionSession);
    next.exports = Array.isArray(next.exports) ? next.exports.map((item: ProjectDocumentV5['exports'][number] & { revision?: unknown }) => {
        const normalized: ProjectDocumentV5['exports'][number] & { revision?: unknown } = {
            ...item,
            canonicalRevision: Math.max(1, Number(item.canonicalRevision || item.revision || next.canonicalRevision))
        };
        delete normalized.revision;
        return normalized;
    }) : [];
    next.commandLog = Array.isArray(next.commandLog) ? next.commandLog.map((item: ProjectDocumentV5['commandLog'][number] & { expectedRevision?: unknown; committedRevision?: unknown }) => ({
        commandId: text(item.commandId),
        commandType: text(item.commandType, 'LegacyCommand'),
        expectedDocumentRevision: Math.max(0, Number(item.expectedDocumentRevision ?? item.expectedRevision ?? 0)),
        committedDocumentRevision: Math.max(1, Number(item.committedDocumentRevision ?? item.committedRevision ?? next.documentRevision)),
        expectedCanonicalRevision: Math.max(0, Number(item.expectedCanonicalRevision ?? item.expectedRevision ?? 0)),
        committedCanonicalRevision: Math.max(1, Number(item.committedCanonicalRevision ?? item.committedRevision ?? next.canonicalRevision)),
        createdAt: text(item.createdAt)
    })).filter(item => item.commandId) : [];
    next.revisions = Array.isArray(next.revisions) ? next.revisions.map(revision => {
        const snapshot: SnapshotDraft = (revision.snapshot && typeof revision.snapshot === 'object' ? structuredClone(revision.snapshot) : {}) as SnapshotDraft;
        snapshot.schemaVersion = 5;
        snapshot.schemaRevision = 7;
        snapshot.documentRevision = Math.max(1, Number(snapshot.documentRevision || snapshot.revision || revision.number || 1));
        snapshot.canonicalRevision = Math.max(1, Number(snapshot.canonicalRevision || snapshot.revision || revision.number || 1));
        delete snapshot.revision;
        snapshot.planningScenarios = Array.isArray(snapshot.planningScenarios) ? snapshot.planningScenarios : [];
        snapshot.sectionPatchProposals = Array.isArray(snapshot.sectionPatchProposals) ? snapshot.sectionPatchProposals : [];
        snapshot.implementationEvidencePackages = Array.isArray(snapshot.implementationEvidencePackages) ? snapshot.implementationEvidencePackages : [];
        snapshot.ideaDocumentRevisions = Array.isArray(snapshot.ideaDocumentRevisions) ? snapshot.ideaDocumentRevisions : [];
        snapshot.sourceIdeaRevisionId = snapshot.sourceIdeaRevisionId || null;
        snapshot.sourceIdeaRevisionNumber = Number.isInteger(snapshot.sourceIdeaRevisionNumber) ? snapshot.sourceIdeaRevisionNumber : null;
        snapshot.planAlignment = snapshot.planAlignment || emptyPlanAlignment();
        return { ...revision, number: Math.max(1, Number(revision.number || snapshot.canonicalRevision)), snapshot };
    }) : [];
    next.ideaDiscussion = {
        mode: oneOf<IdeaDiscussionMode>(next.ideaDiscussion?.mode, ['explore', 'challenge', 'compare', 'clarify']) ? next.ideaDiscussion.mode : 'explore',
        records: Array.isArray(next.ideaDiscussion?.records) ? next.ideaDiscussion.records.filter(item => item && item.id && item.text).map(item => ({
            id: text(item.id),
            kind: oneOf<IdeaRecordKind>(item.kind, ['decision', 'hypothesis', 'risk', 'question']) ? item.kind : 'hypothesis',
            text: text(item.text),
            originalText: text(item.originalText || item.text),
            note: text(item.note),
            answer: text(item.answer),
            rationale: text(item.rationale),
            validationPlan: text(item.validationPlan),
            history: Array.isArray(item.history) ? item.history.map(entry => ({
                editedAt: text(entry.editedAt),
                text: text(entry.text),
                note: text(entry.note),
                answer: text(entry.answer),
                rationale: text(entry.rationale),
                validationPlan: text(entry.validationPlan)
            })) : [],
            status: oneOf<IdeaRecordStatus>(item.status, ['pending', 'accepted', 'deferred', 'rejected']) ? item.status : 'pending',
            sourceBundleId: text(item.sourceBundleId),
            sourceMessageId: text(item.sourceMessageId),
            createdAt: text(item.createdAt),
            ...(item.resolvedAt ? { resolvedAt: text(item.resolvedAt) } : {})
        })) : [],
        updatedAt: text(next.ideaDiscussion?.updatedAt)
    };
    if (next.ideaLabSession?.conceptSummary) {
        const source = next.ideaLabSession.conceptSummary;
        const needsReconfirmation = sourceSchemaRevision < 3;
        next.ideaLabSession.conceptSummary = {
            ...source,
            summary: text(source.summary, next.identity?.summary || next.identity?.originalIdea),
            targetUser: text(source.targetUser, 'Birincil kullanıcı migration sonrası doğrulanmalı.'),
            problemStatement: text(source.problemStatement, next.identity?.originalIdea || 'Problem tanımı migration sonrası doğrulanmalı.'),
            currentAlternative: text(source.currentAlternative, 'Mevcut çözüm migration sonrası doğrulanmalı.'),
            desiredOutcome: text(source.desiredOutcome, next.identity?.desiredOutcome || 'Beklenen sonuç migration sonrası doğrulanmalı.'),
            interpretationConfidence: Math.max(0, Math.min(100, Math.round(Number(source.interpretationConfidence ?? 40)))),
            confidenceRationale: list(source.confidenceRationale).length
                ? list(source.confidenceRationale)
                : ['Eski proje kaydında yorum güveni bulunmadığı için düşük başlangıç değeri kullanıldı.'],
            confirmedFeatures: list(source.confirmedFeatures),
            outOfScope: list(source.outOfScope),
            technicalApproaches: list(source.technicalApproaches),
            openQuestions: [
                ...list(source.openQuestions),
                ...(needsReconfirmation ? ['Yeni hedef kullanıcı ve problem alanları migration sonrası doğrulanmalı.'] : [])
            ],
            knownRisks: list(source.knownRisks),
            mvpTarget: text(source.mvpTarget),
            userConfirmed: needsReconfirmation ? false : Boolean(source.userConfirmed),
            ...(needsReconfirmation ? { confirmedAt: undefined } : {})
        };
    }
    next.metadata = { ...(next.metadata || {}), canonicalModelVersion: CANONICAL_MODEL_VERSION };
    return next;
}

export { CANONICAL_MODEL_VERSION };
