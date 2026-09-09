import type { ConceptSummary, IdeaDiscussionRecord, ProjectDocumentV5, SuggestionItem } from '../contracts.js';
import { usesStageModel } from './conversion-v2.js';
import { expansionFingerprint, isExpansionBundle } from './proposal-bundle-selectors.js';
import { SCOPE_NARROWING_CATEGORY_LABEL } from '../idea-expansion/categories.js';

/**
 * ÖLÇÜLEN KUSUR. Kullanıcı fikir aşamasında bir kartın "Fikre ekle" düğmesine
 * basıyor; kart `accepted` olarak fikir defterine giriyor. Ortak Anlayış'a
 * geldiğinde "Kapsam içinde" ve "Kapsam dışında" kutuları BOŞ oluyor ve
 * kullanıcı az önce kabul ettiği şeyi bir daha yazıyor.
 *
 * Bu dosya o boşluğu KAPATIR ama yeni bir mekanizma AÇMAZ:
 *
 * - Hiçbir şey yazmaz. Saf bir okumadır; `ConceptSummary`'ye yeni bir alan
 *   eklenmez, alım yolu (`idea-expansion-intake.ts`) canonical plana yazmama
 *   sınırını korur. Çıktısı yalnız düzenleyicinin TASLAĞIDIR; belgeye ancak
 *   kullanıcı "kaydet"e basarsa geçer.
 * - Kullanıcının kendi işini EZMEZ. Bir alanda zaten içerik varsa o alan
 *   olduğu gibi kalır ve o alan için hiçbir türetme yapılmaz.
 * - Aşama modeli yolunu (`projectStageDataToConceptSummary`) DEĞİŞTİRMEZ. O
 *   yol açıkken bu ikincil kaynak hiç çalışmaz; iki kaynağın aynı kutuya
 *   karışması, bu paketin önlemek için var olduğu dördüncü mekanizma olurdu.
 */

/** Fikir aşamasından türetilmiş kapsam taslağı. */
export interface ConceptScopeDraft {
  /** Düzenleyicide gösterilecek "Kapsam içinde" satırları. */
  confirmedFeatures: string[];
  /** Düzenleyicide gösterilecek "Kapsam dışında" satırları. */
  outOfScope: string[];
  /**
   * Yukarıdaki listelerin TÜRETİLMİŞ olan kısmı. Kullanıcının kendi yazdığı
   * satırlar buraya HİÇ girmez: köken bildirimi yalnız bu satırlar için
   * gösterilir, aksi hâlde kullanıcının kendi cümlesine "bunu biz koyduk"
   * denmiş olurdu.
   */
  derived: {
    confirmedFeatures: string[];
    outOfScope: string[];
  };
}

/** Aynı maddenin iki kez ya da iki listede birden görünmesini engelleyen anahtar. */
function scopeKey(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
}

/**
 * Kartın kapsam kutusuna girip girmeyeceğini KARTIN KENDİ `affectedSections`
 * alanı söyler — burada yeniden bir tür sınıflandırması yapılmaz.
 *
 * O alan alım sırasında karta yazılıyor (bkz. `SECTIONS_BY_KIND`,
 * idea-expansion-intake.ts) ve "bu kart hangi plan bölümünün metnine dokunur"
 * sorusunun deponun tek cevabıdır. Soru ve risk kartları orada zaten `scope`
 * taşımaz: sorunun yeri fikir defteridir, riskin yeri risk listesidir.
 */
function touchesScope(item: SuggestionItem): boolean {
  return (item.affectedSections || []).includes('scope');
}

/** Kartın "Kapsamı daralt" başlığı altından gelip gelmediği. */
const SCOPE_NARROWING_FINGERPRINT_PREFIX = expansionFingerprint(SCOPE_NARROWING_CATEGORY_LABEL, '');

function narrowsScope(item: SuggestionItem): boolean {
  return String(item.fingerprint || '').startsWith(SCOPE_NARROWING_FINGERPRINT_PREFIX);
}

/**
 * Kaydın doğduğu keşif kartı.
 *
 * Eşleme `originalText` üzerinden yapılır, `text` üzerinden DEĞİL: kullanıcı
 * kaydı fikir defterinden düzenlemiş olabilir ve o hâlde başlık artık
 * tutmaz. `originalText` kaydın doğduğu andaki başlıktır (bkz.
 * `captureDiscussionBundle`) ve kartla her zaman aynı kalır.
 */
function sourceCard(project: ProjectDocumentV5, record: IdeaDiscussionRecord): SuggestionItem | null {
  if (!record.sourceBundleId) return null;
  const bundle = (project.proposalStore?.bundles || [])
    .find(item => item.id === record.sourceBundleId);
  if (!bundle || !isExpansionBundle(bundle)) return null;
  const needle = String(record.originalText || record.text || '').trim();
  return bundle.items.find(item => item.title.trim() === needle) || null;
}

/**
 * Kabul edilmiş keşif kartlarının kapsam ayrımı.
 *
 * KAYNAK YALNIZ KEŞİF PAKETİDİR. Kullanıcının "Fikre ekle" ile bilerek kabul
 * ettiği kartlar buradadır; sohbet turlarının ve keşif üretiminin kayıtları
 * kapsam kutusuna girmez — onlar kullanıcının bir kutuya yazmayı üstlendiği
 * cümleler değil, tartışmanın izidir ve düzenleyicide zaten kendi defterinde
 * (`agreement-ledger`) görünür.
 *
 * Durumu KAYIT söyler, kart değil: kullanıcı kararını fikir defterinden
 * değiştirebilir ve orası son sözdür.
 */
function acceptedExpansionScope(project: ProjectDocumentV5): { confirmed: string[]; excluded: string[] } {
  const confirmed: string[] = [];
  const excluded: string[] = [];
  const seen = new Set<string>();
  for (const record of project.ideaDiscussion?.records || []) {
    if (record.status !== 'accepted') continue;
    const card = sourceCard(project, record);
    if (!card || !touchesScope(card)) continue;
    const text = String(record.text || '').trim();
    const key = scopeKey(text);
    if (!text || seen.has(key)) continue;
    seen.add(key);
    (narrowsScope(card) ? excluded : confirmed).push(text);
  }
  return { confirmed, excluded };
}

/**
 * Düzenleyicinin kapsam kutularına ne yazacağını çözer.
 *
 * `summary` ayrı bir parametredir çünkü kutuların KAYNAĞI odur; bu işlev
 * belgeden ikinci bir özet okumaz ve iki farklı özet arasında seçim yapmaz.
 */
export function resolveConceptScopeDraft(
  project: ProjectDocumentV5,
  summary: ConceptSummary
): ConceptScopeDraft {
  const existingConfirmed = [...(summary.confirmedFeatures || [])];
  const existingOutOfScope = [...(summary.outOfScope || [])];
  const empty = { confirmedFeatures: [], outOfScope: [] };
  if (usesStageModel(project)) {
    return { confirmedFeatures: existingConfirmed, outOfScope: existingOutOfScope, derived: empty };
  }

  const { confirmed, excluded } = acceptedExpansionScope(project);
  // Türetme yalnız BOŞ alana girer. Dolu alan kullanıcınındır; oraya bir satır
  // eklemek, ona sormadan belgesine yazmak olurdu.
  const takenKeys = new Set([...existingConfirmed, ...existingOutOfScope].map(scopeKey));
  const fill = (candidates: string[], existing: string[]) => {
    if (existing.length > 0) return [];
    return candidates.filter(item => !takenKeys.has(scopeKey(item)));
  };
  // Kapsam DIŞI önce çözülür: aynı metin her iki türetmeye birden düşerse
  // dışlama kazanır — kullanıcı onu "çıkar" başlığı altında kabul etti.
  const derivedOutOfScope = fill(excluded, existingOutOfScope);
  for (const item of derivedOutOfScope) takenKeys.add(scopeKey(item));
  const derivedConfirmed = fill(confirmed, existingConfirmed);

  return {
    confirmedFeatures: existingConfirmed.length > 0 ? existingConfirmed : derivedConfirmed,
    outOfScope: existingOutOfScope.length > 0 ? existingOutOfScope : derivedOutOfScope,
    derived: { confirmedFeatures: derivedConfirmed, outOfScope: derivedOutOfScope }
  };
}
