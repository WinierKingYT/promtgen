import type { ProjectDocumentV5, SuggestionBundle, SuggestionItem } from '../contracts.js';
import type { ExpansionCard } from './idea-expansion-service.js';
import { captureDiscussionBundle } from './idea-discussion-service.js';

const EXPANSION_BUNDLE_TITLE = 'Keşifden eklenenler';

function openExpansionBundle(project: ProjectDocumentV5): SuggestionBundle {
  // Projede aynı anda en fazla bir "open" paket olması bekleniyor (bkz.
  // idea-coach-service.ts). Zaten açık bir paket varsa kartı oraya ekleriz;
  // yeni, ayrı bir açık paket oluşturmak, açık paketi tekilmiş gibi okuyan
  // diğer tüketicilerin kartı hiç görmemesine yol açar.
  const existing = project.proposalStore.bundles.find(bundle => bundle.status === 'open');
  if (existing) return existing;
  const bundle: SuggestionBundle = {
    id: `bundle-expansion-${project.proposalStore.bundles.length + 1}`,
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
 * Kartı yalnızca bekleyen öneri yapar. Canonical plana hiçbir yolla yazmaz;
 * plana geçiş mevcut kabul/ertele/reddet ve dönüşüm kapılarından geçer.
 */
export function addExpansionCardAsSuggestion(
  project: ProjectDocumentV5,
  card: ExpansionCard,
  categoryLabel: string
): ProjectDocumentV5 {
  const next = structuredClone(project);
  const bundle = openExpansionBundle(next);
  const title = card.title.trim();
  if (bundle.items.some(item => item.title === title)) return next;

  const item: SuggestionItem = {
    id: `suggestion-expansion-${bundle.items.length + 1}-${card.id}`,
    fingerprint: `expansion:${categoryLabel}:${title}`.toLocaleLowerCase('tr-TR'),
    kind: card.kind as SuggestionItem['kind'],
    title,
    description: card.description.trim(),
    pros: [],
    cons: [],
    effort: card.effort as SuggestionItem['effort'],
    impact: card.impact as SuggestionItem['impact'],
    recommended: false,
    recommendationReason: '',
    affectedSections: ['scope'],
    dependencies: [],
    status: 'pending'
  };
  bundle.items.push(item);
  return captureDiscussionBundle(next, bundle, '');
}
