/**
 * Aynı PARTİ içindeki tekrar kartlarını eler.
 *
 * NEDEN: canlı ölçümde (qwen2.5:7b, fikir = "unityde bir at sistemi yapmak
 * istiyorum multiplayer olucak", kategori = "Multiplayer Mekanikleri") sekiz
 * kartın dördü aynı mekanizmanın parantez içinde değişen varyasyonuydu:
 * "At Etkileşimleri (Kafa Saldırısı / Sürükleme / Toplama / Sürükleme ve
 * Döndürme)". Asıl neden istemdeki sabit kart kotasıydı ve o kaldırıldı
 * (bkz. ai/tasks/idea-expansion.ts) -- ama kota kalksa da model kendi
 * kendini tekrar edebilir. Bu modül son savunmadır.
 *
 * `hideDecidedCards` bunu yakalayamaz: o yalnız PROJEDE zaten karara
 * bağlanmış başlıkları eler, partinin kendi içine hiç bakmaz.
 *
 * ASİMETRİ -- BURADA TERSTİR: yanlış eleme kullanıcıdan GERÇEK bir fikri
 * gizler ve kullanıcı onu hiç görmez; yanlış tutma yalnız bir tekrar
 * gösterir ve kullanıcı onu görmezden gelebilir. Bu yüzden EMİN DEĞİLSEN
 * TUT. `foundation-idea-claim.ts`teki asimetri bunun TAM TERSİDİR: orada
 * sınırdaki vaka DÜŞÜRÜLÜR, çünkü orada yanlış etiketin bedeli kullanıcının
 * güvenidir; burada yanlış elemenin bedeli kaybolan bir fikirdir.
 *
 * İKİ KURAL VARDIR ve İKİSİ DE GEREKLİDİR:
 *   1. BAŞLIK kuralı -- normalize başlığı aynı olan kart, açıklamadan
 *      BAĞIMSIZ olarak tekrardır.
 *   2. ORAN kuralı -- başlık + açıklama parçacıklarının simetrik örtüşmesi
 *      `DUPLICATE_SIMILARITY` eşiğini geçiyorsa tekrardır.
 * Oran kuralı tek başına yetmez; nedeni `isSameTitle`in üstünde ölçüsüyle
 * yazılıdır. Başlık kuralı da tek başına yetmez: ölçülen ilk kusurda dört
 * varyasyon kartının başlıkları BİRBİRİNDEN FARKLIYDI.
 *
 * NEDEN BAZI YARDIMCILAR DIŞA AKTARILIYOR: `expansion-section-dedup.ts`
 * (bölümler ARASI eleme) aynı ölçütü kullanmak ZORUNDADIR. İki yer ayrı
 * ölçüt taşısaydı pano tutarsız olurdu -- kategori içinde tekrar sayılan bir
 * çift, bölümler arasında ayrı kart sayılabilirdi. Kopyalamak yerine
 * paylaşmak, eşiği ayarlayan kişinin İKİ yeri birden ayarlamasını sağlar.
 * `dropDuplicateExpansionCards`in gövdesi bundan etkilenmez: yalnız
 * görünürlük değişti, davranış değil.
 *
 * Neden `foundation-idea-claim.ts` ile ortak yardımcı kullanmıyor: orada
 * karşılaştırmanın BİR tarafı kullanıcının ham fikir cümlesidir, bu yüzden
 * "kısa olan uzunun ÖNEKİ mi" (tek yönlü içerme) doğru araçtır. Burada İKİ
 * taraf da model-yazımı ve İKİSİ de çekimlidir: "nesnelere" ile "nesneleri"
 * hiçbiri diğerinin öneki değildir ama aynı kelimedir. Bu yüzden burada
 * SİMETRİK ortak-gövde ölçütü kullanılır. İki modülü tek yardımcıya bağlamak
 * birini bozmadan diğerini ayarlamayı imkânsız kılardı.
 */

/**
 * Türkçe durak kelimeleri: içerik taşımayan işlevsel kelimeler. Çekirdek
 * liste `foundation-idea-claim.ts` ve `change-impact-service.ts` ile aynı
 * mantıkta tutulur; buraya ek olarak kart cümlelerinde sık geçen işaret
 * zamirleri girer.
 */
const STOP_WORDS = new Set([
  've', 'ile', 'bir', 'bu', 'şu', 'için', 'icin', 'olarak', 'gibi', 'daha',
  'çok', 'en', 'da', 'de', 'ki', 'ise', 'ya', 'veya', 'ama', 'ancak', 'ayrıca',
  'her', 'tüm', 'hem', 'yani', 'göre', 'kadar', 'üzere', 'sonra', 'önce',
  'var', 'yok', 'olan', 'olacak', 'oldu', 'olur', 'olmak', 'olması',
  'artık', 'bunu', 'buna', 'bunun', 'mi', 'mı', 'mu', 'mü',
  'onu', 'ona', 'onun', 'onları', 'onlara', 'kendi',
  'istiyorum', 'istiyor', 'isterim', 'yap', 'yapmak', 'yapmayı',
  'ekle', 'eklemek', 'olsun', 'olmalı',
  'the', 'and', 'for', 'with'
]);

/** Kök sayılabilecek en kısa parça. "at" ve "ağ" gerçek köklerdir. */
const MIN_ROOT_LENGTH = 2;

/**
 * Kısa bir kökün üzerine binebilecek en uzun çekim zinciri:
 * "at" -> "atların" (5), "atlarıyla" (7). Bundan uzunu "at" ile
 * "atmosferindeki"yi eşleştirmeye başlar.
 */
const MAX_SUFFIX_LENGTH = 7;

/**
 * İki kelime BİRBİRİNİN öneki değilken (ikisi de çekimliyken) aynı sayılmak
 * için gereken en kısa ortak gövde: "nesneler|e" ile "nesneler|i" -> 8,
 * "topla|ma" ile "topla|yabilir" -> 5. 5'in altına inilmez; "konum" ile
 * "konuşma" (ortak 4) ya da "kara" ile "karar" gibi alakasız çiftler
 * eşleşmeye başlar.
 */
const MIN_SHARED_STEM = 5;

/**
 * İki kartı aynı kart saymak için gereken en düşük benzerlik.
 *
 * ÖLÇÜLEN AYRIM (yukarıdaki canlı parti; başlıklar birebir, açıklamalar
 * kötümser -- yani gerçekte olduğundan daha FARKLI -- yeniden kuruldu):
 *   - dört varyasyon kartının birbirine benzerliği: 0.500 - 0.889
 *   - gerçekten ayrı kartların en yüksek benzerliği: 0.353
 *     ("Sesli Sohbet" ile "Ağ Senkronizasyonu (Ses)")
 * Aradaki boşluk [0.353, 0.500] geniştir. Eşik bu boşluğun İÇİNE, ama
 * TEKRAR bandına YAKIN konur (0.45): boşlukta kalan her sınır vakası TUTULUR.
 * Yukarıdaki asimetri bunu gerektirir -- bu, eşiği temiz banda yakın koyan
 * `foundation-idea-claim.ts`in bilinçli olarak tersidir.
 *
 * SINIR: bu sözlüksel bir ölçüttür, anlam bilmez. Tamamen farklı kelimelerle
 * yazılmış iki eş fikir buradan geçer. Amaç mükemmel tespit değil, ölçülen
 * ASIL hatayı -- tek mekanizmanın parantezle çoğaltılmasını -- kesmektir.
 */
export const DUPLICATE_SIMILARITY = 0.45;

/**
 * Bir kartın benzerlik ölçümüne SOKULABİLMESİ için gereken en az içerik
 * parçacığı. Bir veya iki parçacıklı kartta oran anlamsızdır: tek ortak
 * kelime oranı doğrudan 1.00'e çıkarır ve alakasız iki kartı aynı sayar.
 * Ölçülen gerçek kartlar 8-12 parçacık taşıyor; bu kapı onlara dokunmaz,
 * yalnız ölçülemeyecek kadar ince kartı KORUR (emin değilsen TUT).
 */
export const MIN_COMPARABLE_TOKENS = 3;

/** Karşılaştırma yalnız bu iki alana bakar; kart tipi bundan bağımsızdır. */
export interface DedupableCard {
  title: string;
  description: string;
}

export interface ExpansionDedupResult<TCard> {
  /** Kalan kartlar; girdi sırasında ve girdiyle AYNI nesneler. */
  cards: TCard[];
  /** Parti içi tekrar olduğu için elenen kart sayısı. */
  duplicateCount: number;
}

/**
 * Metni Türkçe-duyarlı içerik parçacıklarına ayırır.
 * `toLocaleLowerCase('tr-TR')` zorunludur: "I" -> "ı", "İ" -> "i". Varsayılan
 * küçültme bu iki harfi yanlış eşler ve aynı kartı farklı sanar.
 */
export function contentTokens(value: string): string[] {
  const normalized = String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFC')
    .replace(/[^0-9a-zçğıiöşü]+/g, ' ')
    .trim();
  if (!normalized) return [];
  const unique = new Set<string>();
  for (const token of normalized.split(/\s+/)) {
    if (token.length < MIN_ROOT_LENGTH) continue;
    if (STOP_WORDS.has(token)) continue;
    unique.add(token);
  }
  return [...unique];
}

function sharedPrefixLength(left: string, right: string): number {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[index] === right[index]) index += 1;
  return index;
}

/**
 * İki parçacık aynı kelimenin çekimleri mi? İki durum vardır:
 *   1. Biri diğerinin tamamını içeriyor: "at" / "atları" -> kısa kök + ek.
 *   2. İkisi de çekimli, ortak gövde ayrışıyor: "nesnelere" / "nesneleri".
 * Naif tam-kelime eşleşmesi ikisini de kaçırır ve tekrarları farklı gösterir.
 */
function sharesRoot(left: string, right: string): boolean {
  if (left === right) return true;
  const shared = sharedPrefixLength(left, right);
  if (shared < MIN_ROOT_LENGTH) return false;
  const shortest = Math.min(left.length, right.length);
  const longest = Math.max(left.length, right.length);
  if (shared === shortest) return longest - shortest <= MAX_SUFFIX_LENGTH;
  return shared >= MIN_SHARED_STEM;
}

/**
 * Simetrik örtüşme oranı: iki taraftan da karşılık bulan parçacıkların, tüm
 * parçacıklara oranı. Simetri şarttır -- tek yönlü ölçüt kısa kartı uzun
 * kartın içinde eritir ve gerçek bir fikri eler.
 */
export function similarity(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) return 0;
  const matchedLeft = left.filter(token => right.some(other => sharesRoot(token, other))).length;
  const matchedRight = right.filter(token => left.some(other => sharesRoot(token, other))).length;
  return (matchedLeft + matchedRight) / (left.length + right.length);
}

/**
 * İki kart AYNI BAŞLIĞI mı taşıyor?
 *
 * NEDEN AYRI BİR KURAL: başlık, kartın panodaki KİMLİĞİDİR -- kullanıcı önce
 * onu okur ve aynı başlığı iki kez görmek açıkça bir hatadır. Açıklama farkı
 * bunu meşrulaştırmaz: iki farklı şey söylenmek isteniyorsa başlıkları da
 * farklı olmalıydı.
 *
 * NEDEN ORAN KURALI BUNU YAKALAYAMIYOR (canlı ölçüm, qwen2.5:7b, kategori =
 * "Multisatırlık oyun mekanikleri"): panoda BİREBİR "At hareketi: Zamanlamalı
 * ilerleme" başlıklı iki kart yan yanaydı. Başlık dört parçacık, açıklamalar
 * 17 ve 21 parçacık; açıklama gürültüsü sayıca baskın geldi ve toplam oran
 * ÖLÇÜLDÜ = 0.368, yani 0.45 eşiğinin ALTINDA kaldı. Başlıkların kendi arası
 * ÖLÇÜLDÜ = 1.000. Başlık çakışması açıklamanın içinde boğuluyor; bu yüzden
 * başlık ayrı ve açıklamadan BAĞIMSIZ ölçülmek zorundadır.
 *
 * NEDEN YAKIN-BAŞLIK TOLERANSI YOK (bilinçli karar, ölçümle):
 * yalnız başlık üzerinden benzerlik ölçüldüğünde
 *   - elenmesi GEREKEN üçlü ("At etkileşimleri: Sürükleme ve Toplama" /
 *     "... Sürükleme" / "... Toplama"): 0.667 - 0.857
 *   - KORUNMASI gereken ayrı kartlar ("Ağ Senkronizasyonu (Konum)" ile
 *     "(Ses)"): 0.667
 * Bantlar 0.667'de ÇAKIŞIYOR -- ikisini ayıran bir eşik YOKTUR. Yukarıdaki
 * asimetri gereği (emin değilsen TUT) tolerans EKLENMEDİ: yanlış eleme
 * kullanıcıdan gerçek bir fikri gizler, yanlış tutma yalnız bir tekrar
 * gösterir. Yakın ama aynı olmayan başlıklı gerçek tekrarlar zaten oran
 * kuralına yakalanır -- ölçülen ilk kusurdaki dört varyasyon kartı böyle
 * elenmişti; yukarıdaki üçlü de gerçekçi açıklamalarla çalıştırıldığında oran
 * kuralınca TEK karta indi (ölçüldü). Yani tolerans gereksiz, yalnız risklidir.
 *
 * Karşılaştırma parçacık DİZİSİ üzerindendir: aynı sayıda ve aynı sırada
 * parçacık, her biri `sharesRoot` ile eşleşmeli. `sharesRoot` burada da
 * zorunludur, çünkü "Envanter Sistemi" ile "Envanterler Sistemi" aynı
 * başlıktır; naif tam eşleşme bunu kaçırırdı.
 */
export function isSameTitle(left: string[], right: string[]): boolean {
  // Başlıksız kart kimliksizdir; hiçbir başlığa eşit sayılmaz (emin değilsen TUT).
  if (left.length === 0 || right.length === 0) return false;
  if (left.length !== right.length) return false;
  return left.every((token, index) => sharesRoot(token, right[index]));
}

/**
 * SAF: I/O yok, AI yok, rastgelelik yok, girdi mutasyonu yok. Kalan kartlar
 * kopyalanmaz, girdideki nesneler aynen geri verilir.
 *
 * Her kart yalnız ELDE TUTULANLARLA karşılaştırılır ve İLK gelen tutulur:
 * böylece sonuç girdi sırasına göre kararlıdır ve zincirleme eleme olmaz.
 */
export function dropDuplicateExpansionCards<TCard extends DedupableCard>(
  cards: readonly TCard[]
): ExpansionDedupResult<TCard> {
  const kept: TCard[] = [];
  const keptTokens: string[][] = [];
  const keptTitleTokens: string[][] = [];

  for (const card of cards) {
    const titleTokens = contentTokens(card.title);
    const tokens = contentTokens(`${card.title} ${card.description}`);

    // 1. BAŞLIK kuralı: aynı başlık, açıklamadan BAĞIMSIZ olarak tekrardır.
    // `MIN_COMPARABLE_TOKENS` kapısı buraya UYGULANMAZ: oran kuralında ince
    // içerik ölçümü anlamsızlaştırır, burada ise karşılaştırma bir oran değil
    // dizi eşitliğidir -- tek parçacıklı iki başlığın aynı olması da tekrardır.
    const hasSameTitle = keptTitleTokens.some(other => isSameTitle(titleTokens, other));

    // 2. ORAN kuralı: içeriği ölçülemeyecek kadar ince kart hiçbir şeye
    // benzemez sayılır -- emin değilsen TUT. Bu, karşılaştırmanın İKİ tarafı
    // için de geçerlidir.
    const isTooSimilar = tokens.length >= MIN_COMPARABLE_TOKENS
      && keptTokens.some(other =>
        other.length >= MIN_COMPARABLE_TOKENS
        && similarity(tokens, other) >= DUPLICATE_SIMILARITY);

    if (hasSameTitle || isTooSimilar) continue;
    kept.push(card);
    keptTokens.push(tokens);
    keptTitleTokens.push(titleTokens);
  }

  return { cards: kept, duplicateCount: cards.length - kept.length };
}
