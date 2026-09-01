/**
 * Emir kipiyle yazılmış -- yani FİKİR değil GÖREV gibi yazılmış -- genişletme
 * kartlarını eler.
 *
 * NEDEN: canlı ölçümde (qwen2.5:7b, fikir = "unityde bir at sistemi yapmak
 * istiyorum multiplayer olucak") kartların açıklamaları bir geliştiriciye
 * verilmiş iş tanımı gibi çıktı: "At yarışı için farklı şablonları
 * OLUŞTURUN.", "Oyuncuların atlarına etkileşim kurabilecek araçlar
 * OLUŞTURUN." Kullanıcının istediği bu değildi; kendi sözüyle "at sistemine
 * health, stamina, at sürme, at envanteri gibi şeyler eklenecek" -- yani bir
 * ŞEY (isim), bir GÖREV (fiil) değil.
 *
 * İSTEM NEDEN YETMİYOR: bu oturumda dört kez ölçüldü (uydurma, tekrar, kota,
 * Çince) -- istem doğru yazıldığı hâlde 7B model uymadı. İstem düzeltmesi
 * (bkz. ai/tasks/idea-expansion.ts) ilk savunmadır; bu modül son savunmadır.
 *
 * ASİMETRİ -- EMİN DEĞİLSEN TUT: yanlış eleme kullanıcıdan GERÇEK bir öneriyi
 * gizler ve kullanıcı onu hiç göremez; yanlış tutma yalnız kötü yazılmış bir
 * kart gösterir ve kullanıcı onu görmezden gelebilir. Yön
 * `expansion-card-dedup.ts`teki asimetriyle AYNIDIR ve
 * `foundation-idea-claim.ts`tekinin tersidir (orada sınırdaki vaka düşürülür,
 * çünkü orada bedel kullanıcının güvenidir).
 *
 * BAŞLIK DA ÖLÇÜLÜR (bkz. aşağıda TASK_TONE_VERBS). Önceki sürüm yalnız
 * açıklamaya bakıyordu ve gerekçesi "başlıktaki ihlal ad-fiildir, mekanik bir
 * ek kuralıyla ayrılamaz" idi. Canlı ölçüm bunu çürüttü: dokuz başlıktan
 * dokuzu ad-fiildi ("...geliştirme", "...implemente etme"). Ayrım gerçekten de
 * EKTE değildir -- ama FİİLDE mekaniktir ve kapalı bir liste ile kesin
 * ayrılabilir. Ayrıntı aşağıda.
 */

/** Ölçüm bu iki alana bakar; kart tipi bundan bağımsızdır. */
export interface ToneCheckableCard {
  title: string;
  description: string;
}

export interface ExpansionToneResult<TCard> {
  /** Kalan kartlar; girdi sırasında ve girdiyle AYNI nesneler. */
  cards: TCard[];
  /** Emir kipiyle yazıldığı için elenen kart sayısı. */
  commandToneCount: number;
}

/**
 * Türkçe 2. çoğul emir eki dört ünlü uyumu biçiminde görünür. Nezaket biçimi
 * (-iniz/-ınız/-unuz/-ünüz) da aynı kiptir ve aynı şekilde elenir.
 */
const IMPERATIVE_SUFFIXES = ['in', 'ın', 'un', 'ün'];
const FORMAL_IMPERATIVE_SUFFIXES = ['iniz', 'ınız', 'unuz', 'ünüz'];

/**
 * Büyük ünlü uyumu: ekin ünlüsü gövdenin SON ünlüsüne bağlıdır. Uymayan
 * kelime çekimli bir Türkçe fiil değildir (çoğu zaman alıntı bir isimdir:
 * "vitamin", "kabin"). Uyum tutmuyorsa kart KORUNUR.
 */
const HARMONY: Record<string, string> = {
  a: 'ı', ı: 'ı',
  e: 'i', i: 'i',
  o: 'u', u: 'u',
  ö: 'ü', ü: 'ü'
};

const VOWELS = new Set(Object.keys(HARMONY));

/**
 * Ek atıldıktan sonra geriye kalması gereken en kısa gövde.
 *
 * NEDEN 3: iki harflik gövdeler bu metinlerde neredeyse her zaman isim
 * kökleridir -- "oy|un", "uz|un", "iç|in", "at|ın" (iyelik). İki harflik
 * GERÇEK fiil kökleri ("ye-", "de-", "ko-") ise 2. çoğulda kaynaştırma y'si
 * alır ve gövde zaten üç harfe çıkar: "yiyin", "deyin", "koyun". Yani bu kapı
 * hiçbir gerçek emri düşürmez, yalnız isimleri korur.
 */
const MIN_VERB_STEM_LENGTH = 3;

/**
 * DURAK LİSTESİ -- emir ekiyle AYNI harflerle biten ama emir OLMAYAN
 * kelimeler.
 *
 * Yukarıdaki iki mekanik kural (gövde uzunluğu + ünlü uyumu) bunların bir
 * kısmını zaten korur ("için" -> gövde "iç", 2 harf; "oyun" -> "oy"). Ama üç
 * harflik gövdesi olup uyumu da tutan bir kalıntı vardır ve onlar ancak elle
 * sayılarak korunabilir:
 *   - sıfat/zarf: "derin", "serin", "yakın", "bütün", "kalın", "olgun"
 *   - isim: "burun", "boyun", "koyun", "tütün", "düğün", "yayın", "altın",
 *     "kurşun", "gelin", "benzin"
 *   - zaman zarfı: "yarın", "bugün", "dün"
 *   - zamir iyeliği: "bunun", "şunun", "onun", "kimin", "neyin"
 *   - "düşün": 2. TEKİL emirdir, 2. çoğul değil. Ürünün kendi arayüz dili
 *     2. tekil kullanır ("ekle", "yaz"); kart açıklamasında beklenmez ama
 *     asimetri gereği ELENMEZ -- "düşün" aynı zamanda sık bir yan cümle
 *     kelimesidir ve yanlış elemenin bedeli daha ağırdır.
 * Liste kapalı ve küçüktür; büyütmek elemeyi zayıflatır ama ASLA yanlış
 * elemeye yol açmaz -- doğru yöndeki hata budur.
 */
const NOT_IMPERATIVE = new Set([
  'için', 'gibi', 'bütün', 'üzerin', 'ilerin', 'derin', 'serin', 'yakın',
  'uzun', 'oyun', 'düşün', 'kalın', 'olgun', 'yorgun', 'dolgun', 'memnun',
  'burun', 'boyun', 'koyun', 'tütün', 'düğün', 'yayın', 'sayın', 'altın',
  'kurşun', 'gelin', 'benzin', 'ekin', 'akın', 'satın', 'yarın', 'bugün',
  'dün', 'gün', 'bunun', 'şunun', 'onun', 'kimin', 'neyin',
  'beyin', 'metin', 'vitrin', 'türbin', 'motorin', 'perçin', 'kabin'
]);

/**
 * 3. TEKİL İSTEK KİPİ -- "-sın / -sin / -sun / -sün".
 *
 * ÖLÇÜLDÜ (tests/e2e/idea-expansion-board.spec.ts sahte kartları): "Sürüş
 * geçmişi buluta gitmeden telefonda SAKLANSIN.", "... ayrı bir izin
 * SORULSUN.", "Kullanıcı tüm sürüş verisini tek adımda SİLEBİLSİN." Bunların
 * hepsi ürün hakkında bir DİLEKTİR ve tam olarak istenen kart dilidir; hiçbiri
 * geliştiriciye verilmiş bir emir değildir. Yalnız ek harflerine bakan bir
 * kural üçünü de eler ve panoyu boşaltır -- e2e kapısı bunu yakaladı.
 *
 * Ayırt edici işaret: istek kipinde ekin önünde HER ZAMAN bir "s" durur.
 * Gövdesi "s" ile biten gerçek 2. çoğul emirler ("kesin", "basın", "susun")
 * bu yüzden korunur -- kaybedilen budur ve bilinçlidir: üçü de kart
 * metinlerinde nadirdir, ikisi ("kesin", "basın") zaten sık birer isim/sıfattır
 * ve asimetri gereği emin değilsek TUTARIZ.
 */
const OPTATIVE_MARKER = 's';

/**
 * Türkçe-duyarlı küçültme zorunludur: "I" -> "ı", "İ" -> "i". Varsayılan
 * küçültme bu iki harfi yanlış eşler ve "OLUŞTURUN" gibi büyük harfle yazılmış
 * bir emri kaçırır.
 */
function normalizeWord(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFC')
    .replace(/[^0-9a-zçğıiöşü]+/g, '');
}

function lastVowel(stem: string): string | null {
  for (let index = stem.length - 1; index >= 0; index -= 1) {
    if (VOWELS.has(stem[index])) return stem[index];
  }
  return null;
}

/**
 * Tek bir kelime 2. çoğul emir kipinde mi?
 *
 * Dört kapı da geçilmelidir: ek + gövde uzunluğu + istek kipi değil + ünlü
 * uyumu; ve kelime durak listesinde OLMAMALIDIR.
 */
function isImperativeWord(word: string): boolean {
  if (!word) return false;
  if (NOT_IMPERATIVE.has(word)) return false;

  const formal = FORMAL_IMPERATIVE_SUFFIXES.find(suffix => word.endsWith(suffix));
  const suffix = formal || IMPERATIVE_SUFFIXES.find(item => word.endsWith(item));
  if (!suffix) return false;

  const stem = word.slice(0, word.length - suffix.length);
  if (stem.length < MIN_VERB_STEM_LENGTH) return false;
  if (stem.endsWith(OPTATIVE_MARKER)) return false;

  const vowel = lastVowel(stem);
  if (!vowel) return false;
  return HARMONY[vowel] === suffix[0];
}

/**
 * KONUM ÖNEMLİDİR. Cümlenin SONUNDAKİ fiil ile ortadaki iyelik eki aynı
 * harflerle biter ama farklı şeylerdir:
 *   - "... araçlar oluşturun."   -> cümle sonunda, YÜKLEM: emir.
 *   - "atın hareketi eşitlenir." -> "atın" cümlenin ORTASINDA, tamlayan:
 *     emir değil. Yüklem "eşitlenir"dir ve zaten emir ekiyle bitmez.
 * Türkçede tamlayan ("atın", "sistemin", "oyuncunun") kendinden sonra bir ad
 * ister, yani cümlenin sonunda duramaz. Bu yüzden yalnız cümle sonuna bakmak,
 * iyelik eklerini tek başına ve GÜVENİLİR biçimde korur.
 *
 * Cümle sınırı yalnız gerçek bitiricilerdir. Virgülde BÖLÜNMEZ: "atın," gibi
 * bir tamlayan virgülden hemen önce durabilir ve orada bölmek yanlış elemeye
 * kapı açardı (emin değilsen TUT).
 */
const SENTENCE_BOUNDARY = /[.!?;\n\r…]+/;

/**
 * PARANTEZ İÇİ EK, EMİR FİİLİNİ CÜMLE SONU OLMAKTAN ÇIKARIR.
 *
 * ÖLÇÜLDÜ (aynı canlı koşu): "Atların hangi olaylara tepki vermesi gerektiğini
 * BELİRLEYİN (örneğin, rehin alınma, yarışma, ve diğer atlarla etkileşim)."
 * Yüklem "belirleyin"dir ve emirdir; ama arkasına yapıştırılan parantezli ek
 * yüzünden cümlenin son kelimesi "etkileşim" olur ve kural kaçırır.
 *
 * ÇÖZÜM KURALI DEĞİL GİRDİYİ DÜZELTİR: parantezli ek bir ARA SÖZDÜR, cümlenin
 * yüklemini taşımaz; atıldığında geriye kalan cümle özgün yüklemiyle biter.
 * Böylece "yalnız cümle sonuna bak" kuralı -- iyelik eklerini koruyan tek
 * güvenilir mekanizma -- olduğu gibi durur.
 *
 * Ek olarak parantez içindeki nokta ("(bkz. X)") sahte bir cümle sınırı
 * üretirdi; ayıklama bunu da ortadan kaldırır.
 *
 * KAPANMAMIŞ PARANTEZE DOKUNULMAZ: desen kapanışı ZORUNLU tutar. Yarım kalmış
 * bir parantezden sonrasını silmek cümlenin gerçek yüklemini yutabilir ve
 * yanlış elemeye yol açardı -- emin değilsek TUTARIZ.
 */
const PARENTHETICAL = /\([^()]*\)/g;

function stripParentheticals(text: string): string {
  return text.replace(PARENTHETICAL, ' ');
}

export function hasCommandTone(description: string): boolean {
  const text = stripParentheticals(String(description || ''));
  if (!text.trim()) return false;

  for (const sentence of text.split(SENTENCE_BOUNDARY)) {
    const words = sentence.trim().split(/\s+/);
    const last = normalizeWord(words[words.length - 1] || '');
    if (isImperativeWord(last)) return true;
  }
  return false;
}

/**
 * BAŞLIK: GELİŞTİRME FİİLİYLE BİTEN İŞ KALEMLERİ.
 *
 * ÖLÇÜLDÜ (aynı canlı koşu): "At hareket öncelikleri BELİRLEME", "Atın yorulma
 * mekanizması GELİŞTİRME", "... implemente ETME", "Rehine durumu takibini
 * GELİŞTİRMEK", "... sesler EKLEYİN". Dokuz başlık, dokuzu da bir geliştiriciye
 * verilmiş iş kalemi.
 *
 * -- EN KRİTİK TUZAK: EK DEĞİL, FİİL --
 * `-ma / -me` ekini toptan yasaklamak ürünün EN İYİ kartını siler:
 *   "Atı uzaktan ÇAĞIRMA | Oyuncular, atları oyunun belirli noktalarından
 *    uzaktan çağırabilirler."
 * `çağırma` da `-ma` ile biter. Fark ekte değil FİİLDEDİR:
 *   - `çağır-` OYUNCUNUN yaptığı şeydir  -> özellik, KORUNUR
 *   - `geliştir-` GELİŞTİRİCİNİN yaptığı şeydir -> görev, ELENİR
 * Bu yüzden kural kapalı ve DAR bir geliştirme/meta fiil listesine bağlıdır.
 *
 * -- LİSTEYE ALINANLAR VE GEREKÇELERİ --
 *   `geliştir` : ölçümde dört kez geçti; Türkçede yazılım üretiminin kendi
 *                adıdır ("geliştirme").
 *   `oluştur`  : açıklama sütununda ölçülen ihlalin ("oluşturun") ad-fiil
 *                karşılığı; aynı fiilin iki sütunda tutarlı ele alınması.
 *   `belirle`  : ölçümde geçti; bir şeyi "belirlemek" tasarım/karar eylemidir,
 *                oyuncunun oyun içinde yaptığı bir şey değildir.
 *   `ekle`     : ölçümde iki kez geçti ("...ekleme", "...ekleyin").
 *   `tanımla`  : `belirle` ile aynı türden saf tanımlama eylemi.
 *   `modelle`  : yalnız üretim eylemi; oyuncu bir şeyi "modellemez".
 *   `gerçekleştir` : "implement" karşılığı; oyun içi bir eylemi adlandırmaz.
 *
 * -- BİLEREK DIŞARIDA BIRAKILANLAR --
 *   `yönet`  : "Atları yönetme" OYUNCUNUN yaptığı şey olabilir. Ölçümde
 *              başlık-sonu olarak da geçmedi ("...yönetimi geliştirmek"te
 *              yüklem `geliştir`dir). Emin değiliz -> TUTUYORUZ.
 *   `kullan`, `seç`, `topla`, `çağır`, `besle`, `sür` : hepsi oyuncu eylemi.
 *   `uygula`, `entegre`, `optimize` : ölçümde hiç görülmedi; liste ancak
 *              ölçümle büyür.
 *
 * -- `ekle` RİSKİ, AÇIKÇA -- "Envantere eşya ekleme" bir oyuncu eylemi olabilir
 * ve bu kural onu eler. Bilinçli bir bedeldir: ölçümde iki kez ihlal olarak
 * görüldü, hiç meşru kullanımı görülmedi. Meşru kullanımı ölçülürse liste
 * KÜÇÜLTÜLMELİDİR -- doğru yöndeki hata budur.
 */
const TASK_TONE_VERBS = [
  'geliştir', 'oluştur', 'belirle', 'ekle', 'tanımla', 'modelle', 'gerçekleştir'
];

/**
 * Ad-fiil (`-ma/-me`) ve mastar (`-mak/-mek`). Ünlü uyumunun tuttuğu biçim
 * zaten tektir; dördü de üretilip TAM EŞLEŞME aranır. Tam eşleşme kasıtlıdır:
 * `endsWith` ile "beklenmeme" gibi türemiş biçimler de yakalanırdı ve liste
 * sessizce genişlerdi.
 */
const VERBAL_NOUN_SUFFIXES = ['ma', 'me', 'mak', 'mek'];

const TASK_TONE_FORMS = new Set(
  TASK_TONE_VERBS.flatMap(verb => VERBAL_NOUN_SUFFIXES.map(suffix => verb + suffix))
);

/**
 * BİLEŞİK FİİL: "implemente etme". Yüklem "et-"tir ve gövdesi iki harftir;
 * tek başına "etme" ölçülemez ("hareket etme" bir oyuncu eylemi olabilir).
 * Bu yüzden ölçülen şey ÖNCEKİ kelimedir: alıntı mühendislik fiilleri bir oyun
 * özelliğini asla adlandırmaz.
 */
const AUXILIARY_VERB_FORMS = new Set(['etme', 'etmek']);
const TASK_TONE_AUXILIARY_STEMS = new Set(['implemente']);

/**
 * Başlık bir İŞ KALEMİ gibi mi yazılmış?
 *
 * Üç koşul birlikte aranır:
 *   1. Fiil başlığın SON kelimesi olmalı. Türkçede ad-fiil başta ya da ortada
 *      durduğunda tamlayandır ve başlık yine bir isim öbeğidir: "YARIŞMA
 *      mekanizması" korunur, "... geliştirME" elenir.
 *   2. Fiilden önce başka içerik bulunmalı ("X <fiil>" kalıbı). Tek kelimelik
 *      bir başlık zaten anlamsızdır; onu elemek kural için kanıt sağlamaz.
 *   3. Fiil kapalı listede olmalı (ya da 2. çoğul emir kipinde -- "...ekleyin"
 *      ölçümde geçti; açıklama sütunundaki kural başlığa aynen uygulanır ve
 *      aynı gerekçeyle güvenlidir: cümle/başlık sonunda duran bir kelime
 *      iyelik eki taşıyamaz).
 *
 * ASİMETRİ -- EMİN DEĞİLSEN TUT: yön `expansion-card-dedup.ts` ve bu dosyanın
 * açıklama kuralıyla AYNIDIR. Yanlış eleme kullanıcıdan gerçek bir öneriyi
 * GİZLER; yanlış tutma yalnız kötü yazılmış bir kart gösterir.
 */
export function hasTaskToneTitle(title: string): boolean {
  const text = stripParentheticals(String(title || ''));
  if (!text.trim()) return false;

  const words = text.trim().split(/\s+/).map(normalizeWord).filter(Boolean);
  if (words.length < 2) return false;

  const last = words[words.length - 1];
  if (TASK_TONE_FORMS.has(last)) return true;
  if (AUXILIARY_VERB_FORMS.has(last)) {
    return TASK_TONE_AUXILIARY_STEMS.has(words[words.length - 2]);
  }
  return isImperativeWord(last);
}

/**
 * SAF: I/O yok, AI yok, rastgelelik yok, girdi mutasyonu yok. Kalan kartlar
 * kopyalanmaz, girdideki nesneler aynen geri verilir.
 *
 * PARTİYİ REDDETMEZ. Emir kipi bulunduğunda tüm turu düşürmek 7B modelde çoğu
 * turda `maxRepairAttempts`i tüketip başlangıç kartlarına düşürür ve ürün DAHA
 * KÖTÜ olur; bu yüzden kart TEK TEK elenir. Eleme sonucu kart sayısı düşerse
 * zaten var olan tamamlama turu devreye girer (bkz. idea-expansion-service.ts).
 *
 * İKİ SÜTUN, TEK SAYAÇ: başlık ve açıklama ayrı kurallarla ölçülür ama tek bir
 * `commandToneCount` üretir. Çağıran bu sayıyı yalnız "kaç kart eksildi"
 * sorusuna cevap olarak ve tamamlama turunu tetiklemek için kullanır;
 * kullanıcı açısından iki ihlal arasında fark yoktur.
 */
export function dropCommandToneExpansionCards<TCard extends ToneCheckableCard>(
  cards: readonly TCard[]
): ExpansionToneResult<TCard> {
  const kept = cards.filter(
    card => !hasTaskToneTitle(card.title) && !hasCommandTone(card.description)
  );
  return { cards: kept, commandToneCount: cards.length - kept.length };
}
