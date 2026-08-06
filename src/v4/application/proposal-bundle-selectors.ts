import type { ProjectDocumentV5, SuggestionBundle } from '../contracts.js';

/**
 * Öneri paketleri iki farklı işi taşır ve karıştırılmamalıdır:
 *
 * - **Tur paketi**: konuşmanın o turunda modelin önerdiği seçenekler. Tur
 *   kapanınca karara bağlanmayanlar toplu hâlde ertelenir.
 * - **Keşif paketi**: kullanıcının Keşif panosundan bilerek eklediği kartlar.
 *   Bunlar bir turun eki değildir; kullanıcı kendi eklediği için başka bir
 *   paketin kapanmasıyla ertelenmemelidir.
 *
 * İkisi tek bir "açık paket" içinde toplandığında kart, turun seçenek
 * listesine karışıyor ve tur kapanınca sessizce `deferred` damgalanıyordu.
 * Ayrım paket kimliğinde taşınır: kalıcı belgeye yeni bir alan eklemeden
 * çalışır ve eski projeler geçerli kalır (keşif paketi olmayan belgede
 * `selectExpansionBundle` yalnız null döner).
 */
export const EXPANSION_BUNDLE_ID_PREFIX = 'bundle-idea-expansion';

export const EXPANSION_BUNDLE_TITLE = 'Keşiften eklenenler';

export function isExpansionBundle(bundle: SuggestionBundle): boolean {
  return bundle.id.startsWith(EXPANSION_BUNDLE_ID_PREFIX);
}

/**
 * Konuşma turunun paketi. Keşif paketleri hiçbir koşulda turun yerine geçemez:
 * tur paketi kapanmış olsa bile en son keşif paketi "güncel tur" sanılırsa
 * konuşma paneli kullanıcının kartlarını turun seçenekleri gibi gösterir.
 */
export function selectTurnBundle(project: ProjectDocumentV5): SuggestionBundle | undefined {
  const bundles = project.proposalStore?.bundles || [];
  const turnBundles = bundles.filter(bundle => !isExpansionBundle(bundle));
  return [...turnBundles].reverse().find(bundle => bundle.status === 'open') || turnBundles.at(-1);
}

/** Açık keşif paketi; yoksa null. Kapanmış paketler yeni kart kabul etmez. */
export function selectExpansionBundle(project: ProjectDocumentV5): SuggestionBundle | null {
  const bundles = project.proposalStore?.bundles || [];
  return [...bundles].reverse().find(bundle => isExpansionBundle(bundle) && bundle.status === 'open') || null;
}

/** Yeni keşif paketi için çakışmayan kimlik. */
export function nextExpansionBundleId(project: ProjectDocumentV5): string {
  const existing = (project.proposalStore?.bundles || []).filter(isExpansionBundle).length;
  return `${EXPANSION_BUNDLE_ID_PREFIX}-${existing + 1}`;
}
