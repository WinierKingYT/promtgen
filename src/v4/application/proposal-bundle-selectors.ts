import type { ProjectDocumentV5, SuggestionBundle, SuggestionItem } from '../contracts.js';

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
 * Keşif kartının parmak izi. Kartın hangi BAŞLIK altından geldiğini taşıyan
 * TEK yer burasıdır: fikir defterinin kaydında (`IdeaDiscussionRecord`)
 * kategori alanı yoktur ve kayıt yalnız paket kimliğini taşır.
 *
 * Biçim tek yerde durur ki OKUYAN ile YAZAN ayrışmasın: aynı işlev boş bir
 * başlıkla çağrıldığında bir kategorinin önekini verir
 * (`expansionFingerprint(label, '')`), böylece bir öğenin o kategoriden gelip
 * gelmediği metin biçimini ikinci kez elle kurmadan sınanabilir.
 */
export function expansionFingerprint(categoryLabel: string, title: string): string {
  return `expansion:${categoryLabel}:${title}`.toLocaleLowerCase('tr-TR');
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

/**
 * Tüm keşif paketlerindeki (kategori farketmeksizin) öğeler, tek bir düz
 * liste hâlinde. `findExpansionItemByTitle` ve `collectExpansionItemTitles`
 * AYNI bu listeden okur — iki yer aynı taramayı ikinci kez elle kurarsa
 * biri değişip diğeri geride kalabilir (bkz. dosya başındaki not: panonun
 * gösterdiği kart ile alımın kabul ettiği kart ayrışır).
 */
function expansionBundleItems(project: ProjectDocumentV5): SuggestionItem[] {
  const items: SuggestionItem[] = [];
  for (const bundle of project.proposalStore?.bundles || []) {
    if (!isExpansionBundle(bundle)) continue;
    items.push(...bundle.items);
  }
  return items;
}

/**
 * Aynı kartın daha önce eklenmiş hâli — hangi keşif paketinde olursa olsun.
 *
 * Paketler dönüşümlüdür: bir paket karara bağlanınca sonraki kart taze bir
 * pakete düşer. Mükerrer denetimi yalnız açık pakete bakarsa apply sonrası boş
 * bir listeye bakar ve kart ikinci kez aday olur; kabul edilirse plana ikinci
 * bir karar yazılır ve fikir defteri parmak izine göre tekilleştirdiği için o
 * öneriye hiç kayıt düşmez — iki defter ayrışır.
 *
 * Eşleme başlık üzerinden yapılır, parmak izi üzerinden değil: parmak izi
 * kategori taşır, dolayısıyla aynı kart başka bir başlık altından ikinci kez
 * geçebilirdi. Fikir defteri de kaydı başlıkla tekilleştirir; iki defterin
 * aynı anahtarı kullanması ayrışmayı baştan engeller.
 */
export function findExpansionItemByTitle(
  project: ProjectDocumentV5,
  title: string
): SuggestionItem | null {
  const needle = title.trim();
  if (!needle) return null;
  return expansionBundleItems(project).find(item => item.title.trim() === needle) || null;
}

/**
 * Tüm keşif paketlerindeki öğelerin başlık kümesi — DURUMDAN BAĞIMSIZ
 * (pending/accepted/edited/deferred/rejected hepsi girer), tıpkı
 * `findExpansionItemByTitle`in yaptığı gibi. `idea-expansion-service.ts` bu
 * kümeyi üretim isteminin "ZATEN ELİMDE" kısıtına (`avoidTitles`) besler; iki
 * yerin AYNI eşleşme kuralını (`expansionBundleItems`, trim) paylaşması
 * zorunludur — aksi hâlde panonun gizlediği bir kart üretim isteminde hâlâ
 * "elde yok" sanılıp yeniden önerilebilir (ya da tersi).
 */
export function collectExpansionItemTitles(project: ProjectDocumentV5): string[] {
  const seen = new Set<string>();
  for (const item of expansionBundleItems(project)) {
    const trimmed = item.title.trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen];
}

/** Yeni keşif paketi için çakışmayan kimlik. */
export function nextExpansionBundleId(project: ProjectDocumentV5): string {
  const existing = (project.proposalStore?.bundles || []).filter(isExpansionBundle).length;
  return `${EXPANSION_BUNDLE_ID_PREFIX}-${existing + 1}`;
}
