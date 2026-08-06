import type { ProjectDocumentV5, SuggestionBundle, SuggestionItem } from '../contracts.js';
import type { ExpansionCard } from './idea-expansion-service.js';
import { captureDiscussionBundle } from './idea-discussion-service.js';
import {
  EXPANSION_BUNDLE_TITLE,
  findExpansionItemByTitle,
  nextExpansionBundleId,
  selectExpansionBundle
} from './proposal-bundle-selectors.js';

/**
 * Kart daha önce eklenmişse kullanıcıya verdiği kararı hatırlatırız. Kararı
 * değiştirmek isteyen kullanıcı kartı yeniden eklemez; kaydın kendisini fikir
 * defterinden düzenler. Aksi hâlde aynı içerik plana ikinci kez girer.
 */
const ALREADY_ADDED_REASON: Record<string, string> = {
  pending: 'Bu kart zaten fikir defterinde karar bekliyor.',
  accepted: 'Bu kartı daha önce kabul ettin; içeriği plana geçti.',
  edited: 'Bu kartı daha önce düzenleyerek kabul ettin; içeriği plana geçti.',
  deferred: 'Bu kartı daha önce erteledin; kararı fikir defterinden değiştirebilirsin.',
  rejected: 'Bu kartı daha önce reddettin; kararı fikir defterinden değiştirebilirsin.'
};

function openExpansionBundle(project: ProjectDocumentV5): SuggestionBundle {
  // Kartlar turun seçenek paketine karışmaz. Kullanıcı bu kartları kendisi
  // ekledi; bir konuşma turunun kapanması onları erteleyemez. Ayrımın neden
  // paket kimliğinde taşındığı için bkz. proposal-bundle-selectors.ts.
  const existing = selectExpansionBundle(project);
  if (existing) return existing;
  const bundle: SuggestionBundle = {
    id: nextExpansionBundleId(project),
    title: EXPANSION_BUNDLE_TITLE,
    phase: project.lifecycle.activePhase,
    status: 'open',
    createdAt: new Date().toISOString(),
    items: [],
    openQuestions: [],
    source: { type: 'local', providerId: 'idea-expansion' }
  };
  project.proposalStore.bundles.push(bundle);
  return bundle;
}

/**
 * Yerel başlangıç kartları AI çıktısıyla aynı kabı paylaşır; paketin kaynağı
 * `ai` olduğu için kökeni kaydın kendisinde yazılı olmalı. Aksi hâlde
 * çevrimdışı eklenen bir kart, model değerlendirmesinden gelmiş gibi okunur.
 */
const LOCAL_SEED_REASON =
  'Bu kart yerel başlangıç önerilerinden geldi; AI değerlendirmesi yok, eforu ve etkisi ölçülmedi.';

/** Öneri kaydına düşen efor/etki değeri; AI kartlarında model yargısıdır. */
const UNASSESSED_LEVEL: SuggestionItem['effort'] = 'medium';

/**
 * Kartın hangi plan bölümlerini etkilediği türünden gelir.
 *
 * Sabit `['scope']` her kartı yalnız bir kapsam maddesi yapıyordu: kabul edilen
 * bir "MVP adayı" özellik kartı hiçbir zaman gereksinime dönüşmüyordu ve
 * fikir→plan dönüşümü gereksinimleri `conceptSummary.confirmedFeatures`'tan
 * ürettiği için orada da yakalanmıyordu — kart kapsam bölümünde ölü bir madde
 * olarak kalıyordu. Aynı sabit, kararı ve riski de kapsama sızdırıyordu.
 *
 * Paketi uygulayan akış karar ve risk kayıtlarını zaten türden üretir; buradaki
 * liste yalnız hangi bölüm metnine dokunulacağını söyler. Soru bir plan öğesi
 * değildir: yeri fikir defteridir, plana hiçbir bölüm yazmaz.
 *
 * (Bu modül plana yazan hiçbir işlevi çağırmaz; kartı yalnız `pending` öneri
 * yapar. Bunu tests/v4/architecture/ai-runtime-ownership.test.ts denetler.)
 */
const SECTIONS_BY_KIND: Record<string, string[]> = {
  feature: ['scope', 'requirements'],
  decision: ['decisions'],
  architecture: ['architecture'],
  risk: ['risks'],
  question: []
};

export interface ExpansionIntakeResult {
  project: ProjectDocumentV5;
  /** Kart yeni bir öneri olarak eklendiyse true; zaten varsa false. */
  added: boolean;
  reason: string;
}

/**
 * Kartı yalnızca bekleyen öneri yapar. Canonical plana hiçbir yolla yazmaz;
 * plana geçiş mevcut kabul/ertele/reddet ve dönüşüm kapılarından geçer.
 *
 * Aynı kart ikinci kez geldiğinde sessizce yutulmaz: çağıran `added` alanından
 * durumu görür ve kullanıcıya doğru olanı söyleyebilir.
 */
export function addExpansionCardAsSuggestion(
  project: ProjectDocumentV5,
  card: ExpansionCard,
  categoryLabel: string
): ExpansionIntakeResult {
  const title = card.title.trim();
  // Denetim paketten önce gelir: yalnız açık pakete bakılsaydı karara bağlanmış
  // bir kart taze pakette yeniden aday olurdu. Bkz. proposal-bundle-selectors.ts.
  const previous = findExpansionItemByTitle(project, title);
  if (previous) {
    return {
      project,
      added: false,
      reason: ALREADY_ADDED_REASON[previous.status] || 'Bu kart zaten fikir defterinde duruyor.'
    };
  }

  const next = structuredClone(project);
  const bundle = openExpansionBundle(next);

  const assessed = card.origin === 'ai';
  const item: SuggestionItem = {
    id: `suggestion-expansion-${bundle.items.length + 1}-${card.id}`,
    fingerprint: `expansion:${categoryLabel}:${title}`.toLocaleLowerCase('tr-TR'),
    kind: card.kind as SuggestionItem['kind'],
    title,
    description: card.description.trim(),
    pros: [],
    cons: [],
    // Alanlar zorunlu olduğu için bir değer taşınır; değerlendirilmemiş kartta
    // bu bir yargı değildir ve recommendationReason bunu açıkça söyler.
    effort: (assessed ? card.effort as SuggestionItem['effort'] : undefined) || UNASSESSED_LEVEL,
    impact: (assessed ? card.impact as SuggestionItem['impact'] : undefined) || UNASSESSED_LEVEL,
    recommended: false,
    recommendationReason: assessed ? '' : LOCAL_SEED_REASON,
    affectedSections: SECTIONS_BY_KIND[card.kind] || ['scope'],
    dependencies: [],
    status: 'pending'
  };
  bundle.items.push(item);
  return {
    project: captureDiscussionBundle(next, bundle, ''),
    added: true,
    reason: ''
  };
}
