import type { Concern, ConcernDecision, ConcernImportance, ConcernStatus } from '../contracts.js';

/**
 * Concern modeli — V3'ün soru seçimi ve kapı mantığı buradan türer.
 *
 * PromtGen bir anket motoru değil: kullanıcıya 16 soruyu birden sormaz. Her
 * turda **tek** soru sorar ve o soru çözülmemişler arasında en yüksek bilgi
 * kazancına sahip olandır.
 */

const IMPORTANCE: readonly ConcernImportance[] = ['critical', 'important', 'optional', 'irrelevant'] as const;
const STATUS: readonly ConcernStatus[] = ['open', 'answered', 'decided', 'deferred', 'irrelevant'] as const;

/** Çözülmüş sayılan durumlar; kapı bunlara takılmaz. */
const RESOLVED: readonly ConcernStatus[] = ['decided', 'deferred', 'irrelevant'] as const;

const clamp01 = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(1, Math.max(0, numeric));
};

/**
 * Bir concern'ü kanonik şekle getirir. AI çıktısı eksik veya bozuk alan
 * gönderebilir; çekirdek şekli garanti eder, içeriği değil.
 */
export function normalizeConcern(value: Partial<Concern> | undefined, index = 0): Concern {
  const source = value || {};
  const text = (input: unknown, fallback = '') => (typeof input === 'string' && input.trim() ? input.trim() : fallback);
  const strings = (input: unknown) => (Array.isArray(input) ? input.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : []);

  return {
    id: text(source.id, `concern-${index + 1}`),
    title: text(source.title, `Konu ${index + 1}`),
    description: text(source.description),
    category: text(source.category, 'Genel'),
    importance: IMPORTANCE.includes(source.importance as ConcernImportance) ? source.importance as ConcernImportance : 'important',
    status: STATUS.includes(source.status as ConcernStatus) ? source.status as ConcernStatus : 'open',
    whyItMatters: text(source.whyItMatters),
    questions: strings(source.questions),
    options: Array.isArray(source.options)
      ? source.options.map((option, optionIndex) => ({
          id: text(option?.id, `option-${optionIndex + 1}`),
          title: text(option?.title, `Seçenek ${optionIndex + 1}`),
          description: text(option?.description),
          tradeoffs: strings(option?.tradeoffs)
        }))
      : [],
    dependsOn: strings(source.dependsOn),
    relatedConcerns: strings(source.relatedConcerns),
    decisionRequired: source.decisionRequired !== false,
    uncertainty: clamp01(source.uncertainty),
    downstreamImpact: clamp01(source.downstreamImpact)
  };
}

export function isResolved(concern: Concern): boolean {
  return RESOLVED.includes(concern.status);
}

/**
 * Bir concern kapıyı bloklar mı?
 *
 * Yalnız **kritik** ve **karar gerektiren** ve **çözülmemiş** olanlar bloklar.
 * `deferred` bloklamaz: kullanıcı "sonra" dediyse bu da bir karardır ve onu
 * yok saymak, verdiği kararı geri almak olurdu. `irrelevant` de bloklamaz —
 * konunun bu projeye ait olmadığına karar verilmiştir.
 */
export function isBlocking(concern: Concern): boolean {
  return concern.importance === 'critical' && concern.decisionRequired && !isResolved(concern);
}

export function blockingConcerns(concerns: readonly Concern[]): Concern[] {
  return concerns.filter(isBlocking);
}

/**
 * Bilgi kazancı skoru.
 *
 * ```
 * öncelik ≈ belirsizlik × aşağı-akış etkisi × bloklayıcılık
 * ```
 *
 * Formülün mükemmel olması gerekmiyor; ayrımın kendisi önemli. "At bir ulaşım
 * aracı mı, bakım yapılan kalıcı bir sistem mi?" sorusu save, stats,
 * ownership, death ve progression'ı birden belirler; "isim etiketi hangi
 * renkte olsun?" hiçbirini belirlemez. İkisi aynı ağırlıkta olamaz.
 *
 * Çözülmüş concern'ler 0 döner: sırayı bir daha meşgul etmezler.
 */
export function concernPriority(concern: Concern): number {
  if (isResolved(concern)) return 0;
  const blockingFactor = isBlocking(concern) ? 2 : 1;
  const importanceWeight = concern.importance === 'irrelevant' ? 0
    : concern.importance === 'optional' ? 0.5
      : concern.importance === 'important' ? 1
        : 1.5;
  return concern.uncertainty * concern.downstreamImpact * blockingFactor * importanceWeight;
}

/**
 * Bağımlılığı çözülmemiş bir concern henüz sorulamaz: cevabı önceki karara
 * bağlıdır. Kullanıcıya sırasız soru sormak, aynı şeyi iki kez sormaya yol
 * açar.
 */
export function isAskable(concern: Concern, all: readonly Concern[]): boolean {
  if (isResolved(concern)) return false;
  if (concern.importance === 'irrelevant') return false;
  const byId = new Map(all.map(item => [item.id, item]));
  return concern.dependsOn.every(id => {
    const dependency = byId.get(id);
    // Bilinmeyen bağımlılık engel sayılmaz; AI var olmayan bir kimlik
    // ürettiğinde bütün akışı kilitlemek, hatayı kullanıcıya ödetmek olurdu.
    return !dependency || isResolved(dependency);
  });
}

/**
 * Sırada konuşulacak tek konu. Hiçbiri sorulabilir değilse null — bu, akışın
 * durma koşuludur, hata değil.
 */
export function selectNextConcern(concerns: readonly Concern[]): Concern | null {
  const askable = concerns.filter(concern => isAskable(concern, concerns));
  if (!askable.length) return null;
  return askable.reduce((best, candidate) =>
    concernPriority(candidate) > concernPriority(best) ? candidate : best
  );
}

/** Bir concern'ün kararını kanonik şekle getirir. */
export function normalizeConcernDecision(value: Partial<ConcernDecision> | undefined, index = 0): ConcernDecision {
  const source = value || {};
  const text = (input: unknown, fallback = '') => (typeof input === 'string' && input.trim() ? input.trim() : fallback);
  return {
    id: text(source.id, `concern-decision-${index + 1}`),
    concernId: text(source.concernId),
    chosenOptionId: typeof source.chosenOptionId === 'string' && source.chosenOptionId ? source.chosenOptionId : null,
    answer: text(source.answer),
    rationale: text(source.rationale),
    decidedAtRevision: Number.isInteger(source.decidedAtRevision) ? source.decidedAtRevision as number : 0,
    decisionId: typeof source.decisionId === 'string' && source.decisionId ? source.decisionId : null
  };
}
