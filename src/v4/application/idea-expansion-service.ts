import type { ProjectDocumentV5 } from '../contracts.js';
import type { ProviderSettings } from '../provider-settings.js';
import type { StructuredProvider } from '../ai/provider-adapters.js';
import { runRegisteredAITask } from '../ai/runtime.js';
import { getExpansionCategories, type ExpansionCategory } from '../idea-expansion/categories.js';
import { findExpansionItemByTitle } from './proposal-bundle-selectors.js';
import { dropDuplicateExpansionCards } from './expansion-card-dedup.js';
import { dropCommandToneExpansionCards } from './expansion-card-tone.js';
import { fingerprint } from './deterministic-idea-planning.js';
import type { IdeaExpansionOutput } from '../ai/schemas/schemas.js';

/**
 * Kartın nereden geldiği kartın kendisinde taşınır; tüketici tahmin etmez.
 * `user`: kullanıcının panoya serbest metinle kendi yazdığı öneri — bir model
 * değerlendirmesi değildir, `local-seed` gibi effort/impact/mvpHint taşımaz.
 */
export type ExpansionCardOrigin = 'ai' | 'local-seed' | 'user';

export interface ExpansionCard {
  id: string;
  title: string;
  description: string;
  kind: string;
  /**
   * Efor, etki ve MVP etiketi bir değerlendirmedir: yalnız AI kartlarında
   * bulunur. Başlangıç kartlarında bu alanlar yoktur, uydurulmuş nötr
   * değerlerle doldurulmaz.
   */
  effort?: string;
  impact?: string;
  mvpHint?: string;
  origin: ExpansionCardOrigin;
}

export interface ExpansionResult {
  categoryId: string;
  cards: ExpansionCard[];
  mode: 'local-ai' | 'cloud-ai' | 'fallback';
  fallbackReason: string | null;
  /** Daha önce karara bağlandığı için gizlenen kart sayısı. */
  hiddenCount: number;
  /**
   * Aynı partide birbirinin tekrarı olduğu için elenen kart sayısı. AYRI bir
   * sayaçtır: `hiddenCount` "bunu zaten karara bağladın" demektir ve arayüzde
   * öyle açıklanır; bu ise "model kendini tekrar etti" demektir. İkisini
   * toplamak kullanıcıya vermediği bir kararı atfederdi.
   *
   * ARAYÜZE ÇIKMAZ. Yalnız İÇ sinyaldir: tamamlama turunun gerekip
   * gerekmediğini bu belirler (bkz. `generateExpansionCards`). Kullanıcı
   * "elenenin yerine başkasını ver" dedi, "kaç tane elendiğini söyle"
   * demedi.
   */
  duplicateCount: number;
  /**
   * Emir kipiyle -- yani FİKİR değil GÖREV gibi -- yazıldığı için elenen kart
   * sayısı. ÜÇÜNCÜ ve AYRI bir sayaçtır: `hiddenCount` "bunu zaten karara
   * bağladın", `duplicateCount` "model kendini tekrar etti", bu ise "model
   * kartı bir iş tanımı gibi yazdı" demektir. Üçünü toplamak kullanıcıya
   * vermediği kararları atfederdi.
   *
   * ARAYÜZE ÇIKMAZ; `duplicateCount` gibi yalnız İÇ sinyaldir ve tamamlama
   * turunun gerekip gerekmediğini `duplicateCount` ile birlikte belirler.
   */
  commandToneCount: number;
}

/**
 * Karara bağlanmış kart panoda yeniden aday olarak gösterilmez.
 *
 * İstem reddedilen kayıtları bağlamda görüyor ama bu modelin uymasına bağlı bir
 * söz; başlangıç kartları ise sabit başlıklar olduğu için her açılışta aynen
 * geri geliyordu. Kullanıcı ekleyemeyeceği bir kartın "Fikre ekle" düğmesini
 * görüyor, bastığında "daha önce reddettin" uyarısı alıyordu.
 *
 * Ölçüt intake ile aynı: başlık. İki yer aynı anahtarı kullanmazsa panonun
 * gösterdiği kart ile alımın kabul ettiği kart ayrışır.
 */
function hideDecidedCards(project: ProjectDocumentV5, cards: ExpansionCard[]): {
  cards: ExpansionCard[];
  hiddenCount: number;
} {
  const visible = cards.filter(card => !findExpansionItemByTitle(project, card.title));
  return { cards: visible, hiddenCount: cards.length - visible.length };
}

/**
 * Hangi sonucun ekranda gösterileceğini kategoriye bağlar. Kategoriler farklı
 * hızlarda döner (önbellekli anında, üretim ~25 sn); geç gelen bir yanıt başka
 * bir kategorinin kartlarını onun başlığı altına yazamaz. Aksi hâlde "Fikre
 * ekle" yanlış kategori etiketini fingerprint'e ve tartışma kaydına basar.
 */
export function selectVisibleExpansionResult(
  activeCategoryId: string | null,
  result: ExpansionResult | null
): ExpansionResult | null {
  if (!activeCategoryId || !result) return null;
  return result.categoryId === activeCategoryId ? result : null;
}

export interface GenerateExpansionOptions {
  settings: ProviderSettings;
  credential?: string;
  provider?: StructuredProvider;
  signal?: AbortSignal;
  refresh?: boolean;
  /**
   * Tier 3 (fikre özel, model-üretimi) eksenler `getExpansionCategories`'in
   * senkron/saf sonucunda YOKTUR — bilerek, bkz. idea-expansion/categories.ts.
   * Böyle bir eksen için kart üretilecekse çağıran (board) kategori nesnesini
   * burada doğrudan geçer; aksi hâlde bu fonksiyon onu hiçbir zaman bulamaz.
   * `categoryId` ile eşleşmiyorsa yok sayılır — çağıran yanlış eksen geçemez.
   */
  category?: ExpansionCategory;
}

/**
 * Kategori başına ~25 saniyelik üretim maliyeti olduğu için sonuç bellekte
 * tutulur. Anahtar canonical revision içerir: fikir değişince önbellek doğal
 * olarak geçersizleşir.
 */
const cache = new Map<string, ExpansionResult>();

/**
 * Önbellekte tutulan en fazla girdi sayısı.
 *
 * GEREKÇE. Anahtar `documentRevision` içeriyor ve revizyon YALNIZ fikir metni
 * değişince değil, kart eklemek dâhil her kalıcılaştırmada artıyor. Yani eski
 * revizyonun girdilerine bir daha HİÇ bakılmaz — onlar canlı bir önbellek
 * değil, ölü ağırlıktır. Arka plan doldurma (bkz. expansion-prefetch.ts) bu
 * ölü ağırlığı revizyon başına bir-iki girdiden ~6'ya çıkardığı için sınır
 * artık gerekli: 20 düzenleme ~120 girdi demek ve hiçbiri okunmuyor.
 *
 * 96 seçildi: revizyon başına en fazla ~14 kategori (pano canlı ölçümde bu
 * kadar gösteriyor) tutulabilir; 96 bunun ~7 revizyonluk penceresidir. Yani
 * kullanıcı fikri düzeltip geri aldığında bile eldeki revizyonun TAMAMI
 * kesinlikle önbellekte kalır — sınır yalnız çok eskiyi düşürür.
 *
 * Düşürme sırası yazma sırasıdır (`Map` ekleme sırasını korur): en eski
 * yazılan gider. Bu, "en eski revizyon" ile pratikte aynı şeydir.
 */
const MAX_CACHE_ENTRIES = 96;

export function clearExpansionCache(): void {
  cache.clear();
}

function rememberResult(key: string, result: ExpansionResult): void {
  // Yeniden yazılan anahtar tazelenir: `delete` + `set` onu sıranın sonuna
  // taşır, yoksa "Yenile" ile güncellenen bir girdi ilk yazıldığı anın
  // yaşıyla düşerdi.
  cache.delete(key);
  cache.set(key, result);
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

function cacheKey(project: ProjectDocumentV5, categoryId: string): string {
  return `${project.id}::${project.canonicalRevision}::${project.documentRevision}::${categoryId}`;
}

/** Şemanın üst sınırı; birleşik sonuç da bunu aşmaz. */
const MAX_EXPANSION_CARDS = 10;

/**
 * Eleme sonrası TAMAMLAMA turu: elenen tekrarların yerine gerçekten farklı
 * kart ister.
 *
 * NE İSTEMEZ: "N tane daha üret". Bu, bu görevden yeni kaldırılan kart
 * kotasının geri gelmesi olurdu (bkz. ai/tasks/idea-expansion.ts) ve modeli
 * yine uydurmaya iterdi. İstenen şey bir KISITTIR: "şunlar elimde, bunlardan
 * farkını göster". Model yeni bir şey bulamıyorsa AZ kart döndürmesi —
 * hatta şema tabanının altına düşüp turu düşürmesi — DOĞRU cevaptır.
 *
 * HİÇBİR HÂLDE FIRLATMAZ. İlk parti kullanıcının elinde geçerli kartlardır;
 * tamamlama bir İYİLEŞTİRMEDİR, ona bağlı değildir. `runRegisteredAITask`
 * çevrimdışı ayarlarda SENKRON fırlatır; o da buradan sessizce yutulur.
 */
async function runTopUpRound(
  project: ProjectDocumentV5,
  category: ExpansionCategory,
  options: GenerateExpansionOptions,
  avoidTitles: string[]
): Promise<ExpansionCard[]> {
  try {
    const run = await runRegisteredAITask<IdeaExpansionOutput>('idea-expansion', {
      project,
      settings: options.settings,
      credential: options.credential,
      provider: options.provider,
      signal: options.signal,
      input: {
        categoryId: category.id,
        categoryLabel: category.label,
        categoryHint: category.hint,
        seedTitles: category.seedTitles,
        avoidTitles
      }
    });
    return run.output.cards.map(card => ({ ...card, origin: 'ai' as const }));
  } catch {
    // Şema tutmadı / zaman aşımı / sağlayıcı düştü: sessizce vazgeçilir.
    // Kullanıcı elindeki kartları görmeye devam eder; mode ve fallbackReason
    // ilk çağrının sonucunu yansıtmayı sürdürür.
    return [];
  }
}

/**
 * Başlangıç başlıklarından kart üretir. Hiçbir alan uydurulmaz; başlık açıklama
 * olarak da kullanılır ve değerlendirme gerektiren alanlar boş bırakılır.
 * `origin` alanı kartı tüketen her yerde yerel köken bilgisini taşır.
 */
function seedCards(category: ExpansionCategory): ExpansionCard[] {
  return category.seedTitles.map((title, index) => ({
    id: `seed-${category.id}-${index}`,
    title,
    description: `${category.hint} sorusuna bu başlangıç önerisiyle bakabilirsin.`,
    kind: 'feature',
    origin: 'local-seed'
  }));
}

/** Kullanıcının serbest metinle yazdığı öneri en fazla bu uzunlukta tutulur. */
const MAX_USER_CARD_LENGTH = 500;
/**
 * Kullanıcı-yazımı kart kimlikleri her zaman bu önekle başlar; `ai.` (model
 * eksenleri) veya `seed-` (yerel başlangıç) kimlikleriyle asla çakışmaz —
 * `ai.<fingerprint>` önekiyle aynı gerekçe: bkz. idea-axis-service.ts.
 */
const USER_CARD_ID_PREFIX = 'user.';

/**
 * Kullanıcının panoya serbest metinle eklediği öneriden kart üretir.
 *
 * AI kartlarındaki gibi bir DEĞERLENDİRME (effort/impact/mvpHint) taşımaz:
 * kullanıcı bu konuda hiçbir yargı vermedi, uydurmak yerine alanlar hiç
 * yazılmaz — tıpkı `seedCards`'ın yaptığı gibi.
 *
 * Boş veya yalnız boşluktan oluşan girişte `null` döner; çağıran (board) bunu
 * sessizce reddeder, bildirim spamlamaz.
 */
export function createUserExpansionCard(text: string): ExpansionCard | null {
  const title = String(text || '').trim().slice(0, MAX_USER_CARD_LENGTH);
  if (!title) return null;
  const slug = fingerprint(title) || String(Date.now());
  return {
    id: `${USER_CARD_ID_PREFIX}${slug}`,
    title,
    description: title,
    kind: 'feature',
    origin: 'user'
  };
}

export async function generateExpansionCards(
  project: ProjectDocumentV5,
  categoryId: string,
  options: GenerateExpansionOptions
): Promise<ExpansionResult> {
  const category = (options.category && options.category.id === categoryId)
    ? options.category
    : getExpansionCategories(project).find(item => item.id === categoryId);
  if (!category) throw new Error(`Bilinmeyen genişletme kategorisi: ${categoryId}`);

  const key = cacheKey(project, categoryId);
  if (!options.refresh) {
    const cached = cache.get(key);
    if (cached) return cached;
  }

  let result: ExpansionResult;
  try {
    const run = await runRegisteredAITask<IdeaExpansionOutput>('idea-expansion', {
      project,
      settings: options.settings,
      credential: options.credential,
      provider: options.provider,
      signal: options.signal,
      input: {
        categoryId: category.id,
        categoryLabel: category.label,
        categoryHint: category.hint,
        seedTitles: category.seedTitles
      }
    });
    const visible = hideDecidedCards(project, run.output.cards.map(card => ({ ...card, origin: 'ai' as const })));
    // BORU HATTI SIRASI -- üçü de aynı gerekçeyle bu sırada durur: eleyen her
    // kapı, kendisinden SONRA gelen kapının elinde kullanıcının GERÇEKTEN
    // görebileceği kartlar kalmasını sağlar.
    //   1. karara bağlanmışlar düşer (kullanıcı onları zaten görmeyecek),
    //   2. emir kipiyle yazılmış kartlar düşer,
    //   3. parti içi tekrarlar elenir.
    // 2 neden 3'ten ÖNCE: iki kart birbirinin varyasyonuysa ve ilki emir
    // kipliyse, ters sırada temsilci olarak EMİR KİPLİ kart tutulur, meşru
    // varyasyon onunla birlikte düşer ve ardından temsilci de elenir --
    // kullanıcı İKİSİNİ birden kaybederdi. Aynı gerekçe 1'in 3'ten önce
    // olmasını da gerektirir.
    const toned = dropCommandToneExpansionCards(visible.cards);
    const unique = dropDuplicateExpansionCards(toned.cards);
    let cards = unique.cards;

    // Eleme kart SAYISINI düşürür; kullanıcı tekrarların gizlenmesini istedi
    // ama panonun boşalmasını değil. Elenmiş kartların YERİNE bir tur daha
    // kart istenir.
    //
    // EN ÇOK BİR TUR. Bu dosyanın başında yazdığı gibi kategori başına üretim
    // ~25 saniye sürüyor; ikinci çağrı beklemeyi ~50 saniyeye çıkarır. Üçüncü
    // bir tur kullanıcıyı panonun başında kaybettirir ve kazandıracağı kart
    // sayısı her turda azalır (model zaten söylemediğini söylemeye çalışır).
    // Tur yeni hiçbir kart getirmezse sessizce durulur.
    //
    // TON ELEMESİ DE AYNI TURU TETİKLER: kullanıcı açısından fark yoktur --
    // her iki hâlde de panoda daha az kart kalır. Yeni bir mekanizma
    // icat edilmez, var olan tur aynı koşulun yanına eklenir.
    if (unique.duplicateCount > 0 || toned.commandToneCount > 0) {
      const extra = await runTopUpRound(project, category, options, cards.map(card => card.title));
      if (extra.length) {
        // Tamamlama kartları da AYNI ÜÇ kapıdan ve AYNI sırayla geçer: model
        // bu turda da karara bağlanmış bir başlığı, emir kipli bir kart ya da
        // elde olanın varyasyonunu önerebilir. Tekrar elemesi birikmiş küme
        // ÜZERİNDE çalışır; yalnız yeni partinin kendi içine bakmak, elde
        // olanın kopyasını geçirirdi.
        const freshVisible = hideDecidedCards(project, extra);
        const freshToned = dropCommandToneExpansionCards(freshVisible.cards);
        const merged = dropDuplicateExpansionCards([...cards, ...freshToned.cards]);
        cards = merged.cards.slice(0, MAX_EXPANSION_CARDS);
      }
    }

    result = {
      categoryId,
      cards,
      mode: run.provenance.mode === 'cloud-ai' ? 'cloud-ai' : 'local-ai',
      fallbackReason: null,
      // ÜÇ SAYAÇ DA İLK PARTİYİ anlatır. Tamamlama turu kullanıcının hiç
      // görmediği iç bir onarımdır; oradaki gizlemeleri "senin kararın"
      // sayacına eklemek, kullanıcının bakmadığı bir partiden ona hesap
      // vermek olurdu. `duplicateCount` ve `commandToneCount` ise burada
      // turun NEDEN çalıştığını açıklar.
      hiddenCount: visible.hiddenCount,
      duplicateCount: unique.duplicateCount,
      commandToneCount: toned.commandToneCount
    };
  } catch (error) {
    // İPTAL BİR BAŞARISIZLIK DEĞİLDİR. Arka plan doldurma fikir değişince
    // uçuştaki üretimi iptal ediyor (bkz. expansion-prefetch.ts); o istek
    // artık İSTENMİYOR. Yedek kartlar üretmek "AI bağlı değil" demek olurdu
    // -- yanlış; önbelleğe yazmak ise eskimiş bir anahtarı yedek sonuçla
    // doldurup sonraki gerçek üretimi engellerdi. İkisi de yapılmaz: hata
    // olduğu gibi yukarı verilir, çağıran ekrana hiçbir şey yazmaz.
    if (options.signal?.aborted) throw error;

    // Sağlayıcı yok, şema tutmadı veya zaman aşımı: pano yine açılır ama
    // bunun AI üretimi olmadığı açıkça bildirilir.
    //
    // Parti içi tekrar elemesi bu yola UYGULANMAZ. Başlangıç kartlarının
    // açıklaması kategori ipucundan üretilir ve hepsi BİREBİR AYNIDIR;
    // eleme burada çalışsaydı elle seçilmiş, gerçekten farklı başlıklar
    // birbirinin tekrarı sanılıp silinirdi. Zaten uydurma da yok: bu
    // başlıklar modelin değil, sözlüğün. Eleme çalışmadığı için tamamlama
    // turu da ARANMAZ — burada zaten AI yoktur.
    //
    // TON ELEMESİ DE UYGULANMAZ ve aynı gerekçeyle: bu başlıklar elle
    // seçilmiştir, emir kipiyle yazılmamıştır ve burada denetlenecek bir
    // model çıktısı yoktur. Yanlış eleme burada elle yazılmış bir öneriyi
    // kullanıcıdan gizlerdi.
    const visible = hideDecidedCards(project, seedCards(category));
    result = {
      categoryId,
      cards: visible.cards,
      mode: 'fallback',
      fallbackReason: error instanceof Error ? error.message : 'AI çağrısı başarısız.',
      hiddenCount: visible.hiddenCount,
      duplicateCount: 0,
      commandToneCount: 0
    };
  }

  rememberResult(key, result);
  return result;
}
