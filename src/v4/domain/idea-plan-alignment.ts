import type {
  IdeaDocumentRevision,
  IdeaDocumentSnapshot,
  PlanAlignment,
  ProjectDocumentV5
} from '../contracts.js';

const FIELD_SECTIONS: Record<keyof IdeaDocumentSnapshot, string[]> = {
  summary: ['vision'],
  targetUser: ['vision', 'objectives', 'requirements', 'tasks'],
  problemStatement: ['vision', 'objectives', 'requirements'],
  currentAlternative: ['vision', 'decisions'],
  desiredOutcome: ['vision', 'objectives', 'requirements', 'testing'],
  confirmedFeatures: ['scope', 'requirements', 'tasks', 'testing'],
  outOfScope: ['scope', 'requirements', 'tasks'],
  technicalApproaches: ['decisions', 'architecture', 'tasks', 'testing'],
  openQuestions: ['vision', 'scope', 'requirements', 'decisions'],
  knownRisks: ['risks', 'tasks', 'testing'],
  mvpTarget: ['objectives', 'scope', 'requirements', 'tasks']
};

const CANONICAL_BREAKING_FIELDS = new Set<keyof IdeaDocumentSnapshot>([
  'targetUser',
  'problemStatement',
  'desiredOutcome',
  'confirmedFeatures',
  'outOfScope',
  'mvpTarget'
]);

export function emptyPlanAlignment(reason = 'Canonical plan henüz fikir belgesinden üretilmedi.'): PlanAlignment {
  return {
    status: 'aligned',
    sourceIdeaRevisionId: null,
    sourceIdeaRevisionNumber: null,
    currentIdeaRevisionId: null,
    currentIdeaRevisionNumber: null,
    changedFields: [],
    affectedSections: [],
    reason,
    detectedAt: null,
    reviewedAt: null,
    deferredAt: null
  };
}

function changedFields(
  source: IdeaDocumentSnapshot,
  current: IdeaDocumentSnapshot
): Array<keyof IdeaDocumentSnapshot> {
  return (Object.keys(FIELD_SECTIONS) as Array<keyof IdeaDocumentSnapshot>)
    .filter(field => JSON.stringify(source[field]) !== JSON.stringify(current[field]));
}

function findSourceRevision(project: ProjectDocumentV5): IdeaDocumentRevision | undefined {
  if (project.sourceIdeaRevisionId) {
    return project.ideaDocumentRevisions.find(revision => revision.id === project.sourceIdeaRevisionId);
  }
  return [...project.ideaDocumentRevisions]
    .reverse()
    .find(revision => revision.status === 'converted' && revision.convertedCanonicalRevision !== null);
}

export function evaluatePlanAlignment(
  project: ProjectDocumentV5,
  detectedAt = new Date().toISOString()
): PlanAlignment {
  const source = findSourceRevision(project);
  const current = project.ideaDocumentRevisions.at(-1);

  if (!source || !current) {
    return {
      ...emptyPlanAlignment(),
      sourceIdeaRevisionId: source?.id ?? null,
      sourceIdeaRevisionNumber: source?.number ?? null,
      currentIdeaRevisionId: current?.id ?? null,
      currentIdeaRevisionNumber: current?.number ?? null
    };
  }

  const fields = changedFields(source.snapshot, current.snapshot);
  if (fields.length === 0) {
    return {
      status: 'aligned',
      sourceIdeaRevisionId: source.id,
      sourceIdeaRevisionNumber: source.number,
      currentIdeaRevisionId: current.id,
      currentIdeaRevisionNumber: current.number,
      changedFields: [],
      affectedSections: [],
      reason: `Canonical plan fikir belgesi r${source.number} ile hizalı.`,
      detectedAt: null,
      reviewedAt: null,
      deferredAt: null
    };
  }

  const affectedSections = [...new Set(fields.flatMap(field => FIELD_SECTIONS[field]))];
  const status = fields.some(field => CANONICAL_BREAKING_FIELDS.has(field))
    ? 'stale'
    : 'review_required';
  const sameComparison = project.planAlignment?.sourceIdeaRevisionId === source.id
    && project.planAlignment?.currentIdeaRevisionId === current.id;
  const deferredAt = sameComparison ? project.planAlignment.deferredAt : null;
  const reviewedAt = sameComparison ? project.planAlignment.reviewedAt : null;
  const reason = deferredAt
    ? project.planAlignment.reason
    : status === 'stale'
      ? 'Fikrin hedefi veya kapsamı değişti; canonical plan güncelliğini kaybetti.'
      : 'Fikirde canonical planı etkileyebilecek değişiklikler var; kullanıcı incelemesi gerekiyor.';
  return {
    status,
    sourceIdeaRevisionId: source.id,
    sourceIdeaRevisionNumber: source.number,
    currentIdeaRevisionId: current.id,
    currentIdeaRevisionNumber: current.number,
    changedFields: fields,
    affectedSections,
    reason,
    detectedAt: sameComparison ? project.planAlignment.detectedAt || detectedAt : detectedAt,
    reviewedAt,
    deferredAt
  };
}

export function alignPlanToIdeaRevision(
  project: ProjectDocumentV5,
  revision: IdeaDocumentRevision
): ProjectDocumentV5 {
  const next = structuredClone(project);
  next.sourceIdeaRevisionId = revision.id;
  next.sourceIdeaRevisionNumber = revision.number;
  next.planAlignment = {
    status: 'aligned',
    sourceIdeaRevisionId: revision.id,
    sourceIdeaRevisionNumber: revision.number,
    currentIdeaRevisionId: revision.id,
    currentIdeaRevisionNumber: revision.number,
    changedFields: [],
    affectedSections: [],
    reason: `Canonical plan fikir belgesi r${revision.number} üzerinden oluşturuldu.`,
    detectedAt: null,
    reviewedAt: new Date().toISOString(),
    deferredAt: null
  };
  return next;
}

export function refreshPlanAlignment(project: ProjectDocumentV5): ProjectDocumentV5 {
  if (!project.sourceIdeaRevisionId && !project.ideaDocumentRevisions.some(item => item.status === 'converted')) {
    return project;
  }
  const next = structuredClone(project);
  next.planAlignment = evaluatePlanAlignment(next);
  next.sourceIdeaRevisionId = next.planAlignment.sourceIdeaRevisionId;
  next.sourceIdeaRevisionNumber = next.planAlignment.sourceIdeaRevisionNumber;
  return next;
}

export function deferPlanAlignment(project: ProjectDocumentV5): ProjectDocumentV5 {
  if (project.planAlignment.status === 'aligned') return project;
  const next = structuredClone(project);
  const deferredAt = new Date().toISOString();
  next.planAlignment.deferredAt = deferredAt;
  next.planAlignment.reviewedAt = deferredAt;
  next.planAlignment.reason = `İnceleme kullanıcı tarafından ertelendi. ${project.planAlignment.reason}`;
  next.documentRevision += 1;
  next.lifecycle.updatedAt = deferredAt;
  return next;
}
