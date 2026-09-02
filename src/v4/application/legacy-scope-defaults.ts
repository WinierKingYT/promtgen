/**
 * KALDIRILMIŞ KAPSAM VARSAYILANLARININ TARİHSEL KAYDI.
 *
 * `38bc893` ve `06d2541` commitleri, sistemin kullanıcı adına UYDURDUĞU kapsam
 * varsayılanlarını kaynaktan kaldırdı. Ölçülen somut zarar: kullanıcı
 * "multiplayer olucak" yazmıştı, sistem "Bulut senkronizasyonu ve çok
 * kullanıcılı işbirliği"ni MVP DIŞINDA yazmıştı — fikrin çekirdek özelliğini
 * sessizce kapsam dışına atmıştı.
 *
 * Yeni projeler artık temiz doğuyor. Ama o commitlerden ÖNCE oluşturulmuş
 * belgeler uydurmayı hâlâ taşıyor. Bu modül yalnızca TESPİT eder; belgeye
 * dokunmaz, silmez, düzeltmez. Kararı kullanıcı verir.
 *
 * ————————————————————————————————————————————————————————————————————————
 * KRİTİK — bu liste bir TARİHSEL KAYITTIR, canlı bir varsayılan değildir.
 *
 * ASLA yeni madde EKLENMEZ. Yeni bir kapsam varsayılanı eklemek gerektiğini
 * düşünüyorsan sorun varsayılanın kendisidir, bu liste değil: sistem kullanıcı
 * adına kapsam kararı vermez (bkz. tests/v4/concept-scope-honesty.test.ts).
 *
 * Bu liste yalnız KÜÇÜLEBİLİR — bir gün hiçbir kullanıcı belgesinde bu
 * satırlar kalmadığında.
 * ————————————————————————————————————————————————————————————————————————
 */

/** `idea-discussion-service.ts` · `confirmedFeatures` şablonları (38bc893 öncesi). */
const DISCUSSION_CONFIRMED_FEATURE_DEFAULTS = [
  'Temel oynanış döngüsü',
  'Oyuncu etkileşimi ve durum yönetimi',
  'Temel ekran ve navigasyon akışı',
  'Yerel veri saklama',
  'Temel kullanıcı arayüzü',
  'Veri modeli ve ana iş akışı',
  'Temel kullanıcı akışı',
  'Çekirdek veri ve iş mantığı'
] as const;

/** `idea-discussion-service.ts` · koşulsuz `outOfScope` sabiti (38bc893 öncesi). */
const DISCUSSION_OUT_OF_SCOPE_DEFAULTS = [
  'İleri seviye raporlama ve optimizasyon',
  'Bulut senkronizasyonu ve çok kullanıcılı işbirliği'
] as const;

/** `deterministic-idea-planning.ts` · `ConceptProfile.features` (06d2541 öncesi). */
const PROFILE_FEATURE_DEFAULTS = [
  'Oyuncu kontrolü ve temel mekanikler',
  'Sahne ve oyun döngüsü',
  'Temel sayfa ve kullanıcı akışları',
  'Veri modeli ve API katmanı',
  'Temel ekran navigasyonu',
  'Yerel veri ve API entegrasyonu',
  'Model çağrı ve prompt yönetimi',
  'Yanıt doğrulama ve hata yönetimi',
  'Çekirdek kullanıcı akışı',
  'Temel veri ve entegrasyon katmanı'
] as const;

/** `deterministic-idea-planning.ts` · `ConceptProfile.outOfScope` (38bc893 öncesi). */
const PROFILE_OUT_OF_SCOPE_DEFAULTS = [
  'Derin NPC davranışı',
  'İleri shader optimizasyonu',
  'Gelişmiş analitik',
  'Mikroservis ayrıştırması',
  'Gelişmiş çakışma çözümü',
  'Cihaz içi ML',
  'Özel model eğitimi',
  'Çok modlu giriş',
  'İleri ölçekleme',
  'Gelişmiş raporlama'
] as const;

/** Dondurulmuş tarihsel kayıt — yalnız okunur, yalnız küçülebilir. */
export const REMOVED_SCOPE_DEFAULTS: readonly string[] = Object.freeze([
  ...DISCUSSION_CONFIRMED_FEATURE_DEFAULTS,
  ...DISCUSSION_OUT_OF_SCOPE_DEFAULTS,
  ...PROFILE_FEATURE_DEFAULTS,
  ...PROFILE_OUT_OF_SCOPE_DEFAULTS
]);

const REMOVED_SCOPE_DEFAULT_SET: ReadonlySet<string> = new Set(REMOVED_SCOPE_DEFAULTS);

/**
 * Bir satırın kaldırılmış varsayılanlardan biri olup olmadığını söyler.
 *
 * Ölçüt TAM EŞLEŞMEDİR ve bilerek öyledir: bir satır kaldırılmış varsayılanla
 * birebir aynıysa oradan gelmiştir. Kısmi eşleşme (parça ya da içinde geçiren
 * daha uzun cümle) kullanıcının kendi cümlesi olabilir; ona "bunu sen
 * yazmadın" demek, uydurmanın aynadaki hâli olurdu.
 */
export function isRemovedScopeDefault(line: string): boolean {
  return REMOVED_SCOPE_DEFAULT_SET.has(line);
}

/** Verilen satırlardan kaldırılmış varsayılan olanları, sırasını koruyarak döndürür. */
export function findRemovedScopeDefaults(lines: readonly string[]): readonly string[] {
  return lines.filter(isRemovedScopeDefault);
}
