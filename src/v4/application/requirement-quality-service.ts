import type { Priority, ProjectDocumentV5, Requirement } from '../contracts.js';
import { normalizeRequirement, normalizeTraceLink } from '../canonical-entities.js';

const MIN_TEXT_LENGTH = 8;

function clean(value: unknown): string {
  return String(value || '').trim();
}

function lines(values: unknown): string[] {
  return [...new Set((Array.isArray(values) ? values : []).map(clean).filter(Boolean))];
}

function slug(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42) || 'ozellik';
}

function uniqueRequirementId(project: ProjectDocumentV5, title: string): string {
  const used = new Set(project.requirements.map(item => item.id));
  const base = `req-mvp-${slug(title)}`;
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function defaultCriterion(feature: string): string {
  return `Kullanıcı "${feature}" davranışını tamamladığında beklenen sonuç arayüzde gözlenebilir.`;
}

function invalidReasons(
  requirement: Requirement,
  acceptedObjectiveIds: Set<string>,
  allObjectiveIds: Set<string>
): string[] {
  const reasons: string[] = [];
  if (clean(requirement.title).length < MIN_TEXT_LENGTH) reasons.push('Başlık en az 8 karakter olmalı.');
  if (clean(requirement.statement).length < MIN_TEXT_LENGTH) reasons.push('Gereksinim ifadesi gözlenebilir bir davranış anlatmalı.');
  if (!requirement.acceptanceCriteria.length) reasons.push('En az bir kabul kriteri gerekli.');
  if (requirement.acceptanceCriteria.some(item => clean(item).length < MIN_TEXT_LENGTH)) reasons.push('Kabul kriterleri en az 8 karakter olmalı.');
  if (acceptedObjectiveIds.size && !requirement.sourceObjectiveIds.length) reasons.push('En az bir proje hedefine bağlanmalı.');
  if (requirement.sourceObjectiveIds.some(id => !allObjectiveIds.has(id) || !acceptedObjectiveIds.has(id))) {
    reasons.push('Hedef bağlantısı var olan kabul edilmiş bir hedefe gitmeli.');
  }
  return reasons;
}

export interface RequirementQualityItem {
  requirementId: string;
  title: string;
  priority: Priority;
  status: Requirement['status'];
  reasons: string[];
  taskIds: string[];
  testCaseIds: string[];
}

export interface RequirementQualityResult {
  readyForTaskCompilation: boolean;
  readyForFinalization: boolean;
  acceptedCount: number;
  draftCount: number;
  mustCount: number;
  invalidAccepted: RequirementQualityItem[];
  mustWithoutTask: RequirementQualityItem[];
  mustWithoutTest: RequirementQualityItem[];
  issues: string[];
}

export function evaluateRequirementQuality(project: ProjectDocumentV5): RequirementQualityResult {
  const accepted = project.requirements.filter(item => item.status === 'accepted');
  const drafts = project.requirements.filter(item => item.status === 'draft');
  const acceptedObjectiveIds = new Set(project.objectives.filter(item => item.status === 'accepted').map(item => item.id));
  const allObjectiveIds = new Set(project.objectives.map(item => item.id));
  const item = (requirement: Requirement): RequirementQualityItem => ({
    requirementId: requirement.id,
    title: requirement.title,
    priority: requirement.priority,
    status: requirement.status,
    reasons: invalidReasons(requirement, acceptedObjectiveIds, allObjectiveIds),
    taskIds: project.tasks.filter(task => task.requirementIds.includes(requirement.id)).map(task => task.id),
    testCaseIds: project.testCases.filter(testCase => testCase.requirementIds.includes(requirement.id)).map(testCase => testCase.id)
  });
  const acceptedItems = accepted.map(item);
  const mustItems = acceptedItems.filter(requirement => requirement.priority === 'must');
  const invalidAccepted = acceptedItems.filter(requirement => requirement.reasons.length > 0);
  const mustWithoutTask = mustItems.filter(requirement => requirement.taskIds.length === 0);
  const mustWithoutTest = mustItems.filter(requirement => requirement.testCaseIds.length === 0);
  const issues = [
    ...(accepted.length ? [] : ['En az bir gereksinim kullanıcı tarafından kabul edilmeli.']),
    ...(mustItems.length ? [] : ['MVP için en az bir Must gereksinimi kullanıcı tarafından kabul edilmeli.']),
    ...invalidAccepted.map(requirement => `${requirement.title}: ${requirement.reasons.join(' ')}`),
    ...mustWithoutTask.map(requirement => `${requirement.title}: Must gereksinimi bir göreve bağlı değil.`),
    ...mustWithoutTest.map(requirement => `${requirement.title}: Must gereksinimi bir doğrulama senaryosuna bağlı değil.`)
  ];
  const readyForTaskCompilation = accepted.length > 0 && mustItems.length > 0 && invalidAccepted.length === 0;
  return {
    readyForTaskCompilation,
    readyForFinalization: readyForTaskCompilation && mustWithoutTask.length === 0 && mustWithoutTest.length === 0,
    acceptedCount: accepted.length,
    draftCount: drafts.length,
    mustCount: mustItems.length,
    invalidAccepted,
    mustWithoutTask,
    mustWithoutTest,
    issues
  };
}

export function createRequirementDraftsFromConcept(project: ProjectDocumentV5): ProjectDocumentV5 {
  const summary = project.ideaLabSession?.conceptSummary;
  if (!summary?.userConfirmed) throw new Error('Önce sistem yorumu ve MVP kapsamı kullanıcı tarafından onaylanmalı.');
  const next = structuredClone(project);
  const existingStatements = new Set(next.requirements.map(item => clean(item.statement).toLocaleLowerCase('tr-TR')));
  const sourceObjectiveIds = next.objectives.filter(item => item.status === 'accepted').slice(0, 1).map(item => item.id);
  for (const feature of summary.confirmedFeatures) {
    const statement = `${feature} kullanıcı tarafından tamamlanabilmeli.`;
    if (existingStatements.has(statement.toLocaleLowerCase('tr-TR'))) continue;
    next.requirements.push(normalizeRequirement({
      id: uniqueRequirementId(next, feature),
      title: feature,
      statement,
      kind: 'functional',
      priority: 'must',
      acceptanceCriteria: [defaultCriterion(feature)],
      sourceObjectiveIds,
      status: 'draft'
    }));
    existingStatements.add(statement.toLocaleLowerCase('tr-TR'));
  }
  return next;
}

export function updateRequirementDraft(
  project: ProjectDocumentV5,
  requirementId: string,
  changes: Partial<Pick<Requirement, 'title' | 'statement' | 'kind' | 'priority' | 'acceptanceCriteria' | 'sourceObjectiveIds'>>
): ProjectDocumentV5 {
  const next = structuredClone(project);
  const requirement = next.requirements.find(item => item.id === requirementId);
  if (!requirement) throw new Error('Gereksinim bulunamadı.');
  if (requirement.status !== 'draft') throw new Error('Kabul edilmiş gereksinim taslak olarak düzenlenemez; canonical etki analizi kullanılmalı.');
  if (changes.title !== undefined) requirement.title = clean(changes.title);
  if (changes.statement !== undefined) requirement.statement = clean(changes.statement);
  if (changes.kind && ['functional', 'quality', 'constraint'].includes(changes.kind)) requirement.kind = changes.kind;
  if (changes.priority && ['must', 'should', 'could'].includes(changes.priority)) requirement.priority = changes.priority;
  if (changes.acceptanceCriteria !== undefined) requirement.acceptanceCriteria = lines(changes.acceptanceCriteria);
  if (changes.sourceObjectiveIds !== undefined) requirement.sourceObjectiveIds = lines(changes.sourceObjectiveIds);
  requirement.status = 'draft';
  return next;
}

export function acceptRequirementDraft(project: ProjectDocumentV5, requirementId: string): ProjectDocumentV5 {
  const next = structuredClone(project);
  const requirement = next.requirements.find(item => item.id === requirementId);
  if (!requirement) throw new Error('Gereksinim bulunamadı.');
  const acceptedObjectiveIds = new Set(next.objectives.filter(item => item.status === 'accepted').map(item => item.id));
  const reasons = invalidReasons(requirement, acceptedObjectiveIds, new Set(next.objectives.map(item => item.id)));
  if (reasons.length) throw new Error(reasons.join(' '));
  requirement.status = 'accepted';
  const section = next.sections.requirements;
  section.items = [...new Set([...section.items, requirement.statement])];
  section.status = 'draft';
  for (const objectiveId of requirement.sourceObjectiveIds) {
    const linkId = `trace-${objectiveId}-${requirement.id}`;
    if (!next.traceLinks.some(link => link.id === linkId)) {
      next.traceLinks.push(normalizeTraceLink({
        id: linkId,
        fromType: 'objective',
        fromId: objectiveId,
        toType: 'requirement',
        toId: requirement.id,
        relation: 'drives'
      }));
    }
  }
  return next;
}

export function removeRequirementDraft(project: ProjectDocumentV5, requirementId: string): ProjectDocumentV5 {
  const next = structuredClone(project);
  const requirement = next.requirements.find(item => item.id === requirementId);
  if (!requirement) return next;
  if (requirement.status !== 'draft') throw new Error('Kabul edilmiş gereksinim silinemez; önce yeni bir plan değişikliği oluşturulmalı.');
  next.requirements = next.requirements.filter(item => item.id !== requirementId);
  return next;
}
