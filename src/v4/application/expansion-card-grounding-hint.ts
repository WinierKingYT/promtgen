import type { FoundationContext } from '../ai/context/context-builder.js';
import { MIN_COMPARABLE_TOKENS, contentTokens, similarity } from './expansion-card-dedup.js';

/**
 * E1 -- HAFİF bir güven sinyali, `model-strength-hint.ts` (A6) ile AYNI
 * ruhta: kartı YANLIŞ ilan etmez, "buraya bir bak" der. `IdeaExpansionBoard`
 * bunu var olan `pg-expansion-card-detail` ("Modelin tahmini") bloğunun
 * İÇİNE ekler; yeni bir CSS ailesi AÇMAZ (bkz. o dosyadaki not: bu blok ve
 * `pg-expansion-decisions`, üç aşama boyunca paylaşılan tek kart dili).
 *
 * DÜRÜSTLÜK KARARI -- A6 ile AYNI disiplin: YOKLUK bir İDDİA DEĞİLDİR.
 *   1. Proje ZEMİNSİZSE (`buildFoundationContext` `null` döner ya da hiç
 *      zeminli alan taşımıyorsa) hiçbir şey ÖLÇÜLEMEZ; `null` döner, arayüz
 *      hiçbir şey göstermez.
 *   2. Kartın kendi metni (başlık+açıklama) ya da temelin metni
 *      `MIN_COMPARABLE_TOKENS`in altında kalacak kadar İNCEyse örtüşme
 *      SAYILAMAZ; yine `null` -- ne "paylaşıyor" ne "paylaşmıyor" iddia
 *      edilir.
 *   3. Yalnız ikisi de ölçülebiliyorsa gerçek bir kıyas yapılır: hiç ortak
 *      kök yoksa ipucu döner.
 *
 * `contentTokens`/`similarity`/`MIN_COMPARABLE_TOKENS` -- ÜÇÜ de
 * `expansion-card-dedup.ts`ten PAYLAŞILIR: Türkçe çekim ayrımı (kök
 * eşleşmesi) orada zaten ölçülerek kurulmuş; aynı kelime çiftini burada
 * ikinci bir eşikle değerlendirmek aynı içeriği iki farklı kuralla yargılamak
 * olurdu.
 */
export function getExpansionCardGroundingHint(
  card: { title: string; description: string },
  foundation: FoundationContext | null
): string | null {
  if (!foundation || !foundation.fields.length) return null;

  const cardTokens = contentTokens(`${card.title} ${card.description}`);
  if (cardTokens.length < MIN_COMPARABLE_TOKENS) return null;

  const foundationTokens = foundation.fields.flatMap(field => contentTokens(field.text));
  if (foundationTokens.length < MIN_COMPARABLE_TOKENS) return null;

  if (similarity(cardTokens, foundationTokens) > 0) return null;

  return 'Bu kart, fikrin zeminli temeliyle (kendi sözlerinle kurduğun kısım) ortak kelime taşımıyor; bir göz atmak isteyebilirsin.';
}
