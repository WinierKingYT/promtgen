import type { ConceptSummary, ProjectDocumentV5 } from '../contracts.js';
import {
  analyzeDiscoverySignals,
  createInitialConceptInterpretation,
  getConceptAgreementGate,
  updateConceptAgreement,
  type DiscoveryConcernId
} from '../application/idea-discussion-service.js';
import {
  analyzeIdea,
  applyIdeaExpansion,
  confirmConceptSummary
} from '../planning-engine.js';
import { generateExpansionDimensions } from '../ai-discovery.js';

export interface DiscoveryBenchmarkReference {
  summary: string;
  targetUser: string;
  targetUserTerms: string[];
  problemStatement: string;
  currentAlternative: string;
  desiredOutcome: string;
  confirmedFeatures: string[];
  outOfScope: string[];
  mvpTarget: string;
}

export interface DiscoveryBenchmarkScenario {
  version: 1;
  id: string;
  title: string;
  category: 'ambiguous' | 'adversarial';
  rawIdea: string;
  simulatedClarification: string;
  expectedConcerns: DiscoveryConcernId[];
  reference: DiscoveryBenchmarkReference;
  thresholds: {
    minimumConcernRecall: number;
    maximumInterpretationConfidence: number;
  };
}

export interface DiscoveryBenchmarkScenarioResult {
  scenarioId: string;
  title: string;
  category: DiscoveryBenchmarkScenario['category'];
  passed: boolean;
  failures: string[];
  detectedConcerns: DiscoveryConcernId[];
  questions: string[];
  metrics: {
    concernRecall: number;
    initialTargetUserTermRecall: number;
    questionsAsked: number;
    correctionFields: number;
    interpretationConfidence: number;
    prematureTechnicalDecisions: number;
    canonicalScopeCoverage: number;
    outOfScopeCoverage: number;
    autoConfirmed: boolean;
    agreementReadyAfterUserCorrection: boolean;
  };
}

export interface DiscoveryBenchmarkReport {
  schemaVersion: 1;
  suiteId: 'guided-discovery-v1';
  scenarioCount: number;
  passedCount: number;
  passRate: number;
  generatedAt: string;
  results: DiscoveryBenchmarkScenarioResult[];
  aggregate: {
    concernRecall: number;
    initialTargetUserTermRecall: number;
    averageQuestionsAsked: number;
    averageCorrectionFields: number;
    automaticConfirmationCount: number;
    prematureTechnicalDecisionCount: number;
  };
}

const CORRECTION_FIELDS = [
  'summary',
  'targetUser',
  'problemStatement',
  'currentAlternative',
  'desiredOutcome',
  'confirmedFeatures',
  'outOfScope',
  'mvpTarget'
] as const;

function normalize(value: unknown): string {
  return String(value || '').toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function ratio(passed: number, total: number): number {
  return total ? passed / total : 1;
}

function listCoverage(expected: string[], actual: string[]): number {
  const actualText = normalize(actual.join(' '));
  return ratio(expected.filter(item => actualText.includes(normalize(item))).length, expected.length);
}

function changedFieldCount(initial: ConceptSummary, reference: DiscoveryBenchmarkReference): number {
  return CORRECTION_FIELDS.filter(field =>
    JSON.stringify(initial[field]) !== JSON.stringify(reference[field])
  ).length;
}

function ensureConceptProject(
  initial: ProjectDocumentV5,
  scenario: DiscoveryBenchmarkScenario
): ProjectDocumentV5 {
  if (initial.ideaLabSession?.conceptSummary) return initial;
  const dimensions = generateExpansionDimensions(initial.identity.originalIdea);
  const firstDimension = dimensions[0];
  return applyIdeaExpansion(initial, {
    dimensions,
    answers: firstDimension ? { [firstDimension.id]: scenario.simulatedClarification } : {}
  }) as ProjectDocumentV5;
}

export function runDiscoveryBenchmarkScenario(
  scenario: DiscoveryBenchmarkScenario
): DiscoveryBenchmarkScenarioResult {
  const initialProject = analyzeIdea(scenario.rawIdea, { outputLanguage: 'tr' }) as ProjectDocumentV5;
  const initialInterpretation = createInitialConceptInterpretation(initialProject);
  const signalAnalysis = analyzeDiscoverySignals(initialProject);
  const detectedConcerns = signalAnalysis.concerns.map(concern => concern.id);
  const concernRecall = ratio(
    scenario.expectedConcerns.filter(concern => detectedConcerns.includes(concern)).length,
    scenario.expectedConcerns.length
  );
  const targetUserText = normalize(initialInterpretation.targetUser);
  const initialTargetUserTermRecall = ratio(
    scenario.reference.targetUserTerms.filter(term => targetUserText.includes(normalize(term))).length,
    scenario.reference.targetUserTerms.length
  );
  const correctionFields = changedFieldCount(initialInterpretation, scenario.reference);
  let project = ensureConceptProject(initialProject, scenario);
  project = updateConceptAgreement(project, {
    ...scenario.reference,
    interpretationConfidence: initialInterpretation.interpretationConfidence,
    confidenceRationale: initialInterpretation.confidenceRationale,
    technicalApproaches: [],
    knownRisks: project.ideaLabSession?.conceptSummary?.knownRisks || [],
    openQuestions: []
  });
  const agreementReadyAfterUserCorrection = getConceptAgreementGate(project).ready;
  const confirmed = agreementReadyAfterUserCorrection
    ? confirmConceptSummary(project) as ProjectDocumentV5
    : project;
  const canonicalScopeCoverage = listCoverage(
    scenario.reference.confirmedFeatures,
    confirmed.sections.scope?.items || []
  );
  const outOfScopeCoverage = listCoverage(
    scenario.reference.outOfScope,
    [confirmed.sections.scope?.content || '']
  );
  const metrics = {
    concernRecall,
    initialTargetUserTermRecall,
    questionsAsked: initialInterpretation.openQuestions.length,
    correctionFields,
    interpretationConfidence: initialInterpretation.interpretationConfidence,
    prematureTechnicalDecisions: initialInterpretation.technicalApproaches.length,
    canonicalScopeCoverage,
    outOfScopeCoverage,
    autoConfirmed: initialInterpretation.userConfirmed,
    agreementReadyAfterUserCorrection
  };
  const failures = [
    ...(concernRecall >= scenario.thresholds.minimumConcernRecall ? [] : ['Beklenen kritik discovery sinyalleri yakalanamadı.']),
    ...(metrics.questionsAsked >= 1 && metrics.questionsAsked <= 5 ? [] : ['Sistem 1–5 arası odaklı kritik soru üretmedi.']),
    ...(metrics.interpretationConfidence <= scenario.thresholds.maximumInterpretationConfidence ? [] : ['Belirsiz fikir için yorum güveni gereğinden yüksek.']),
    ...(!metrics.autoConfirmed ? [] : ['Sistem yorumu kullanıcı onayı olmadan kesinleştirildi.']),
    ...(metrics.prematureTechnicalDecisions === 0 ? [] : ['Kullanıcı seçimi olmadan teknik yaklaşım kesinleştirildi.']),
    ...(metrics.agreementReadyAfterUserCorrection ? [] : ['Simüle edilen kullanıcı düzeltmesi onay kapısını açmadı.']),
    ...(metrics.canonicalScopeCoverage === 1 ? [] : ['Onaylanan MVP kapsamı canonical scope alanına kayıpsız taşınmadı.']),
    ...(metrics.outOfScopeCoverage === 1 ? [] : ['Onaylanan kapsam dışı maddeler canonical planda korunmadı.'])
  ];

  return {
    scenarioId: scenario.id,
    title: scenario.title,
    category: scenario.category,
    passed: failures.length === 0,
    failures,
    detectedConcerns,
    questions: initialInterpretation.openQuestions,
    metrics
  };
}

export function runDiscoveryBenchmark(
  scenarios: DiscoveryBenchmarkScenario[],
  generatedAt = new Date().toISOString()
): DiscoveryBenchmarkReport {
  const ids = new Set<string>();
  for (const scenario of scenarios) {
    if (scenario.version !== 1 || !scenario.id || ids.has(scenario.id) || !scenario.rawIdea.trim()) {
      throw new Error(`Geçersiz veya yinelenen discovery senaryosu: ${scenario.id || '(kimlik yok)'}`);
    }
    if (!scenario.expectedConcerns.length || !scenario.reference.confirmedFeatures.length || !scenario.reference.outOfScope.length) {
      throw new Error(`${scenario.id}: benchmark referansı kritik sinyal, MVP içi ve kapsam dışı veri taşımalı.`);
    }
    ids.add(scenario.id);
  }
  const results = scenarios.map(runDiscoveryBenchmarkScenario);
  const average = (pick: (result: DiscoveryBenchmarkScenarioResult) => number) =>
    results.length ? results.reduce((total, result) => total + pick(result), 0) / results.length : 0;
  const passedCount = results.filter(result => result.passed).length;
  return {
    schemaVersion: 1,
    suiteId: 'guided-discovery-v1',
    scenarioCount: results.length,
    passedCount,
    passRate: ratio(passedCount, results.length),
    generatedAt,
    results,
    aggregate: {
      concernRecall: average(result => result.metrics.concernRecall),
      initialTargetUserTermRecall: average(result => result.metrics.initialTargetUserTermRecall),
      averageQuestionsAsked: average(result => result.metrics.questionsAsked),
      averageCorrectionFields: average(result => result.metrics.correctionFields),
      automaticConfirmationCount: results.filter(result => result.metrics.autoConfirmed).length,
      prematureTechnicalDecisionCount: results.reduce((total, result) => total + result.metrics.prematureTechnicalDecisions, 0)
    }
  };
}
