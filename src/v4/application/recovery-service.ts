import type { ProjectDocumentV5 } from '../contracts.js';
import { diffTextLines } from '../planning-engine.js';
import { normalizeProjectDocument } from '../canonical-entities.js';
import { validateProjectDocument } from '../project-document.js';

export type RecoverySource = 'web-checkpoint' | 'desktop-backup' | 'portable-package';
export type RecoveryIntegrity = 'verified' | 'validated' | 'legacy';

export interface RecoverySectionChange {
  sectionId: string;
  title: string;
  addedLines: number;
  removedLines: number;
  addedItems: number;
  removedItems: number;
  statusChanged: boolean;
}

export interface RecoveryEntityChange {
  key: string;
  label: string;
  beforeCount: number;
  afterCount: number;
  added: number;
  removed: number;
  changed: number;
}

export interface RecoveryPreview {
  source: RecoverySource;
  sourceDocumentRevision: number;
  sourceCanonicalRevision: number;
  expectedDocumentRevision: number;
  expectedCanonicalRevision: number;
  nextDocumentRevision: number;
  nextCanonicalRevision: number;
  integrity: RecoveryIntegrity;
  sections: RecoverySectionChange[];
  entities: RecoveryEntityChange[];
  documentChanges: string[];
  canRestore: boolean;
  reason: string;
}

type EntityCollectionKey = 'objectives' | 'requirements' | 'decisions' | 'risks' | 'tasks' | 'testCases' | 'traceLinks';

const entityCollections: Array<{ key: EntityCollectionKey; label: string }> = [
  { key: 'objectives', label: 'Hedefler' },
  { key: 'requirements', label: 'Gereksinimler' },
  { key: 'decisions', label: 'Kararlar' },
  { key: 'risks', label: 'Riskler' },
  { key: 'tasks', label: 'Görevler' },
  { key: 'testCases', label: 'Testler' },
  { key: 'traceLinks', label: 'İzlenebilirlik bağları' }
];

function comparableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(comparableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${comparableJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function entityId(value: unknown, index: number): string {
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') return value.id;
  return `index:${index}`;
}

function compareEntities(
  current: ProjectDocumentV5,
  candidate: ProjectDocumentV5,
  key: EntityCollectionKey,
  label: string
): RecoveryEntityChange | null {
  const before = current[key];
  const after = candidate[key];
  const beforeById = new Map(before.map((value, index) => [entityId(value, index), comparableJson(value)]));
  const afterById = new Map(after.map((value, index) => [entityId(value, index), comparableJson(value)]));
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const [id, serialized] of afterById) {
    if (!beforeById.has(id)) added += 1;
    else if (beforeById.get(id) !== serialized) changed += 1;
  }
  for (const id of beforeById.keys()) if (!afterById.has(id)) removed += 1;
  if (!added && !removed && !changed) return null;
  return { key, label, beforeCount: before.length, afterCount: after.length, added, removed, changed };
}

function compareSections(current: ProjectDocumentV5, candidate: ProjectDocumentV5): RecoverySectionChange[] {
  const sectionIds = new Set([...Object.keys(current.sections), ...Object.keys(candidate.sections)]);
  const changes: RecoverySectionChange[] = [];
  for (const sectionId of sectionIds) {
    const before = current.sections[sectionId];
    const after = candidate.sections[sectionId];
    const content = diffTextLines(before?.content || '', after?.content || '');
    const beforeItems = new Set(before?.items || []);
    const afterItems = new Set(after?.items || []);
    const addedItems = [...afterItems].filter(item => !beforeItems.has(item)).length;
    const removedItems = [...beforeItems].filter(item => !afterItems.has(item)).length;
    const addedLines = content.filter(line => line.type === 'added').length;
    const removedLines = content.filter(line => line.type === 'removed').length;
    const statusChanged = before?.status !== after?.status;
    if (!addedItems && !removedItems && !addedLines && !removedLines && !statusChanged) continue;
    changes.push({
      sectionId,
      title: after?.title || before?.title || sectionId,
      addedLines,
      removedLines,
      addedItems,
      removedItems,
      statusChanged
    });
  }
  return changes;
}

function compareDocumentState(current: ProjectDocumentV5, candidate: ProjectDocumentV5): string[] {
  const changes: string[] = [];
  if (comparableJson(current.identity) !== comparableJson(candidate.identity)) changes.push('Proje kimliği ve fikir özeti');
  if (comparableJson(current.planningDepth) !== comparableJson(candidate.planningDepth)) changes.push('Planlama derinliği');
  if (comparableJson(current.ideaLabSession) !== comparableJson(candidate.ideaLabSession)
    || comparableJson(current.ideaDiscussion) !== comparableJson(candidate.ideaDiscussion)
    || comparableJson(current.ideaDocumentRevisions) !== comparableJson(candidate.ideaDocumentRevisions)) {
    changes.push('Fikir belgesi');
  }
  if (comparableJson(current.openQuestions) !== comparableJson(candidate.openQuestions)) changes.push('Açık sorular');
  if (comparableJson(current.messages) !== comparableJson(candidate.messages)) changes.push('Keşif konuşması');
  return changes;
}

export function buildRecoveryPreview(
  current: ProjectDocumentV5,
  candidate: ProjectDocumentV5,
  source: RecoverySource,
  integrity: RecoveryIntegrity
): RecoveryPreview {
  if (current.id !== candidate.id) throw new Error('Kurtarma kaydı başka bir projeye ait.');
  const sections = compareSections(current, candidate);
  const entities = entityCollections
    .map(({ key, label }) => compareEntities(current, candidate, key, label))
    .filter((change): change is RecoveryEntityChange => change !== null);
  const documentChanges = compareDocumentState(current, candidate);
  const canRestore = sections.length > 0 || entities.length > 0 || documentChanges.length > 0;
  return {
    source,
    sourceDocumentRevision: candidate.documentRevision,
    sourceCanonicalRevision: candidate.canonicalRevision,
    expectedDocumentRevision: current.documentRevision,
    expectedCanonicalRevision: current.canonicalRevision,
    nextDocumentRevision: current.documentRevision + 1,
    nextCanonicalRevision: current.canonicalRevision + 1,
    integrity,
    sections,
    entities,
    documentChanges,
    canRestore,
    reason: canRestore ? '' : 'Bu kayıt ile güncel proje arasında geri yüklenecek bir fark bulunamadı.'
  };
}

export function assertRecoveryPreviewFresh(current: ProjectDocumentV5, preview: RecoveryPreview): void {
  if (current.documentRevision !== preview.expectedDocumentRevision
    || current.canonicalRevision !== preview.expectedCanonicalRevision) {
    throw new Error('Kurtarma önizlemesi artık güncel değil. Proje değişti; kaydı yeniden inceleyin.');
  }
  if (!preview.canRestore) throw new Error(preview.reason);
}

export function restorePortablePackageAsNewRevision(
  currentProject: ProjectDocumentV5,
  packageProject: ProjectDocumentV5
): ProjectDocumentV5 {
  const current = normalizeProjectDocument(currentProject);
  const packageSnapshot = normalizeProjectDocument(packageProject);
  if (current.id !== packageSnapshot.id) throw new Error('Taşınabilir paket başka bir projeye ait.');
  const restoredAt = new Date().toISOString();
  const next = structuredClone(packageSnapshot);
  next.documentRevision = current.documentRevision + 1;
  next.canonicalRevision = current.canonicalRevision + 1;
  next.lifecycle.status = 'active';
  next.lifecycle.updatedAt = restoredAt;
  next.lifecycle.finalizedAt = null;
  next.revisions = structuredClone(current.revisions);
  next.exports = structuredClone(current.exports);
  next.executionSessions = structuredClone(current.executionSessions);
  next.commandLog = structuredClone(current.commandLog);
  next.metadata = {
    ...next.metadata,
    restoredFromPortablePackage: {
      sourceDocumentRevision: packageSnapshot.documentRevision,
      sourceCanonicalRevision: packageSnapshot.canonicalRevision,
      restoredAt
    }
  };
  const snapshot = structuredClone(next);
  snapshot.revisions = [];
  next.revisions.push({
    id: `revision-package-${Date.now()}`,
    number: next.canonicalRevision,
    createdAt: restoredAt,
    summary: `Taşınabilir paket r${packageSnapshot.canonicalRevision} yeni revision olarak geri yüklendi`,
    acceptedSuggestionIds: [],
    affectedSections: Object.keys(next.sections),
    snapshot
  });
  const validation = validateProjectDocument(next);
  if (!validation.valid) throw new Error(`Paket geri yükleme sonucu geçersiz: ${validation.errors.join(' ')}`);
  return next;
}
