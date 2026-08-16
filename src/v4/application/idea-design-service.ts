import { concernPriority, isResolved, normalizeConcern } from './concerns.js';
import type { DiscoveryOutput } from '../ai/schemas/schemas.js';
import type { Concern, ConcernImportance } from '../contracts.js';

/**
 * Idea Design servisi — AI keşif çıktısını `Concern` modeline bağlar.
 *
 * Bu, modelden davranışa geçilen ilk adım. Servis **AI çağırmaz**: girdi
 * olarak zaten doğrulanmış `DiscoveryOutput` alır ve saf dönüşüm yapar.
 * Böylece ağsız test edilebilir ve sağlayıcı değişse de mantık değişmez.
 */

/** Keşif seçeneğinin türü → concern kategorisi. */
const KIND_CATEGORY: Readonly<Record<DiscoveryOutput['options'][number]['kind'], string>> = {
  feature: 'Kapsam',
  decision: 'Karar',
  risk: 'Risk',
  question: 'Açık soru',
  architecture: 'Mimari'
};

/** `impact` üç kademeli; aşağı-akış etkisi 0–1 aralığına bu şekilde düşer. */
const IMPACT_SCORE: Readonly<Record<'low' | 'medium' | 'high', number>> = {
  low: 0.3,
  medium: 0.6,
  high: 0.9
};

/**
 * Önem derecesi. `architecture` ve `decision` türleri yüksek etkiliyse
 * kritiktir: bunlar çözülmeden sonraki aşama açılamaz. `feature` yüksek
 * etkili olsa bile kritik sayılmaz — kapsam kararı ertelenebilir, mimari
 * kararı genelde ertelenemez.
 */
function importanceOf(kind: keyof typeof KIND_CATEGORY, impact: 'low' | 'medium' | 'high'): ConcernImportance {
  if (impact === 'high' && (kind === 'decision' || kind === 'architecture')) return 'critical';
  if (impact === 'low') return 'optional';
  return 'important';
}

/** Aynı konuyu iki kez kaydetmemek için başlık anahtarı. */
function topicKey(title: string): string {
  return String(title || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9çğıöşü]+/g, ' ')
    .trim();
}

/**
 * Keşif çıktısını concern'lere çevirir.
 *
 * Hiçbir alan uydurulmaz: keşif çıktısında seçenek alternatifi yoksa
 * `options` boş kalır. Önerinin kendisi tek bir `ConcernOption` olur ve
 * `cons` alanı onun bedeli (`tradeoffs`) olarak taşınır — bedeli olmayan
 * seçenek karşılaştırılamaz.
 */
export function discoverConcerns(discovery: Pick<DiscoveryOutput, 'options' | 'openQuestions' | 'uncertainty'>): Concern[] {
  const uncertainTopics = new Set((discovery.uncertainty || []).map(topicKey).filter(Boolean));
  const concerns: Concern[] = [];

  for (const [index, option] of (discovery.options || []).entries()) {
    const impact = option.impact || 'medium';
    concerns.push(normalizeConcern({
      id: `concern-${topicKey(option.title).replace(/\s+/g, '-') || index + 1}`,
      title: option.title,
      description: option.description,
      category: KIND_CATEGORY[option.kind] || 'Genel',
      importance: importanceOf(option.kind, impact),
      status: 'open',
      whyItMatters: option.description,
      questions: option.kind === 'question' ? [option.title] : [],
      options: [{
        id: 'option-onerilen',
        title: option.title,
        description: option.description,
        tradeoffs: option.cons || []
      }],
      // Model bu konuda belirsizlik bildirdiyse öncelik yükselir; soru
      // türündeki seçenek zaten tanımı gereği belirsizdir.
      uncertainty: uncertainTopics.has(topicKey(option.title)) || option.kind === 'question' ? 0.9 : 0.5,
      downstreamImpact: IMPACT_SCORE[impact],
      decisionRequired: true
    }, index));
  }

  for (const [index, question] of (discovery.openQuestions || []).entries()) {
    concerns.push(normalizeConcern({
      id: `concern-soru-${topicKey(question).replace(/\s+/g, '-') || index + 1}`,
      title: question,
      category: 'Açık soru',
      // Açık soru henüz derecelendirilmemiştir; kritik ilan etmek kapıyı
      // hak etmediği bir yerde kapatırdı.
      importance: 'important',
      status: 'open',
      questions: [question],
      uncertainty: 0.9,
      downstreamImpact: 0.5,
      decisionRequired: true
    }, index));
  }

  return dedupe(concerns);
}

function dedupe(concerns: readonly Concern[]): Concern[] {
  const seen = new Map<string, Concern>();
  for (const concern of concerns) {
    const key = topicKey(concern.title);
    if (!key || seen.has(key)) continue;
    seen.set(key, concern);
  }
  return [...seen.values()];
}

/**
 * Yeni keşfedilenleri mevcutlara katar.
 *
 * İki değişmez:
 *
 * 1. **Çözülmüş konu dirilmez.** Kullanıcı bir konuyu karara bağladıysa,
 *    erteledi ya da "bu projeye ait değil" dediyse, sonraki keşif turu aynı
 *    konuyu yeniden açamaz. Mevcut mimarinin "reddedilen öneri hafızası"
 *    değişmezinin concern tarafındaki karşılığı budur; olmazsa AI aynı şeyi
 *    her turda yeniden önerir ve kullanıcı aynı kararı tekrar tekrar verir.
 *
 * 2. **Kullanıcının verdiği bilgi korunur.** Aynı konu tekrar gelirse mevcut
 *    kayıt kazanır; yalnız açık kalmış bir konunun belirsizlik ve etki
 *    skorları yükseltilebilir — yeni turda daha fazla şey öğrenildiyse
 *    öncelik de yükselmelidir.
 */
export function mergeConcerns(existing: readonly Concern[], incoming: readonly Concern[]): Concern[] {
  const byKey = new Map(existing.map(concern => [topicKey(concern.title), concern]));

  for (const candidate of incoming) {
    const key = topicKey(candidate.title);
    if (!key) continue;
    const current = byKey.get(key);

    if (!current) {
      byKey.set(key, candidate);
      continue;
    }
    if (isResolved(current)) continue;

    byKey.set(key, {
      ...current,
      uncertainty: Math.max(current.uncertainty, candidate.uncertainty),
      downstreamImpact: Math.max(current.downstreamImpact, candidate.downstreamImpact),
      questions: [...new Set([...current.questions, ...candidate.questions])],
      options: current.options.length ? current.options : candidate.options
    });
  }

  return [...byKey.values()];
}

/** Öncelik sırasına dizilmiş kopya; girdi değiştirilmez. */
export function prioritizeConcerns(concerns: readonly Concern[]): Concern[] {
  return [...concerns].sort((a, b) => concernPriority(b) - concernPriority(a));
}
