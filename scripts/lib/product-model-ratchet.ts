/**
 * ESKİ ÜRÜN MODELİ ÇERÇEVESİNİN TARİHSEL SAYIMI — Kademe 2 cırcırı (ratchet).
 *
 * `scripts/check-product-model.ts` bu tabloyu okur. Kapı bir muafiyet listesi
 * DEĞİLDİR: buradaki hiçbir satır bir dosyayı denetimden çıkarmaz. Tablo yalnız
 * **bugünkü borcu** kaydeder ve borcun **büyümesini** yasaklar.
 *
 * ————————————————————————————————————————————————————————————————————————
 * KRİTİK — bu liste yalnız KÜÇÜLEBİLİR.
 *
 * Yeni bir satır eklemek ya da mevcut bir satırın `count` değerini YÜKSELTMEK
 * yasaktır; kapı düşer. Bir dosyanın sayısı düştüğünde de kapı düşer — ama o
 * bir hata değil, ilerlemedir: kapı yeni satırı ekrana yazar, sen buraya
 * yapıştırırsın. Düşüş elle işlenir çünkü **küçülme göze görünmelidir**;
 * kendi taban çizgisini yazan bir kapı kendini yeşile boyayabilir.
 *
 * Emsal: `src/v4/application/legacy-scope-defaults.ts` (asla büyümeyen tarihsel
 * kayıt) ve `benchmarks/reachability/baseline.json` (erişilemez dışa aktarım
 * taban çizgisi).
 * ————————————————————————————————————————————————————————————————————————
 *
 * ## Neden sayım, neden yasak değil
 *
 * Kök `CLAUDE.md` kuralı: *"MVP kavramı yasak değildir: bir projenin kendi
 * kapsamını 'MVP' diye adlandırması meşrudur. Yasak olan, MVP'nin PromtGen'in
 * evrensel yaşam döngüsü aşaması olmasıdır."*
 *
 * Bu yüzden çıplak `MVP` kelimesi Kademe 1 gibi sert yasaklanamaz. Bugün üretim
 * kökünde ölçülen 54 geçiş 23 dosyaya yayılıdır; hepsini yasaklamak ya derlemeyi
 * düşürürdü ya da 23 girişli bir muafiyet listesi doğururdu — ve o liste bir
 * çöp tenekesine dönüşürdü. Cırcır üçüncü yolu seçer: yön garantisi. Kalan
 * temizlik paketleri (V3-04b, V3-05, V3-06, V3-09/DOC-06) sayıyı düşürür; kapı
 * yalnız yönün tersine dönmediğini kanıtlar.
 *
 * ## `owner` ne demek
 *
 * Sahiplik uydurulmadı; `docs/LEGACY_MODEL_INVENTORY.md` §1.3, §3 ve §7'den
 * alındı. `—` sahipsiz demek değildir: o satırlar eski modelin NEDEN
 * bırakıldığını anlatan gerekçe metinleridir. Temizlik borcu değildirler ve
 * "düzeltilmemelidirler"; yine de sayılırlar, çünkü bir sonraki ajanın eski
 * çerçeveyi bir yorumun içine geri sızdırması tam da kapının aradığı şeydir.
 *
 * ## Kapsam dışında tutulan tek dosya
 *
 * `src/v4/product/product-contract.ts` bu tabloda yoktur ve bilerek yoktur:
 * kuralın kendisi orada YAZILIR (`mvpRule`, `mistakenIdentities`). Kuralı
 * söylemek kuralı çiğnemek değildir. Ayrıntı ve `product-documentation.ts`'in
 * neden kapsam DIŞINDA bırakılmadığı için `check-product-model.ts` başlığına
 * bakın.
 *
 * Ölçüm: 2026-09-05 · `ec0f525` · toplam **54** geçiş / **23** dosya.
 */

/** Cırcır tablosundaki tek satır. */
export interface ProductModelRatchetEntry {
  /** Depo köküne göre POSIX yol. */
  readonly file: string;
  /** O dosyadaki çıplak `MVP` geçişi sayısı. Yükselemez. */
  readonly count: number;
  /** Temizliği hangi paket devralıyor; `—` ise gerekçe metnidir, borç değildir. */
  readonly owner: string;
  /** Neyin sayıldığı — okuyanın dosyayı açmadan borcu anlaması için. */
  readonly note: string;
}

/**
 * Sıra: önce sahip, sonra azalan sayı. Alfabetik değil — okuyan "hangi paket ne
 * kadar borç taşıyor" sorusunu tablodan doğrudan cevaplayabilsin diye.
 */
export const TIER2_RATCHET: readonly ProductModelRatchetEntry[] = [
  // ── V3-04b · `ConceptSummary` üçlüsü (mvpTarget · confirmedFeatures · outOfScope)
  //    Envanter §1.3: kaydedilir, kapıyı bloklar, dokuz dosya okur. Toplam 19.
  {
    file: 'src/react/components/ConceptAgreementEditor.tsx',
    count: 5,
    owner: 'V3-04b',
    note: 'Üçlünün arayüzü: "MVP hedefi", "MVP içinde", "MVP dışında" etiketleri ve kaydet düğmesi.'
  },
  {
    file: 'src/v4/application/idea-coach-service.ts',
    count: 5,
    owner: 'V3-04b',
    note: '`mvp` alan kimliği, `summary?.mvpTarget` okuması ve "Tek MVP hipotezi seç" önerisi.'
  },
  {
    file: 'src/v4/application/discovery-answer-service.ts',
    count: 3,
    owner: 'V3-04b',
    note: 'Serbest metni hangi alana yazacağına karar veren alan etiketleri (envanter §1.3: canlı karar mantığı).'
  },
  {
    file: 'src/v4/application/idea-document-revision-service.ts',
    count: 3,
    owner: 'V3-04b',
    note: 'Revizyon anlık görüntüsünde aynı üç alan etiketi.'
  },
  {
    file: 'src/v4/application/requirement-quality-service.ts',
    count: 2,
    owner: 'V3-04b',
    note: 'Gereksinim kapısının kullanıcıya döndürdüğü iki hata metni.'
  },
  {
    file: 'src/v4/project-document.ts',
    count: 1,
    owner: 'V3-04b',
    note: 'Konsept doğrulama hatası: "MVP içi ve kapsam dışı listeler boş olamaz."'
  },

  // ── V3-05 · Kullanıcıya görünen terminoloji. Envanter §7: risk düşük-orta,
  //    metinlerin çoğu testte iddia edilmiyor. Toplam 15.
  {
    file: 'src/v4/application/idea-discussion-service.ts',
    count: 6,
    owner: 'V3-05',
    note: 'Kullanıcıya sorulan altı çelişki/boşluk sorusunun metni.'
  },
  {
    file: 'src/v4/planning-engine.ts',
    count: 3,
    owner: 'V3-05',
    note: 'Üretilen planlama seçeneklerinin başlığı ve artı listeleri.'
  },
  {
    file: 'src/react/Workspace.tsx',
    count: 2,
    owner: 'V3-05',
    note: 'Envanter DOC-08: kullanıcıya görünen "MVP sınırı" / "MVP kapsamı" metni.'
  },
  {
    file: 'src/v4/application/idea-guide-service.ts',
    count: 1,
    owner: 'V3-05',
    note: 'Rehber adımı: "MVP içi ve kapsam dışı özellikleri kesinleştir."'
  },
  {
    file: 'src/v4/domain-packs/game.ts',
    count: 1,
    owner: 'V3-05',
    note: 'Oyun paketinin kapsam onayı mesajı.'
  },
  {
    file: 'src/v4/domain-packs/web-saas.ts',
    count: 1,
    owner: 'V3-05',
    note: 'Web/SaaS paketinin kapsam onayı mesajı.'
  },
  {
    file: 'src/v4/idea-expansion/categories.ts',
    count: 1,
    owner: 'V3-05',
    note: 'Kategori ipucu: "Neyi çıkarırsan MVP hâlâ ayakta kalır?"'
  },

  // ── V3-06 · Benchmark hizalama. Envanter §7 ve BENCH-01/02: bu metinler
  //    latest-report.json · BENCHMARK_REPORT.md · generated-benchmark-evidence.ts
  //    üçlüsüne akar ve ATOMİK gitmek zorundadır. Toplam 6.
  {
    file: 'src/v4/benchmarks/planner-benchmark.ts',
    count: 4,
    owner: 'V3-06',
    note: 'BENCH-01/02 dahil senaryo görev ve karar başlıkları; işlenmiş kanıta akar.'
  },
  {
    file: 'src/v4/benchmarks/discovery-benchmark.ts',
    count: 2,
    owner: 'V3-06',
    note: 'Keşif benchmark uyarısı ve referans doğrulama hatası.'
  },

  // ── V3-09 / DOC-06 · Üretilen belge kapısının kör noktası.
  {
    file: 'src/v4/product/product-documentation.ts',
    count: 5,
    owner: 'V3-09/DOC-06',
    note: 'Üçü `MVP_SCOPE.md` üreticisinin kendi gömülü metni (DOC-06 kör noktası); ikisi kuralı anlatan yorum.'
  },

  // ── `—` · Eski modelin NEDEN bırakıldığını anlatan gerekçe metinleri.
  //    Temizlik borcu değildir; sayılır ki yerlerine yenisi sızmasın. Toplam 9.
  {
    file: 'src/v4/application/deterministic-idea-planning.ts',
    count: 3,
    owner: '—',
    note: 'Alan-nötr soru gerekçesi: yasak olanın MVP kavramı değil, her fikre dayatılması olduğunu anlatır.'
  },
  {
    file: 'src/v4/ai/schemas/language-guard.ts',
    count: 1,
    owner: '—',
    note: 'Dil kapısında Latin harfli ödünç kelime örneği; ürün modeliyle ilgisi yok.'
  },
  {
    file: 'src/v4/ai/schemas/schemas.ts',
    count: 1,
    owner: '—',
    note: 'Bırakılan modeli tarif eden şema yorumu.'
  },
  {
    file: 'src/v4/application/adaptive-idea-coach.ts',
    count: 1,
    owner: '—',
    note: 'Sabit `Problem → Kullanıcı → Değer → MVP` sırasının neden kaldırıldığını anlatan yorum.'
  },
  {
    file: 'src/v4/application/idea-expansion-intake.ts',
    count: 1,
    owner: '—',
    note: '"MVP adayı" kartlarının neden gereksinime dönüşmediğini anlatan yorum.'
  },
  {
    file: 'src/v4/application/legacy-scope-defaults.ts',
    count: 1,
    owner: '—',
    note: 'Kaldırılmış kapsam varsayılanlarının tarihsel kaydındaki alıntı.'
  },
  {
    file: 'src/v4/contracts.ts',
    count: 1,
    owner: '—',
    note: 'Sabit keşif sırasının neden bırakıldığını anlatan sözleşme yorumu.'
  }
] as const;
