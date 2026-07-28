export type ComparisonMethod = 'baseline-chat' | 'master-prompt' | 'promtgen';

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

export interface BlindComparisonSubmission {
  schemaVersion: 1;
  blindId: string;
  scenarioId: string;
  inScope: string[];
  outOfScope: string[];
  requirements: ComparisonRequirement[];
  tasks: ComparisonTask[];
  tests: ComparisonTest[];
  decisionStatements: string[];
  planningDurationSeconds: number | null;
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
  understandability: 1 | 2 | 3 | 4 | 5;
  applicability: 1 | 2 | 3 | 4 | 5;
}

export interface AnonymousUserSession {
  schemaVersion: 1;
  anonymousSessionId: string;
  capabilityId: string;
  consent: true;
  completed: boolean;
  firstExportReached: boolean;
  mvpAcceptedWithMinorEdits: boolean;
  manualEditCount: number;
  durationSeconds: number;
  satisfaction: 1 | 2 | 3 | 4 | 5;
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
    planningDurationSeconds: number | null;
    agentFirstPassCompleted: boolean | null;
    humanUnderstandability: number | null;
    humanApplicability: number | null;
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
  schemaVersion: 1;
  studyId: string;
  generatedAt: string;
  blindedEvaluation: BlindEvaluationResult[];
  byMethod: Partial<Record<ComparisonMethod, {
    samples: number;
    averageScore: number;
    averageScopeContainment: number;
    averageAcceptanceCoverage: number;
    averageRequirementTaskCoverage: number;
  }>>;
  userEvidence: {
    validParticipants: number;
    completionRate: number;
    firstExportRate: number;
    minorEditMvpAcceptanceRate: number;
    averageSatisfaction: number;
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

function humanAverage(evaluations: HumanEvaluation[], blindId: string, key: 'understandability' | 'applicability'): number | null {
  const values = evaluations.filter(item => item.blindId === blindId).map(item => item[key]);
  return values.length ? rounded(average(values)) : null;
}

export function evaluateBlindSubmission(
  submission: BlindComparisonSubmission,
  humanEvaluations: HumanEvaluation[] = []
): BlindEvaluationResult {
  if (submission.schemaVersion !== 1 || !submission.blindId || !submission.scenarioId) {
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
  const scopeContainment = outOfScope.length ? 1 - scopeLeaks.length / outOfScope.length : 1;
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
      planningDurationSeconds: submission.planningDurationSeconds,
      agentFirstPassCompleted: submission.agentFirstPassCompleted,
      humanUnderstandability: humanAverage(humanEvaluations, submission.blindId, 'understandability'),
      humanApplicability: humanAverage(humanEvaluations, submission.blindId, 'applicability')
    },
    findings: [
      ...(scopeLeaks.length ? [`Kapsam dışı görevler: ${scopeLeaks.join(', ')}`] : []),
      ...(requirementTaskCoverage < 1 ? ['Bazı gereksinimler göreve bağlı değil.'] : []),
      ...(requirementTestCoverage < 1 ? ['Bazı gereksinimler teste bağlı değil.'] : []),
      ...(acceptanceCriteriaCoverage < 1 ? ['Bazı görevlerin kabul kriteri yok.'] : []),
      ...(invalidReferences.length ? ['Var olmayan gereksinim veya test referansı bulundu.'] : []),
      ...(duplicateDecisions ? ['Yinelenen karar ifadeleri bulundu.'] : [])
    ]
  };
}

export function validateAnonymousUserSessions(sessions: AnonymousUserSession[]): AnonymousUserSession[] {
  const allowed = new Set([
    'schemaVersion', 'anonymousSessionId', 'capabilityId', 'consent', 'completed',
    'firstExportReached', 'mvpAcceptedWithMinorEdits', 'manualEditCount', 'durationSeconds', 'satisfaction'
  ]);
  const ids = new Set<string>();
  return sessions.map(session => {
    if (Object.keys(session).some(key => !allowed.has(key))) throw new Error('Kullanıcı evidence kaydı izin verilmeyen alan içeriyor.');
    if (session.schemaVersion !== 1 || session.consent !== true || !session.anonymousSessionId || ids.has(session.anonymousSessionId)) {
      throw new Error('Anonim kullanıcı evidence kaydı geçersiz veya yineleniyor.');
    }
    if (!Number.isInteger(session.manualEditCount) || session.manualEditCount < 0 ||
        !Number.isFinite(session.durationSeconds) || session.durationSeconds < 0 ||
        !Number.isInteger(session.satisfaction) || session.satisfaction < 1 || session.satisfaction > 5) {
      throw new Error('Anonim kullanıcı evidence metrikleri geçersiz.');
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
  generatedAt?: string;
}): ComparisonReport {
  const mapping = new Map(input.mapping.map(item => [item.blindId, item.method]));
  if (mapping.size !== input.mapping.length) throw new Error('Kör yöntem eşlemesinde yinelenen kimlik var.');
  if (input.submissions.some(item => !mapping.has(item.blindId))) throw new Error('Her submission için kapalı yöntem eşlemesi gerekli.');
  const evaluated = input.submissions.map(item => evaluateBlindSubmission(item, input.humanEvaluations));
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
      averageRequirementTaskCoverage: rounded(average(results.map(item => item.metrics.requirementTaskCoverage)))
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
    schemaVersion: 1,
    studyId: input.studyId,
    generatedAt: input.generatedAt || new Date().toISOString(),
    blindedEvaluation: evaluated,
    byMethod,
    userEvidence: {
      validParticipants: sessions.length,
      completionRate: rounded(ratio(sessions.filter(item => item.completed).length, sessions.length)),
      firstExportRate: rounded(ratio(sessions.filter(item => item.firstExportReached).length, sessions.length)),
      minorEditMvpAcceptanceRate: rounded(ratio(sessions.filter(item => item.mvpAcceptedWithMinorEdits).length, sessions.length)),
      averageSatisfaction: rounded(average(sessions.map(item => item.satisfaction)))
    },
    publicationGate: { eligible: blockers.length === 0, blockers }
  };
}
