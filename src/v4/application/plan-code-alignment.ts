import type {
  ImplementationEvidencePackage,
  ProjectDocumentV5,
  Requirement,
  SuggestionBundle,
  SuggestionItem,
  Task,
  TestCase
} from '../contracts.js';
import type { ProjectInventoryReport } from '../project-analyzer.js';

export type AlignmentStatus =
  | 'not_analyzed'
  | 'scope_missing'
  | 'evidence_gap'
  | 'partially_evidenced'
  | 'aligned'
  | 'suspicious'
  | 'out_of_scope';

export type AlignmentResolutionAction = 'update_plan' | 'accept_deviation' | 'rollback_guidance';

export interface TaskCodeAlignment {
  taskId: string;
  title: string;
  status: AlignmentStatus;
  requirementIds: string[];
  matchedPaths: string[];
  changedPaths: string[];
  outOfScopePaths: string[];
  linkedTestCaseIds: string[];
  verificationCommands: string[];
  evidencePackageIds: string[];
  evidenceStatus: ImplementationEvidencePackage['status'] | 'none';
  findings: string[];
  recommendedAction: AlignmentResolutionAction | null;
}

export interface RequirementCodeAlignment {
  requirementId: string;
  title: string;
  status: 'unlinked' | 'planned' | 'traceable' | 'evidence_gap' | 'suspicious';
  taskIds: string[];
  testCaseIds: string[];
  findings: string[];
}

export interface PlanCodeAlignmentReport {
  version: 2;
  mode: 'advisory';
  baseCanonicalRevision: number;
  summary: {
    requirements: number;
    tasks: number;
    alignedTasks: number;
    partialTasks: number;
    suspiciousTasks: number;
    outOfScopeTasks: number;
    evidenceGaps: number;
    inventoryFiles: number;
    filteredInventoryFiles: number;
  };
  requirements: RequirementCodeAlignment[];
  tasks: TaskCodeAlignment[];
  limitations: string[];
}

type InventoryEntry = { path?: unknown; secretDetected?: unknown; injectionDetected?: unknown };

function normalizePath(value: unknown): string {
  return String(value || '').replaceAll('\\', '/').replace(/^\.\//, '');
}

function escapeRegex(value: string): string {
  return value.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

function pathPattern(pattern: string): RegExp | null {
  const normalized = normalizePath(pattern);
  if (!normalized || normalized.startsWith('/') || normalized.includes('../')) return null;
  const expression = escapeRegex(normalized)
    .replaceAll('**', '\u0000')
    .replaceAll('*', '[^/]*')
    .replaceAll('\u0000', '.*');
  return new RegExp(`^${expression}$`, 'i');
}

function inventoryState(inventory?: ProjectInventoryReport): {
  hasInventory: boolean;
  safePaths: string[];
  filteredCount: number;
} {
  if (!inventory || !Array.isArray(inventory.inventory)) {
    return { hasInventory: false, safePaths: [], filteredCount: 0 };
  }
  const entries = inventory.inventory.map(entry => entry as InventoryEntry);
  return {
    hasInventory: true,
    safePaths: entries
      .filter(entry => !entry.secretDetected && !entry.injectionDetected)
      .map(entry => normalizePath(entry.path))
      .filter(Boolean),
    filteredCount: entries.filter(entry => entry.secretDetected || entry.injectionDetected).length
  };
}

function taskPathRules(task: Task): { allowed: RegExp[]; forbidden: RegExp[] } {
  return {
    allowed: task.contract.filePolicy.allowedPaths.map(pathPattern).filter((pattern): pattern is RegExp => pattern !== null),
    forbidden: task.contract.filePolicy.forbiddenPaths.map(pathPattern).filter((pattern): pattern is RegExp => pattern !== null)
  };
}

function pathIsAllowed(path: string, task: Task): boolean {
  const { allowed, forbidden } = taskPathRules(task);
  return allowed.some(pattern => pattern.test(path)) && !forbidden.some(pattern => pattern.test(path));
}

function matchingPaths(task: Task, paths: string[]): string[] {
  return task.contract.filePolicy.allowedPaths.length
    ? paths.filter(path => pathIsAllowed(path, task)).slice(0, 50)
    : [];
}

function linkedTests(task: Task, testCases: TestCase[]): TestCase[] {
  const explicitIds = new Set([...task.verificationIds, ...task.contract.verification.testCaseIds]);
  const requirementIds = new Set(task.requirementIds);
  return testCases.filter(testCase => explicitIds.has(testCase.id) || testCase.requirementIds.some(id => requirementIds.has(id)));
}

function evidenceForTask(project: ProjectDocumentV5, taskId: string): ImplementationEvidencePackage[] {
  return project.implementationEvidencePackages.filter(item => item.taskId === taskId);
}

function analyzeTask(
  project: ProjectDocumentV5,
  task: Task,
  paths: string[],
  testCases: TestCase[],
  hasInventory: boolean
): TaskCodeAlignment {
  const matchedPaths = matchingPaths(task, paths);
  const tests = linkedTests(task, testCases);
  const verificationCommands = task.contract.verification.commands;
  const packages = evidenceForTask(project, task.id);
  const activeEvidence = [...packages].reverse().find(item => item.status !== 'rejected');
  const changedPaths = (activeEvidence?.changedFiles || []).map(item => normalizePath(item.path)).filter(Boolean);
  const outOfScopePaths = changedPaths.filter(path => !pathIsAllowed(path, task));
  const findings: string[] = [];

  if (!hasInventory) findings.push('Proje envanteri yok; mevcut dosya kapsamı doğrulanamaz.');
  if (task.contract.filePolicy.status === 'requires_inventory') findings.push('Dosya envanteri ve kapsam onayı bekleniyor.');
  if (task.contract.filePolicy.allowedPaths.length > 0 && matchedPaths.length === 0 && hasInventory) {
    findings.push('İzinli yollar güvenli envanterde eşleşmedi.');
  }
  if (tests.length === 0) findings.push('Bağlı test senaryosu yok.');
  if (verificationCommands.length === 0) findings.push('Doğrulama komutu yok.');
  if (outOfScopePaths.length) findings.push(`${outOfScopePaths.length} değişen dosya TaskContract kapsamının dışında veya yasaklı.`);
  if (activeEvidence?.baseCanonicalRevision !== undefined && activeEvidence.baseCanonicalRevision !== project.canonicalRevision) {
    findings.push(`Kanıt paketi r${activeEvidence.baseCanonicalRevision} için üretildi; güncel canonical revision r${project.canonicalRevision}.`);
  }
  if (activeEvidence?.testRuns.some(run => run.status === 'failed')) findings.push('Kanıt paketinde başarısız test bulunuyor.');
  if (activeEvidence?.acceptanceEvidence.some(item => item.status !== 'met')) findings.push('Kabul kriterlerinin tamamı karşılanmış değil.');
  if (activeEvidence?.remainingIssues.length) findings.push(`${activeEvidence.remainingIssues.length} açık teslim sorunu bulunuyor.`);
  if (activeEvidence?.status === 'review_required') findings.push('Kanıt paketi henüz kullanıcı incelemesinde.');
  if (activeEvidence?.status === 'stale') findings.push('Kanıt paketi bayat olarak işaretlenmiş.');

  const staleEvidence = Boolean(activeEvidence && (
    activeEvidence.status === 'stale'
    || activeEvidence.baseCanonicalRevision !== project.canonicalRevision
    || activeEvidence.testRuns.some(run => run.status === 'failed')
    || activeEvidence.acceptanceEvidence.some(item => item.status !== 'met')
  ));
  const hasTraceability = tests.length > 0 && verificationCommands.length > 0;
  const cleanAcceptedEvidence = Boolean(
    activeEvidence
    && activeEvidence.status === 'accepted'
    && !staleEvidence
    && outOfScopePaths.length === 0
    && changedPaths.length > 0
    && hasTraceability
  );

  let status: AlignmentStatus = 'evidence_gap';
  if (outOfScopePaths.length) status = 'out_of_scope';
  else if (staleEvidence) status = 'suspicious';
  else if (cleanAcceptedEvidence) status = 'aligned';
  else if (!hasInventory && !activeEvidence) status = 'not_analyzed';
  else if (task.contract.filePolicy.status === 'requires_inventory' || !task.contract.filePolicy.allowedPaths.length) status = 'scope_missing';
  else if (activeEvidence || matchedPaths.length || tests.length || verificationCommands.length) status = 'partially_evidenced';

  if (status === 'partially_evidenced' && !activeEvidence) {
    findings.push('Dosya, test veya komut bağlantısı mevcut; kullanıcıca kabul edilmiş teslim kanıtı yok.');
  }

  const recommendedAction: AlignmentResolutionAction | null =
    status === 'out_of_scope' ? 'accept_deviation'
      : status === 'suspicious' ? 'rollback_guidance'
        : ['evidence_gap', 'scope_missing', 'partially_evidenced'].includes(status) ? 'update_plan'
          : null;

  return {
    taskId: task.id,
    title: task.title,
    status,
    requirementIds: [...task.requirementIds],
    matchedPaths,
    changedPaths,
    outOfScopePaths,
    linkedTestCaseIds: tests.map(testCase => testCase.id),
    verificationCommands: [...verificationCommands],
    evidencePackageIds: packages.map(item => item.id),
    evidenceStatus: activeEvidence?.status || 'none',
    findings,
    recommendedAction
  };
}

function analyzeRequirement(
  requirement: Requirement,
  tasks: Task[],
  testCases: TestCase[],
  taskAlignments: TaskCodeAlignment[]
): RequirementCodeAlignment {
  const linkedTasks = tasks.filter(task => task.requirementIds.includes(requirement.id));
  const linkedTestCases = testCases.filter(testCase => testCase.requirementIds.includes(requirement.id));
  const relatedAlignment = taskAlignments.filter(item => linkedTasks.some(task => task.id === item.taskId));
  const findings: string[] = [];
  if (!linkedTasks.length) findings.push('Bağlı görev yok.');
  if (!linkedTestCases.length) findings.push('Bağlı test yok.');
  if (relatedAlignment.some(item => ['suspicious', 'out_of_scope'].includes(item.status))) {
    findings.push('Bağlı görevlerden en az biri inceleme gerektiriyor.');
  } else if (relatedAlignment.length && !relatedAlignment.some(item => item.status === 'aligned')) {
    findings.push('Bağlı görevlerin kabul edilmiş uygulama kanıtı yok.');
  }

  let status: RequirementCodeAlignment['status'] = 'traceable';
  if (!linkedTasks.length) status = 'unlinked';
  else if (!linkedTestCases.length) status = 'planned';
  else if (relatedAlignment.some(item => ['suspicious', 'out_of_scope'].includes(item.status))) status = 'suspicious';
  else if (!relatedAlignment.some(item => item.status === 'aligned')) status = 'evidence_gap';
  return {
    requirementId: requirement.id,
    title: requirement.title,
    status,
    taskIds: linkedTasks.map(task => task.id),
    testCaseIds: linkedTestCases.map(testCase => testCase.id),
    findings
  };
}

export function analyzePlanCodeAlignment(project: ProjectDocumentV5): PlanCodeAlignmentReport {
  const inventory = project.profile.projectInventory as ProjectInventoryReport | undefined;
  const { hasInventory, safePaths, filteredCount } = inventoryState(inventory);
  const requirements = project.requirements.filter(item => ['accepted', 'implemented', 'verified'].includes(item.status));
  const tasks = project.tasks.map(task => analyzeTask(project, task, safePaths, project.testCases, hasInventory));
  const requirementAlignments = requirements.map(requirement => analyzeRequirement(requirement, project.tasks, project.testCases, tasks));
  const nonAlignedTasks = tasks.filter(task => task.status !== 'aligned');
  return {
    version: 2,
    mode: 'advisory',
    baseCanonicalRevision: project.canonicalRevision,
    summary: {
      requirements: requirements.length,
      tasks: project.tasks.length,
      alignedTasks: tasks.filter(task => task.status === 'aligned').length,
      partialTasks: tasks.filter(task => task.status === 'partially_evidenced').length,
      suspiciousTasks: tasks.filter(task => task.status === 'suspicious').length,
      outOfScopeTasks: tasks.filter(task => task.status === 'out_of_scope').length,
      evidenceGaps: nonAlignedTasks.length
        + requirementAlignments.filter(requirement => requirement.status !== 'traceable').length,
      inventoryFiles: safePaths.length,
      filteredInventoryFiles: filteredCount
    },
    requirements: requirementAlignments,
    tasks,
    limitations: [
      'Rapor tavsiye niteliğindedir; kodu veya canonical planı kendiliğinden değiştirmez.',
      'Dosya-kapsam eşleşmesi doğru uygulamayı tek başına kanıtlamaz.',
      'Dosya içeriği modele gönderilmez; değişiklik durumu yalnız kullanıcıca sağlanan teslim kanıtından okunur.',
      'Çözüm önerileri mevcut onay akışına eklenir ve ayrıca kabul edilmeden canonical plana uygulanmaz.'
    ]
  };
}

const ACTION_CONFIG: Record<AlignmentResolutionAction, {
  kind: SuggestionItem['kind'];
  title: string;
  affectedSections: string[];
}> = {
  update_plan: {
    kind: 'feature',
    title: 'Planı uygulamadaki gerçek kapsamla güncelle',
    affectedSections: ['requirements', 'tasks', 'testing']
  },
  accept_deviation: {
    kind: 'decision',
    title: 'Plan–kod sapmasını bilinçli karar olarak incele',
    affectedSections: ['decisions', 'risks', 'tasks']
  },
  rollback_guidance: {
    kind: 'question',
    title: 'TaskContract geri alma rehberini değerlendir',
    affectedSections: ['tasks', 'risks']
  }
};

function identifier(prefix: string): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}-${random}`;
}

export function createPlanCodeAlignmentSuggestion(
  project: ProjectDocumentV5,
  taskId: string,
  action: AlignmentResolutionAction
): { project: ProjectDocumentV5; created: boolean; bundleId: string | null; reason: string } {
  const report = analyzePlanCodeAlignment(project);
  const alignment = report.tasks.find(item => item.taskId === taskId);
  const task = project.tasks.find(item => item.id === taskId);
  if (!alignment || !task) return { project, created: false, bundleId: null, reason: 'Görev bulunamadı.' };
  if (alignment.status === 'aligned') {
    return { project, created: false, bundleId: null, reason: 'Görev zaten plan ve kabul edilmiş kanıtla uyumlu.' };
  }

  const config = ACTION_CONFIG[action];
  const fingerprint = `plan-code-v2:${project.canonicalRevision}:${task.id}:${action}`;
  const existing = project.proposalStore.bundles
    .flatMap(bundle => bundle.items.map(item => ({ bundle, item })))
    .find(entry => entry.item.fingerprint === fingerprint);
  if (existing) {
    return { project, created: false, bundleId: existing.bundle.id, reason: 'Aynı çözüm önerisi zaten mevcut.' };
  }

  const pathSummary = alignment.outOfScopePaths.length
    ? `Kapsam dışı/yasaklı yollar: ${alignment.outOfScopePaths.join(', ')}.`
    : alignment.changedPaths.length
      ? `Bildirilen değişen yollar: ${alignment.changedPaths.join(', ')}.`
      : 'Değişen dosya kanıtı henüz sağlanmadı.';
  const rollback = task.contract.rollbackPlan.trim() || 'Geri alma adımları TaskContract içinde tanımlanmalı.';
  const descriptions: Record<AlignmentResolutionAction, string> = {
    update_plan: `${task.title} görevinin plan kapsamı, kabul kriterleri ve doğrulama bağlantıları güncel uygulama kanıtına göre yeniden incelensin. ${pathSummary}`,
    accept_deviation: `${task.title} için saptanan plan–kod farkı gerekçesi, riski ve sınırlarıyla bilinçli bir karar olarak değerlendirilsin. ${pathSummary}`,
    rollback_guidance: `${task.title} için kodu PromtGen değiştirmeden şu geri alma rehberi değerlendirilsin: ${rollback}`
  };
  const item: SuggestionItem = {
    id: identifier('suggestion'),
    fingerprint,
    kind: config.kind,
    title: config.title,
    description: descriptions[action],
    pros: ['Plan ve uygulama arasındaki fark görünür ve izlenebilir kalır.', 'Canonical değişiklik açık kullanıcı onayına bağlı kalır.'],
    cons: ['Karar verilene kadar ilgili görev tam uyumlu sayılmaz.'],
    effort: action === 'rollback_guidance' ? 'low' : 'medium',
    impact: alignment.status === 'out_of_scope' || alignment.status === 'suspicious' ? 'high' : 'medium',
    recommended: alignment.recommendedAction === action,
    recommendationReason: alignment.findings.join(' ') || 'Plan–kod hizalama incelemesi gerekiyor.',
    affectedSections: config.affectedSections.filter(sectionId => Boolean(project.sections[sectionId])),
    dependencies: [task.id, ...task.requirementIds],
    status: 'pending'
  };
  const bundle: SuggestionBundle = {
    id: identifier('bundle'),
    title: `Plan–Kod Hizalama · ${task.title}`,
    phase: project.lifecycle.activePhase,
    status: 'open',
    decisionComplete: false,
    createdAt: new Date().toISOString(),
    items: [item],
    openQuestions: ['Bu sapma planı mı, uygulamayı mı, yoksa bilinçli kabul edilen sınırı mı değiştirmeli?'],
    source: { type: 'local', providerId: 'plan-code-alignment-v2' }
  };
  const next = structuredClone(project);
  next.proposalStore.bundles.push(bundle);
  next.lifecycle.updatedAt = bundle.createdAt;
  return {
    project: next,
    created: true,
    bundleId: bundle.id,
    reason: 'Çözüm önerisi onay kuyruğuna eklendi; canonical plan değiştirilmedi.'
  };
}
