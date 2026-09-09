import type { ProjectDocumentV5, Priority, Requirement } from '../contracts.js';
import { evaluateRequirementQuality } from './requirement-quality-service.js';

/**
 * Plan aşamasının "Gereksinimler" bölümünü kart olarak okutan seçici.
 *
 * NEDEN VAR. Dönüşüm taslak gereksinimleri üretiyordu
 * (`createRequirementDraftsFromConcept`), `acceptRequirementDraft` /
 * `updateRequirementDraft` / `removeRequirementDraft` onları karara bağlamaya
 * hazır bekliyordu — ama üçünün de üretimde SIFIR çağıranı vardı. Ölçüldü:
 * `src/react` altında "Requirement" kelimesi bir kez bile geçmiyordu. Yani
 * taslak üretiliyor, hiçbir şey onu kabul edemiyor, `compileTaskPlan` yalnız
 * `status === 'accepted'` okuduğu için sıfır görev dönüyor ve finalizasyon
 * kapısı hiç açılmıyordu. Bu modül o boşluğun OKUMA tarafı: dördüncü bir
 * kabul mekanizması AÇMAZ, var olan üçünü ekrana bağlanabilir hâle getirir.
 *
 * KARAR MANTIĞI BURADA DEĞİL. Geçerlilik (`invalidReasons`) ve durum geçişi
 * `requirement-quality-service`'te durur; buradaki `decidable`/`editable`
 * yalnız o servisin ZATEN reddedeceği düğmeleri kapatır — kuralın kopyası
 * değil, kuralın tek satırlık yansımasıdır (taslak olmayan gereksinim
 * düzenlenemez/silinemez, bkz. aynı dosya).
 */

export const REQUIREMENT_PRIORITY_LABELS: Readonly<Record<Priority, string>> = Object.freeze({
  must: 'Olmazsa olmaz',
  should: 'Olmalı',
  could: 'Olabilir'
});

/** Yalnız kart etiketini üretmek için; dışa aktarılmıyor — dışarıda çağıranı yok. */
const REQUIREMENT_STATUS_LABELS: Readonly<Record<Requirement['status'], string>> = Object.freeze({
  draft: 'Karar bekliyor',
  accepted: 'Kabul edildi',
  implemented: 'Uygulandı',
  verified: 'Doğrulandı'
});

export interface PlanRequirementCard {
  id: string;
  title: string;
  statement: string;
  kind: Requirement['kind'];
  priority: Priority;
  priorityLabel: string;
  acceptanceCriteria: string[];
  status: Requirement['status'];
  statusLabel: string;
  /** Kabul edilebilir mi? Yalnız taslaklar karara bağlanır. */
  decidable: boolean;
  /** Düzenlenebilir/reddedilebilir mi? Kabul edilmiş gereksinim ikisini de reddeder. */
  editable: boolean;
}

export interface PlanRequirementReview {
  cards: PlanRequirementCard[];
  draftCount: number;
  acceptedCount: number;
  /** Kabul edilmiş Must sayısı — görev üretiminin ve finalizasyonun eşiği. */
  acceptedMustCount: number;
  /** `compileTaskPlan` şu an görev üretebilir mi? */
  taskCompilationOpen: boolean;
  /** Bölüm "boş gerekli bölüm" olmaktan çıktı mı? */
  sectionSatisfied: boolean;
  hint: string;
}

function toCard(requirement: Requirement): PlanRequirementCard {
  const isDraft = requirement.status === 'draft';
  return {
    id: requirement.id,
    title: requirement.title,
    statement: requirement.statement,
    kind: requirement.kind,
    priority: requirement.priority,
    priorityLabel: REQUIREMENT_PRIORITY_LABELS[requirement.priority] || requirement.priority,
    acceptanceCriteria: [...requirement.acceptanceCriteria],
    status: requirement.status,
    statusLabel: REQUIREMENT_STATUS_LABELS[requirement.status] || requirement.status,
    decidable: isDraft,
    editable: isDraft
  };
}

function hintFor(review: Omit<PlanRequirementReview, 'hint'>): string {
  if (!review.cards.length) {
    return 'Bu bölümde henüz gereksinim yok. Fikri plana dönüştürdüğünde taslaklar burada belirir.';
  }
  if (!review.acceptedMustCount) {
    return 'Görev taslağı üretmek için en az bir "Olmazsa olmaz" gereksinimi kabul et; '
      + 'kabul ettiklerin bu bölümün içeriğini de doldurur.';
  }
  if (review.draftCount) {
    return `${review.draftCount} gereksinim hâlâ karar bekliyor. Yalnız kabul ettiklerin görev üretir.`;
  }
  return 'Bütün gereksinimler karara bağlandı; görev taslağı üretebilirsin.';
}

export function selectPlanRequirementReview(project: ProjectDocumentV5): PlanRequirementReview {
  const requirements = project.requirements || [];
  // Karar bekleyen kartlar önce gelir: kullanıcının İŞİ olan kart listenin
  // başındadır, karara bağlananlar altta birikir. Grup içinde belge sırası
  // korunur — dönüşümün ürettiği sıra kullanıcının okuduğu sıradır.
  const cards = [
    ...requirements.filter(item => item.status === 'draft'),
    ...requirements.filter(item => item.status !== 'draft')
  ].map(toCard);
  const quality = evaluateRequirementQuality(project);
  const section = project.sections?.requirements;
  // readiness-service bir gerekli bölümü ancak İÇERİK ve ÖĞE listesinin
  // İKİSİ de boşken "boş" sayar (readiness-service.ts). `acceptRequirementDraft`
  // kabul edilen ifadeyi `items`e yazdığı için serbest metin kutusu boş
  // kalsa bile bölüm dolmuş olur; buradaki okuma o kuralın aynısıdır.
  const sectionSatisfied = Boolean(section && (section.content.trim() || section.items.length));
  const base = {
    cards,
    draftCount: quality.draftCount,
    acceptedCount: quality.acceptedCount,
    acceptedMustCount: quality.mustCount,
    taskCompilationOpen: quality.readyForTaskCompilation,
    sectionSatisfied
  };
  return { ...base, hint: hintFor(base) };
}
