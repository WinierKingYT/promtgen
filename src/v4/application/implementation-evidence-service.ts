import { normalizeImplementationEvidencePackage } from '../canonical-entities.js';
import type {
  ImplementationEvidencePackage,
  ProjectDocumentV5,
  Task
} from '../contracts.js';
import { captureCurrentRevision } from '../planning-engine.js';

export interface ImplementationEvidenceInput {
  taskId: string;
  source: ImplementationEvidencePackage['source'];
  summary: string;
  changedFiles: ImplementationEvidencePackage['changedFiles'];
  testRuns: ImplementationEvidencePackage['testRuns'];
  acceptanceEvidence: ImplementationEvidencePackage['acceptanceEvidence'];
  remainingIssues: string[];
  rollbackNotes: string;
}

function normalizePath(value: string) {
  return value.trim().replaceAll('\\', '/').replace(/^\.\//, '');
}

function escapeRegex(value: string) {
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

function matchesAny(path: string, patterns: string[]) {
  return patterns.some(pattern => pathPattern(pattern)?.test(path));
}

function normalizedText(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
}

function reviewInput(project: ProjectDocumentV5, task: Task, input: ImplementationEvidenceInput) {
  const findings: string[] = [];
  const allowed = task.contract.filePolicy.allowedPaths;
  const forbidden = task.contract.filePolicy.forbiddenPaths;
  if (task.contract.filePolicy.status !== 'confirmed') findings.push('Görevin dosya kapsamı kullanıcı tarafından doğrulanmamış.');
  if (!input.summary.trim()) findings.push('Uygulama özeti eksik.');
  if (!input.changedFiles.length) findings.push('Değişen dosya kanıtı eksik.');
  for (const file of input.changedFiles) {
    const path = normalizePath(file.path);
    if (!path || path.startsWith('/') || path.includes('../')) findings.push(`Güvensiz veya geçersiz dosya yolu: ${file.path || 'boş'}`);
    else if (matchesAny(path, forbidden)) findings.push(`Yasak dosya yolu değiştirildi: ${path}`);
    else if (!matchesAny(path, allowed)) findings.push(`TaskContract kapsamı dışında dosya değişikliği: ${path}`);
  }

  const testRuns = new Map(input.testRuns.map(run => [normalizedText(run.command), run]));
  for (const command of task.contract.verification.commands) {
    const run = testRuns.get(normalizedText(command));
    if (!run) findings.push(`Zorunlu doğrulama komutu çalıştırılmamış: ${command}`);
    else if (run.status !== 'passed') findings.push(`Doğrulama komutu başarılı değil: ${command} (${run.status})`);
    else if (!run.outputSummary.trim()) findings.push(`Doğrulama çıktısı özeti eksik: ${command}`);
  }
  if (task.contract.verification.requiresCommandDiscovery && !input.testRuns.length) {
    findings.push('Doğrulama komut keşfi tamamlanmamış.');
  }

  const evidence = new Map(input.acceptanceEvidence.map(item => [normalizedText(item.criterion), item]));
  for (const criterion of task.acceptanceCriteria) {
    const item = evidence.get(normalizedText(criterion));
    if (!item) findings.push(`Kabul kriteri için kanıt yok: ${criterion}`);
    else if (item.status !== 'met') findings.push(`Kabul kriteri karşılanmamış veya belirsiz: ${criterion}`);
    else if (!item.evidence.trim()) findings.push(`Kabul kriteri kanıt açıklaması eksik: ${criterion}`);
  }
  if (!input.rollbackNotes.trim()) findings.push('Uygulama için geri alma notu eksik.');
  if (input.remainingIssues.length) findings.push(`${input.remainingIssues.length} açık sorun çözülmeden görev tamamlanamaz.`);

  const hardBlocked = findings.some(item =>
    item.includes('Yasak dosya')
    || item.includes('Güvensiz')
    || item.includes('kapsamı dışında')
    || item.includes('başarılı değil')
  );
  return {
    outcome: hardBlocked ? 'blocked' as const : findings.length ? 'needs_changes' as const : 'ready_for_approval' as const,
    findings
  };
}

export function createImplementationEvidenceReview(
  project: ProjectDocumentV5,
  input: ImplementationEvidenceInput,
  options: { id?: string; now?: string; baseCanonicalRevision?: number } = {}
): ImplementationEvidencePackage {
  const task = project.tasks.find(item => item.id === input.taskId);
  if (!task) throw new Error('Kanıt paketi için canonical görev bulunamadı.');
  const reviewedAt = options.now || new Date().toISOString();
  const review = reviewInput(project, task, input);
  const baseCanonicalRevision = options.baseCanonicalRevision || project.canonicalRevision;
  if (baseCanonicalRevision !== project.canonicalRevision) {
    review.findings.unshift(`Kanıt paketi r${baseCanonicalRevision} planına ait; güncel canonical plan r${project.canonicalRevision}.`);
    review.outcome = 'blocked';
  }
  return normalizeImplementationEvidencePackage({
    ...input,
    id: options.id || `implementation-evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    baseCanonicalRevision,
    review: { ...review, reviewedAt, reviewerNote: '' },
    status: 'review_required',
    createdAt: reviewedAt,
    resolvedAt: null
  }) as ImplementationEvidencePackage;
}

function updateRequirementStatuses(project: ProjectDocumentV5, task: Task) {
  for (const requirementId of task.requirementIds) {
    const requirement = project.requirements.find(item => item.id === requirementId);
    if (!requirement) continue;
    const relatedTasks = project.tasks.filter(item => item.requirementIds.includes(requirementId));
    if (!relatedTasks.length || relatedTasks.some(item => item.status !== 'done')) continue;
    const relatedTests = project.testCases.filter(item => item.requirementIds.includes(requirementId));
    requirement.status = relatedTests.length > 0 && relatedTests.every(item => item.status === 'passed')
      ? 'verified'
      : 'implemented';
  }
}

export function decideImplementationEvidence(
  project: ProjectDocumentV5,
  evidencePackage: ImplementationEvidencePackage,
  decision: 'accept' | 'reject',
  reviewerNote = ''
) {
  if (project.implementationEvidencePackages.some(item => item.id === evidencePackage.id)) {
    return { success: false as const, project, reason: 'Bu kanıt paketi daha önce karara bağlanmış.' };
  }
  if (evidencePackage.baseCanonicalRevision !== project.canonicalRevision) {
    return { success: false as const, project, reason: `Kanıt paketi r${evidencePackage.baseCanonicalRevision} görevine ait; güncel canonical plan r${project.canonicalRevision}.` };
  }
  const task = project.tasks.find(item => item.id === evidencePackage.taskId);
  if (!task) return { success: false as const, project, reason: 'Kanıt paketinin canonical görevi bulunamadı.' };
  if (decision === 'accept' && evidencePackage.review.outcome !== 'ready_for_approval') {
    return { success: false as const, project, reason: 'Engelleyici veya eksik kanıtlar çözülmeden paket kabul edilemez.' };
  }

  const next = structuredClone(project);
  const resolvedAt = new Date().toISOString();
  const stored = structuredClone(evidencePackage);
  stored.status = decision === 'accept' ? 'accepted' : 'rejected';
  stored.resolvedAt = resolvedAt;
  stored.review.reviewerNote = reviewerNote.trim();
  next.implementationEvidencePackages.push(stored);
  next.documentRevision += 1;
  next.lifecycle.updatedAt = resolvedAt;

  if (decision === 'reject') {
    return { success: true as const, project: next, reason: 'Kanıt paketi reddedildi; canonical görev durumu değişmedi.' };
  }

  next.canonicalRevision += 1;
  const nextTask = next.tasks.find(item => item.id === task.id)!;
  nextTask.status = 'done';
  for (const testCaseId of new Set([...task.verificationIds, ...task.contract.verification.testCaseIds])) {
    const testCase = next.testCases.find(item => item.id === testCaseId);
    if (testCase) testCase.status = 'passed';
  }
  updateRequirementStatuses(next, nextTask);
  if (next.sections.tasks) next.sections.tasks.updatedAtRevision = next.canonicalRevision;
  if (next.sections.testing) next.sections.testing.updatedAtRevision = next.canonicalRevision;
  const versioned = captureCurrentRevision(next, `Uygulama kanıtı onaylandı: ${nextTask.title}`);
  return { success: true as const, project: versioned, reason: 'Kanıt onaylandı; görev ve bağlı canonical durumlar güncellendi.' };
}
