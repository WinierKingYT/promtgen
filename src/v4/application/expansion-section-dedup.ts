import {
  contentTokens,
  isSameTitle,
  similarity,
  DUPLICATE_SIMILARITY,
  MIN_COMPARABLE_TOKENS,
  type DedupableCard
} from './expansion-card-dedup.js';

/**
 * BÖLÜMLER ARASI tekrar elemesi.
 *
 * NEDEN. `dropDuplicateExpansionCards` KATEGORİ İÇİNDE çalışır ve orada doğru
 * çalışıyor. Pano tek kategori gösterdiği sürece bu yetiyordu; hazır olan her
 * başlık aynı anda görünmeye başlayınca ayrı partilerin tekrarları ilk kez yan
 * yana geldi. CANLI ÖLÇÜM (qwen2.5:7b / Ollama, fikir = "unityde bir at
 * sistemi yapmak istiyorum multiplayer olucak", dokuz bölüm açık, DOM'dan
 * sayıldı): 40 kartın yalnız 33'ü benzersizdi.
 *   "At dayanıklılığı"            -> 3 bölümde
 *   "Eyer ve envanter"            -> 3 bölümde
 *   "Atı uzaktan çağırma"         -> 3 bölümde
 *   "At dayanıklılığı geliştirme" -> 2 bölümde
 *
 * SAF TÜRETİLMİŞ GÖRÜNÜMDÜR, ÖNBELLEĞE DOKUNMAZ. Kategori başına önbellek
 * girdileri HAM kalır; eleme yalnız gösterim anında hesaplanır. Gerekçe:
 * önbellek fikrin kendisiyle anahtarlı ve kategoriler arasında paylaşılıyor
 * (bkz. idea-expansion-service.ts `expansionGenerationKey`). Elenmiş sonucu
 * önbelleğe yazmak, aynı
 * kategorinin kullanıcının o an hangi bölümleri açtığına göre farklı içerik
 * göstermesi demek olurdu. `idea-state-view.ts` bu kod tabanındaki saf
 * türetilmiş görünüm örneğidir; bu modül aynı çizgidedir.
 *
 * TAMAMLAMA TURUNU TETİKLEMEZ. Kategori B, A ile çakıştığı için kart
 * kaybederse yerine yenisi İSTENMEZ (`runTopUpRound`, idea-expansion-service).
 * İki gerekçe: (1) gelen yeni kart da bir üst bölümle çakışabilir ve bu döngü
 * sürebilir -- her tur yerel modelde ~25 saniye; (2) kart KAYBOLMADI, bir üst
 * bölümde duruyor. Kullanıcının gördüğü benzersiz öneri sayısı azalmıyor, aynı
 * öneri iki kez yazılmıyor.
 *
 * ASİMETRİ -- `expansion-card-dedup.ts`teki ile AYNI YÖNDE: yanlış eleme
 * kullanıcıdan GERÇEK bir öneriyi gizler ve kullanıcı onu hiç görmez; yanlış
 * tutma yalnız bir tekrar gösterir ve kullanıcı onu görmezden gelebilir. Bu
 * yüzden EMİN DEĞİLSEN TUT. Ölçüt de oradan aynen alınır (kopyalanmaz,
 * paylaşılır): birebir başlık kuralı + 0.45 simetrik örtüşme eşiği. İki yer
 * ayrı ölçüt taşısaydı kategori içinde tekrar sayılan bir çift bölümler
 * arasında ayrı kart sayılabilirdi.
 */

/** Bir bölümün ELEMEDEN ÖNCEKİ hâli. Sıra, panonun gösterim sırasıdır. */
export interface ExpansionSectionCards<TCard extends DedupableCard> {
  categoryId: string;
  cards: readonly TCard[];
  /**
   * Bu bölüm elemenin TAMAMEN DIŞINDADIR: ne kart kaybeder, ne de başka bir
   * bölümün kartını eler.
   *
   * NEDEN VAR (ölçüldü -- bu bayrak eklenmeden önce e2e kapısı düştü): yedek
   * yolunda kartlar modelin değil SÖZLÜĞÜN (`seedCards`,
   * idea-expansion-service.ts) ve açıklamaları tek bir kalıptan üretiliyor
   * ("<ipucu> sorusuna bu başlangıç önerisiyle bakabilirsin"). Kalıp ortak
   * olduğu için elle seçilmiş, gerçekten FARKLI başlıklar birbirinin tekrarı
   * sanılıyor ve kullanıcı AI'sız kaldığı anda elindeki tek öneri listesini de
   * kaybediyordu. Kategori içi eleme aynı gerekçeyle bu yola zaten
   * uygulanmıyor; burada da uygulanmaz.
   */
  isExemptFromDedup?: boolean;
}

export interface ExpansionSectionView<TCard extends DedupableCard> {
  categoryId: string;
  /** Kalan kartlar; girdi sırasında ve girdiyle AYNI nesneler. */
  cards: TCard[];
  /**
   * Bölümün kartı VARDI ama hepsi başka bölümlerdeki kartlarla çakıştığı için
   * düştü. Henüz kart gelmemiş (üretimi süren) bölüm bunu ASLA demez: orada
   * çakışma değil, bekleme vardır ve ikisi kullanıcıya farklı şeyler anlatır.
   */
  isCoveredByOtherSections: boolean;
}

/** Kümelenirken kartın nereden geldiği; kazananı geri yazmak için gerekir. */
interface PlacedCard<TCard extends DedupableCard> {
  card: TCard;
  sectionIndex: number;
  cardIndex: number;
  titleTokens: string[];
  tokens: string[];
}

/**
 * Bir küme = "aynı kart"ın bütün kopyaları. Üyelik TEMSİLCİYE (kümenin ilk
 * üyesi) göre belirlenir; her kartı kümedeki HER üyeyle karşılaştırmak
 * zincirleme elemeye yol açardı (A~B, B~C ama A≁C iken C de düşerdi).
 * `dropDuplicateExpansionCards` de aynı nedenle yalnız ELDE TUTULANLARLA
 * karşılaştırır.
 */
interface Cluster<TCard extends DedupableCard> {
  representative: PlacedCard<TCard>;
  members: PlacedCard<TCard>[];
}

function isSameCard<TCard extends DedupableCard>(
  left: PlacedCard<TCard>,
  right: PlacedCard<TCard>
): boolean {
  // 1. BAŞLIK kuralı: aynı başlık, açıklamadan BAĞIMSIZ olarak tekrardır.
  if (isSameTitle(left.titleTokens, right.titleTokens)) return true;
  // 2. ORAN kuralı: içeriği ölçülemeyecek kadar ince kart hiçbir şeye
  // benzemez sayılır -- emin değilsen TUT. Bu, karşılaştırmanın İKİ tarafı
  // için de geçerlidir.
  if (left.tokens.length < MIN_COMPARABLE_TOKENS) return false;
  if (right.tokens.length < MIN_COMPARABLE_TOKENS) return false;
  return similarity(left.tokens, right.tokens) >= DUPLICATE_SIMILARITY;
}

/**
 * Çakışmayı hangi kart kazanır?
 *
 * ÖLÇÜT: DAHA AZ İÇERİK PARÇACIĞI TAŞIYAN BAŞLIK KAZANIR.
 *
 * GEREKÇE (ölçülen veriden): `At dayanıklılığı` ile `At dayanıklılığı
 * geliştirme` aynı şeydir; ikincisinin fazladan taşıdığı tek parçacık bir
 * GÖREV EKİDİR ("geliştirme", "geliştirmek"). Aynı şey `Eyer ve envanter` ile
 * `Eyer ve envanter geliştirmek` çiftinde de geçerlidir. Fazladan parçacık
 * yeni bir şey söylemiyorsa, fikri ADLANDIRAN başlık işi TARİF EDEN başlıktan
 * temizdir ve panoda kalması gereken odur. Bu, "görev dili" sorununu ayrı bir
 * filtre yazmadan çözer: `X geliştirme` zaten `X`in tekrarıdır.
 *
 * NEDEN KELİME LİSTESİ DEĞİL: "geliştirme / iyileştirme / eklemek..." diye bir
 * sözlük tutmak, listede olmayan her ekte sessizce yanılırdı ve dilin tamamını
 * kovalamak zorunda kalırdık. Parçacık saymak mekaniktir, bakım istemez ve
 * ölçülen iki vakayı da doğru çözer.
 *
 * NEDEN "İLK GELEN KAZANIR" DEĞİL: seçim yalnız bölüm sırasına bakılarak
 * yapılsaydı `At dayanıklılığı geliştirme` önce hazırlandığında panoda o
 * kalır, temiz başlık düşerdi. Kullanıcı aynı fikri bir kez ve en temiz
 * hâliyle görmeli -- hangi başlığın önce hazırlandığından bağımsız olarak.
 *
 * BU BİR ELEME ÖLÇÜTÜ DEĞİL, BİR SEÇİM ÖLÇÜTÜDÜR: buraya gelen kartların
 * tekrar olduğuna zaten `isSameCard` karar verdi. Yani "emin değilsen TUT"
 * asimetrisi burada işlemez; kümeden bir kart mutlaka kalacaktır, soru yalnız
 * HANGİSİ olduğudur.
 *
 * Eşitlikte sırasıyla: daha kısa başlık metni, sonra panoda önce gelen kart.
 * Son kural sonucu KARARLI kılar -- aynı girdi her zaman aynı çıktıyı verir.
 */
function isCleanerTitle<TCard extends DedupableCard>(
  candidate: PlacedCard<TCard>,
  current: PlacedCard<TCard>
): boolean {
  if (candidate.titleTokens.length !== current.titleTokens.length) {
    return candidate.titleTokens.length < current.titleTokens.length;
  }
  const candidateLength = candidate.card.title.trim().length;
  const currentLength = current.card.title.trim().length;
  if (candidateLength !== currentLength) return candidateLength < currentLength;
  if (candidate.sectionIndex !== current.sectionIndex) return candidate.sectionIndex < current.sectionIndex;
  return candidate.cardIndex < current.cardIndex;
}

/**
 * SAF: I/O yok, AI yok, rastgelelik yok, girdi mutasyonu yok. Kalan kartlar
 * kopyalanmaz, girdideki nesneler aynen geri verilir; çıktı dizileri yenidir.
 */
export function dropCrossSectionDuplicates<TCard extends DedupableCard>(
  sections: readonly ExpansionSectionCards<TCard>[]
): ExpansionSectionView<TCard>[] {
  const clusters: Cluster<TCard>[] = [];

  sections.forEach((section, sectionIndex) => {
    if (section.isExemptFromDedup) return;
    section.cards.forEach((card, cardIndex) => {
      const placed: PlacedCard<TCard> = {
        card,
        sectionIndex,
        cardIndex,
        titleTokens: contentTokens(card.title),
        tokens: contentTokens(`${card.title} ${card.description}`)
      };
      const existing = clusters.find(cluster => isSameCard(placed, cluster.representative));
      if (existing) existing.members.push(placed);
      else clusters.push({ representative: placed, members: [placed] });
    });
  });

  // Kazananlar bölüm+kart KONUMUYLA işaretlenir: aynı metni taşıyan iki ayrı
  // kart nesnesi (ölçümde tam olarak bu oluyor) kimlikle ayırt edilemezdi.
  const winners = new Set<string>();
  for (const cluster of clusters) {
    let winner = cluster.representative;
    for (const member of cluster.members) if (isCleanerTitle(member, winner)) winner = member;
    winners.add(`${winner.sectionIndex}::${winner.cardIndex}`);
  }

  return sections.map((section, sectionIndex) => {
    const cards = section.isExemptFromDedup
      ? [...section.cards]
      : section.cards.filter((_, cardIndex) => winners.has(`${sectionIndex}::${cardIndex}`));
    return {
      categoryId: section.categoryId,
      cards,
      isCoveredByOtherSections: !section.isExemptFromDedup && section.cards.length > 0 && cards.length === 0
    };
  });
}
