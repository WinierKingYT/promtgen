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
 * temizlik paketleri (V3-04b-2, V3-06) sayıyı düşürür; kapı
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
 * ## Ne sayılıyor: SATIR değil, GEÇİŞ
 *
 * Bütün sayılar `String.match(/\bMVP\b/g).length` — yani bir satırdaki iki
 * geçiş **iki** sayılır. Kapı da aynı ifadeyi kullanır; iki taraf farklı birim
 * saysaydı defter sürekli yanlış görünürdü. Ölçüldü: envanterde 21 satır ama
 * 28 geçiş var. `grep -c` satır sayar ve bu farkı gizler.
 *
 * `grep` ayrıca bu depoda ikinci bir yanılgı üretebilir: `\b` bayt sınırıdır ve
 * Türkçe tipografiyle yazılmış `MVP’nin` / `“MVP”` biçimlerinde yerel ayara
 * göre eşleşme kaçırabilir. Bu yüzden ölçüm node ile, açık regex'le yapılır —
 * `grep` çıktısı defterde taban çizgisi olarak kullanılmaz.
 *
 * Ölçüm: 2026-09-05 · `ec0f525` · toplam **54** geçiş / **23** dosya.
 * V3-09 sonrası üretim toplamı **51** / **23** (DOC-06 düzeltmesi).
 * V3-05 sonrası **37** / **17**; V3-04b-1 sonrası **18** / **11**.
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
  // ── V3-04b-1 · `ConceptSummary` üçlüsünün KULLANICIYA GÖRÜNEN metni. KAPANDI.
  //    Envanter §1.3 üç alanı işaret ediyordu; ölçüm bunların yalnız birinin
  //    (`mvpTarget`) alan ADINDA bırakılan çerçeveyi taşıdığını gösterdi. Kalan
  //    borcun tamamı ekran metniydi: form etiketleri, rehber adım adları, revizyon
  //    farkı etiketleri, iki doğrulama hatası ve kaydet düğmesi. Altı dosyadaki 19
  //    geçiş alan-nötr karşılıklarıyla değiştirildi; hiçbir alan adı, kayıt biçimi
  //    veya yönlendirme kalıbı değişmedi. İki karar ölçülerek verildi ve gerekçeleri
  //    dosyalarının içinde durur: (1) `idea-coach-service.ts`'teki adım KİMLİĞİ
  //    dokunulmadı — `messages[].nextQuestionStep` üzerinden diske yazılıyor;
  //    (2) `discovery-answer-service.ts`'teki etiket tablosu serbest metin
  //    yönlendirmesini SÜRMÜYOR — eşleştiriciler kendi kalıplarını taşır, yani
  //    etiket değişikliği davranış değişikliği değildir. Alan adlarının kendisi
  //    V3-04b-2'ye kalır: o gerçek bir veri göçüdür. Toplam 19 → 0.

  // ── V3-05 · Kullanıcıya görünen terminoloji. KAPANDI.
  //    Yedi dosyadaki 15 geçişin 14'ü kullanıcıya sorulan soru, üretilen plan
  //    seçeneği, rehber adımı, alan paketi kontrol mesajı ve arayüz metniydi;
  //    hepsi alan-nötr karşılıklarıyla değiştirildi. Hiçbir soru, kontrol ya da
  //    seçenek silinmedi — yalnız çerçeveyi dayatan kelime bırakıldı. Altı dosya
  //    sıfırlandığı için defterden düştü; kalan tek geçiş borç değildir ve
  //    aşağıdaki gerekçe bölümüne taşındı. Toplam 15 → 0.

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

  // ── `—` · Eski modelin NEDEN bırakıldığını anlatan gerekçe metinleri.
  //    Temizlik borcu değildir; sayılır ki yerlerine yenisi sızmasın. Toplam 12.
  {
    // V3-09'a kadar burada 5 geçiş vardı ve üçü `MVP_SCOPE.md` üreticisinin
    // kendi gömülü metniydi — envanterin DOC-06 dediği kör nokta. Belge
    // `CORE_SCOPE.md` oldu ve üç cümlenin üçü de sözleşmeye bağlandı; kalan
    // ikisi kuralın ve bu tarihçenin anlatısıdır, borç değildir.
    file: 'src/v4/product/product-documentation.ts',
    count: 2,
    owner: '—',
    note: 'DOC-06 kapandı. Kalan ikisi: `mvpRule` alanına yapılan atıf ve kök belgelerin neden üretildiğini anlatan tarihçe.'
  },
  {
    file: 'src/v4/application/idea-discussion-service.ts',
    count: 1,
    owner: '—',
    note: 'V3-05 sonrası kalan tek geçiş: sabit keşif sırasının neden bırakıldığını anlatan yorum.'
  },
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

/**
 * ════════════════════════════════════════════════════════════════════════
 * BELGE CIRCIRI — aynı mekanizma, ikinci yüzey.
 * ════════════════════════════════════════════════════════════════════════
 *
 * `check-product-model.ts` bugüne kadar yalnız `PRODUCTION_ROOTS` (`src/v4`,
 * `src/react`) altını taradı. Yani V3-09'da elle düzeltilen üç belge —
 * `README.md`, `docs/product/ROADMAP.md`, `docs/product/FEATURE_FREEZE.md` —
 * yarın hiçbir kapıyı düşürmeden eski modele geri dönebilirdi. Deponun ön
 * kapısı, kapı kapsamının dışındaydı.
 *
 * Çözüm yeni bir kavram değil: aynı cırcır, ikinci bir defterle. Büyüme
 * yasak, küçülme elle işlenir.
 *
 * ## Neden DİZİN taraması, neden açık liste değil
 *
 * Açık liste "bugün bildiğim dosyalar" demektir ve **yeni** bir belgeyi
 * sessizce kaçırır: yarın `docs/product/YENI_MODEL.md` eklenir, listede
 * olmadığı için taranmaz, kapı yeşil kalır. Tam olarak DOC-06'nın hatası —
 * denetlenen şeyin denetlenmeyen bir kaynağı olması.
 *
 * Dizin taraması yeni dosyayı kaçıramaz: defterde olmayan her `.md`, içinde
 * çıplak `MVP` geçtiği anda `YENİ … (defterde yok)` diye düşer ve ekleyenin
 * gerekçesini buraya yazması gerekir. Üretim tarafı da tam olarak böyle
 * yazılmıştır (`collectFiles`, uzantı filtresi yok); bu, o kararın belgelere
 * uygulanmasıdır, ondan sapma değil.
 *
 * Bedeli, sıfır olmayan her tarihsel belgenin defterde bir satır tutmasıdır.
 * O satırlar israf değil, envanterin ta kendisidir: 21 dosyanın 106 geçişi
 * arasında yeni bir tanesinin fark edilmeden saklanması imkânsız hâle gelir.
 *
 * ## `owner: 'PRESERVE_LEGACY'`
 *
 * Üretim defterinde `—` "gerekçe metni, borç değil" demekti. Belgelerde üçüncü
 * bir durum var: bırakılan modeli **bilerek** anlatan tarihsel kayıtlar
 * (envanterin kendisi, ilk sürüm vizyon belgesi, tarihli planlar, dondurulmuş
 * çalışma girdileri). Bunlar düzeltilecek borç DEĞİLDİR; "temizlenmeleri"
 * denetim izini yok ederdi. `PRESERVE_LEGACY` bunu satırın kendisinde söyler:
 * sayı burada duruyor ki aralarına yenisi karışmasın.
 *
 * `—` yine "borç değil" demektir: üretilen kök dosyalar (`AGENTS.md`,
 * `CLAUDE.md`) sözleşmenin kural metnini basar. Bir paket adı ise o satırın
 * hangi temizlik paketiyle düşeceğini söyler.
 *
 * ## Kapsam dışında bırakılanlar
 *
 * `src/`, `tests/` ve `scripts/` altındaki `.md` yoktur; kod ağacının kendi
 * kapıları var. `node_modules`, `.git`, `dist`, `graphify-out` gibi üretilen
 * ağaçlara hiç girilmez, çünkü kökler açıkça sayılıdır.
 *
 * Ölçüm: 2026-09-08 · V3-09 sonrası · toplam **106** geçiş / **21** dosya
 * (69 `.md` tarandı). `README.md` sıfırdır ve bilerek defterde YOKTUR: eski
 * çerçeve geri gelirse `YENİ` satırı olarak düşmesi gerekir.
 */

/** Belge taramasının kökü. `recursive: false` yalnız o dizinin kendi dosyaları demektir. */
export interface DocScanRoot {
  /** Depo köküne göre POSIX yol. `'.'` depo köküdür. */
  readonly dir: string;
  /** Alt dizinlere inilir mi? */
  readonly recursive: boolean;
}

/**
 * Depo kökü **özyinelemesiz** taranır: oradaki `.md` dosyaları (`README.md`,
 * üretilen `AGENTS.md`/`CLAUDE.md`, ilk sürüm vizyon belgesi) kapsamdadır ama
 * `src/`, `tests/`, `node_modules/` gibi kardeş ağaçlara inilmez.
 *
 * `benchmarks/` kapsamdadır çünkü dondurulmuş çalışma girdileri de birer
 * belgedir; oraya eklenen yeni bir metnin kapı dışında kalması, kapıyı
 * "yalnız kolay yerlere bakan" bir kapı yapardı.
 */
export const DOC_SCAN_ROOTS: readonly DocScanRoot[] = [
  { dir: '.', recursive: false },
  { dir: 'docs', recursive: true },
  { dir: 'benchmarks', recursive: true }
] as const;

/** Sıra: azalan sayı — okuyan "borç nerede yoğun" sorusunu tablodan görsün diye. */
export const TIER2_DOC_RATCHET: readonly ProductModelRatchetEntry[] = [
  {
    file: 'docs/LEGACY_MODEL_INVENTORY.md',
    count: 28,
    owner: 'PRESERVE_LEGACY',
    note: 'Envanterin kendisi: bırakılan modelin nerede yaşadığını sayan kontrol belgesi. Sayısı düşerse ölçümün kendisi kaybolur.'
  },
  {
    file: 'Evrensel_AI_Proje_Tasarim_Sistemi_Plani.md',
    count: 26,
    owner: 'PRESERVE_LEGACY',
    note: 'İlk commit’in (`9cd9bb4`) v1.0 ürün vizyonu; §27 başlığı dahil belgenin tamamı eski modelin kaydıdır.'
  },
  {
    file: 'docs/superpowers/plans/2026-08-03-idea-studio-layout.md',
    count: 12,
    owner: 'PRESERVE_LEGACY',
    note: 'Tarihli uygulama planı: o günkü `mvp` alan kimliğini ve adımını olduğu gibi anlatır.'
  },
  {
    file: 'docs/superpowers/specs/2026-08-03-idea-studio-layout-design.md',
    count: 9,
    owner: 'PRESERVE_LEGACY',
    note: 'Yukarıdaki planın tarihli tasarım şartnamesi.'
  },
  {
    file: 'AGENTS.md',
    count: 5,
    owner: '—',
    note: 'Üretilen kök dosya; beşi de `PRODUCT_CONTRACT.mvpRule` ve `mistakenIdentities` metnidir. Elle değişmez, `check:product-docs` denetler.'
  },
  {
    file: 'CLAUDE.md',
    count: 5,
    owner: '—',
    note: 'Aynı üretici, aynı sözleşme metni. Sayı ancak sözleşmenin kural cümlesi değişirse değişir.'
  },
  {
    file: 'docs/product/PRODUCT_MODEL_V3.md',
    count: 3,
    owner: 'PRESERVE_LEGACY',
    note: 'Envanter DOC-10: şartname eski modeli bilerek KARŞITLIK olarak yazar; silinirse V3’ün gerekçesi kaybolur.'
  },
  {
    file: 'docs/product/freeze-exceptions/2026-08-06-idea-expansion-board.md',
    count: 2,
    owner: 'PRESERVE_LEGACY',
    note: 'Tarihli dondurma istisnası kaydı; o günün kapsam disiplini gerekçesi.'
  },
  {
    file: 'docs/superpowers/plans/2026-08-06-idea-expansion-board.md',
    count: 2,
    owner: 'PRESERVE_LEGACY',
    note: 'Tarihli uygulama planı; kategori ipucu metnini kaynağından alıntılar.'
  },
  {
    file: 'docs/superpowers/plans/2026-08-15-information-architecture.md',
    count: 2,
    owner: 'PRESERVE_LEGACY',
    note: 'Alt Proje C planı; o günkü arayüz metnini birebir gösterir.'
  },
  {
    file: 'docs/superpowers/specs/2026-08-06-idea-expansion-board-design.md',
    count: 2,
    owner: 'PRESERVE_LEGACY',
    note: 'Panonun tarihli tasarım şartnamesi.'
  },
  {
    file: 'benchmarks/comparison/master-prompt.md',
    count: 1,
    owner: 'PRESERVE_LEGACY',
    note: 'Dondurulmuş çalışma girdisi (`frozenDigest`): değişirse `check:comparison` düşer ve v1 verisi yorumlanamaz hâle gelir.'
  },
  {
    file: 'benchmarks/comparison-v2/master-prompt.md',
    count: 1,
    owner: 'PRESERVE_LEGACY',
    note: 'v2 kolunun dondurulmuş girdisi; karşılaştırılabilirlik için v1 ile aynı metni taşır.'
  },
  {
    file: 'benchmarks/comparison-v2/pilot/BULGULAR.md',
    count: 1,
    owner: 'PRESERVE_LEGACY',
    note: 'Pilot bulgu kaydı: ölçüldüğü gün ekranda yazan hatalı çıktıyı alıntılar.'
  },
  {
    file: 'docs/product/BENCHMARK_REPORT.md',
    count: 1,
    owner: '—',
    note: 'Üretilen rapor; `benchmarks/planner/scenarios.json` içindeki "E-ticaret MVP" senaryo adı. Bir projenin kendi kapsamını böyle adlandırması kuralın açıkça meşru saydığı durumdur.'
  },
  {
    file: 'docs/product/DISCOVERY_BENCHMARK_REPORT.md',
    count: 1,
    owner: '—',
    note: 'Üretilen rapor; adversarial senaryo adı `benchmarks/discovery/scenarios.json`’dan gelir — kullanıcının kapsamı karıştırmasını ürünün ÖLÇTÜĞÜ durum.'
  },
  {
    file: 'docs/product/COMPARISON_REPORT.md',
    count: 1,
    owner: 'DOC-09',
    note: '`minorEditMvpAcceptanceRate` alanının rapor etiketi. Kaynağı `scripts/comparison-benchmark.ts`; alan adı değişmeden etiket değişemez.'
  },
  {
    file: 'docs/product/COMPARISON_REPORT_V2.md',
    count: 1,
    owner: 'DOC-09',
    note: 'v2 çalışmasının aynı etiketi, aynı kaynaktan.'
  },
  {
    file: 'docs/product/COMPARISON_STUDY_PROTOCOL.md',
    count: 1,
    owner: 'PRESERVE_LEGACY',
    note: 'Protokol, katılımcının kurduğu cümleyi alıntılar. Katılımcının sözü düzeltilmez; düzeltilirse protokol ölçtüğü şeyi anlatmaz.'
  },
  {
    file: 'docs/product/FEATURE_FREEZE.md',
    count: 1,
    owner: 'PRESERVE_LEGACY',
    note: 'V3-09 önsözü düzeltti (DOC-04). Kalan geçiş "Kayıtlı istisna 2"nin tarihli karar gövdesindedir: modeli ilan etmek için değil, bırakıldığını anlatmak için durur.'
  },
  {
    file: 'docs/product/ROADMAP.md',
    count: 1,
    owner: 'DOC-09',
    note: 'V3-09 giriş paragrafını düzeltti (DOC-03). Kalan geçiş Faz 5’in ölçüm listesindeki `mvpAcceptedWithMinorEdits` alanının düzyazı adıdır; alan yaşadığı sürece düzeltmek belgeyi yalancı yapardı.'
  }
] as const;
