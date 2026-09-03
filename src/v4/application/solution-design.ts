import { isResolved, normalizeConcernDecision } from './concerns.js';
import type {
  ConcernDecision,
  Decision,
  DecisionEvidence,
  ProjectDocumentV5,
  RejectedAlternative,
  Reversibility,
  TechnologyCandidate
} from '../contracts.js';

/**
 * Solution Design canonical modeli — "bunu nasıl kuracağız?" aşamasının
 * çekirdeği.
 *
 * İki kural bu modülün tamamını açıklar:
 *
 * 1. **Öneri ≠ Karar.** AI `PostgreSQL öneriyorum` dediğinde canonical
 *    teknoloji PostgreSQL olmaz. `TechnologyCandidate` bir adaydır; canonical
 *    karar kullanıcı onayıyla doğar. Ayrı bir teknik karar deposu **açılmaz** —
 *    aday kabul edilince mevcut canonical `Decision` kaydına
 *    `stage: 'technical'` ile yazılır. İki karar deposu, iki doğruluk kaynağı
 *    demek olurdu.
 *
 * 2. **Erken teknoloji yasağı.** Ürün/sistem kısıtları gerekçelendirmeden geri
 *    dönülemez teknik öneri yapılmaz. "E-ticaret sitesi istiyorum" cümlesine
 *    "React + Node + PostgreSQL + Stripe" cevabı verilmez; problem henüz
 *    bilinmiyor.
 */

const REVERSIBILITY: readonly Reversibility[] = ['reversible', 'costly', 'irreversible'] as const;

const text = (input: unknown, fallback = '') =>
  (typeof input === 'string' && input.trim() ? input.trim() : fallback);

const strings = (input: unknown) =>
  (Array.isArray(input) ? input.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : []);

function normalizeEvidence(value: Partial<DecisionEvidence> | undefined): DecisionEvidence {
  return {
    ideaDecisionIds: strings(value?.ideaDecisionIds),
    ideaConcernIds: strings(value?.ideaConcernIds)
  };
}

export function normalizeTechnologyCandidate(
  value: Partial<TechnologyCandidate> | undefined,
  index = 0
): TechnologyCandidate {
  const source = value || {};
  return {
    id: text(source.id, `candidate-${index + 1}`),
    concernId: text(source.concernId),
    title: text(source.title, `Aday ${index + 1}`),
    category: text(source.category, 'Genel'),
    rationale: text(source.rationale),
    tradeoffs: strings(source.tradeoffs),
    // Bilinmeyen geri dönülebilirlik en temkinli değere düşer: ucuz varsaymak
    // yasağı kazara devre dışı bırakırdı.
    reversibility: REVERSIBILITY.includes(source.reversibility as Reversibility)
      ? source.reversibility as Reversibility
      : 'irreversible',
    evidence: normalizeEvidence(source.evidence),
    status: source.status === 'accepted' || source.status === 'rejected' ? source.status : 'proposed',
    rejectionReason: text(source.rejectionReason)
  };
}

/** Aynı teknolojiyi iki kez konuşmamak için başlık anahtarı. */
function titleKey(title: string): string {
  return String(title || '').toLocaleLowerCase('tr-TR').trim();
}

/**
 * Belgede gerçekten var olan gerekçe kimlikleri.
 *
 * Yalnız belgede var olan ve gerçekten karara bağlanmış fikir kayıtları sayılır.
 * Aksi hâlde model, var olmayan bir kimliğe atıf yaparak gerekçeyi uydurabilir
 * ve yasak kâğıt üstünde kalırdı.
 *
 * Hem sayma (`groundedEvidenceCount`) hem süzme (`groundEvidence`) bu tek
 * kaynaktan beslenir: iki ayrı kopya, ikisinin ayrı ayrı kaymasına ve "kabul
 * edilen ama kanıtı süzülmüş" gibi tutarsız sonuçlara yol açardı.
 */
function groundedIdeaIds(project: ProjectDocumentV5): { decisions: Set<string>; concerns: Set<string> } {
  return {
    decisions: new Set(
      (project.decisions || [])
        .filter(decision => decision.stage === 'idea' && decision.status === 'accepted')
        .map(decision => decision.id)
    ),
    concerns: new Set(
      (project.ideaDesign?.concerns || []).filter(isResolved).map(concern => concern.id)
    )
  };
}

/**
 * Gerekçeyi **gerçeğe** süzer: belgede karşılığı olmayan kimlikler düşer.
 *
 * Belgeye yazılan her kimlik çözülebilmeli. "Bu aday şu fikir kararından
 * türedi" diyip o kararı gösterememek, belgenin taşıdığı soyağacı iddiasını
 * doğrulanamaz kılardı — okuyan da bunu fark edemezdi.
 *
 * Süzme **kabul kararını değiştirmez**: `admitCandidate` zaten yalnız gerçek
 * kimlikleri sayıyordu, bu yüzden süzülmüş kanıtla da aynı sonucu verir.
 * Değişen tek şey neyin SAKLANDIĞI.
 *
 * Saf: girdi mutasyona uğramaz, yeni bir kayıt döner.
 */
export function groundEvidence(evidence: DecisionEvidence, project: ProjectDocumentV5): DecisionEvidence {
  const grounded = groundedIdeaIds(project);
  return {
    ideaDecisionIds: evidence.ideaDecisionIds.filter(id => grounded.decisions.has(id)),
    ideaConcernIds: evidence.ideaConcernIds.filter(id => grounded.concerns.has(id))
  };
}

/** Kaç gerekçe kimliği gerçekten belgede karşılık buluyor? */
function groundedEvidenceCount(evidence: DecisionEvidence, project: ProjectDocumentV5): number {
  const grounded = groundEvidence(evidence, project);
  return grounded.ideaDecisionIds.length + grounded.ideaConcernIds.length;
}

export interface AdmissionResult {
  admitted: boolean;
  reason: string;
}

/**
 * Aday sunulabilir mi?
 *
 * Geri dönülebilir öneriler serbesttir — ucuz bir seçeneği konuşmak keşfin
 * kendisidir. Pahalı ya da geri dönülemez olanlar, en az bir **kabul edilmiş
 * fikir kararına** ya da **karara bağlanmış fikir konusuna** dayanmak
 * zorundadır.
 */
export function admitCandidate(candidate: TechnologyCandidate, project: ProjectDocumentV5): AdmissionResult {
  const previouslyRejected = (project.solutionDesign?.candidates || []).find(
    existing => existing.status === 'rejected' && titleKey(existing.title) === titleKey(candidate.title)
  );
  if (previouslyRejected) {
    return {
      admitted: false,
      reason: `“${candidate.title}” daha önce reddedildi: ${previouslyRejected.rejectionReason}`
    };
  }

  if (candidate.reversibility === 'reversible') return { admitted: true, reason: '' };

  if (groundedEvidenceCount(candidate.evidence, project) === 0) {
    return {
      admitted: false,
      reason: `“${candidate.title}” geri dönülemez bir seçim ama hangi fikir kararından türediği gösterilmiyor.`
    };
  }

  return { admitted: true, reason: '' };
}

/** Reddedilen aday nedeniyle kaydedilir; aynı şey her turda yeniden önerilmesin. */
export function rejectCandidate(candidate: TechnologyCandidate, reason: string): TechnologyCandidate {
  const trimmed = String(reason || '').trim();
  if (!trimmed) {
    throw new Error('Aday reddedilirken neden yazılmalıdır; nedensiz ret sonraki turda hatırlanamaz.');
  }
  return { ...candidate, status: 'rejected', rejectionReason: trimmed };
}

export interface PromotionInput {
  /** Kararın kullanıcının kendi kelimeleriyle ifadesi. */
  statement: string;
  rationale: string;
  rejectedAlternatives: RejectedAlternative[];
  revision: number;
}

export type PromotionResult =
  | {
      promoted: true;
      decision: Decision;
      /** Konu → karar bağı; izlenebilirlik zinciri burada kapanır. */
      concernDecision: ConcernDecision;
      candidate: TechnologyCandidate;
    }
  | { promoted: false; reason: string };

/**
 * Adayı canonical teknik karara yükseltir.
 *
 * Belgeyi değiştirmez; kaydı üretir ve yazma işini çağırana bırakır — canonical
 * revizyon disiplini tek yerde kalsın diye.
 */
export function promoteCandidate(
  candidate: TechnologyCandidate,
  project: ProjectDocumentV5,
  input: PromotionInput
): PromotionResult {
  const admission = admitCandidate(candidate, project);
  if (!admission.admitted) return { promoted: false, reason: admission.reason };

  if (!String(input.rationale || '').trim()) {
    return { promoted: false, reason: 'Teknik karar gerekçesiz kaydedilemez.' };
  }

  const unexplained = input.rejectedAlternatives.find(alternative => !String(alternative.reason || '').trim());
  if (unexplained) {
    return {
      promoted: false,
      reason: `“${unexplained.title}” için neden seçilmediği yazılmamış; gerekçesiz alternatif bir ADR oluşturmaz.`
    };
  }

  const decisionId = `decision-${candidate.id}`;

  return {
    promoted: true,
    candidate: { ...candidate, status: 'accepted' },
    concernDecision: normalizeConcernDecision({
      id: `concern-decision-${candidate.id}`,
      concernId: candidate.concernId,
      chosenOptionId: null,
      answer: text(input.statement, candidate.title),
      // Bir aday kabul edilirken kullanıcı bir dışlama YAZMIYOR — teknik karar
      // adayı kabul etmek ve reddetmektir, o yüzden negatif yarı bilinen
      // biçimde boş. `scopeSplit: 'confirmed'` yine de doğru: bu, kullanıcının
      // (adayı kabul ederek) BİZZAT yaptığı bir ayrım, çıkarım değil.
      excluded: [],
      scopeSplit: 'confirmed',
      rationale: input.rationale.trim(),
      decidedAtRevision: Number.isInteger(input.revision) ? input.revision : 0,
      decisionId
    }),
    decision: {
      stage: 'technical',
      id: decisionId,
      title: candidate.title,
      decision: text(input.statement, candidate.title),
      rationale: input.rationale.trim(),
      // Eski `alternatives` alanı korunur: mevcut tüketiciler (dışa aktarım,
      // ajan sözleşmeleri) onu okuyor ve bu dönüşüm onları kırmamalı.
      alternatives: input.rejectedAlternatives.map(alternative => alternative.title),
      consequences: candidate.tradeoffs,
      status: 'accepted',
      sourceSuggestionId: candidate.id,
      affectedSectionIds: [],
      rejectedAlternatives: input.rejectedAlternatives,
      evidence: candidate.evidence
    }
  };
}
