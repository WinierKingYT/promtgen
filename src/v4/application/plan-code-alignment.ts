import type { ProjectDocumentV5, Requirement, Task, TestCase } from '../contracts.js';
import type { ProjectInventoryReport } from '../project-analyzer.js';

export type AlignmentStatus = 'not_analyzed' | 'scope_missing' | 'evidence_gap' | 'partially_evidenced' | 'evidenced';

export interface TaskCodeAlignment {
  taskId: string;
  title: string;
  status: AlignmentStatus;
  requirementIds: string[];
  matchedPaths: string[];
  linkedTestCaseIds: string[];
  verificationCommands: string[];
  evidencePackageIds: string[];
  findings: string[];
}

export interface RequirementCodeAlignment {
  requirementId: string;
  title: string;
  status: 'unlinked' | 'planned' | 'traceable' | 'evidence_gap';
  taskIds: string[];
  testCaseIds: string[];
  findings: string[];
}

export interface PlanCodeAlignmentReport {
  version: 1;
  mode: 'read_only';
  baseCanonicalRevision: number;
  summary: { requirements: number; tasks: number; evidencedTasks: number; evidenceGaps: number; inventoryFiles: number };
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

function safeInventoryPaths(inventory?: ProjectInventoryReport): string[] {
  if (!inventory || !Array.isArray(inventory.inventory)) return [];
  return inventory.inventory
    .map(entry => entry as InventoryEntry)
    .filter(entry => !entry.secretDetected && !entry.injectionDetected)
    .map(entry => normalizePath(entry.path))
    .filter(Boolean);
}

function matchingPaths(task: Task, paths: string[]): string[] {
  const patterns = task.contract.filePolicy.allowedPaths.map(pathPattern).filter((pattern): pattern is RegExp => pattern !== null);
  return patterns.length ? paths.filter(path => patterns.some(pattern => pattern.test(path))).slice(0, 50) : [];
}

function linkedTests(task: Task, testCases: TestCase[]): TestCase[] {
  const explicitIds = new Set([...task.verificationIds, ...task.contract.verification.testCaseIds]);
  const requirementIds = new Set(task.requirementIds);
  return testCases.filter(testCase => explicitIds.has(testCase.id) || testCase.requirementIds.some(id => requirementIds.has(id)));
}

function analyzeTask(task: Task, paths: string[], testCases: TestCase[], hasInventory: boolean): TaskCodeAlignment {
  const matchedPaths = matchingPaths(task, paths);
  const tests = linkedTests(task, testCases);
  const verificationCommands = task.contract.verification.commands;
  const evidencePackageIds: string[] = [];
  const findings: string[] = [];
  if (!hasInventory) findings.push('Proje envanteri yok; dosya kapsamı doğrulanamaz.');
  if (task.contract.filePolicy.status === 'requires_inventory') findings.push('Dosya envanteri ve kapsam onayı bekleniyor.');
  if (task.contract.filePolicy.allowedPaths.length > 0 && matchedPaths.length === 0 && hasInventory) findings.push('İzinli yollar envanterde eşleşmedi.');
  if (tests.length === 0) findings.push('Bağlı test senaryosu yok.');
  if (verificationCommands.length === 0) findings.push('Doğrulama komutu yok.');

  let status: AlignmentStatus = 'evidence_gap';
  if (!hasInventory) status = 'not_analyzed';
  else if (task.contract.filePolicy.status === 'requires_inventory' || !task.contract.filePolicy.allowedPaths.length) status = 'scope_missing';
  else if (matchedPaths.length && tests.length && verificationCommands.length) status = 'evidenced';
  else if (matchedPaths.length || tests.length || verificationCommands.length) status = 'partially_evidenced';

  return {
    taskId: task.id,
    title: task.title,
    status,
    requirementIds: [...task.requirementIds],
    matchedPaths,
    linkedTestCaseIds: tests.map(testCase => testCase.id),
    verificationCommands: [...verificationCommands],
    evidencePackageIds,
    findings
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
  if (relatedAlignment.length && relatedAlignment.every(item => !['evidenced', 'partially_evidenced'].includes(item.status))) {
    findings.push('Bağlı görevlerin uygulama kanıtı yok.');
  }

  let status: RequirementCodeAlignment['status'] = 'traceable';
  if (!linkedTasks.length) status = 'unlinked';
  else if (!linkedTestCases.length) status = 'planned';
  else if (!relatedAlignment.some(item => item.status === 'evidenced')) status = 'evidence_gap';
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
  const paths = safeInventoryPaths(inventory);
  const hasInventory = Boolean(inventory && Array.isArray(inventory.inventory));
  const requirements = project.requirements.filter(item => ['accepted', 'implemented', 'verified'].includes(item.status));
  const tasks = project.tasks.map(task => {
    const alignment = analyzeTask(task, paths, project.testCases, hasInventory);
    alignment.evidencePackageIds = project.implementationEvidencePackages
      .filter(item => item.taskId === task.id && item.status === 'accepted')
      .map(item => item.id);
    if (alignment.evidencePackageIds.length) {
      alignment.status = 'evidenced';
      alignment.findings = alignment.findings.filter(finding => !finding.includes('uygulama kanıtı'));
    } else if (alignment.status === 'evidenced') {
      alignment.status = 'partially_evidenced';
      alignment.findings.push('Dosya, test ve komut bağlantıları mevcut; onaylanmış uygulama kanıt paketi yok.');
    }
    return alignment;
  });
  const requirementAlignments = requirements.map(requirement => analyzeRequirement(requirement, project.tasks, project.testCases, tasks));
  return {
    version: 1,
    mode: 'read_only',
    baseCanonicalRevision: project.canonicalRevision,
    summary: {
      requirements: requirements.length,
      tasks: project.tasks.length,
      evidencedTasks: tasks.filter(task => task.status === 'evidenced').length,
      evidenceGaps: tasks.filter(task => !['evidenced', 'partially_evidenced'].includes(task.status)).length
        + requirementAlignments.filter(requirement => requirement.status !== 'traceable').length,
      inventoryFiles: paths.length
    },
    requirements: requirementAlignments,
    tasks,
    limitations: [
      'Rapor salt okunurdur; kodu ve canonical planı değiştirmez.',
      'Dosya-kapsam eşleşmesi doğru uygulamayı tek başına kanıtlamaz.',
      'Dosya içeriği modele gönderilmez; değişiklikler için envanter yenilenmelidir.'
    ]
  };
}
