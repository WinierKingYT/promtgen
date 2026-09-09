/**
 * A6 -- soyut kategorilerde küçük/yerel model uyarısı.
 *
 * ÖLÇÜLEN SORUN (canlı test, `qwen2.5:7b`): küçük yerel modeller soyut/derin
 * kategorilerde (ör. bir "Paylaşım Modeli" ya da "Para modeli" gibi iş
 * modeli sorusu) somut kategorilere göre GÖZLE GÖRÜLÜR biçimde daha çok
 * hayal görüyor. Bu bir engel DEĞİL, bir ipucudur -- otomatik sağlayıcı
 * değişimi kapsam dışıdır.
 *
 * DÜRÜSTLÜK KARARI -- üç girdiden yalnız BİRİ güvenle ölçülebilir:
 *
 * 1. "Yerel" ÖLÇÜLEBİLİR: `provider-settings.ts`teki `offline` ("Yerel
 *    Akıllı Motor") ve `ollama` ("Yerel model") sağlayıcı kimlikleri budur.
 *    Bu modül İPUCUNUN ANA KOŞULUNU buraya dayandırır.
 * 2. "Küçük" GÜVENLE ÖLÇÜLEMEZ: `qwen2.5:7b` etiketinde parametre sayısı
 *    var, ama Ollama'nın kendi varsayılanı `llama3.2`de YOK. Etiketten
 *    ayrıştırma bazen tutar bazen sessizce tutmaz -- bu yüzden ayrıştırma
 *    SONUCU asla ipucunun gösterilip gösterilmeyeceğine karar VERMEZ, yalnız
 *    metni zenginleştirir (bkz. `parseModelParamBillions`).
 * 3. "Soyut" bir ÖLÇÜM değil, bir YARGIDIR: kategori sözlüğündeki hangi
 *    kategorilerin soyut sayıldığı `idea-expansion/categories.ts`te
 *    `isAbstract` alanıyla AÇIKÇA işaretlenir (yalnız kapalı CORE kümesinde;
 *    pack/AI eksenleri hiç işaretlenmez -- bu bir YOKLUK, "somut" iddiası
 *    DEĞİL). Bu modül o bayrağı üretmez, yalnız okur.
 */

const LOCAL_PROVIDER_IDS: ReadonlySet<string> = new Set(['offline', 'ollama']);

/** Sağlayıcı `provider-settings.ts` anlamında YEREL mi? Tek güvenilir girdi budur. */
export function isLocalProvider(providerId: string): boolean {
  return LOCAL_PROVIDER_IDS.has(providerId);
}

/**
 * Model etiketinden milyar cinsinden parametre sayısını ayrıştırmayı DENER.
 *
 * SESSİZCE BAŞARISIZ OLUR: `llama3.2` gibi sayı taşımayan bir etikette
 * `null` döner, hata fırlatmaz. Çağıran taraf bu `null`ı asla "uyarıyı
 * kapat" olarak okumamalı -- bkz. `getModelStrengthHint`.
 */
export function parseModelParamBillions(model: string): number | null {
  const match = String(model || '').match(/(\d+(?:\.\d+)?)\s*b\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Bu eşiğin altı "küçük" sayılır -- bir ölçüm değil, mesaj metnini zenginleştirmek için seçilmiş bir sınır. */
const SMALL_MODEL_MAX_BILLION_PARAMS = 14;

/**
 * Kategori + sağlayıcı ayarına göre ipucu metni, ya da hiçbiri.
 *
 * ANA KOŞUL yalnız "yerel sağlayıcı + işaretli soyut kategori"dir. Boyut
 * ayrıştırması yalnız METNİ zenginleştirir: ayrıştırılamayan (`null`) ya da
 * eşiğin üstünde çıkan bir değer, ipucuyu ASLA bastırmaz -- yalnız modelin
 * adını/boyutunu anmayan daha genel bir cümle döner.
 */
export function getModelStrengthHint(
  settings: { providerId: string; model: string },
  category: { isAbstract?: true }
): string | null {
  if (!isLocalProvider(settings.providerId)) return null;
  if (category.isAbstract !== true) return null;

  const billions = parseModelParamBillions(settings.model);
  const isKnownSmall = billions !== null && billions <= SMALL_MODEL_MAX_BILLION_PARAMS;

  return isKnownSmall
    ? `Bu kategori daha soyut; "${settings.model}" gibi küçük yerel modeller (~${billions}B parametre) burada daha çok hayal görebilir. Önerileri dikkatli gözden geçir.`
    : 'Bu kategori daha soyut; yerel modeller burada daha çok hayal görebilir. Önerileri dikkatli gözden geçir.';
}
