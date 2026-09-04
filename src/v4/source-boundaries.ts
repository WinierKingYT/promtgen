/**
 * Depo kaynak sınırı — tek kaynak.
 *
 * Bu sabiti iki taraf okur ve ikisinin de aynı şeyi söylemesi zorunludur:
 *
 *   - `scripts/check-legacy-boundary.ts`  kuralı **uygular** (CI kapısı).
 *   - `src/v4/product/product-documentation.ts`  kuralı kök `AGENTS.md` ve
 *     `CLAUDE.md` dosyalarına **yazar** (ajanın okuduğu gerçek).
 *
 * İki kopya olsaydı birini değiştirip diğerini unutmak mümkün olurdu. Bu depo
 * o bedeli bir kez ödedi: `16abc11` kopyalanmış aşama sabitlerini tek kaynağa
 * indirmek zorunda kaldı ve gerekçesi aynen buydu.
 *
 * **Neden `src/v4` içinde.** Kapı, `src/v4/**` ve `src/react/**` içinden bu iki
 * kökün dışına çözülen her göreli importu ihlal sayar. Sabit `scripts/` altında
 * dursaydı belge üreticisinin ona ulaşması kapının kendi kuralını ihlal ederdi.
 * Betikler üretim kökünden okuyabilir; üretim betiklerden okuyamaz. Yön tek
 * taraflı olduğu için tek meşru ev burasıdır.
 *
 * Yollar depo köküne göre POSIX biçimindedir. Mutlak çözümleme çağıranın işidir;
 * sabitin kendisi dosya sistemine bağlı değildir, çünkü onu okuyanlardan biri
 * (belge üreticisi) saf bir metin üreticisidir.
 */

/** Üretim kökleri. Ürün davranışı yalnız burada yaşar. */
export const PRODUCTION_ROOTS = ['src/v4', 'src/react'] as const;

/**
 * Üretim köklerinin bulunduğu kaynak dizini.
 *
 * Uyumluluk katmanı liste olarak yazılmaz: `src/` altındaki üretim kökü
 * olmayan **her** dizin uyumluluktur. Kural kökle yazıldığı için yarın
 * `src/telemetry/` eklenirse hiçbir liste güncellenmeden kapsanır — kapı da
 * tam olarak böyle yazılmıştır.
 */
export const SOURCE_ROOT = 'src';

/**
 * Sınırın tek cümlelik ifadesi.
 *
 * Kapının ihlal mesajı ile belgedeki satır aynı cümleyi kullanır; aksi hâlde
 * kural iki farklı kelimeyle iki yerde yaşardı.
 */
export const BOUNDARY_RULE =
  'İzin verilen yön tek taraflıdır: uyumluluk katmanından üretime göç edilir, '
  + 'üretim uyumluluğa bağımlı olamaz. Uyumluluk koduna yeni ürün davranışı eklenmez.';
