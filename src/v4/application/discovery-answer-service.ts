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
  evidence: string[];
  confidence: number;
  status: DiscoveryAnswerPatchStatus;
}

export interface DiscoveryAnswerAssessment {
  quality: 'actionable' | 'ambiguous' | 'conflicting';
  warnings: string[];
  detectedFields: DiscoveryConceptField[];
  canCloseQuestion: boolean;
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
  assessment: DiscoveryAnswerAssessment;
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
    .split(/\r?\n|[;,•]/)
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

function inferQuestionFields(question: string): DiscoveryConceptField[] {
  const text = question.toLocaleLowerCase('tr-TR');
  const fields: DiscoveryConceptField[] = [];
  const add = (field: DiscoveryConceptField, pattern: RegExp) => {
    if (pattern.test(text) && !fields.includes(field)) fields.push(field);
  };
  add('targetUser', /kim kullan|hedef kullanıcı|birincil kullanıcı|persona|target user/);
  add('currentAlternative', /bugün|şu anda|mevcut çözüm|nasıl çöz|alternatif|current alternative/);
  add('problemStatement', /ana problem|hangi problem|gerçek problem|neden zorlan|ne kaybed|pain point/);
  add('desiredOutcome', /beklenen.*sonuç|başarı.*ölç|ne değiş|ana sonuç|desired outcome/);
  add('outOfScope', /mvp.*dış|kapsam dış|sonraki sürüm|geleceğe bırak|out of scope/);
  add('confirmedFeatures', /mvp.*iç|ilk sürümde.*özellik|hangi özellik|kapsama al|must have/);
  add('technicalApproaches', /teknoloji|teknik yaklaşım|mimari|hangi araç|ne kullan|tech stack/);
  add('knownRisks', /risk|hassas veri|güvenlik|başarısız|security/);
  add('mvpTarget', /mvp|ilk sürüm|ilk doğrulan|en küçük sürüm|first release/);
  return fields;
}

const LABEL_PATTERNS: Array<[DiscoveryConceptField, RegExp]> = [
  ['outOfScope', /^(?:mvp\s*dış(?:ı|ında)?|kapsam dış(?:ı|ında)?|out of scope)\s*:/i],
  ['confirmedFeatures', /^(?:mvp\s*iç(?:i|inde)?|özellikler?|must have)\s*:/i],
  ['targetUser', /^(?:hedef kullanıcı|birincil kullanıcı|kullanıcı|persona|target user|user)\s*:/i],
  ['problemStatement', /^(?:ana problem|problem|sorun|pain point)\s*:/i],
  ['currentAlternative', /^(?:bugünkü çözüm|mevcut çözüm|alternatif|current alternative)\s*:/i],
  ['desiredOutcome', /^(?:beklenen sonuç|ana sonuç|sonuç|desired outcome|outcome)\s*:/i],
  ['technicalApproaches', /^(?:teknik yaklaşım|teknoloji|mimari|tech stack|technology)\s*:/i],
  ['knownRisks', /^(?:bilinen riskler?|riskler?|risk|security)\s*:/i],
  ['mvpTarget', /^(?:mvp hedefi|ilk sürüm hedefi|mvp|first release)\s*:/i]
];

function splitClauses(answer: string): string[] {
  return answer
    .split(/\r?\n|;|(?<=[.!?])\s+/)
    .map(clause => clause.trim())
    .filter(Boolean)
    .slice(0, 24);
}

function explicitField(clause: string): DiscoveryConceptField | null {
  return LABEL_PATTERNS.find(([, pattern]) => pattern.test(clause))?.[0] || null;
}

function stripLabel(clause: string): string {
  for (const [, pattern] of LABEL_PATTERNS) {
    if (pattern.test(clause)) return clause.replace(pattern, '').trim();
  }
  return clause.trim();
}

function semanticFields(clause: string): DiscoveryConceptField[] {
  const text = clause.toLocaleLowerCase('tr-TR');
  const fields: DiscoveryConceptField[] = [];
  const add = (field: DiscoveryConceptField, pattern: RegExp) => {
    if (pattern.test(text) && !fields.includes(field)) fields.push(field);
  };
  add('targetUser', /kullanıcı|geliştirici|developer|yönetici|öğrenci|doktor|hasta|çalışan|ekip lideri|proje yöneticisi|customer|operator/);
  add('problemStatement', /sorun|zorlan|kaybol|gecik|yapam|dağınık|pain|struggle|problem/);
  add('currentAlternative', /şu anda|bugün|halen|mevcutta|yerine|currently|today|şimdilik/);
  add('desiredOutcome', /amaç|hedeflenen sonuç|sağlayacak|azaltmak|artırmak|başarı|ölçülecek|outcome|so that/);
  add('outOfScope', /kapsam dış|sonraki sürüm|ileride|daha sonra|şimdilik yok|olmayacak|future|later|not in mvp/);
  add('confirmedFeatures', /mvp içinde|ilk sürümde|zorunlu özellik|must have|çekirdek özellik/);
  if (!/zorunlu değil|şart değil|not required|tercih değil/.test(text)) {
    add('technicalApproaches', /react|vue|angular|next\.?js|typescript|python|tauri|electron|flutter|postgres|sqlite|redis|kafka|mikroservis|microservice|server.?auth|local.?first/);
  }
  add('knownRisks', /risk|tehlike|güvenlik|hassas veri|gecikme|belirsizlik|security|privacy|failure/);
  add('mvpTarget', /mvp hedef|ilk sürümün hedef|ilk doğrulan|first release goal/);
  return fields;
}

function hasMaterialConflict(text: string): boolean {
  const normalized = text.toLocaleLowerCase('tr-TR');
  return (
    (/(?:yalnız|sadece|bireysel|tek kullanıcı)/.test(normalized) && /ekip|takım|çok kullanıcılı|işbirliği/.test(normalized)) ||
    (/local.?first|yalnız cihaz|cihazdan çıkma/.test(normalized) && /bulut|cloud|sunucuya gönder/.test(normalized)) ||
    (/ilk sürüm|mvp/.test(normalized) && /her şey|tüm özellik|eksiksiz|tam kapsam/.test(normalized)) ||
    /(?:olmalı|zorunlu).{0,60}(?:olmamalı|gereksiz)|(?:olmamalı|gereksiz).{0,60}(?:olmalı|zorunlu)/.test(normalized)
  );
}

function isUncertain(text: string): boolean {
  return /bilmiyorum|emin değilim|kararsızım|fark etmez|herkes|ne olursa|belki|galiba|sanırım|don't know|not sure|whatever/i.test(text);
}

function isIronic(text: string): boolean {
  return /güya|sözde|aynen tabii|tabii ki.*[!?]|yeah right|as if/i.test(text);
}

function hasMultiplePersonas(text: string): boolean {
  const roles = text.toLocaleLowerCase('tr-TR').match(/geliştirici|developer|yönetici|öğrenci|doktor|hasta|çalışan|müşteri|proje yöneticisi|ekip lideri/g) || [];
  return new Set(roles).size > 1;
}

function placeholderValue(value: DiscoveryAnswerPatchValue): boolean {
  const text = Array.isArray(value) ? value.join(' ') : value;
  return /kullanıcı tarafından|doğrulanmalı|kesin persona|bu ihtiyacı/.test(text.toLocaleLowerCase('tr-TR'));
}

function confidenceFor(input: {
  field: DiscoveryConceptField;
  questionFields: DiscoveryConceptField[];
  explicit: boolean;
  semantic: boolean;
  value: string;
  currentValue: DiscoveryAnswerPatchValue;
  ambiguous: boolean;
  conflicting: boolean;
  longAnswer: boolean;
  multiplePersonas: boolean;
}): number {
  let score = 42;
  if (input.explicit) score += 28;
  if (input.semantic) score += 18;
  if (input.questionFields.includes(input.field)) score += 12;
  if (input.value.split(/\s+/).length >= 4) score += 6;
  if (input.ambiguous) score -= 28;
  if (input.conflicting) score -= 32;
  if (input.longAnswer) score -= 12;
  if (input.field === 'targetUser' && input.multiplePersonas) score -= 18;
  if (!placeholderValue(input.currentValue) && normalizeComparison(input.currentValue) !== normalizeComparison(input.value)) score -= 8;
  return Math.max(15, Math.min(96, score));
}

function normalizeComparison(value: DiscoveryAnswerPatchValue): string {
  return (Array.isArray(value) ? value.join(' ') : value).toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();
}

function makePatch(
  field: DiscoveryConceptField,
  summary: ConceptSummary,
  values: string[],
  idFactory: () => string,
  context: {
    questionFields: DiscoveryConceptField[];
    explicitFields: Set<DiscoveryConceptField>;
    semanticFields: Set<DiscoveryConceptField>;
    ambiguous: boolean;
    conflicting: boolean;
    longAnswer: boolean;
    multiplePersonas: boolean;
  }
): DiscoveryAnswerPatch {
  const meta = FIELD_META[field];
  const currentValue = structuredClone(summary[field]) as DiscoveryAnswerPatchValue;
  const joinedValue = values.map(stripLabel).filter(Boolean).join(' ');
  const proposedValue = meta.kind === 'list'
    ? mergeUnique(currentValue as string[], values.flatMap(value => answerItems(stripLabel(value))))
    : normalizedText(joinedValue);
  const explicit = context.explicitFields.has(field);
  const semantic = context.semanticFields.has(field);
  const confidence = confidenceFor({
    field,
    questionFields: context.questionFields,
    explicit,
    semantic,
    value: joinedValue,
    currentValue,
    ambiguous: context.ambiguous,
    conflicting: context.conflicting,
    longAnswer: context.longAnswer,
    multiplePersonas: context.multiplePersonas
  });
  const evidence = [
    ...(explicit ? ['Alan etiketi'] : []),
    ...(semantic ? ['Anlam sinyali'] : []),
    ...(context.questionFields.includes(field) ? ['Soru eşleşmesi'] : [])
  ];
  return {
    id: idFactory(),
    field,
    label: meta.label,
    currentValue,
    proposedValue,
    rationale: `“${meta.label}” eşlemesi ${evidence.length} sinyalle hesaplandı; onay gerekir.`,
    evidence,
    confidence,
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
  if (!summary || !answer || !question) return null;
  const idFactory = options.idFactory || defaultId;
  const questionFields = inferQuestionFields(question);
  const clauses = splitClauses(answer);
  const conflicting = hasMaterialConflict(answer);
  const ambiguous = isUncertain(answer) || isIronic(answer) || answer.split(/\s+/).length < 2;
  const longAnswer = answer.length > 1200;
  const multiplePersonas = hasMultiplePersonas(answer);
  const warnings = [
    ...(conflicting ? ['Çelişkili kapsam veya kullanım sınırları bulundu.'] : []),
    ...(isUncertain(answer) ? ['Kesin karar yok; soru açık kalacak.'] : []),
    ...(isIronic(answer) ? ['İroni sinyali bulundu; eşleme sınırlandı.'] : []),
    ...(longAnswer ? ['Yanıt çok uzun; yalnız açık sinyaller kullanıldı.'] : []),
    ...(multiplePersonas ? ['Birden fazla persona var; birincil kullanıcı seçilmeli.'] : [])
  ];
  const valuesByField = new Map<DiscoveryConceptField, string[]>();
  const explicitFields = new Set<DiscoveryConceptField>();
  const detectedSemanticFields = new Set<DiscoveryConceptField>();
  const addValue = (field: DiscoveryConceptField, clause: string) => {
    const values = valuesByField.get(field) || [];
    values.push(clause);
    valuesByField.set(field, values);
  };

  if (!ambiguous) {
    for (const clause of clauses) {
      const explicit = explicitField(clause);
      if (explicit) {
        explicitFields.add(explicit);
        addValue(explicit, clause);
        continue;
      }
      const semantic = semanticFields(clause);
      for (const field of semantic) {
        detectedSemanticFields.add(field);
        addValue(field, clause);
      }
      if (semantic.length === 0 && questionFields.length === 1) addValue(questionFields[0], clause);
    }
  }

  if (conflicting) {
    for (const field of [...valuesByField.keys()]) {
      if (field === 'targetUser' || field === 'confirmedFeatures' || field === 'outOfScope') valuesByField.delete(field);
    }
  }
  const context = {
    questionFields,
    explicitFields,
    semanticFields: detectedSemanticFields,
    ambiguous,
    conflicting,
    longAnswer,
    multiplePersonas
  };
  const patches = [...valuesByField.entries()]
    .map(([field, values]) => makePatch(field, summary, values, idFactory, context))
    .filter(patch => normalizeComparison(patch.currentValue) !== normalizeComparison(patch.proposedValue));
  if (patches.some(patch => !placeholderValue(patch.currentValue))) {
    warnings.push('Yanıt önceki alanı değiştiriyor; uygulamadan önce karşılaştır.');
  }
  const canCloseQuestion = patches.length > 0
    && !ambiguous
    && !conflicting
    && !multiplePersonas
    && patches.every(patch => patch.confidence >= 55);
  if (summary.openQuestions.includes(question) && canCloseQuestion) {
    patches.push({
      id: idFactory(),
      field: 'openQuestions',
      label: FIELD_META.openQuestions.label,
      currentValue: [...summary.openQuestions],
      proposedValue: summary.openQuestions.filter(item => item !== question),
      rationale: 'Yanıtlanan soruyu kapatma önerisi.',
      evidence: ['Alan önerisi', 'Çelişki yok'],
      confidence: Math.min(96, Math.max(...patches.map(patch => patch.confidence))),
      status: 'pending'
    });
  }
  const quality: DiscoveryAnswerAssessment['quality'] = conflicting
    ? 'conflicting'
    : ambiguous || patches.length === 0
      ? 'ambiguous'
      : 'actionable';
  if (patches.length === 0 && warnings.length === 0) {
    warnings.push('Yanıt bir plan alanıyla eşleşmedi; alan etiketiyle netleştir.');
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
    assessment: {
      quality,
      warnings,
      detectedFields: patches.filter(patch => patch.field !== 'openQuestions').map(patch => patch.field),
      canCloseQuestion
    },
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
