/**
 * Model çıktısında YAZI SİSTEMİ sapmasını mekanik olarak sınar.
 *
 * NEDEN: canlı ölçümde (Ollama qwen2.5:7b, fikir = "unityde bir at sistemi
 * yapmak istiyorum multiplayer olucak") fikir genişletme panosunun TÜM
 * kartları Çince geldi: "同步跳跃机制 · 实时伤害反馈 · 共享资源系统 ·
 * 多人竞技场 · 社交互动 ..." — sayfadaki CJK karakter sayısı ÖLÇÜLDÜ = 428.
 * İstemde `Türkçe yanıt ver.` satırı VARDI ve model uymadı. Aynı turda
 * `idea-foundation` çıktısı Türkçe kaldı; yani sapma tek görevde oluştu ama
 * göreve özgü bir kusur değil, modelin genel bir kayması.
 *
 * Bu yüzden ÇÖZÜM İSTEMİ SERTLEŞTİRMEK DEĞİLDİR: sertleşen istem zaten
 * uyulmayan bir cümleyi tekrarlar. `containsPromptInjection`,
 * `verifyIdeaClaim` ve `dropDuplicateExpansionCards` ile aynı yaklaşım
 * uygulanır: MODELE GÜVENME, ÇIKTIYI MEKANİK OLARAK SINA.
 *
 * KRİTİK AYRIM -- BURADA YALNIZ YAZI SİSTEMİNE BAKILIR, DİLE DEĞİL:
 *   - `Unity`, `multiplayer`, `WebSocket`, `API`, `MVP` Latin harflidir ve
 *     Türkçe teknik yazımda NORMALDİR; bunları avlamak ürünü kırar.
 *   - `İ Ğ Ü Ş Ö Ç ı ğ ü ş ö ç` Latin yazı sistemine aittir; Türkçe metin
 *     bu modülden hiçbir koşulda geçmemezlik etmez.
 *   - Emoji, rakam, noktalama ve simge HARF DEĞİLDİR; sayıma girmez.
 * Yakalanan şey Latin DIŞI yazı sistemleridir: Han (CJK), Hiragana,
 * Katakana, Hangul, Kiril, Arap, İbrani, Devanagari, Yunan. Türkçe bir
 * üründe bunların meşru sebebi yoktur -- tek istisna aşağıda ölçülmüştür.
 *
 * ASİMETRİ: bu modülün reddi bir SİLME değil bir YENİDEN DENEMEDİR
 * (bkz. ai/orchestrator.ts). Yanlış reddin bedeli bir tur gecikme, en kötü
 * hâlde mevcut deterministik yedeğe düşmektir -- yedek zaten dürüst bir
 * yoldur. Bu yüzden `expansion-card-dedup.ts`teki "emin değilsen TUT"
 * kuralı BURADA GEÇERSİZDİR; burada sıkı davranılabilir.
 *
 * AMA BİR SINIR VARDIR ve eşiğin varlık nedeni odur: kullanıcının kendi
 * fikri meşru olarak Latin dışı bir ÖZEL AD taşıyabilir ("小米 entegrasyonu",
 * "原神 tarzı kamera"). Model bunu her denemede DOĞRU biçimde yankılar; "tek
 * Latin dışı karakter yeter" kuralı böyle bir projeyi KALICI olarak yedeğe
 * mahkûm ederdi -- kendi kendini düzeltemeyen tek hata türü budur. Eşik bu
 * yüzden vardır ve bu yüzden orandır.
 */

/** Herhangi bir yazı sistemine ait harf. Rakam, emoji ve noktalama hariçtir. */
const LETTER = /\p{L}/u;

/** Latin yazı sistemi. Türkçe özel harflerin tamamı buraya girer. */
const LATIN_LETTER = /\p{Script=Latin}/u;

/**
 * Ölçüme girebilmek için gereken en az Latin dışı HARF sayısı.
 *
 * ÖLÇÜLEN AYRIM: yukarıdaki canlı partide en kısa sapmış başlık "社交互动"
 * ve "动态事件" = 4 harftir; eşik bunları KAÇIRMAMALIDIR. Öte yandan meşru
 * Latin dışı özel adlar kısadır: 小米 (2), 原神 (2), 王者荣耀 (4). Kapı 4'e
 * konur: iki-üç harflik bir ad tek başına asla sapma sayılmaz, dört harften
 * itibaren oran kuralı devreye girer ve adı Türkçe bağlamı korur.
 */
const MIN_NON_LATIN_LETTERS = 4;

/**
 * Bir metnin sapmış sayılması için Latin dışı harflerin TÜM harflere oranı.
 *
 * ÖLÇÜLEN BANTLAR:
 *   - sapmış metinler (yukarıdaki on başlığın tamamı ve açıklamaları): 1.00
 *     -- içlerinde tek Latin harfi yoktur.
 *   - meşru yankı bandı (özel ad + Türkçe bağlam):
 *     "小米 entegrasyonu için ağ katmanı" = 0.08, "原神 tarzı bir kamera
 *     kontrolü ekle" = 0.08, en kötü hâl "王者荣耀 modu" = 0.50.
 * Aradaki boşluk [0.50, 1.00] geniştir. Eşik boşluğun İÇİNE, meşru banda
 * yakın konur (0.60): sapmayı kaçırmamak kadar, meşru adı kalıcı olarak
 * reddetmemek de gerekir. `expansion-card-dedup.ts` eşiği bilinçli olarak
 * TERS yöne yaslar; oradaki asimetri (kaybolan fikir) buradakinden farklıdır.
 */
const NON_LATIN_DOMINANCE = 0.6;

/**
 * Oran kuralının SEYRELTTİĞİ durumu yakalayan ikinci kural: kesintisiz
 * Latin dışı harf dizisinin uzunluğu.
 *
 * NEDEN GEREKLİ: uzun ve çoğunlukla Türkçe bir açıklamanın içine gömülü
 * Çince bir yan cümle (20 harf / 200 harf) oranı 0.09'a düşürür ve oran
 * kuralından geçer; oysa kullanıcı ekranda Çince bir cümle görür. Diziyi
 * yalnız bir LATİN HARFİ böler: boşluk ve noktalama bölmez, çünkü CJK
 * metninde zaten boşluk yoktur ve "同步 跳跃 机制" tek bir ibaredir.
 *
 * SINIR (bilinçli): 8 harften uzun meşru bir özel ad -- örneğin uzun bir
 * katakana çevriyazımı -- bu kurala takılır. Kabul edilir, çünkü bedeli bir
 * yeniden denemedir ve tek karakter kuralının aksine oran kuralı böyle bir
 * adı taşıyan Türkçe cümleyi zaten geçirir.
 */
const NON_LATIN_RUN_LIMIT = 8;

/** İç içe çıktıda raporlanacak en fazla alan yolu; onarım istemini şişirmemek için. */
const MAX_REPORTED_PATHS = 6;

/**
 * Metin Latin dışı bir yazı sistemine SAPMIŞ mı?
 *
 * SAF: I/O yok, AI yok, rastgelelik yok, girdi mutasyonu yok. Modül
 * düzeyindeki iki düzenli ifade `g` bayrağı TAŞIMAZ; `lastIndex` durumu
 * olmadığı için çağrılar birbirini etkilemez.
 */
export function containsNonLatinScript(value: string): boolean {
  const text = typeof value === 'string' ? value : String(value ?? '');
  let latinLetters = 0;
  let nonLatinLetters = 0;
  let currentRun = 0;
  let longestRun = 0;

  for (const character of text) {
    if (!LETTER.test(character)) continue;
    if (LATIN_LETTER.test(character)) {
      latinLetters += 1;
      currentRun = 0;
      continue;
    }
    nonLatinLetters += 1;
    currentRun += 1;
    if (currentRun > longestRun) longestRun = currentRun;
  }

  // Ölçülemeyecek kadar az Latin dışı harf: meşru bir özel addan ayırt
  // edilemez, sapma sayılmaz.
  if (nonLatinLetters < MIN_NON_LATIN_LETTERS) return false;
  if (longestRun >= NON_LATIN_RUN_LIMIT) return true;
  return nonLatinLetters / (nonLatinLetters + latinLetters) >= NON_LATIN_DOMINANCE;
}

/**
 * Görev çıktısındaki SAPMIŞ metin alanlarının yollarını verir (örn.
 * `cards.0.title`). Boş dizi "sapma yok" demektir.
 *
 * Yalnız DEĞERLERE bakılır; anahtarlar şemadan gelir, modelden değil.
 * Sayı, boolean ve null alanlar yazı sistemi taşımaz, atlanır.
 *
 * SAF: girdiyi okur, kopyalamaz, DEĞİŞTİRMEZ; her zaman yeni bir dizi döner.
 */
export function findNonLatinScriptPaths(output: unknown): string[] {
  const paths: string[] = [];

  const walk = (value: unknown, path: string): void => {
    if (paths.length >= MAX_REPORTED_PATHS) return;
    if (typeof value === 'string') {
      if (containsNonLatinScript(value)) paths.push(path || '(kök)');
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, path ? `${path}.${index}` : String(index)));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        walk(item, path ? `${path}.${key}` : key);
      }
    }
  };

  walk(output, '');
  return paths;
}
