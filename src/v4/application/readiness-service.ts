import type { ProjectDocumentV5, ReadinessAction, ReadinessCheck, ReadinessDimension, ReadinessResult } from '../contracts.js';
import { analyzeCanonicalTraceability } from '../canonical-graph.js';
import { getRequiredSections } from '../project-document.js';
import { assessWebSaasPack } from '../domain-packs/web-saas.js';
import { evaluateRequirementQuality } from './requirement-quality-service.js';

const DIMENSION_WEIGHTS: Record<ReadinessDimension, number> = {
  completeness: 20,
  consistency: 20,
  traceability: 25,
  riskCoverage: 15,
  implementationReadiness: 20
};

const DIMENSION_LABELS: Record<ReadinessDimension, string> = {
  completeness: 'Tamlık',
  consistency: 'Tutarlılık',
  traceability: 'İzlenebilirlik',
  riskCoverage: 'Risk kapsamı',
  implementationReadiness: 'Uygulamaya hazırlık'
};

interface CheckInput {
  id: string;
  dimension: ReadinessDimension;
  label: string;
  passed: boolean;
  points: number;
  failure: string;
  blocking?: boolean;
  warning?: boolean;
  entityIds?: string[];
  partialCredit?: number;
  evidence?: { satisfied: number; total: number };
  sectionId?: string;
  actionLabel?: string;
}

function check(input: CheckInput): ReadinessCheck {
  const partialCredit = Math.max(0, Math.min(1, input.partialCredit || 0));
  return {
    id: input.id,
    dimension: input.dimension,
    label: input.label,
    status: input.passed ? 'passed' : input.blocking ? 'blocked' : 'warning',
    earned: input.passed ? input.points : Math.round(input.points * partialCredit),
    possible: input.points,
    message: input.passed ? `${input.label} doğrulandı.` : input.failure,
    blocking: Boolean(input.blocking),
    entityIds: input.entityIds || [],
    ...(input.sectionId ? { sectionId: input.sectionId } : {}),
    ...(input.actionLabel ? { actionLabel: input.actionLabel } : {}),
    ...(input.evidence ? { evidence: input.evidence } : {})
  };
}

function clean(value: unknown): string {
  return String(value || '').trim();
}

function normalized(value: unknown): string {
  return clean(value)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9çğıöşü]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SCOPE_STOP_WORDS = new Set(['bir', 'ile', 've', 'veya', 'icin', 'olan', 'olarak', 'the', 'and', 'for', 'with']);

function meaningfulTokens(value: unknown): string[] {
  return [...new Set(normalized(value).split(' ').filter(token => token.length >= 3 && !SCOPE_STOP_WORDS.has(token)))];
}

function ratio(satisfied: number, total: number, emptyValue = 0): number {
  return total ? satisfied / total : emptyValue;
}

function hasTaskDependencyCycle(project: ProjectDocumentV5): boolean {
  const tasks = new Map(project.tasks.map(task => [task.id, task]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (taskId: string): boolean => {
    if (visiting.has(taskId)) return true;
    if (visited.has(taskId)) return false;
    visiting.add(taskId);
    for (const dependencyId of tasks.get(taskId)?.dependencies || []) {
      if (tasks.has(dependencyId) && visit(dependencyId)) return true;
    }
    visiting.delete(taskId);
    visited.add(taskId);
    return false;
  };
  return project.tasks.some(task => visit(task.id));
}

function findScopeContradictions(project: ProjectDocumentV5): string[] {
  const excluded = (project.ideaLabSession?.conceptSummary?.outOfScope || [])
    .map(item => ({ source: item, normalized: normalized(item), tokens: meaningfulTokens(item) }))
    .filter(item => item.normalized.length >= 5 && item.tokens.length > 0);
  const canonicalText = [
    ...project.requirements.filter(item => item.status === 'accepted').map(item => `${item.title} ${item.statement}`),
    ...project.tasks.map(item => `${item.title} ${item.description}`)
  ].map(normalized);
  return excluded
    .filter(item => canonicalText.some(text => {
      if (text.includes(item.normalized)) return true;
      const matched = item.tokens.filter(token => text.includes(token)).length;
      return item.tokens.length >= 2 && matched >= Math.max(2, Math.ceil(item.tokens.length * 0.7));
    }))
    .map(item => item.source);
}

function findDuplicateAcceptedRequirements(project: ProjectDocumentV5): string[] {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const requirement of project.requirements.filter(item => item.status === 'accepted')) {
    const key = normalized(requirement.statement || requirement.title);
    if (!key) continue;
    if (seen.has(key)) duplicates.push(requirement.id);
    else seen.set(key, requirement.id);
  }
  return duplicates;
}

function hasRiskTaskLink(project: ProjectDocumentV5, riskId: string): boolean {
  return project.traceLinks.some(link =>
    link.relation === 'mitigates' &&
    ((link.fromType === 'risk' && link.fromId === riskId && link.toType === 'task') ||
      (link.toType === 'risk' && link.toId === riskId && link.fromType === 'task'))
  );
}

function percentage(checks: ReadinessCheck[], dimension: ReadinessDimension): number {
  const relevant = checks.filter(item => item.dimension === dimension);
  const possible = relevant.reduce((total, item) => total + item.possible, 0);
  const earned = relevant.reduce((total, item) => total + item.earned, 0);
  return possible ? Math.round((earned / possible) * 100) : 100;
}

function buildNextActions(checks: ReadinessCheck[]): ReadinessAction[] {
  const dimensionTotals = new Map<ReadinessDimension, number>();
  for (const item of checks) {
    dimensionTotals.set(item.dimension, (dimensionTotals.get(item.dimension) || 0) + item.possible);
  }
  return checks
    .filter(item => item.status !== 'passed')
    .map(item => {
      const dimensionTotal = dimensionTotals.get(item.dimension) || item.possible;
      const scoreImpact = Math.round(
        ((item.possible - item.earned) / dimensionTotal) * DIMENSION_WEIGHTS[item.dimension] * 10
      ) / 10;
      return {
        checkId: item.id,
        label: item.actionLabel || item.label,
        message: item.message,
        priority: item.status === 'blocked' ? 'critical' as const : 'recommended' as const,
        sectionId: item.sectionId,
        entityIds: item.entityIds,
        scoreImpact
      };
    })
    .sort((a, b) =>
      (a.priority === b.priority ? 0 : a.priority === 'critical' ? -1 : 1) ||
      b.scoreImpact - a.scoreImpact ||
      a.label.localeCompare(b.label, 'tr')
    )
    .slice(0, 5);
}

export function calculateReadiness(project: ProjectDocumentV5): {
  readiness: ReadinessResult;
  traceability: ReturnType<typeof analyzeCanonicalTraceability>['report'];
} {
  const summary = project.ideaLabSession?.conceptSummary;
  const requiredSections = getRequiredSections(project.planningDepth.selected)
    .map(id => project.sections[id])
    .filter(Boolean);
  const emptyRequired = requiredSections.filter(section => !clean(section.content) && !section.items.length);
  const staleSections = Object.values(project.sections).filter(section => section.status === 'stale');
  const staleRequiredSections = requiredSections.filter(section => section.status === 'stale');
  const staleOptionalSections = staleSections.filter(section => !section.required);
  const requirementQuality = evaluateRequirementQuality(project);
  const acceptedRequirements = project.requirements.filter(item => item.status === 'accepted');
  const acceptedMust = acceptedRequirements.filter(item => item.priority === 'must');
  const acceptedObjectives = project.objectives.filter(item => item.status === 'accepted');
  const acceptedDecisions = project.decisions.filter(item => item.status === 'accepted');
  const scopeContradictions = findScopeContradictions(project);
  const duplicateRequirements = findDuplicateAcceptedRequirements(project);
  const dependencyCycle = hasTaskDependencyCycle(project);
  const unresolvedDiscussionQuestions = (project.ideaDiscussion?.records || [])
    .filter(item => item.kind === 'question' && item.status === 'pending');
  const openCriticalQuestions = [
    ...(summary?.openQuestions || []),
    ...(project.openQuestions || []),
    ...unresolvedDiscussionQuestions.map(item => item.text)
  ];
  const criticalRisks = project.risks.filter(item => item.status === 'open' && item.impact === 'high');
  const activeRisks = project.risks.filter(item => item.status === 'open');
  const securityRequirements = acceptedRequirements.filter(item =>
    item.kind !== 'functional' && /güven|security|privacy|gizli|kimlik|yetki|şifre|secret/i.test(`${item.title} ${item.statement}`)
  );
  const testIds = new Set(project.testCases.map(item => item.id));
  const taskIds = new Set(project.tasks.map(item => item.id));
  const acceptedRequirementIds = new Set(acceptedRequirements.map(item => item.id));
  const invalidDependencies = project.tasks.flatMap(task =>
    task.dependencies.filter(id => !taskIds.has(id)).map(id => `${task.id}:${id}`)
  );
  const invalidTaskRequirementLinks = project.tasks.flatMap(task =>
    task.requirementIds.filter(id => !acceptedRequirementIds.has(id)).map(id => `${task.id}:${id}`)
  );
  const invalidVerifications = project.tasks.flatMap(task =>
    task.verificationIds.filter(id => !testIds.has(id)).map(id => `${task.id}:${id}`)
  );
  const invalidTestRequirementLinks = project.testCases.flatMap(testCase =>
    testCase.requirementIds.filter(id => !acceptedRequirementIds.has(id)).map(id => `${testCase.id}:${id}`)
  );
  const weakTests = project.testCases.filter(testCase =>
    testCase.requirementIds.length === 0 ||
    testCase.steps.length === 0 ||
    clean(testCase.expectedResult).length < 8
  );
  const broadTasks = project.tasks.filter(task =>
    task.effort === 'high' && (task.requirementIds.length > 2 || task.acceptanceCriteria.length > 5)
  );
  const incompleteTaskContracts = project.tasks.filter(task =>
    task.contract?.version !== 2 ||
    !clean(task.contract?.objective) ||
    !task.contract?.inScope?.length ||
    !task.contract?.outOfScope?.length ||
    !task.contract?.filePolicy?.forbiddenPaths?.length ||
    !task.contract?.verification?.testCaseIds?.length ||
    !task.contract?.expectedOutputs?.length ||
    !task.contract?.completionEvidence?.length ||
    !clean(task.contract?.rollbackPlan)
  );
  const unresolvedFilePolicies = project.tasks.filter(task => task.contract?.filePolicy?.status !== 'confirmed');
  const unresolvedCommandDiscovery = project.tasks.filter(task => task.contract?.verification?.requiresCommandDiscovery);
  const tasksWithAcceptance = project.tasks.filter(item => item.acceptanceCriteria.length > 0).length;
  const tasksWithValidVerification = project.tasks.filter(item =>
    item.verificationIds.length > 0 && item.verificationIds.every(id => testIds.has(id))
  ).length;
  const tasksWithDetail = project.tasks.filter(item => clean(item.description).length >= 8).length;
  const requirementsWithObjective = acceptedRequirements.filter(item =>
    item.sourceObjectiveIds.some(id => acceptedObjectives.some(objective => objective.id === id))
  ).length;
  const risksWithTask = activeRisks.filter(item => hasRiskTaskLink(project, item.id)).length;
  const lastReview = project.metadata?.lastReview as { revision?: number } | undefined;
  const reviewIsCurrent = (lastReview?.revision || 0) >= project.canonicalRevision - 1;
  const currentReviewFindings = reviewIsCurrent
    ? (project.reviewFindings || []).filter(item => item.status === 'open')
    : [];
  const traceability = analyzeCanonicalTraceability(project).report;
  const ideaPlanAligned = project.planAlignment?.status === 'aligned';
  const webSaasAssessment = assessWebSaasPack(project);
  const webSaasChecks: ReadinessCheck[] = webSaasAssessment.active
    ? webSaasAssessment.checks.map(item => check({
        id: `domain.${item.id}`,
        dimension: item.id.includes('delivery') ? 'implementationReadiness' : item.id.includes('accessibility') || item.id.includes('core-flow') ? 'completeness' : 'riskCoverage',
        label: item.label,
        passed: item.passed,
        points: item.blocking ? 12 : 7,
        failure: item.message,
        blocking: item.blocking,
        warning: !item.blocking,
        entityIds: item.entityIds,
        sectionId: item.sectionId,
        actionLabel: item.label
      }))
    : [];

  const checks: ReadinessCheck[] = [
    check({ id: 'complete.concept', dimension: 'completeness', label: 'Hedef kullanıcı ve problem onaylı', passed: Boolean(summary?.userConfirmed && clean(summary.targetUser) && clean(summary.problemStatement)), points: 20, failure: 'Hedef kullanıcı, problem ve sistem yorumu kullanıcı tarafından onaylanmalı.', blocking: true, sectionId: 'vision', actionLabel: 'Ürün yorumunu netleştir' }),
    check({ id: 'complete.mvp-in', dimension: 'completeness', label: 'MVP kapsamı tanımlı', passed: Boolean(summary?.userConfirmed && summary.confirmedFeatures.length), points: 20, failure: 'MVP içinde yer alan özellikler onaylanmalı.', blocking: true, sectionId: 'scope', actionLabel: 'MVP kapsamını belirle' }),
    check({ id: 'complete.mvp-out', dimension: 'completeness', label: 'Kapsam dışı liste tanımlı', passed: Boolean(summary?.userConfirmed && summary.outOfScope.length), points: 15, failure: 'MVP kapsam dışı listesi onaylanmalı.', blocking: true, sectionId: 'scope', actionLabel: 'Kapsam dışını belirle' }),
    check({ id: 'complete.outcome', dimension: 'completeness', label: 'Beklenen sonuç tanımlı', passed: Boolean(clean(summary?.desiredOutcome) && clean(summary?.mvpTarget)), points: 15, failure: 'Beklenen ürün sonucu ve MVP hedefi netleştirilmeli.', warning: true, sectionId: 'vision', actionLabel: 'Başarı sonucunu netleştir' }),
    check({ id: 'complete.questions', dimension: 'completeness', label: 'Kritik açık soru yok', passed: openCriticalQuestions.length === 0, points: 15, failure: `${openCriticalQuestions.length} kritik soru cevap bekliyor.`, blocking: true, sectionId: 'scope', actionLabel: 'Kritik soruları kapat', evidence: { satisfied: 0, total: openCriticalQuestions.length } }),
    check({ id: 'complete.sections', dimension: 'completeness', label: 'Zorunlu plan bölümleri dolu', passed: emptyRequired.length === 0, points: 15, failure: `${emptyRequired.map(item => item.title).join(', ')} bölümü boş.`, blocking: true, entityIds: emptyRequired.map(item => item.id), sectionId: emptyRequired[0]?.id, actionLabel: 'Eksik plan bölümünü tamamla', partialCredit: ratio(requiredSections.length - emptyRequired.length, requiredSections.length, 1), evidence: { satisfied: requiredSections.length - emptyRequired.length, total: requiredSections.length } }),

    check({ id: 'consistent.idea-plan', dimension: 'consistency', label: 'Fikir belgesi ve canonical plan hizalı', passed: ideaPlanAligned, points: 25, failure: 'Fikir belgesi canonical plandan farklı. Etki analizini inceleyip kabul etmeden plan hazır veya dışa aktarılabilir sayılamaz.', blocking: true }),
    check({ id: 'consistent.sections', dimension: 'consistency', label: 'Zorunlu plan bölümleri güncel', passed: staleRequiredSections.length === 0, points: 25, failure: `${staleRequiredSections.length} zorunlu plan bölümü upstream değişikliklerden sonra yeniden doğrulanmalı.`, blocking: true, entityIds: staleRequiredSections.map(item => item.id) }),
    check({ id: 'consistent.scope', dimension: 'consistency', label: 'Kapsam ve görevler çelişmiyor', passed: scopeContradictions.length === 0, points: 30, failure: `Kapsam dışı öğeler canonical planda bulundu: ${scopeContradictions.join(', ')}.`, blocking: true, sectionId: 'scope', actionLabel: 'Kapsam sızıntısını incele', entityIds: scopeContradictions }),
    check({ id: 'consistent.duplicates', dimension: 'consistency', label: 'Kabul edilmiş gereksinimler yinelenmiyor', passed: duplicateRequirements.length === 0, points: 15, failure: `${duplicateRequirements.length} kabul edilmiş gereksinim aynı davranışı tekrar ediyor.`, warning: true, sectionId: 'requirements', actionLabel: 'Yinelenen gereksinimleri birleştir', entityIds: duplicateRequirements }),
    check({ id: 'consistent.requirements', dimension: 'consistency', label: 'Kabul edilmiş gereksinimler geçerli', passed: requirementQuality.invalidAccepted.length === 0, points: 25, failure: `${requirementQuality.invalidAccepted.length} kabul edilmiş gereksinim kalite sözleşmesini ihlal ediyor.`, blocking: true, entityIds: requirementQuality.invalidAccepted.map(item => item.requirementId) }),
    check({ id: 'consistent.review', dimension: 'consistency', label: 'Kritik inceleme bulgusu yok', passed: !currentReviewFindings.some(item => ['critical', 'high'].includes(item.severity)), points: 20, failure: 'Güncel kalite incelemesinde kritik veya yüksek önem dereceli bulgular var.', blocking: true, entityIds: currentReviewFindings.filter(item => ['critical', 'high'].includes(item.severity)).map(item => item.id) }),

    check({ id: 'trace.objectives', dimension: 'traceability', label: 'Hedefler gereksinimlere bağlı', passed: acceptedObjectives.length > 0 && requirementsWithObjective === acceptedRequirements.length, points: 20, failure: acceptedObjectives.length ? 'Bazı gereksinimler kabul edilmiş bir hedefe bağlı değil.' : 'En az bir ölçülebilir hedef kabul edilmeli ve gereksinimlere bağlanmalı.', warning: true, sectionId: 'requirements', actionLabel: 'Gereksinimleri hedeflere bağla', partialCredit: ratio(requirementsWithObjective, acceptedRequirements.length), evidence: { satisfied: requirementsWithObjective, total: acceptedRequirements.length } }),
    check({ id: 'trace.must-tasks', dimension: 'traceability', label: 'Must gereksinimleri görevlere bağlı', passed: acceptedMust.length > 0 && requirementQuality.mustWithoutTask.length === 0, points: 30, failure: acceptedMust.length ? `${requirementQuality.mustWithoutTask.length} Must gereksinimin görev bağlantısı yok.` : 'En az bir Must gereksinimi kabul edilmeli.', blocking: true, entityIds: requirementQuality.mustWithoutTask.map(item => item.requirementId), sectionId: 'tasks', actionLabel: 'Eksik görevleri üret', partialCredit: ratio(acceptedMust.length - requirementQuality.mustWithoutTask.length, acceptedMust.length), evidence: { satisfied: acceptedMust.length - requirementQuality.mustWithoutTask.length, total: acceptedMust.length } }),
    check({ id: 'trace.must-tests', dimension: 'traceability', label: 'Must gereksinimleri testlere bağlı', passed: acceptedMust.length > 0 && requirementQuality.mustWithoutTest.length === 0, points: 25, failure: acceptedMust.length ? `${requirementQuality.mustWithoutTest.length} Must gereksinimin doğrulama bağlantısı yok.` : 'En az bir Must gereksinimi kabul edilmeli.', blocking: true, entityIds: requirementQuality.mustWithoutTest.map(item => item.requirementId), sectionId: 'testing', actionLabel: 'Eksik doğrulamaları oluştur', partialCredit: ratio(acceptedMust.length - requirementQuality.mustWithoutTest.length, acceptedMust.length), evidence: { satisfied: acceptedMust.length - requirementQuality.mustWithoutTest.length, total: acceptedMust.length } }),
    check({ id: 'trace.decisions', dimension: 'traceability', label: 'Kararların etkilediği alanlar kayıtlı', passed: acceptedDecisions.length === 0 || acceptedDecisions.every(item => item.affectedSectionIds.length > 0), points: 15, failure: 'Bazı kabul edilmiş kararların etkilediği plan bölümleri kayıtlı değil.', warning: true, entityIds: acceptedDecisions.filter(item => !item.affectedSectionIds.length).map(item => item.id) }),
    check({ id: 'trace.risks', dimension: 'traceability', label: 'Açık riskler azaltma görevlerine bağlı', passed: activeRisks.length === 0 || risksWithTask === activeRisks.length, points: 10, failure: 'Bazı açık riskler azaltma görevine izlenebilir biçimde bağlı değil.', warning: true, entityIds: activeRisks.filter(item => !hasRiskTaskLink(project, item.id)).map(item => item.id), sectionId: 'risks', actionLabel: 'Risk azaltma görevlerini bağla', partialCredit: ratio(risksWithTask, activeRisks.length, 1), evidence: { satisfied: risksWithTask, total: activeRisks.length } }),

    check({ id: 'risk.inventory', dimension: 'riskCoverage', label: 'Risk envanteri derinliğe uygun', passed: project.planningDepth.selected === 'quick' || project.risks.length > 0, points: 20, failure: 'Bu plan derinliği için yapılandırılmış risk kaydı gerekli.', warning: true }),
    check({ id: 'risk.mitigation', dimension: 'riskCoverage', label: 'Kritik risklerin azaltma planı var', passed: criticalRisks.every(item => clean(item.mitigation).length >= 8), points: 30, failure: 'Kritik risklerin azaltma planı eksik.', blocking: true, entityIds: criticalRisks.filter(item => clean(item.mitigation).length < 8).map(item => item.id) }),
    check({ id: 'risk.owner', dimension: 'riskCoverage', label: 'Kritik risklerin sahibi var', passed: criticalRisks.every(item => clean(item.owner).length >= 2), points: 25, failure: 'Kritik risklerin sorumlusu belirtilmeli.', blocking: true, entityIds: criticalRisks.filter(item => clean(item.owner).length < 2).map(item => item.id) }),
    check({ id: 'risk.security-tests', dimension: 'riskCoverage', label: 'Güvenlik gereksinimleri doğrulanabilir', passed: securityRequirements.every(requirement => project.testCases.some(testCase => testCase.requirementIds.includes(requirement.id))), points: 15, failure: 'Bazı güvenlik veya gizlilik gereksinimleri teste bağlı değil.', blocking: true, entityIds: securityRequirements.filter(requirement => !project.testCases.some(testCase => testCase.requirementIds.includes(requirement.id))).map(item => item.id) }),
    check({ id: 'risk.acceptance', dimension: 'riskCoverage', label: 'Kabul edilen riskler açıkça kayıtlı', passed: project.risks.filter(item => item.status === 'accepted').every(item => clean(item.description) && clean(item.owner)), points: 10, failure: 'Kabul edilen risklerde açıklama ve sorumlu eksik.', warning: true }),

    check({ id: 'implementation.requirements', dimension: 'implementationReadiness', label: 'Uygulanabilir Must gereksinimi var', passed: acceptedMust.length > 0 && requirementQuality.invalidAccepted.length === 0, points: 20, failure: 'Uygulanabilir ve geçerli en az bir Must gereksinimi gerekli.', blocking: true }),
    check({ id: 'implementation.tasks', dimension: 'implementationReadiness', label: 'Görevlerin kabul kriterleri var', passed: project.tasks.length > 0 && tasksWithAcceptance === project.tasks.length, points: 25, failure: project.tasks.length ? 'Bazı görevlerin kabul kriteri eksik.' : 'Uygulanabilir görev listesi henüz oluşmadı.', blocking: true, entityIds: project.tasks.filter(item => !item.acceptanceCriteria.length).map(item => item.id), sectionId: 'tasks', actionLabel: 'Görev kabul kriterlerini tamamla', partialCredit: ratio(tasksWithAcceptance, project.tasks.length), evidence: { satisfied: tasksWithAcceptance, total: project.tasks.length } }),
    check({ id: 'implementation.links', dimension: 'implementationReadiness', label: 'Görevler kabul edilmiş gereksinimlere bağlı', passed: project.tasks.length > 0 && invalidTaskRequirementLinks.length === 0 && project.tasks.every(task => task.requirementIds.length > 0), points: 15, failure: 'Bazı görevlerin kaynak gereksinimi eksik veya canonical olarak kabul edilmemiş.', blocking: true, entityIds: invalidTaskRequirementLinks, sectionId: 'tasks', actionLabel: 'Görev kaynaklarını düzelt' }),
    check({ id: 'implementation.verification', dimension: 'implementationReadiness', label: 'Görevlerin doğrulama yöntemi geçerli', passed: project.tasks.length > 0 && tasksWithValidVerification === project.tasks.length && invalidVerifications.length === 0, points: 20, failure: 'Bazı görevlerin geçerli doğrulama bağlantısı yok.', blocking: true, sectionId: 'testing', actionLabel: 'Doğrulama bağlantılarını düzelt', partialCredit: ratio(tasksWithValidVerification, project.tasks.length), evidence: { satisfied: tasksWithValidVerification, total: project.tasks.length } }),
    check({ id: 'implementation.test-quality', dimension: 'implementationReadiness', label: 'Test sözleşmeleri uygulanabilir', passed: project.testCases.length > 0 && weakTests.length === 0 && invalidTestRequirementLinks.length === 0, points: 15, failure: 'Bazı testlerde kaynak gereksinim, adım veya gözlenebilir beklenen sonuç eksik.', blocking: true, entityIds: [...weakTests.map(item => item.id), ...invalidTestRequirementLinks], sectionId: 'testing', actionLabel: 'Test sözleşmelerini güçlendir', partialCredit: ratio(project.testCases.length - weakTests.length, project.testCases.length), evidence: { satisfied: project.testCases.length - weakTests.length, total: project.testCases.length } }),
    check({ id: 'implementation.contracts', dimension: 'implementationReadiness', label: 'Görev Sözleşmesi V2 eksiksiz', passed: project.tasks.length > 0 && incompleteTaskContracts.length === 0, points: 20, failure: `${incompleteTaskContracts.length} görevde kapsam, dosya politikası, kanıt veya rollback sözleşmesi eksik.`, blocking: true, entityIds: incompleteTaskContracts.map(item => item.id), sectionId: 'tasks', actionLabel: 'Görev sözleşmelerini tamamla', partialCredit: ratio(project.tasks.length - incompleteTaskContracts.length, project.tasks.length), evidence: { satisfied: project.tasks.length - incompleteTaskContracts.length, total: project.tasks.length } }),
    check({ id: 'implementation.file-policy', dimension: 'implementationReadiness', label: 'Görev dosya politikaları onaylı', passed: project.tasks.length > 0 && unresolvedFilePolicies.length === 0, points: 10, failure: `${unresolvedFilePolicies.length} görev için proje envanteri veya izinli dosya kapsamı onayı gerekiyor.`, warning: true, entityIds: unresolvedFilePolicies.map(item => item.id), sectionId: 'tasks', actionLabel: 'Dosya kapsamını doğrula', partialCredit: ratio(project.tasks.length - unresolvedFilePolicies.length, project.tasks.length), evidence: { satisfied: project.tasks.length - unresolvedFilePolicies.length, total: project.tasks.length } }),
    check({ id: 'implementation.commands', dimension: 'implementationReadiness', label: 'Doğrulama komutları belirli', passed: project.tasks.length > 0 && unresolvedCommandDiscovery.length === 0, points: 5, failure: `${unresolvedCommandDiscovery.length} görevde çalıştırılacak komutlar mevcut proje envanterinden keşfedilmeli.`, warning: true, entityIds: unresolvedCommandDiscovery.map(item => item.id), sectionId: 'testing', actionLabel: 'Doğrulama komutlarını belirle', partialCredit: ratio(project.tasks.length - unresolvedCommandDiscovery.length, project.tasks.length), evidence: { satisfied: project.tasks.length - unresolvedCommandDiscovery.length, total: project.tasks.length } }),
    check({ id: 'implementation.dependencies', dimension: 'implementationReadiness', label: 'Görev bağımlılıkları geçerli ve döngüsüz', passed: invalidDependencies.length === 0 && !dependencyCycle, points: 20, failure: dependencyCycle ? 'Görev bağımlılıklarında döngü bulundu.' : 'Bazı görev bağımlılıkları var olmayan görevlere gidiyor.', blocking: true }),
    check({ id: 'implementation.detail', dimension: 'implementationReadiness', label: 'Görevler uygulanabilir ayrıntı taşıyor', passed: project.tasks.length > 0 && tasksWithDetail === project.tasks.length, points: 15, failure: 'Bazı görevlerin uygulanabilir açıklaması eksik.', warning: true, entityIds: project.tasks.filter(item => clean(item.description).length < 8).map(item => item.id), sectionId: 'tasks', actionLabel: 'Görev açıklamalarını netleştir', partialCredit: ratio(tasksWithDetail, project.tasks.length), evidence: { satisfied: tasksWithDetail, total: project.tasks.length } }),
    check({ id: 'implementation.size', dimension: 'implementationReadiness', label: 'Görevler makul büyüklükte', passed: broadTasks.length === 0, points: 10, failure: `${broadTasks.length} yüksek eforlu görev birden fazla davranışı birlikte taşıyor; daha küçük görevlere ayrılmalı.`, warning: true, entityIds: broadTasks.map(item => item.id), sectionId: 'tasks', actionLabel: 'Büyük görevleri parçala' }),
    ...webSaasChecks
  ];

  const dimensions = {
    completeness: percentage(checks, 'completeness'),
    consistency: percentage(checks, 'consistency'),
    traceability: percentage(checks, 'traceability'),
    riskCoverage: percentage(checks, 'riskCoverage'),
    implementationReadiness: percentage(checks, 'implementationReadiness')
  };
  const score = Math.round(
    (Object.entries(DIMENSION_WEIGHTS) as Array<[ReadinessDimension, number]>)
      .reduce((total, [dimension, weight]) => total + dimensions[dimension] * weight / 100, 0)
  );
  const blockers = [...new Set(checks.filter(item => item.status === 'blocked').map(item => item.message))];
  const warnings = [...new Set([
    ...checks.filter(item => item.status === 'warning').map(item => item.message),
    ...(requirementQuality.draftCount ? [`${requirementQuality.draftCount} gereksinim taslağı kullanıcı kararı bekliyor.`] : []),
    ...(staleOptionalSections.length ? [`${staleOptionalSections.length} isteğe bağlı plan bölümü yeniden doğrulanmalı.`] : []),
    ...(project.reviewFindings?.length && !reviewIsCurrent ? ['Plan son incelemeden sonra değişti; kalite incelemesi yenilenmeli.'] : []),
    ...currentReviewFindings.filter(item => !['critical', 'high'].includes(item.severity)).map(item => `${item.title}: ${item.recommendation}`),
    ...traceability.findings.map(item => item.message)
  ])];
  const nextActions = buildNextActions(checks);

  return {
    readiness: {
      version: 2,
      status: blockers.length ? 'blocked' : warnings.length ? 'needs_review' : 'ready',
      score,
      dimensions,
      dimensionWeights: DIMENSION_WEIGHTS,
      dimensionLabels: DIMENSION_LABELS,
      checks,
      nextActions,
      blockers,
      warnings,
      calculatedAtRevision: project.canonicalRevision
    },
    traceability
  };
}
