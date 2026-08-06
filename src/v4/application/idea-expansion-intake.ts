import type { ProjectDocumentV5, SuggestionBundle, SuggestionItem } from '../contracts.js';
import type { ExpansionCard } from './idea-expansion-service.js';
import { captureDiscussionBundle } from './idea-discussion-service.js';
import {
  EXPANSION_BUNDLE_TITLE,
  nextExpansionBundleId,
  selectExpansionBundle
} from './proposal-bundle-selectors.js';

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
  const next = structuredClone(project);
  const bundle = openExpansionBundle(next);
  const title = card.title.trim();
  if (bundle.items.some(item => item.title === title)) {
    return { project, added: false, reason: 'Bu kart zaten fikir defterinde duruyor.' };
  }

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
    affectedSections: ['scope'],
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
