export type ComparisonMethod = 'baseline-chat' | 'master-prompt' | 'promtgen';

/**
 * Kör değerlendirmenin ölçütleri **study.json'dan** gelir, buradan değil.
 *
 * Daha önce burada sabit bir liste duruyordu ve `study.json` da aynı listeyi
 * ilan ediyordu: iki doğruluk kaynağı. İkisi ayrışırsa dondurma özeti bir
 * şeyi, kod başka bir şeyi zorlardı — ve ölçütü sessizce değiştirmenin yolu
 * tam olarak burasıydı. Artık tek kaynak çalışma tanımı; dondurma özeti onu
 * kapsıyor.
 *
 * Aşağıdaki liste yalnız **v1'in** ölçütleridir ve geriye dönük okuma için
 * duruyor; yeni çalışmalar kendi listesini getirir.
 */
export const V1_EVALUATION_CRITERIA = [
  'scopeClarity',
  'requirementQuality',
  'applicability',
  'taskTestLinkage',
  'acceptanceCriteria',
  'agentReadiness'
] as const;

/** Ölçüt kimliği; hangi ölçütlerin geçerli olduğunu çalışma tanımı söyler. */
export type EvaluationCriterion = string;

export type CriterionScore = 1 | 2 | 3 | 4 | 5;

/**
 * Süre üç parçaya ayrılır çünkü kollar eşit başlamıyor: baseline-chat'in
 * kurulumu yok, PromtGen depo çalıştırma ve sağlayıcı bağlama istiyor. Tek
 * sayıya indirgemek bu farkı gizler; ayrı tutmak ikisini de raporlanabilir
 * kılar. `null` "kaydedilmedi", `0` "kurulum gerekmedi" demektir.
 */
export interface DurationBreakdown {
  setupDurationSeconds: number | null;
  planningDurationSeconds: number | null;
  endToEndDurationSeconds: number | null;
}

export interface ComparisonRequirement {
  id: string;
  title: string;
  priority: 'must' | 'should' | 'could';
  acceptanceCriteria: string[];
}

export interface ComparisonTask {
  id: string;
  title: string;
  description: string;
  requirementIds: string[];
  acceptanceCriteria: string[];
  verificationIds: string[];
}

export interface ComparisonTest {
  id: string;
  requirementIds: string[];
}

export interface BlindComparisonSubmission extends DurationBreakdown {
  schemaVersion: 2;
  blindId: string;
  scenarioId: string;
  inScope: string[];
  outOfScope: string[];
  requirements: ComparisonRequirement[];
  tasks: ComparisonTask[];
  tests: ComparisonTest[];
  decisionStatements: string[];
  manualEditCount: number | null;
  agentFirstPassCompleted: boolean | null;
}

export interface BlindMethodMapping {
  blindId: string;
  method: ComparisonMethod;
}

export interface HumanEvaluation {
  blindId: string;
  evaluatorId: string;
  /** Çalışmanın ilan ettiği ölçütlerin TAMAMI, 1-5. Eksik ya da fazla ölçüt reddedilir. */
  scores: Record<EvaluationCriterion, CriterionScore>;
}

export interface AnonymousUserSession {
  schemaVersion: 2;
  anonymousSessionId: string;
  capabilityId: string;
  consent: true;
  completed: boolean;
  firstExportReached: boolean;
  mvpAcceptedWithMinorEdits: boolean;
  manualEditCount: number;
  setupDurationSeconds: number;
  planningDurationSeconds: number;
  endToEndDurationSeconds: number;
  satisfaction: 1 | 2 | 3 | 4 | 5;
  /** "Bu planı gerçekten kullanır mıydın?" — kullanım niyeti. */
  wouldUsePlan: boolean;
}

export interface BlindEvaluationResult {
  blindId: string;
  scenarioId: string;
  score: number;
  metrics: {
    scopeContainment: number;
    requirementTaskCoverage: number;
    requirementTestCoverage: number;
    acceptanceCriteriaCoverage: number;
    consistency: number;
    manualEditCount: number | null;
    setupDurationSeconds: number | null;
    planningDurationSeconds: number | null;
    endToEndDurationSeconds: number | null;
    agentFirstPassCompleted: boolean | null;
    /** Ölçüt başına değerlendirici ortalaması; değerlendirme yoksa null. */
    humanScores: Record<EvaluationCriterion, number | null>;
  };
  findings: string[];
}

export interface ComparisonStudyPolicy {
  minimumScenariosPerMethod: number;
  minimumUserParticipants: number;
  minimumPromtgenScopeImprovement: number;
  minimumPromtgenAcceptanceImprovement: number;
}

export interface ComparisonReport {
  schemaVersion: 2;
  studyId: string;
  generatedAt: string;
  blindedEvaluation: BlindEvaluationResult[];
  byMethod: Partial<Record<ComparisonMethod, {
    samples: number;
    averageScore: number;
    averageScopeContainment: number;
    averageAcceptanceCoverage: number;
    averageRequirementTaskCoverage: number;
    averageSetupSeconds: number | null;
    averagePlanningSeconds: number | null;
    averageEndToEndSeconds: number | null;
  }>>;
  userEvidence: {
    validParticipants: number;
    completionRate: number;
    firstExportRate: number;
    minorEditMvpAcceptanceRate: number;
    averageSatisfaction: number;
    /** Kurulum ve planlama ayrı sunulur; tek sayı farkı gizlerdi. */
    averageSetupSeconds: number;
    averagePlanningSeconds: number;
    averageEndToEndSeconds: number;
    wouldUsePlanRate: number;
  };
  publicationGate: {
    eligible: boolean;
    blockers: string[];
  };
}

const normalize = (value: unknown) => String(value || '')
  .toLocaleLowerCase('tr-TR')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9çğıöşü]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const ratio = (passed: number, total: number) => total ? passed / total : 0;
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const rounded = (value: number) => Math.round(value * 1000) / 1000;

/** Kaydedilmemiş (null) süreleri ortalamaya katmaz; hiç kayıt yoksa null. */
const averageOrNull = (values: Array<number | null>) => {
  const present = values.filter((value): value is number => typeof value === 'number');
  return present.length ? rounded(average(present)) : null;
};

function humanScoresFor(
  evaluations: HumanEvaluation[],
  blindId: string,
  criteria: readonly string[]
): Record<EvaluationCriterion, number | null> {
  const forBlind = evaluations.filter(item => item.blindId === blindId);
  const result = {} as Record<EvaluationCriterion, number | null>;
  for (const criterion of criteria) {
    const values = forBlind.map(item => item.scores?.[criterion]).filter((value): value is CriterionScore => Number.isInteger(value));
    result[criterion] = values.length ? rounded(average(values)) : null;
  }
  return result;
}

export function evaluateBlindSubmission(
  submission: BlindComparisonSubmission,
  criteria: readonly string[],
  humanEvaluations: HumanEvaluation[] = []
): BlindEvaluationResult {
  if (submission.schemaVersion !== 2 || !submission.blindId || !submission.scenarioId) {
    throw new Error('Karşılaştırma submission sözleşmesi geçersiz.');
  }
  if ('method' in submission) throw new Error('Kör submission yöntem bilgisini içeremez.');
  const requirementIds = new Set(submission.requirements.map(item => item.id));
  const testIds = new Set(submission.tests.map(item => item.id));
  const outOfScope = submission.outOfScope.map(normalize).filter(item => item.length >= 4);
  const taskTexts = submission.tasks.map(item => normalize(`${item.title} ${item.description}`));
  const scopeLeaks = outOfScope.filter(excluded => taskTexts.some(task => task.includes(excluded)));
  const requirementTaskCoverage = ratio(
    submission.requirements.filter(requirement =>
      submission.tasks.some(task => task.requirementIds.includes(requirement.id))
    ).length,
    submission.requirements.length
  );
  const requirementTestCoverage = ratio(
    submission.requirements.filter(requirement =>
      submission.tests.some(test => test.requirementIds.includes(requirement.id))
    ).length,
    submission.requirements.length
  );
  const acceptanceCriteriaCoverage = ratio(
    submission.tasks.filter(task => task.acceptanceCriteria.length > 0).length,
    submission.tasks.length
  );
  const invalidReferences = submission.tasks.flatMap(task => [
    ...task.requirementIds.filter(id => !requirementIds.has(id)),
    ...task.verificationIds.filter(id => !testIds.has(id))
  ]);
  const decisions = submission.decisionStatements.map(normalize).filter(Boolean);
  const duplicateDecisions = decisions.length - new Set(decisions).size;
  const consistency = invalidReferences.length || duplicateDecisions ? 0 : 1;
  // BOŞ KÜMEDE 1 DEĞİL 0. Burada eskiden `outOfScope.length ? ... : 1` vardı:
  // hiç kapsam kararı vermemiş bir gönderim, kusursuz kapsam disiplini
  // gösterenle toplam skorun %25'inde AYNI puanı alıyordu. Bu bir ölçüm değil,
  // boş küme üzerinde vakum doğruluktu -- ölçülemeyen bir şey kanıtlanmış
  // sayılıyordu.
  //
  // 0 seçildi, "ölçülemedi" değil. Gerekçe: bu skorlayıcının KENDİ kuralı
  // zaten budur -- `ratio()` payda boşken 0 döner, yani hiç gereksinim
  // yazmamış bir gönderim `requirementTaskCoverage` = 0 alır, ölçüden muaf
  // tutulmaz. Kapsam kararı da aynı sınıftandır: "neyi YAPMAYACAĞIM" demek
  // planlamanın bir işidir, yapılmaması bir eksikliktir. Ayrıca çalışmanın
  // ölçtüğü şey tam olarak budur; hiç kapsam kararı üretmeyen bir kolu
  // ölçüden muaf tutmak, o kolun lehine ağırlık dağıtmak olurdu.
  const scopeContainment = ratio(outOfScope.length - scopeLeaks.length, outOfScope.length);
  const score = Math.round(100 * (
    scopeContainment * 0.25 +
    requirementTaskCoverage * 0.25 +
    requirementTestCoverage * 0.20 +
    acceptanceCriteriaCoverage * 0.20 +
    consistency * 0.10
  ));
  return {
    blindId: submission.blindId,
    scenarioId: submission.scenarioId,
    score,
    metrics: {
      scopeContainment: rounded(scopeContainment),
      requirementTaskCoverage: rounded(requirementTaskCoverage),
      requirementTestCoverage: rounded(requirementTestCoverage),
      acceptanceCriteriaCoverage: rounded(acceptanceCriteriaCoverage),
      consistency,
      manualEditCount: submission.manualEditCount,
      setupDurationSeconds: submission.setupDurationSeconds,
      planningDurationSeconds: submission.planningDurationSeconds,
      endToEndDurationSeconds: submission.endToEndDurationSeconds,
      agentFirstPassCompleted: submission.agentFirstPassCompleted,
      humanScores: humanScoresFor(humanEvaluations, submission.blindId, criteria)
    },
    findings: [
      ...(scopeLeaks.length ? [`Kapsam dışı görevler: ${scopeLeaks.join(', ')}`] : []),
      // Sıfır puanın SEBEBİ okunabilir kalır: "hiç kapsam kararı yok" ile
      // "kapsam kararı verildi ama sızdırıldı" aynı puanı alsa da aynı kusur
      // değildir.
      ...(outOfScope.length ? [] : ['Hiç kapsam dışı kararı kaydedilmemiş; kapsam koruması ölçülemez.']),
      ...(requirementTaskCoverage < 1 ? ['Bazı gereksinimler göreve bağlı değil.'] : []),
      ...(requirementTestCoverage < 1 ? ['Bazı gereksinimler teste bağlı değil.'] : []),
      ...(acceptanceCriteriaCoverage < 1 ? ['Bazı görevlerin kabul kriteri yok.'] : []),
      ...(invalidReferences.length ? ['Var olmayan gereksinim veya test referansı bulundu.'] : []),
      ...(duplicateDecisions ? ['Yinelenen karar ifadeleri bulundu.'] : [])
    ]
  };
}

/**
 * Kör değerlendirmeleri doğrular.
 *
 * Bu daha önce yalnız bir yorumdu: "eksik ölçüt reddedilir" yazıyordu ama
 * hiçbir şey zorlamıyordu; eksik ölçüt sessizce `null` olup ortalamadan
 * düşüyordu. Bir değerlendirici bir ölçütü boş bırakırsa sonuç, o ölçütü hiç
 * ölçülmemiş gibi gösterirdi — ve bu, kötü giden bir ölçütü sessizce
 * kaybetmenin en kolay yoluydu.
 *
 * Fazla ölçüt de reddedilir: çalışma tanımında olmayan bir ölçüte verilen puan
 * hiçbir yere yazılmaz, yani değerlendiricinin emeği sessizce çöpe giderdi.
 */
export function validateHumanEvaluations(
  evaluations: HumanEvaluation[],
  criteria: readonly string[]
): HumanEvaluation[] {
  const expected = new Set(criteria);
  for (const evaluation of evaluations) {
    if (!evaluation.blindId || !evaluation.evaluatorId) {
      throw new Error('Değerlendirme kaydı kör kimlik ve değerlendirici kimliği içermeli.');
    }
    const given = Object.keys(evaluation.scores || {});
    const missing = criteria.filter(criterion => !given.includes(criterion));
    if (missing.length) {
      throw new Error(`${evaluation.blindId} değerlendirmesinde eksik ölçüt: ${missing.join(', ')}`);
    }
    const unknown = given.filter(criterion => !expected.has(criterion));
    if (unknown.length) {
      throw new Error(`${evaluation.blindId} değerlendirmesinde çalışmada tanımsız ölçüt: ${unknown.join(', ')}`);
    }
    for (const criterion of criteria) {
      const value = evaluation.scores[criterion];
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        throw new Error(`${evaluation.blindId} · ${criterion} puanı 1-5 aralığında bir tam sayı olmalı.`);
      }
    }
  }
  return evaluations;
}

export function validateAnonymousUserSessions(sessions: AnonymousUserSession[]): AnonymousUserSession[] {
  const allowed = new Set([
    'schemaVersion', 'anonymousSessionId', 'capabilityId', 'consent', 'completed',
    'firstExportReached', 'mvpAcceptedWithMinorEdits', 'manualEditCount',
    'setupDurationSeconds', 'planningDurationSeconds', 'endToEndDurationSeconds',
    'satisfaction', 'wouldUsePlan'
  ]);
  const ids = new Set<string>();
  return sessions.map(session => {
    if (Object.keys(session).some(key => !allowed.has(key))) throw new Error('Kullanıcı evidence kaydı izin verilmeyen alan içeriyor.');
    if (session.schemaVersion !== 2 || session.consent !== true || !session.anonymousSessionId || ids.has(session.anonymousSessionId)) {
      throw new Error('Anonim kullanıcı evidence kaydı geçersiz veya yineleniyor.');
    }
    const durations = [session.setupDurationSeconds, session.planningDurationSeconds, session.endToEndDurationSeconds];
    if (!Number.isInteger(session.manualEditCount) || session.manualEditCount < 0 ||
        durations.some(value => !Number.isFinite(value) || value < 0) ||
        typeof session.wouldUsePlan !== 'boolean' ||
        !Number.isInteger(session.satisfaction) || session.satisfaction < 1 || session.satisfaction > 5) {
      throw new Error('Anonim kullanıcı evidence metrikleri geçersiz.');
    }
    // Uçtan uca süre parçalarından kısa olamaz. Transkripsiyon hatasını
    // yakalar; parçaların toplamına eşit olması ŞART DEĞİL — aralarda mola
    // olabilir.
    if (session.endToEndDurationSeconds < session.setupDurationSeconds ||
        session.endToEndDurationSeconds < session.planningDurationSeconds) {
      throw new Error('Uçtan uca süre, kurulum veya planlama süresinden kısa olamaz.');
    }
    ids.add(session.anonymousSessionId);
    return session;
  });
}

export function buildComparisonReport(input: {
  studyId: string;
  submissions: BlindComparisonSubmission[];
  mapping: BlindMethodMapping[];
  humanEvaluations?: HumanEvaluation[];
  userSessions?: AnonymousUserSession[];
  policy: ComparisonStudyPolicy;
  /** Çalışmanın ilan ettiği ölçütler; kod kendi listesini tutmaz. */
  criteria: readonly string[];
  generatedAt?: string;
}): ComparisonReport {
  const mapping = new Map(input.mapping.map(item => [item.blindId, item.method]));
  if (mapping.size !== input.mapping.length) throw new Error('Kör yöntem eşlemesinde yinelenen kimlik var.');
  if (input.submissions.some(item => !mapping.has(item.blindId))) throw new Error('Her submission için kapalı yöntem eşlemesi gerekli.');
  const evaluated = input.submissions.map(item => evaluateBlindSubmission(item, input.criteria, input.humanEvaluations));
  const methods: ComparisonMethod[] = ['baseline-chat', 'master-prompt', 'promtgen'];
  const byMethod: ComparisonReport['byMethod'] = {};
  for (const method of methods) {
    const results = evaluated.filter(item => mapping.get(item.blindId) === method);
    if (!results.length) continue;
    byMethod[method] = {
      samples: results.length,
      averageScore: rounded(average(results.map(item => item.score))),
      averageScopeContainment: rounded(average(results.map(item => item.metrics.scopeContainment))),
      averageAcceptanceCoverage: rounded(average(results.map(item => item.metrics.acceptanceCriteriaCoverage))),
      averageRequirementTaskCoverage: rounded(average(results.map(item => item.metrics.requirementTaskCoverage))),
      averageSetupSeconds: averageOrNull(results.map(item => item.metrics.setupDurationSeconds)),
      averagePlanningSeconds: averageOrNull(results.map(item => item.metrics.planningDurationSeconds)),
      averageEndToEndSeconds: averageOrNull(results.map(item => item.metrics.endToEndDurationSeconds))
    };
  }
  const sessions = validateAnonymousUserSessions(input.userSessions || []);
  const promtgen = byMethod.promtgen;
  const baseline = byMethod['baseline-chat'];
  const blockers = [
    ...methods.flatMap(method => (byMethod[method]?.samples || 0) >= input.policy.minimumScenariosPerMethod
      ? []
      : [`${method} için en az ${input.policy.minimumScenariosPerMethod} kör senaryo gerekli.`]),
    ...(sessions.length >= input.policy.minimumUserParticipants
      ? []
      : [`En az ${input.policy.minimumUserParticipants} anonim kullanıcı oturumu gerekli.`]),
    ...(promtgen && baseline && promtgen.averageScopeContainment - baseline.averageScopeContainment >= input.policy.minimumPromtgenScopeImprovement
      ? []
      : ['PromtGen kapsam koruması baseline üstünlük eşiğini karşılamıyor.']),
    ...(promtgen && baseline && promtgen.averageAcceptanceCoverage - baseline.averageAcceptanceCoverage >= input.policy.minimumPromtgenAcceptanceImprovement
      ? []
      : ['PromtGen kabul kriteri kapsamı baseline üstünlük eşiğini karşılamıyor.'])
  ];
  return {
    schemaVersion: 2,
    studyId: input.studyId,
    generatedAt: input.generatedAt || new Date().toISOString(),
    blindedEvaluation: evaluated,
    byMethod,
    userEvidence: {
      validParticipants: sessions.length,
      completionRate: rounded(ratio(sessions.filter(item => item.completed).length, sessions.length)),
      firstExportRate: rounded(ratio(sessions.filter(item => item.firstExportReached).length, sessions.length)),
      minorEditMvpAcceptanceRate: rounded(ratio(sessions.filter(item => item.mvpAcceptedWithMinorEdits).length, sessions.length)),
      averageSatisfaction: rounded(average(sessions.map(item => item.satisfaction))),
      averageSetupSeconds: rounded(average(sessions.map(item => item.setupDurationSeconds))),
      averagePlanningSeconds: rounded(average(sessions.map(item => item.planningDurationSeconds))),
      averageEndToEndSeconds: rounded(average(sessions.map(item => item.endToEndDurationSeconds))),
      wouldUsePlanRate: rounded(ratio(sessions.filter(item => item.wouldUsePlan).length, sessions.length))
    },
    publicationGate: { eligible: blockers.length === 0, blockers }
  };
}
