import { conceptFieldLabel } from './concept-field-labels.js';

/**
 * `ConceptAgreementEditor.tsx`ın taslak metnini satırlara ayırır.
 *
 * `save()` içindeki dönüşümle (`EditableAgreement`'a giden liste alanları)
 * AYNI ayraçtır. Burada AYRICA tanımlanmasının nedeni, alan geçerliliğinin
 * bileşenden bağımsız, node ile de doğrulanabilir olmasıdır.
 */
export function lines(value: string): string[] {
  return value.split('\n').map(item => item.trim()).filter(Boolean);
}

const REQUIRED_TEXT_FIELDS = [
  'summary', 'targetUser', 'problemStatement', 'currentAlternative', 'desiredOutcome', 'firstReleaseTarget'
] as const;

const REQUIRED_SCOPE_LISTS = ['confirmedFeatures', 'outOfScope'] as const;

export type ConceptAgreementTextFieldKey = (typeof REQUIRED_TEXT_FIELDS)[number];
export type ConceptAgreementScopeListKey = (typeof REQUIRED_SCOPE_LISTS)[number];

export interface ConceptAgreementDraftText {
  summary: string;
  targetUser: string;
  problemStatement: string;
  currentAlternative: string;
  desiredOutcome: string;
  firstReleaseTarget: string;
  confirmedFeatures: string;
  outOfScope: string;
  openQuestions: string;
}

export interface ConceptAgreementBlockers {
  emptyTextFields: ConceptAgreementTextFieldKey[];
  emptyScopeLists: ConceptAgreementScopeListKey[];
  openQuestionCount: number;
}

/**
 * Kaydet düğmesini engelleyen alanları TEK TEK döner.
 *
 * ÖLÇÜLEN KUSUR (A4, canlı test): kaydet düğmesi devre dışıydı ve tek geri
 * bildirim, hangi alanın engellediğini söylemeyen TEK bir genel cümleydi
 * (`ConceptAgreementEditor.tsx` eski `agreement-error` metni). Bu fonksiyon
 * o cümlenin arkasındaki koşulları alan alan görünür kılar.
 *
 * KURAL DEĞİŞMEDİ: bu, `ConceptAgreementEditor`'ın kendi TASLAK geçerlilik
 * kontrolüdür -- belge düzeyindeki kapı (`getConceptAgreementGate`,
 * `idea-discussion-service.ts:436-440`) burada tekrarlanmaz, yalnızca aynı
 * altı yorum alanı + iki kapsam listesi + açık soru sayısı ayrı ayrı
 * raporlanır.
 */
export function getConceptAgreementBlockers(draft: ConceptAgreementDraftText): ConceptAgreementBlockers {
  return {
    emptyTextFields: REQUIRED_TEXT_FIELDS.filter(key => !draft[key].trim()),
    emptyScopeLists: REQUIRED_SCOPE_LISTS.filter(key => lines(draft[key]).length === 0),
    openQuestionCount: lines(draft.openQuestions).length
  };
}

export function isConceptAgreementValid(blockers: ConceptAgreementBlockers): boolean {
  return blockers.emptyTextFields.length === 0
    && blockers.emptyScopeLists.length === 0
    && blockers.openQuestionCount === 0;
}

/**
 * Engelleyen alanların KULLANICIYA görünen adları, tek cümlede
 * birleştirilebilecek sırayla.
 *
 * `openQuestions` bilerek `CONCEPT_FIELD_LABELS`'a girmiyor (bkz.
 * concept-field-labels.ts -- kapı yalnız sekiz belirli alanı eksik
 * bildirebilir ve açık sorular onlardan biri değil). Sayısı bu yüzden ayrı
 * bir ifadeyle eklenir, sahte bir etiket uydurulmaz.
 */
export function describeConceptAgreementBlockers(blockers: ConceptAgreementBlockers): string[] {
  const labels: string[] = [
    ...blockers.emptyTextFields.map(field => conceptFieldLabel(field)),
    ...blockers.emptyScopeLists.map(field => conceptFieldLabel(field))
  ];
  if (blockers.openQuestionCount > 0) {
    labels.push(`Açık kritik sorular (${blockers.openQuestionCount} madde)`);
  }
  return labels;
}

/**
 * "Açık kritik sorular" TASLAĞINDAKİ tek bir satırı kaldırır.
 *
 * `ConceptAgreementEditor.tsx`taki `removeLegacyLines` ile AYNI kural:
 * kaldırma yalnız TASLAKTA olur, belgeye geçmesi için kullanıcının ayrıca
 * kaydetmesi gerekir. Sistem kendiliğinden hiçbir satırı kaldırmaz -- bu
 * fonksiyon yalnız kullanıcının "Cevaplandı, kapat" tıklamasıyla çağrılır.
 * Girdi dizisi mutasyona uğramaz.
 */
export function closeOpenQuestion(currentLines: readonly string[], index: number): string[] {
  return currentLines.filter((_, i) => i !== index);
}
