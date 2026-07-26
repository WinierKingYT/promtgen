import type {
  ConceptSummary,
  IdeaDiscussionMode,
  IdeaDiscussionRecord,
  IdeaRecordKind,
  IdeaRecordStatus,
  ProjectDocumentV5,
  SuggestionBundle
} from '../contracts.js';

const VALID_MODES = new Set<IdeaDiscussionMode>(['explore', 'challenge', 'compare', 'clarify']);
const VALID_STATUSES = new Set<IdeaRecordStatus>(['pending', 'accepted', 'deferred', 'rejected']);
const MAX_RECORD_TEXT = 600;
const MAX_DETAIL_TEXT = 2400;

function ensureState(project: ProjectDocumentV5): ProjectDocumentV5 {
  const next = structuredClone(project);
  next.ideaDiscussion ||= { mode: 'explore', records: [], updatedAt: new Date().toISOString() };
  next.ideaDiscussion.records ||= [];
  return next;
}

function recordKind(kind: string): IdeaRecordKind {
  if (kind === 'risk') return 'risk';
  if (kind === 'question') return 'question';
  if (kind === 'decision' || kind === 'architecture') return 'decision';
  return 'hypothesis';
}

function fingerprint(kind: IdeaRecordKind, text: string): string {
  return `${kind}:${text.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ')}`;
}

function bounded(value: unknown, max: number): string {
  return String(value || '').trim().slice(0, max);
}

function discussionSnapshot(record: IdeaDiscussionRecord) {
  return {
    editedAt: new Date().toISOString(),
    text: record.text,
    note: record.note,
    answer: record.answer,
    rationale: record.rationale,
    validationPlan: record.validationPlan
  };
}

export function setIdeaDiscussionMode(project: ProjectDocumentV5, mode: IdeaDiscussionMode): ProjectDocumentV5 {
  if (!VALID_MODES.has(mode)) throw new Error(`Geçersiz fikir tartışma modu: ${mode}`);
  const next = ensureState(project);
  next.ideaDiscussion.mode = mode;
  next.ideaDiscussion.updatedAt = new Date().toISOString();
  return next;
}

export function captureDiscussionBundle(
  project: ProjectDocumentV5,
  bundle: SuggestionBundle,
  sourceMessageId = ''
): ProjectDocumentV5 {
  const next = ensureState(project);
  const existing = new Set(next.ideaDiscussion.records.map(item => fingerprint(item.kind, item.text)));
  const createdAt = new Date().toISOString();
  const candidates = [
    ...bundle.items.map(item => ({ kind: recordKind(item.kind), text: item.title || item.description })),
    ...(bundle.openQuestions || []).map(text => ({ kind: 'question' as const, text }))
  ];

  for (const [index, candidate] of candidates.entries()) {
    const value = String(candidate.text || '').trim();
    const key = fingerprint(candidate.kind, value);
    if (!value || existing.has(key)) continue;
    const record: IdeaDiscussionRecord = {
      id: `idea-record-${Date.now()}-${index}`,
      kind: candidate.kind,
      text: value,
      originalText: value,
      note: '',
      answer: '',
      rationale: '',
      validationPlan: '',
      history: [],
      status: 'pending',
      sourceBundleId: bundle.id,
      sourceMessageId,
      createdAt
    };
    next.ideaDiscussion.records.push(record);
    existing.add(key);
  }
  next.ideaDiscussion.updatedAt = createdAt;
  return next;
}

export function updateIdeaRecord(
  project: ProjectDocumentV5,
  recordId: string,
  changes: Partial<Pick<IdeaDiscussionRecord, 'text' | 'note' | 'answer' | 'rationale' | 'validationPlan'>>
): ProjectDocumentV5 {
  const next = ensureState(project);
  const record = next.ideaDiscussion.records.find(item => item.id === recordId);
  if (!record) throw new Error('Fikir kaydı bulunamadı.');
  const updated = {
    text: changes.text === undefined ? record.text : bounded(changes.text, MAX_RECORD_TEXT),
    note: changes.note === undefined ? record.note : bounded(changes.note, MAX_DETAIL_TEXT),
    answer: changes.answer === undefined ? record.answer : bounded(changes.answer, MAX_DETAIL_TEXT),
    rationale: changes.rationale === undefined ? record.rationale : bounded(changes.rationale, MAX_DETAIL_TEXT),
    validationPlan: changes.validationPlan === undefined ? record.validationPlan : bounded(changes.validationPlan, MAX_DETAIL_TEXT)
  };
  if (!updated.text) throw new Error('Fikir kaydı metni boş olamaz.');
  const changed = Object.entries(updated).some(([key, value]) => record[key as keyof typeof updated] !== value);
  if (!changed) return next;
  record.history ||= [];
  record.history.push(discussionSnapshot(record));
  Object.assign(record, updated);
  next.ideaDiscussion.updatedAt = new Date().toISOString();
  return next;
}

export function updateIdeaRecordStatus(
  project: ProjectDocumentV5,
  recordId: string,
  status: IdeaRecordStatus
): ProjectDocumentV5 {
  if (!VALID_STATUSES.has(status)) throw new Error(`Geçersiz fikir kaydı durumu: ${status}`);
  const next = ensureState(project);
  const record = next.ideaDiscussion.records.find(item => item.id === recordId);
  if (!record) throw new Error('Fikir kaydı bulunamadı.');
  if (record.kind === 'question' && status === 'accepted' && !record.answer.trim()) {
    throw new Error('Açık soru kabul edilmeden önce cevaplanmalı.');
  }
  record.status = status;
  record.resolvedAt = status === 'pending' ? undefined : new Date().toISOString();
  next.ideaDiscussion.updatedAt = new Date().toISOString();
  return next;
}

export function getConceptAgreementGate(project: ProjectDocumentV5) {
  const records = project.ideaDiscussion?.records || [];
  const unansweredAcceptedQuestions = records.filter(item =>
    item.kind === 'question' && item.status === 'accepted' && !item.answer.trim()
  );
  const pending = records.filter(item => item.status === 'pending');
  return {
    ready: pending.length === 0 && unansweredAcceptedQuestions.length === 0,
    pending,
    unresolvedCount: pending.length + unansweredAcceptedQuestions.length,
    unansweredAcceptedQuestions,
    accepted: records.filter(item => item.status === 'accepted'),
    deferred: records.filter(item => item.status === 'deferred'),
    rejected: records.filter(item => item.status === 'rejected')
  };
}

export function buildIdeaDiscussionContext(project: ProjectDocumentV5) {
  const records = project.ideaDiscussion?.records || [];
  const projectRecord = (record: IdeaDiscussionRecord) => ({
    kind: record.kind,
    text: record.text,
    note: record.note || undefined,
    answer: record.answer || undefined,
    rationale: record.rationale || undefined,
    validationPlan: record.validationPlan || undefined
  });
  return {
    mode: project.ideaDiscussion?.mode || 'explore',
    accepted: records.filter(item => item.status === 'accepted').slice(-20).map(projectRecord),
    deferred: records.filter(item => item.status === 'deferred').slice(-12).map(projectRecord),
    rejected: records.filter(item => item.status === 'rejected').slice(-20).map(projectRecord),
    pending: records.filter(item => item.status === 'pending').slice(-12).map(projectRecord)
  };
}

export function updateConceptAgreement(
  project: ProjectDocumentV5,
  changes: Partial<Pick<ConceptSummary, 'summary' | 'confirmedFeatures' | 'outOfScope' | 'technicalApproaches' | 'knownRisks' | 'openQuestions' | 'mvpTarget'>>
): ProjectDocumentV5 {
  const next = ensureState(project);
  const summary = next.ideaLabSession?.conceptSummary;
  if (!summary) throw new Error('Düzenlenecek konsept özeti bulunamadı.');
  const normalizeList = (items: unknown) => Array.isArray(items)
    ? [...new Set(items.map(item => bounded(item, MAX_RECORD_TEXT)).filter(Boolean))].slice(0, 50)
    : [];
  if (changes.summary !== undefined) summary.summary = bounded(changes.summary, MAX_DETAIL_TEXT);
  if (changes.mvpTarget !== undefined) summary.mvpTarget = bounded(changes.mvpTarget, MAX_RECORD_TEXT);
  for (const key of ['confirmedFeatures', 'outOfScope', 'technicalApproaches', 'knownRisks', 'openQuestions'] as const) {
    if (changes[key] !== undefined) summary[key] = normalizeList(changes[key]);
  }
  if (!summary.summary || !summary.mvpTarget) throw new Error('Konsept özeti ve MVP hedefi boş olamaz.');
  next.ideaDiscussion.updatedAt = new Date().toISOString();
  return next;
}
