import type { ConceptSummary } from '../contracts.js';

/**
 * Fikir belgesi alanlarının KULLANICIYA görünen adları.
 *
 * NEDEN AYRI BİR MODÜL. Bu etiketler iki yerden okunuyor: kullanıcının
 * doldurduğu form (`react/components/ConceptAgreementEditor.tsx`) ve o form
 * eksik kaldığında yazılan dönüşüm engeli
 * (`application/idea-plan-conversion-service.ts`). İkisi ayrı ayrı yazılsaydı
 * biri değişince diğeri sessizce başka bir kutunun adını söylerdi; `16abc11`
 * aynı dersi bir kez verdi.
 *
 * ÖLÇÜM (bu paketten önce): dönüşüm engeli ham TypeScript anahtarını
 * basıyordu — "summary alanı tamamlanmalı.", "confirmedFeatures listesi en az
 * bir madde içermeli." Kullanıcının ekranında o kutuların adı "Sistem yorumu"
 * ve "Kapsam içinde". Hata, kullanıcının baktığı kutunun adını söylemeliydi.
 *
 * KÜME NEDEN TAM BU SEKİZ ALAN. `getConceptAgreementGate` yalnız bu sekiz
 * anahtarı eksik bildirebilir: altı yorum alanı
 * (`INTERPRETATION_FIELDS`) ve iki kapsam listesi
 * (`confirmedFeatures`, `outOfScope`) — bkz.
 * `application/idea-discussion-service.ts`. Kalan `ConceptSummary` alanları
 * (`technicalApproaches`, `knownRisks`, `openQuestions`, …) kapıda EKSİK
 * olarak bildirilmez; buraya eklenmeleri var olmayan bir engelin adını
 * uydurmak olurdu.
 */
export type ConceptFieldKey = keyof Pick<
  ConceptSummary,
  'summary' | 'targetUser' | 'problemStatement' | 'currentAlternative' | 'desiredOutcome' |
  'firstReleaseTarget' | 'confirmedFeatures' | 'outOfScope'
>;

export const CONCEPT_FIELD_LABELS: Readonly<Record<ConceptFieldKey, string>> = Object.freeze({
  summary: 'Sistem yorumu',
  targetUser: 'Birincil kullanıcı',
  problemStatement: 'Ana problem',
  currentAlternative: 'Bugünkü çözüm',
  desiredOutcome: 'Beklenen ana sonuç',
  firstReleaseTarget: 'İlk sürüm hedefi',
  confirmedFeatures: 'Kapsam içinde',
  outOfScope: 'Kapsam dışında'
});

/**
 * Anahtarı kullanıcıya gösterilebilir ada çevirir.
 *
 * ETİKETİ OLMAYAN ANAHTARDA SESSİZCE HAM ADA DÜŞMEZ. Ham ada düşmek, bu
 * paketin düzelttiği kusurun ta kendisini geri getirirdi: kullanıcı yine
 * "confirmedFeatures" okurdu, üstelik bu kez hiçbir kapı görmeden. Tip düzeyi
 * ilk savunmadır (`Record<ConceptFieldKey, string>` eksik alanda derlemeyi
 * düşürür); bu fırlatma, tip düzeyinden kaçan çağrı için son savunmadır ve
 * yalnız geliştirici hatasıyla tetiklenir.
 */
export function conceptFieldLabel(field: string): string {
  const label = (CONCEPT_FIELD_LABELS as Record<string, string | undefined>)[field];
  if (!label) {
    throw new Error(`Fikir belgesi alanı için kullanıcıya gösterilecek ad tanımlı değil: ${field}`);
  }
  return label;
}
