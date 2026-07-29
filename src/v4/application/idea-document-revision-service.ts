import type {
  ConceptSummary,
  IdeaDocumentRevision,
  IdeaDocumentSnapshot,
  ProjectDocumentV5
} from '../contracts.js';
import { updateConceptAgreement } from './idea-discussion-service.js';
import {
  alignPlanToIdeaRevision,
  refreshPlanAlignment
} from '../domain/idea-plan-alignment.js';

type EditableIdeaDocument = Pick<
  ConceptSummary,
  'summary' | 'targetUser' | 'problemStatement' | 'currentAlternative' | 'desiredOutcome' |
  'confirmedFeatures' | 'outOfScope' | 'technicalApproaches' | 'knownRisks' | 'openQuestions' | 'mvpTarget'
>;

const FIELD_LABELS: Record<keyof IdeaDocumentSnapshot, string> = {
  summary: 'Sistem yorumu',
  targetUser: 'Birincil kullanıcı',
  problemStatement: 'Ana problem',
  currentAlternative: 'Bugünkü çözüm',
  desiredOutcome: 'Beklenen sonuç',
  confirmedFeatures: 'MVP içinde',
  outOfScope: 'MVP dışında',
  technicalApproaches: 'Teknik yaklaşım',
  openQuestions: 'Açık sorular',
  knownRisks: 'Bilinen riskler',
  mvpTarget: 'MVP hedefi'
};

function id() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `idea-revision-${crypto.randomUUID()}`
    : `idea-revision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function snapshotIdeaDocument(project: ProjectDocumentV5): IdeaDocumentSnapshot {
  const summary = project.ideaLabSession?.conceptSummary;
  if (!summary) throw new Error('Sürümlenecek fikir belgesi bulunamadı.');
  return {
    summary: summary.summary,
    targetUser: summary.targetUser,
    problemStatement: summary.problemStatement,
    currentAlternative: summary.currentAlternative,
    desiredOutcome: summary.desiredOutcome,
    confirmedFeatures: [...summary.confirmedFeatures],
    outOfScope: [...summary.outOfScope],
    technicalApproaches: [...summary.technicalApproaches],
    openQuestions: [...summary.openQuestions],
    knownRisks: [...summary.knownRisks],
    mvpTarget: summary.mvpTarget
  };
}

function sameSnapshot(left: IdeaDocumentSnapshot, right: IdeaDocumentSnapshot) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function appendRevision(
  project: ProjectDocumentV5,
  snapshot: IdeaDocumentSnapshot,
  source: IdeaDocumentRevision['source'],
  summary: string,
  restoredFromRevision: number | null = null
) {
  const next = structuredClone(project);
  next.ideaDocumentRevisions = (next.ideaDocumentRevisions || []).map(revision =>
    revision.status === 'draft' ? { ...revision, status: 'superseded' as const } : revision
  );
  next.ideaDocumentRevisions.push({
    id: id(),
    number: next.ideaDocumentRevisions.reduce((highest, revision) => Math.max(highest, revision.number), 0) + 1,
    documentRevision: project.documentRevision + 1,
    canonicalRevision: project.canonicalRevision,
    createdAt: new Date().toISOString(),
    summary,
    source,
    status: 'draft',
    convertedCanonicalRevision: null,
    restoredFromRevision,
    snapshot
  });
  return next;
}

export function ensureIdeaDocumentRevision(
  project: ProjectDocumentV5,
  summary = 'İlk fikir belgesi oluşturuldu'
) {
  if (!project.ideaLabSession?.conceptSummary || project.ideaDocumentRevisions.length > 0) return project;
  const next = structuredClone(project);
  next.ideaDocumentRevisions.push({
    id: id(),
    number: 1,
    documentRevision: project.documentRevision,
    canonicalRevision: project.canonicalRevision,
    createdAt: new Date().toISOString(),
    summary,
    source: 'initial',
    status: 'draft',
    convertedCanonicalRevision: null,
    restoredFromRevision: null,
    snapshot: snapshotIdeaDocument(project)
  });
  return next;
}

export function updateIdeaDocumentWithRevision(
  project: ProjectDocumentV5,
  changes: Partial<EditableIdeaDocument>,
  source: 'edit' | 'discovery' = 'edit',
  revisionSummary = source === 'discovery' ? 'Keşif yanıtları fikir belgesine işlendi' : 'Fikir belgesi düzenlendi'
) {
  const baseline = ensureIdeaDocumentRevision(project);
  const updated = updateConceptAgreement(baseline, changes);
  const previousSnapshot = snapshotIdeaDocument(baseline);
  const updatedSnapshot = snapshotIdeaDocument(updated);
  if (sameSnapshot(previousSnapshot, updatedSnapshot)) return project;
  return refreshPlanAlignment(appendRevision(updated, updatedSnapshot, source, revisionSummary));
}

export function compareIdeaDocumentRevisions(
  project: ProjectDocumentV5,
  fromRevisionId: string,
  toRevisionId: string
) {
  const from = project.ideaDocumentRevisions.find(revision => revision.id === fromRevisionId);
  const to = project.ideaDocumentRevisions.find(revision => revision.id === toRevisionId);
  if (!from || !to) return { valid: false as const, changes: [] };
  const changes = (Object.keys(FIELD_LABELS) as Array<keyof IdeaDocumentSnapshot>)
    .filter(field => JSON.stringify(from.snapshot[field]) !== JSON.stringify(to.snapshot[field]))
    .map(field => ({
      field,
      label: FIELD_LABELS[field],
      before: Array.isArray(from.snapshot[field]) ? (from.snapshot[field] as string[]).join('\n') : String(from.snapshot[field]),
      after: Array.isArray(to.snapshot[field]) ? (to.snapshot[field] as string[]).join('\n') : String(to.snapshot[field])
    }));
  return { valid: true as const, from, to, changes };
}

export function restoreIdeaDocumentRevision(project: ProjectDocumentV5, revisionId: string) {
  const sourceRevision = project.ideaDocumentRevisions.find(revision => revision.id === revisionId);
  if (!sourceRevision) return { success: false as const, project, reason: 'Geri yüklenecek fikir sürümü bulunamadı.' };
  const current = snapshotIdeaDocument(project);
  if (sameSnapshot(current, sourceRevision.snapshot)) {
    return { success: false as const, project, reason: 'Seçilen sürüm zaten güncel fikir belgesi.' };
  }
  const updated = updateConceptAgreement(project, sourceRevision.snapshot);
  const next = refreshPlanAlignment(appendRevision(
    updated,
    snapshotIdeaDocument(updated),
    'restore',
    `Fikir belgesi r${sourceRevision.number} sürümünden geri yüklendi`,
    sourceRevision.number
  ));
  return {
    success: true as const,
    project: next,
    canonicalPlanUnchanged: project.canonicalRevision > 1 || Boolean(project.ideaLabSession?.conceptSummary?.userConfirmed)
  };
}

export function markCurrentIdeaRevisionConverted(project: ProjectDocumentV5, canonicalRevision: number) {
  const next = ensureIdeaDocumentRevision(project);
  const latest = next.ideaDocumentRevisions.at(-1);
  if (!latest) return next;
  latest.status = 'converted';
  latest.convertedCanonicalRevision = canonicalRevision;
  return alignPlanToIdeaRevision(next, latest);
}
