/**
 * Modelin `source:'idea'` iddiasını MEKANİK olarak sınar.
 *
 * NEDEN: canlı ölçümde (qwen2.5:7b, fikir = "unityde bir at sistemi yapmak
 * istiyorum multiplayer olucak") `summary` alanı 4/4 `source:'idea'` geldi ve
 * içinde fikirde HİÇ GEÇMEYEN şeyler vardı: "yarış", "savaş", "ekipman
 * ekleme", "atın rengi, büyüklüğü". Modelin `unknown`/`assumption` çıkışları
 * dürüst çalışıyor; güvenilmez olan `idea` İDDİASININ KENDİSİ. Yanlış etiket
 * etiketsizden KÖTÜDÜR: uydurmayı "bu senin fikrinden çıktı" diye sunar.
 *
 * FELSEFE: `containsPromptInjection` ile aynı -- modele güvenme, sına. Burada
 * yalnız DÜŞÜRME vardır: `idea` -> `assumption`. `assumption` ve `unknown`
 * asla YÜKSELTİLMEZ; model kendine güven puanı veremez.
 *
 * ASİMETRİ: emin değilsen DÜŞÜR. Yanlış düşürmenin bedeli fazladan bir
 * "Varsayım" rozeti; yanlış `idea`nın bedeli kullanıcının güveni. Bu yüzden
 * eşik temiz örneğe (3.00) uzağa değil YAKIN (3.5) konur: sınırdaki her vaka
 * düşer.
 *
 * SINIR: bu sözlüksel bir sınamadır, anlam bilmez. "at yarışı" gibi kısa ama
 * uydurma bir ekleme "at" çıpasıyla geçebilir. Amaç mükemmel tespit değil,
 * ölçülen ASIL hatayı -- kısa bir fikir cümlesinden koca bir paragraf uydurup
 * `idea` diye sunmayı -- mekanik olarak kesmektir.
 */

/**
 * Türkçe durak kelimeleri. Çekirdek liste `change-impact-service.ts`teki
 * STOP_WORDS ile aynı mantıkta: yalnız işlevsel kelimeler ve fikir cümlesinin
 * KALIP dolgusu ("... yapmak istiyorum") -- bunlar içerik taşımaz ve iki
 * tarafta da sayılırsa bütçeyi yapay biçimde şişirir.
 */
const STOP_WORDS = new Set([
  've', 'ile', 'bir', 'bu', 'şu', 'için', 'icin', 'olarak', 'gibi', 'daha',
  'çok', 'en', 'da', 'de', 'ki', 'ise', 'ya', 'veya', 'ama', 'ancak', 'ayrıca',
  'her', 'tüm', 'hem', 'yani', 'göre', 'kadar', 'üzere', 'sonra', 'önce',
  'var', 'yok', 'olan', 'olacak', 'oldu', 'olur', 'olmak', 'olması',
  'artık', 'bunu', 'buna', 'bunun', 'mi', 'mı', 'mu', 'mü',
  'istiyorum', 'istiyor', 'isterim', 'yap', 'yapmak', 'yapmayı',
  'ekle', 'eklemek', 'olsun', 'olmalı',
  'the', 'and', 'for', 'with'
]);

/** Kök sayılabilecek en kısa parça. "at" gerçek bir köktür, 2'nin altına inilmez. */
const MIN_ROOT_LENGTH = 2;

/**
 * Bir köke eklenebilecek en uzun çekim zinciri. Türkçe sondan eklemelidir:
 * "at" -> "atların" (5), "atlarıyla" (7). 7 bu iki gerçek vakayı kapsar;
 * daha uzun tutmak "at" ile "atmosferindeki" gibi alakasız kelimeleri
 * eşleştirmeye başlar.
 */
const MAX_SUFFIX_LENGTH = 7;

/**
 * İddia metninin içerik hacmi, fikrin içerik hacminin en çok bu KATI olabilir.
 *
 * Gerekçe -- fikir metni kanıtın TAMAMIDIR: `source:'idea'` "bunun karşılığı
 * fikirde var" demektir, dolayısıyla iddia fikirden daha fazla ÖZGÜL içerik
 * taşıyamaz. Bir miktar yeniden ifade etme ve açma meşrudur (aynı şeyi daha
 * uzun anlatmak), ama kat kat büyümek kanıtın taşıyamayacağı bir iddiadır.
 *
 * Ölçülen değerler (fikir içerik hacmi = 33 karakter):
 *   - temiz turn-2 metni ("at hareketlerini ve becerilerini simüle etmek...
 *     birden fazla oyuncu aynı anda")        -> 3.00
 *   - kirli metin ("...yarış ve savaş...
 *     atların rengi, büyüklüğü...")          -> 5.03
 * Eşik 3.5: temiz vaka %14 boşlukla geçer, kirli vaka %44 boşlukla düşer.
 * Eşik bilerek temiz vakaya YAKIN durur (asimetri: sınırdaki vaka düşer).
 */
const CLAIM_EXPANSION_LIMIT = 3.5;

/** Neden düşürüldüğü -- yalnız kayıt/hata ayıklama içindir, kullanıcıya çıkmaz. */
export type IdeaClaimRejection = 'anchor-yok' | 'butce-asimi';

export interface IdeaClaimVerdict {
  /** true: iddia fikirle mekanik olarak bağdaşıyor, `idea` etiketi korunur. */
  grounded: boolean;
  reason: IdeaClaimRejection | null;
}

/**
 * Metni Türkçe-duyarlı biçimde içerik parçacıklarına ayırır.
 * `toLocaleLowerCase('tr-TR')` zorunludur: "I" -> "ı", "İ" -> "i". Varsayılan
 * küçültme bu iki harfi yanlış eşler ve meşru metinleri haksız yere düşürür.
 */
function contentTokens(value: string): string[] {
  const normalized = String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFC')
    .replace(/[^0-9a-zçğıiöşü]+/g, ' ')
    .trim();
  if (!normalized) return [];
  const seen = new Set<string>();
  for (const token of normalized.split(/\s+/)) {
    if (token.length < MIN_ROOT_LENGTH) continue;
    if (STOP_WORDS.has(token)) continue;
    seen.add(token);
  }
  return [...seen];
}

/**
 * İki parçacık aynı köke bağlanıyor mu? Naif tam-kelime eşleşmesi Türkçede
 * meşru ifadeleri düşürür: fikirdeki "at", metindeki "atların"/"atları"/"ata"
 * ile aynı şeydir. Bu yüzden kısa olan uzunun ÖNEKİ ise ve aradaki fark bir
 * çekim zinciri kadarsa eşleşme sayılır.
 */
function sharesRoot(left: string, right: string): boolean {
  if (left === right) return true;
  const [short, long] = left.length <= right.length ? [left, right] : [right, left];
  if (short.length < MIN_ROOT_LENGTH) return false;
  if (!long.startsWith(short)) return false;
  return long.length - short.length <= MAX_SUFFIX_LENGTH;
}

/** İçerik hacmi: parçacıkların karakter toplamı. Noktalama ve dolgu sayılmaz. */
function contentVolume(tokens: string[]): number {
  return tokens.reduce((total, token) => total + token.length, 0);
}

/**
 * SAF: I/O yok, AI çağrısı yok, rastgelelik yok, girdi mutasyonu yok. Aynı
 * girdi her zaman aynı kararı verir.
 *
 * @param claimText  modelin `source:'idea'` diyerek yazdığı metin
 * @param ideaText   kullanıcının kendi fikir metni -- kanıtın TAMAMI
 */
export function verifyIdeaClaim(claimText: string, ideaText: string): IdeaClaimVerdict {
  const ideaTokens = contentTokens(ideaText);
  const claimTokens = contentTokens(claimText);

  // Fikirde hiç içerik yoksa hiçbir iddia doğrulanamaz -- kanıt yokken
  // "fikirden çıktı" demek tam da engellemek istediğimiz şeydir.
  if (ideaTokens.length === 0 || claimTokens.length === 0) {
    return { grounded: false, reason: 'anchor-yok' };
  }

  // 1) ÇIPA: iddia, fikirle tek bir özgül kelimeyi bile paylaşmıyorsa
  //    "fikirde bunun karşılığı var" iddiası mekanik olarak boştur.
  const hasAnchor = claimTokens.some(claimToken =>
    ideaTokens.some(ideaToken => sharesRoot(claimToken, ideaToken)));
  if (!hasAnchor) {
    return { grounded: false, reason: 'anchor-yok' };
  }

  // 2) BÜTÇE: iddia fikrin taşıyabileceğinden kat kat fazla özgül içerik
  //    taşıyorsa fazlası fikirden GELMİYOR demektir.
  if (contentVolume(claimTokens) > contentVolume(ideaTokens) * CLAIM_EXPANSION_LIMIT) {
    return { grounded: false, reason: 'butce-asimi' };
  }

  return { grounded: true, reason: null };
}
