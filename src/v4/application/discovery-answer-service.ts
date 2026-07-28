import type { ConceptSummary, ProjectDocumentV5 } from '../contracts.js';
import { updateConceptAgreement } from './idea-discussion-service.js';

export type DiscoveryConceptField =
  | 'targetUser'
  | 'problemStatement'
  | 'currentAlternative'
  | 'desiredOutcome'
  | 'confirmedFeatures'
  | 'outOfScope'
  | 'technicalApproaches'
  | 'knownRisks'
  | 'mvpTarget'
  | 'openQuestions';

export type DiscoveryAnswerPatchStatus = 'pending' | 'accepted' | 'edited' | 'deferred' | 'rejected';
export type DiscoveryAnswerPatchValue = string | string[];

export interface DiscoveryAnswerPatch {
  id: string;
  field: DiscoveryConceptField;
  label: string;
  currentValue: DiscoveryAnswerPatchValue;
  proposedValue: DiscoveryAnswerPatchValue;
  editedValue?: DiscoveryAnswerPatchValue;
  rationale: string;
  confidence: number;
  status: DiscoveryAnswerPatchStatus;
}

export interface DiscoveryAnswerDraft {
  id: string;
  projectId: string;
  baseDocumentRevision: number;
  baseCanonicalRevision: number;
  sourceQuestion: string;
  sourceAnswer: string;
  createdAt: string;
  provenance: {
    mode: 'rule-engine';
    label: 'Yerel alan eşleyici';
  };
  patches: DiscoveryAnswerPatch[];
}

type DraftOptions = {
  idFactory?: () => string;
  now?: () => string;
};

const FIELD_META: Record<DiscoveryConceptField, { label: string; kind: 'text' | 'list' }> = {
  targetUser: { label: 'Birincil kullanıcı', kind: 'text' },
  problemStatement: { label: 'Ana problem', kind: 'text' },
  currentAlternative: { label: 'Bugünkü çözüm', kind: 'text' },
  desiredOutcome: { label: 'Beklenen ana sonuç', kind: 'text' },
  confirmedFeatures: { label: 'MVP içinde', kind: 'list' },
  outOfScope: { label: 'MVP dışında', kind: 'list' },
  technicalApproaches: { label: 'Teknik yaklaşım', kind: 'list' },
  knownRisks: { label: 'Bilinen riskler', kind: 'list' },
  mvpTarget: { label: 'MVP hedefi', kind: 'text' },
  openQuestions: { label: 'Açık kritik sorular', kind: 'list' }
};

function defaultId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `discovery-patch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizedText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function answerItems(answer: string): string[] {
  const chunks = answer
    .split(/\r?\n|[;•]/)
    .flatMap(part => part.includes(',') ? part.split(',') : [part])
    .map(item => item.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
  return [...new Set(chunks)].slice(0, 12);
}

function mergeUnique(current: string[], incoming: string[]) {
  const seen = new Set(current.map(item => item.toLocaleLowerCase('tr-TR')));
  return [...current, ...incoming.filter(item => {
    const key = item.toLocaleLowerCase('tr-TR');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })];
}

function inferField(question: string): DiscoveryConceptField | null {
  const text = question.toLocaleLowerCase('tr-TR');
  if (/kim kullan|hedef kullanıcı|birincil kullanıcı|persona/.test(text)) return 'targetUser';
  if (/bugün|şu anda|mevcut çözüm|nasıl çöz|alternatif/.test(text)) return 'currentAlternative';
  if (/ana problem|hangi problem|neden zorlan|ne kaybed/.test(text)) return 'problemStatement';
  if (/beklenen.*sonuç|başarı.*ölç|ne değiş|ana sonuç/.test(text)) return 'desiredOutcome';
  if (/mvp.*dış|kapsam dış|sonraki sürüm|geleceğe bırak/.test(text)) return 'outOfScope';
  if (/mvp.*iç|ilk sürümde.*özellik|hangi özellik|kapsama al/.test(text)) return 'confirmedFeatures';
  if (/teknoloji|teknik yaklaşım|mimari|hangi araç|ne kullan/.test(text)) return 'technicalApproaches';
  if (/risk|hassas veri|güvenlik|başarısız/.test(text)) return 'knownRisks';
  if (/mvp|ilk sürüm|ilk doğrulan|en küçük sürüm/.test(text)) return 'mvpTarget';
  return null;
}

function makePatch(
  field: DiscoveryConceptField,
  summary: ConceptSummary,
  answer: string,
  idFactory: () => string
): DiscoveryAnswerPatch {
  const meta = FIELD_META[field];
  const currentValue = structuredClone(summary[field]) as DiscoveryAnswerPatchValue;
  const proposedValue = meta.kind === 'list'
    ? mergeUnique(currentValue as string[], answerItems(answer))
    : normalizedText(answer);
  return {
    id: idFactory(),
    field,
    label: meta.label,
    currentValue,
    proposedValue,
    rationale: `Yanıt, seçilen sorudaki “${meta.label}” alanıyla eşleşti. Bu yalnızca yerel ve kural tabanlı bir öneridir.`,
    confidence: 78,
    status: 'pending'
  };
}

export function createDiscoveryAnswerDraft(
  project: ProjectDocumentV5,
  input: { answer: string; focusedQuestion: string },
  options: DraftOptions = {}
): DiscoveryAnswerDraft | null {
  const summary = project.ideaLabSession?.conceptSummary;
  const answer = input.answer.trim();
  const question = input.focusedQuestion.trim();
  const field = inferField(question);
  if (!summary || !answer || !question || !field) return null;
  const idFactory = options.idFactory || defaultId;
  const patches = [makePatch(field, summary, answer, idFactory)];
  if (summary.openQuestions.includes(question)) {
    patches.push({
      id: idFactory(),
      field: 'openQuestions',
      label: FIELD_META.openQuestions.label,
      currentValue: [...summary.openQuestions],
      proposedValue: summary.openQuestions.filter(item => item !== question),
      rationale: 'Yanıtlanan soruyu açık sorular listesinden kapatma önerisi.',
      confidence: 100,
      status: 'pending'
    });
  }
  return {
    id: idFactory(),
    projectId: project.id,
    baseDocumentRevision: project.documentRevision,
    baseCanonicalRevision: project.canonicalRevision,
    sourceQuestion: question,
    sourceAnswer: answer,
    createdAt: (options.now || (() => new Date().toISOString()))(),
    provenance: { mode: 'rule-engine', label: 'Yerel alan eşleyici' },
    patches
  };
}

export function updateDiscoveryAnswerPatch(
  draft: DiscoveryAnswerDraft,
  patchId: string,
  status: DiscoveryAnswerPatchStatus,
  editedValue?: DiscoveryAnswerPatchValue
): DiscoveryAnswerDraft {
  return {
    ...draft,
    patches: draft.patches.map(patch => patch.id === patchId
      ? { ...patch, status, editedValue: status === 'edited' ? editedValue : undefined }
      : patch)
  };
}

export type ApplyDiscoveryAnswerResult =
  | { success: true; project: ProjectDocumentV5; appliedFields: DiscoveryConceptField[] }
  | { success: false; reason: string };

export function applyDiscoveryAnswerDraft(
  project: ProjectDocumentV5,
  draft: DiscoveryAnswerDraft
): ApplyDiscoveryAnswerResult {
  if (project.id !== draft.projectId) return { success: false, reason: 'Öneri farklı bir projeye ait.' };
  if (
    project.documentRevision !== draft.baseDocumentRevision
    || project.canonicalRevision !== draft.baseCanonicalRevision
  ) {
    return { success: false, reason: 'Proje bu öneriden sonra değişti. Yanıtı yeniden değerlendir.' };
  }
  const selected = draft.patches.filter(patch => patch.status === 'accepted' || patch.status === 'edited');
  if (selected.length === 0) return { success: false, reason: 'Uygulanacak kabul edilmiş alan yok.' };

  const changes: Partial<Pick<
    ConceptSummary,
    DiscoveryConceptField
  >> = {};
  for (const patch of selected) {
    const value = patch.status === 'edited' ? patch.editedValue : patch.proposedValue;
    if (value === undefined) return { success: false, reason: `${patch.label} için düzenlenen değer boş.` };
    Object.assign(changes, { [patch.field]: structuredClone(value) });
  }
  try {
    return {
      success: true,
      project: updateConceptAgreement(project, changes),
      appliedFields: selected.map(patch => patch.field)
    };
  } catch (error) {
    return { success: false, reason: error instanceof Error ? error.message : 'Yanıt önerileri uygulanamadı.' };
  }
}
