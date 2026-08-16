import { blockingConcerns, isResolved, selectNextConcern } from './concerns.js';
import type { Concern, ConcernOption, ProjectDocumentV5 } from '../contracts.js';

/**
 * Adaptif Idea Coach — sıradaki soruyu sabit bir listeden değil, bilgi
 * kazancından seçer.
 *
 * Neden sabit sıra kaldırılıyor: `Problem → Kullanıcı → Değer → MVP` bir
 * startup/SaaS keşif modelidir. "Unity'de at sistemi yapmak istiyorum" diyen
 * birine ilk soru olarak "hedef kullanıcı kim?" sormak, ürünün alanı
 * anlamadığını gösterir. Önce ne tasarladığımız belirlenir, sorular ondan
 * sonra ona göre seçilir.
 *
 * Bu modül **salt okunur**: belgeyi değiştirmez, yalnız ne sorulacağını
 * söyler. Mevcut `idea-coach-service` ile aynı belgeyi okuyan iki görünümdür;
 * ikisi de yazmadığı için çelişen iki durum oluşmaz. Sabit koç, UI adımına
 * kadar yerinde kalır.
 */

export type CoachTurnKind = 'framing' | 'concern' | 'ready';

export interface CoachTurn {
  kind: CoachTurnKind;
  /** Kullanıcıya sorulacak tek soru; `ready` durumunda boş. */
  question: string;
  /**
   * Neden bu soru. Sistem jargonu değil, sade dil: kullanıcı `Concern Map`
   * ya da `downstreamImpact` kavramlarını öğrenmek zorunda değil.
   */
  why: string;
  concernId: string | null;
  options: ConcernOption[];
}

const FRAMING_QUESTION = 'Neyi tasarlıyoruz — yeni bir ürün mü, mevcut bir sisteme eklenecek bir parça mı, yoksa bir alt sistem mi?';

/**
 * Çerçeveleme biliniyor mu? `unknown` ya da tamamen boş bir çerçeveleme,
 * sorulacak ilk şeydir: yanlış çerçevede sorulan doğru soru da yanlıştır.
 */
function framingKnown(project: ProjectDocumentV5): boolean {
  const framing = project.ideaDesign?.framing;
  if (!framing) return false;
  if (framing.kind === 'unknown') return false;
  return Boolean(framing.domain || framing.environment);
}

/**
 * Sıradaki tur.
 *
 * Sıra: çerçeveleme → en yüksek bilgi kazançlı konu → durma.
 */
export function nextCoachTurn(project: ProjectDocumentV5): CoachTurn {
  if (!framingKnown(project)) {
    return {
      kind: 'framing',
      question: FRAMING_QUESTION,
      why: 'Doğru soruları sorabilmek için önce ne yaptığımızı netleştirmemiz gerekiyor.',
      concernId: null,
      options: []
    };
  }

  const concerns = project.ideaDesign?.concerns || [];
  const next = selectNextConcern(concerns);

  if (!next) return readyTurn(concerns);

  return {
    kind: 'concern',
    question: next.questions[0] || `${next.title} konusunda nasıl ilerleyelim?`,
    why: next.whyItMatters || 'Bu karar sonraki adımları belirliyor.',
    concernId: next.id,
    options: next.options
  };
}

/**
 * Durma koşulu.
 *
 * AI kullanıcıyı sonsuz öneriyle oyalamamalı. Bir noktadan sonra yeni özellik
 * eklemek yerine teknik tasarıma geçmek daha değerlidir; bu olmadan ürün bir
 * fikir fırtınası makinesine dönüşür.
 *
 * Bloklayan konu kalmışsa "hazır" denmez — sorulabilir soru bitmiş olsa bile
 * çözülmemiş kritik bir karar varsa kullanıcıya doğru olan şey söylenir.
 */
function readyTurn(concerns: readonly Concern[]): CoachTurn {
  const blockers = blockingConcerns(concerns);
  if (blockers.length) {
    return {
      kind: 'concern',
      question: `${blockers[0].title} konusunda bir karara varmamız gerekiyor.`,
      why: blockers[0].whyItMatters || 'Bu karar verilmeden teknik tasarıma geçilemez.',
      concernId: blockers[0].id,
      options: blockers[0].options
    };
  }

  return {
    kind: 'ready',
    question: '',
    why: 'Ana davranış, kapsam ve kritik kararlar yeterince net. Bu aşamada yeni özellik eklemek yerine teknik tasarıma geçmek daha değerli.',
    concernId: null,
    options: []
  };
}

export interface CoachProgressGroup {
  category: string;
  total: number;
  resolved: number;
}

export interface CoachProgress {
  groups: CoachProgressGroup[];
  /** Çözülmemiş kritik karar sayısı; kapıyı bu belirler. */
  blocking: number;
  deferred: number;
  ready: boolean;
}

/**
 * İlerleme — form hissi vermeden.
 *
 * "47/62 soru cevaplandı" bir anket göstergesidir ve kullanıcıya doldurulacak
 * bir form izlenimi verir. Doğrusu konuların kendi başlıklarıyla gruplanması
 * ve geriye kaç **engel** kaldığının söylenmesidir.
 */
export function coachProgress(project: ProjectDocumentV5): CoachProgress {
  const concerns = project.ideaDesign?.concerns || [];
  const byCategory = new Map<string, CoachProgressGroup>();

  for (const concern of concerns) {
    const category = concern.category || 'Genel';
    const group = byCategory.get(category) || { category, total: 0, resolved: 0 };
    group.total += 1;
    if (isResolved(concern)) group.resolved += 1;
    byCategory.set(category, group);
  }

  const blocking = blockingConcerns(concerns).length;
  return {
    groups: [...byCategory.values()],
    blocking,
    deferred: concerns.filter(concern => concern.status === 'deferred').length,
    ready: blocking === 0 && selectNextConcern(concerns) === null
  };
}
