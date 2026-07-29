import type { ProjectDocumentV5 } from '../contracts.js';
import {
  normalizeDecision,
  normalizeObjective,
  normalizeRequirement,
  normalizeRisk,
  normalizeTraceLink
} from '../canonical-entities.js';
import { createDocumentSet } from '../exporter.js';
import { getRequiredSections } from '../project-document.js';
import { analyzeIdea, recalculateReadiness, updatePlanSection } from '../planning-engine.js';
import { applyCompiledTaskPlan, compileTaskPlan } from '../task-compiler.js';

export interface PlannerBenchmarkRequirement {
  title: string;
  statement: string;
  kind: 'functional' | 'quality' | 'constraint';
  priority: 'must' | 'should' | 'could';
  acceptanceCriteria: string[];
}

export interface PlannerBenchmarkScenario {
  version: 1;
  id: string;
  title: string;
  domain: string;
  idea: string;
  targetUser: string;
  problem: string;
  desiredOutcome: string;
  mvpTarget: string;
  inScope: string[];
  outOfScope: string[];
  requirements: PlannerBenchmarkRequirement[];
  thresholds: {
    minimumReadiness: number;
    minimumMustTaskCoverage: number;
    minimumMustTestCoverage: number;
    minimumTaskAcceptanceCoverage: number;
  };
}

export interface PlannerBenchmarkScenarioResult {
  scenarioId: string;
  title: string;
  domain: string;
  passed: boolean;
  failures: string[];
  metrics: {
    readiness: number;
    mustTaskCoverage: number;
    mustTestCoverage: number;
    taskAcceptanceCoverage: number;
    scopeContradictions: number;
    exportFiles: number;
  };
  capabilityResults: Record<'canonical-planning' | 'canonical-export' | 'readiness-quality-gate', boolean>;
}

export interface PlannerBenchmarkReport {
  schemaVersion: 1;
  suiteId: 'planner-core-v1';
  scenarioCount: number;
  passedCount: number;
  passRate: number;
  generatedAt: string;
  results: PlannerBenchmarkScenarioResult[];
  capabilities: Record<string, { completed: number; passed: number }>;
}

const CORE_EXPORT_FILES = [
  'plan/master-plan.md',
  'documents/prd.md',
  'documents/tasks.md',
  'documents/requirements.md',
  'agents/runbook.md',
  'agents/generic.md'
];

function ratio(passed: number, total: number): number {
  return total ? passed / total : 0;
}

function buildScenarioProject(scenario: PlannerBenchmarkScenario): ProjectDocumentV5 {
  let project = analyzeIdea(scenario.idea, { outputLanguage: 'tr' }) as ProjectDocumentV5;
  project.planningDepth.selected = 'standard';
  project.ideaLabSession ??= {
    status: 'active',
    approaches: [],
    ideaNotes: [],
    candidateDecisions: [],
    candidateRisks: []
  };
  project.ideaLabSession.conceptSummary = {
    summary: scenario.idea,
    targetUser: scenario.targetUser,
    problemStatement: scenario.problem,
    currentAlternative: 'Dağınık araçlar ve manuel takip',
    desiredOutcome: scenario.desiredOutcome,
    interpretationConfidence: 1,
    confidenceRationale: ['Sürümlenmiş benchmark senaryosu tarafından açıkça tanımlandı.'],
    confirmedFeatures: scenario.inScope,
    outOfScope: scenario.outOfScope,
    technicalApproaches: [],
    knownRisks: ['Kapsamın kullanıcı onayı olmadan genişlemesi'],
    mvpTarget: scenario.mvpTarget,
    openQuestions: [],
    userConfirmed: true
  };

  const objectiveId = `${scenario.id}-objective`;
  project.objectives = [normalizeObjective({
    id: objectiveId,
    title: `${scenario.title} MVP sonucunu doğrula`,
    description: scenario.desiredOutcome,
    metric: 'Kabul kriteri başarı oranı',
    target: '%100 Must gereksinim doğrulaması',
    priority: 'must',
    status: 'accepted'
  })];
  project.requirements = scenario.requirements.map((requirement, index) => normalizeRequirement({
    ...requirement,
    id: `${scenario.id}-requirement-${index + 1}`,
    sourceObjectiveIds: [objectiveId],
    status: 'accepted'
  }, index));
  project.decisions = [normalizeDecision({
    id: `${scenario.id}-decision`,
    title: 'MVP kapsamını sabitle',
    decision: `${scenario.inScope.join(', ')} MVP kapsamında uygulanacak.`,
    rationale: 'İlk sürümün ölçülebilir ve uygulanabilir kalması için.',
    alternatives: ['Tüm özellikleri ilk sürüme almak'],
    consequences: ['Kapsam dışı özellikler sonraki revizyonlara bırakılır.'],
    affectedSectionIds: ['scope', 'requirements', 'tasks'],
    status: 'accepted'
  })];

  const compiled = compileTaskPlan(project);
  const applied = applyCompiledTaskPlan(project, compiled, { approved: true });
  if (!applied.success) throw new Error(`${scenario.id}: görev planı uygulanamadı: ${applied.reason}`);
  project = applied.project as ProjectDocumentV5;

  const riskId = `${scenario.id}-risk`;
  project.risks = [normalizeRisk({
    id: riskId,
    title: 'Kapsam sapması',
    description: 'MVP dışında bırakılan özellikler görevlere geri sızabilir.',
    probability: 'medium',
    impact: 'high',
    mitigation: 'Her görev canonical kapsam ve gereksinim bağlantısıyla doğrulanır.',
    owner: 'Proje sahibi',
    status: 'open'
  })];
  if (project.tasks[0]) {
    project.traceLinks.push(normalizeTraceLink({
      id: `${scenario.id}-risk-task-trace`,
      fromType: 'risk',
      fromId: riskId,
      toType: 'task',
      toId: project.tasks[0].id,
      relation: 'mitigates'
    }));
  }

  for (let pass = 0; pass < 3; pass += 1) {
    for (const sectionId of getRequiredSections(project.planningDepth.selected)) {
      const section = project.sections[sectionId];
      if (section && (section.status === 'stale' || (!section.content && !section.items.length))) {
        project = updatePlanSection(project, sectionId, {
          content: `${section.title}: ${scenario.mvpTarget}. Kaynak benchmark senaryosu ${scenario.id}.`
        }) as ProjectDocumentV5;
      }
    }
  }
  return recalculateReadiness(project) as ProjectDocumentV5;
}

export function runPlannerBenchmarkScenario(scenario: PlannerBenchmarkScenario): PlannerBenchmarkScenarioResult {
  const project = buildScenarioProject(scenario);
  const mustRequirements = project.requirements.filter(item => item.status === 'accepted' && item.priority === 'must');
  const mustTaskCoverage = ratio(
    mustRequirements.filter(requirement => project.tasks.some(task => task.requirementIds.includes(requirement.id))).length,
    mustRequirements.length
  );
  const mustTestCoverage = ratio(
    mustRequirements.filter(requirement => project.testCases.some(testCase => testCase.requirementIds.includes(requirement.id))).length,
    mustRequirements.length
  );
  const taskAcceptanceCoverage = ratio(
    project.tasks.filter(task => task.acceptanceCriteria.length > 0).length,
    project.tasks.length
  );
  const scopeContradictions = project.readiness.checks
    .filter(check => check.id === 'consistent.scope' && check.status !== 'passed').length;
  const documents = createDocumentSet(project, { adapters: ['generic'] }) as Record<string, string>;
  const exportComplete = CORE_EXPORT_FILES.every(fileName => Boolean(documents[fileName]?.trim()));
  const planningPassed =
    project.readiness.score >= scenario.thresholds.minimumReadiness &&
    mustTaskCoverage >= scenario.thresholds.minimumMustTaskCoverage &&
    mustTestCoverage >= scenario.thresholds.minimumMustTestCoverage &&
    taskAcceptanceCoverage >= scenario.thresholds.minimumTaskAcceptanceCoverage &&
    scopeContradictions === 0 &&
    project.readiness.blockers.length === 0;
  const readinessGatePassed =
    project.readiness.version === 3 &&
    project.readiness.calculationProfile === 'readiness-3.0' &&
    project.readiness.qualityGate.passed &&
    /^readiness-fnv1a32-[a-f0-9]{8}$/.test(project.readiness.evidenceHash) &&
    Object.values(project.readiness.dimensionEvidence).every(item => item.possible > 0);
  const failures = [
    ...(project.readiness.score >= scenario.thresholds.minimumReadiness ? [] : [`Readiness ${project.readiness.score}/${scenario.thresholds.minimumReadiness}`]),
    ...(mustTaskCoverage >= scenario.thresholds.minimumMustTaskCoverage ? [] : ['Must gereksinim-görev kapsamı düşük.']),
    ...(mustTestCoverage >= scenario.thresholds.minimumMustTestCoverage ? [] : ['Must gereksinim-test kapsamı düşük.']),
    ...(taskAcceptanceCoverage >= scenario.thresholds.minimumTaskAcceptanceCoverage ? [] : ['Görev kabul kriteri kapsamı düşük.']),
    ...(scopeContradictions === 0 ? [] : ['Kapsam dışı öğe canonical görevlerde bulundu.']),
    ...(project.readiness.blockers.length === 0 ? [] : project.readiness.blockers),
    ...(exportComplete ? [] : ['Çekirdek export dosyaları eksik.'])
  ];
  return {
    scenarioId: scenario.id,
    title: scenario.title,
    domain: scenario.domain,
    passed: planningPassed && exportComplete,
    failures,
    metrics: {
      readiness: project.readiness.score,
      mustTaskCoverage,
      mustTestCoverage,
      taskAcceptanceCoverage,
      scopeContradictions,
      exportFiles: Object.keys(documents).length
    },
    capabilityResults: {
      'canonical-planning': planningPassed,
      'canonical-export': exportComplete,
      'readiness-quality-gate': readinessGatePassed
    }
  };
}

export function runPlannerBenchmark(
  scenarios: PlannerBenchmarkScenario[],
  generatedAt = new Date().toISOString()
): PlannerBenchmarkReport {
  const ids = new Set<string>();
  for (const scenario of scenarios) {
    if (scenario.version !== 1 || !scenario.id || ids.has(scenario.id)) {
      throw new Error(`Geçersiz veya yinelenen benchmark senaryosu: ${scenario.id || '(kimlik yok)'}`);
    }
    ids.add(scenario.id);
  }
  const results = scenarios.map(runPlannerBenchmarkScenario);
  const capabilityIds = ['canonical-planning', 'canonical-export', 'readiness-quality-gate'] as const;
  const capabilities = Object.fromEntries(capabilityIds.map(capabilityId => [
    capabilityId,
    {
      completed: results.length,
      passed: results.filter(result => result.capabilityResults[capabilityId]).length
    }
  ]));
  const passedCount = results.filter(result => result.passed).length;
  return {
    schemaVersion: 1,
    suiteId: 'planner-core-v1',
    scenarioCount: results.length,
    passedCount,
    passRate: ratio(passedCount, results.length),
    generatedAt,
    results,
    capabilities
  };
}
