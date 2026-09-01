import type { DomainPackExpansionAxis, ProjectDocumentV5 } from '../contracts.js';
import { classifyProjectDomain, type ProjectDomain } from '../ai/domain-classifier.js';
import { DOMAIN_PACK_REGISTRY } from '../domain-packs/registry.js';

/** Domain pack'lerin katkıda bulunabileceği en fazla eksen sayısı. */
const MAX_PACK_AXES = 6;

export interface ExpansionCategory {
  id: string;
  label: string;
  hint: string;
  /** AI bağlı değilken gösterilecek başlangıç başlıkları. Pano boş görünmez. */
  seedTitles: string[];
}

/**
 * Kategori sözlüğü deterministiktir: ağ, AI, tarih veya rastgelelik kullanmaz.
 * Domain pack'lerin sözlüğü plan kalite kapısı dilidir ve fikir aşaması için
 * fazla tekniktir; burada kategoriler kullanıcının dilinde adlandırılır.
 */
const CORE: ExpansionCategory[] = [
  {
    id: 'onboarding',
    label: 'Kullanıcı ve ilk deneyim',
    hint: 'İlk 5 dakikada ne olur?',
    seedTitles: ['İlk açılışta tek bir değerli sonuç göster', 'Kayıt olmadan denenebilir bir mod']
  },
  {
    id: 'core-depth',
    label: 'Ana akışı derinleştir',
    hint: 'Çekirdek işi daha iyi ne yapar?',
    seedTitles: ['Ana akışı tek ekrana indir', 'Sık yapılan işi tek tıka indir']
  },
  {
    id: 'data',
    label: 'Veri ve içerik',
    hint: 'Neyi nereden alır, nasıl büyür?',
    seedTitles: ['Veriyi kullanıcıdan toplamadan başlat', 'İçe aktarma ile ilk veriyi doldur']
  },
  {
    id: 'trust',
    label: 'Güven ve gizlilik',
    hint: 'Kullanıcı neden güvensin?',
    seedTitles: ['Verinin nerede durduğunu açıkça göster', 'Tek tıkla dışa aktarma ve silme']
  },
  {
    id: 'money',
    label: 'Para modeli',
    hint: 'Ayakta nasıl kalır?',
    seedTitles: ['Ücretsiz katmanın sınırını netleştir', 'Değeri görülmeden ödeme isteme']
  },
  {
    id: 'growth',
    label: 'Büyüme ve elde tutma',
    hint: 'Neden geri döner?',
    seedTitles: ['Geri dönmeyi hak eden tek bildirim', 'Sonucu paylaşılabilir hâle getir']
  },
  {
    id: 'measure',
    label: 'Ölçüm ve öğrenme',
    hint: 'Doğru gittiğini nereden bilirsin?',
    seedTitles: ['Tek bir kuzey yıldızı metriği seç', 'İlk 20 kullanıcıyla konuşma planı']
  },
  {
    id: 'narrow',
    label: 'Kapsamı daralt',
    hint: 'Neyi çıkarırsan MVP hâlâ ayakta kalır?',
    seedTitles: ['İkincil kullanıcı grubunu ilk sürümden çıkar', 'Otomasyonu elle yapılan adıma indir']
  }
];

const BY_DOMAIN: Record<ProjectDomain, ExpansionCategory[]> = {
  web: [
    {
      id: 'accounts',
      label: 'Hesap ve yetkiler',
      hint: 'Kim neyi görebilir ve değiştirebilir?',
      seedTitles: ['Tek kullanıcıyla başla, ekip desteğini sonraya bırak', 'Rol yerine basit sahiplik kuralı']
    },
    {
      id: 'integrations',
      label: 'Entegrasyonlar',
      hint: 'Hangi araca bağlanırsa değeri artar?',
      seedTitles: ['Tek bir dış araca bağlan', 'Dışa aktarma ile entegrasyonu erteler']
    },
    {
      id: 'a11y',
      label: 'Erişilebilirlik',
      hint: 'Klavye ve ekran okuyucuyla kullanılabilir mi?',
      seedTitles: ['Ana akışı klavyeyle tamamlanabilir yap', 'Renk dışında da ayırt edilebilir durumlar']
    }
  ],
  mobile: [
    {
      id: 'offline',
      label: 'Çevrimdışı ve senkron',
      hint: 'Bağlantı yokken ne olur?',
      seedTitles: ['Son veriyi çevrimdışı göster', 'Çakışmada kullanıcıya sor']
    },
    {
      id: 'permissions',
      label: 'İzinler',
      hint: 'Hangi izni ne zaman isteyeceksin?',
      seedTitles: ['İzni ilk açılışta değil ihtiyaç anında iste', 'İzin reddedilirse çalışan bir yedek akış']
    },
    {
      id: 'notifications',
      label: 'Bildirimler',
      hint: 'Hangi bildirim gerçekten hak edilmiş?',
      seedTitles: ['Tek bir yüksek değerli bildirim', 'Bildirim sıklığını kullanıcı belirlesin']
    }
  ],
  game: [
    {
      id: 'game-loop',
      label: 'Oyuncunun elindeki fiil',
      hint: 'Oyuncu saniye saniye ne yapıyor? Ana fiil ile ona bağlı geçişler arasında sürtünme nerede?',
      seedTitles: ['Ana fiili tek bir girdiye indir', 'Fiiller arası geçişi kesintisiz yap', 'Boşta geçen saniyeleri azalt']
    },
    {
      id: 'simulated-state',
      label: 'Simüle edilen durum',
      hint: 'Zamanla ne azalır, onu ne geri doldurur? Azalma hızı, geri kazanım yolu ve sıfıra inince ne olduğu oyuncuya nasıl görünür?',
      seedTitles: ['Azalan değeri sürekli görünür kıl', 'Sıfıra inince cezayı net tanımla', 'Geri kazanım için oyuncuya seçenek sun']
    },
    {
      id: 'network-authority',
      label: 'Ağ yetkisi ve senkron',
      hint: 'Bir varlığın konumuna ve durumuna kim karar verir: sunucu mu istemci mi? Hangi veri diğer oyunculara yayılır, sahiplik nasıl el değiştirir, istemciye asla güvenilmeyecek olan nedir?',
      seedTitles: ['Konumu sunucu yetkili yap, istemci yalnız tahmin etsin', 'Sahiplik devrini tek bir olayla tanımla', 'Hileye açık kararları istemciden çıkar']
    },
    {
      id: 'input-and-feel',
      label: 'Girdi ve his',
      hint: 'Kamera, kontrol şeması ve animasyon geçişleri birlikte nasıl hissettiriyor? Oyuncu bir eylemi yarıda kesip başka bir eyleme geçebiliyor mu?',
      seedTitles: ['Kamerayı tek bir referans noktasına bağla', 'Eylemi yarıda kesmeye izin ver', 'Kontrol şemasını tek bir cihazda ilk test et']
    },
    {
      id: 'content-pipeline',
      label: 'Sanat ve içerik hattı',
      hint: 'Bir varlığı oyuna katmanın gerçek maliyeti nedir: iskelet, animasyon sayısı, uzak mesafe görünümü, hazır varlık mı özel üretim mi?',
      seedTitles: ['İlk sürümde hazır varlık kullan', 'Animasyon sayısını en aza indir', 'Uzak mesafede daha basit görünüm kullan']
    }
  ],
  ai: [
    {
      id: 'model-cost',
      label: 'Model ve maliyet',
      hint: 'Her çağrı ne kadara mal oluyor?',
      seedTitles: ['Küçük modelle başla, büyüğe yükselt', 'Sonuçları önbelleğe al']
    },
    {
      id: 'accuracy',
      label: 'Doğruluk',
      hint: 'Model yanılırsa kullanıcı ne görür?',
      seedTitles: ['Belirsizliği kullanıcıya açıkça göster', 'Kaynağı gösterilmeyen çıktıyı sunma']
    },
    {
      id: 'human-approval',
      label: 'İnsan onayı',
      hint: 'Hangi adım onaysız ilerlememeli?',
      seedTitles: ['Kalıcı değişiklikleri onaya bağla', 'Geri alınabilir varsayılan davranış']
    }
  ],
  general: []
};

/**
 * CORE + alan (domain) eksenlerini, pack'lerin katkıda bulunduğu eksenlerle birleştirir.
 * Sıra sabittir: CORE, sonra BY_DOMAIN, sonra pack eksenleri — asla sıralanmaz veya
 * araya karıştırılmaz. Kimlik çakışmasında ilk gelen kazanır (CORE/BY_DOMAIN her zaman
 * pack eksenine üstün gelir). Pack eksenleri en fazla MAX_PACK_AXES ile sınırlıdır.
 * Saf fonksiyondur; ayrı ihracı doğrudan birim testine izin verir.
 */
export function mergeExpansionCategories(
  core: ExpansionCategory[],
  domainCategories: ExpansionCategory[],
  packAxes: DomainPackExpansionAxis[]
): ExpansionCategory[] {
  const cappedPackAxes = packAxes.slice(0, MAX_PACK_AXES);
  const merged = [...core, ...domainCategories, ...cappedPackAxes];
  const seenIds = new Set<string>();
  const deduped: ExpansionCategory[] = [];
  for (const category of merged) {
    if (seenIds.has(category.id)) continue;
    seenIds.add(category.id);
    deduped.push(category);
  }
  return deduped;
}

/**
 * Kimlik çözümünün çıktısı, KÖKEN ayrımıyla birlikte.
 *
 * `categories` sırası kimlik çözümünün sırasıdır ve DEĞİŞMEZ (CORE → BY_DOMAIN
 * → pack). `domainSpecificIds` yalnız bir ETİKETTİR: hangi kimliklerin alana
 * özel (BY_DOMAIN veya pack) olduğunu taşır ve sunum sırası bunun üzerine
 * kurulur. Kimlik çözümü ile sunum sırası bilerek AYRIDIR — çakışmada CORE'un
 * kazanması bir kimlik kuralıdır, kullanıcının başlıkları hangi sırada
 * göreceğiyle ilgisi yoktur.
 */
export interface ExpansionCategorySet {
  categories: ExpansionCategory[];
  domainSpecificIds: string[];
}

/**
 * Köken ayrımı ÇIKARIMLA yapılır, ikinci bir kimlik listesi tutularak değil:
 * birleşimde CORE her zaman kazandığı için, hayatta kalan bir kategorinin
 * kimliği CORE'da yoksa o kategori BY_DOMAIN'den veya bir pack'ten gelmiştir.
 * Böylece pack ekseni CORE ile çakışıp elendiğinde, hayatta kalan CORE girdisi
 * doğru biçimde "genel" sayılır.
 */
export function getExpansionCategorySet(project: ProjectDocumentV5): ExpansionCategorySet {
  const domain = classifyProjectDomain(project.identity.originalIdea || '');
  const packAxes = DOMAIN_PACK_REGISTRY.collectExpansionAxes(project);
  const categories = mergeExpansionCategories(CORE, BY_DOMAIN[domain], packAxes);
  const coreIds = new Set(CORE.map(category => category.id));
  return {
    categories,
    domainSpecificIds: categories.filter(category => !coreIds.has(category.id)).map(category => category.id)
  };
}

export function getExpansionCategories(project: ProjectDocumentV5): ExpansionCategory[] {
  return getExpansionCategorySet(project).categories;
}

/** Sunum sırasında kategorilerin ait olduğu köken kümeleri. */
export interface ExpansionCategoryOrigins {
  /** Fikre özel (model üretimi) eksenlerin kimlikleri. */
  ideaSpecificIds?: readonly string[];
  /** Alana özel (BY_DOMAIN + pack) eksenlerin kimlikleri. */
  domainSpecificIds?: readonly string[];
}

/**
 * SUNUM ve ÖN-YÜKLEME sırası: fikre özel AI eksenleri → alana özel eksenler →
 * genel CORE kategorileri.
 *
 * NEDEN AYRI BİR FONKSİYON. `mergeExpansionCategories` KİMLİK çözümüdür ve
 * sırası bir değişmezdir (çakışmada ilk gelen kazanır, CORE her zaman üstün).
 * O sıra aynı zamanda ön-yükleme sırası olarak kullanılınca ölçülen sonuç şu
 * oldu: CORE 8 kategori önde durduğu için alana özel eksenler 9. sıradan
 * başlıyor ve arka plan sınırının (BACKGROUND_PREFETCH_LIMIT = 6) dışında
 * kalıyor; bir Unity oyunu fikrinde `Ağ yetkisi ve senkron` HİÇ üretilmezken
 * `Güven ve gizlilik` çerez/oturum önerdi. Bu yüzden kimlik çözümü olduğu
 * gibi bırakılıp sunum sırası buraya AYRILDI.
 *
 * SIRALAMADIR, FİLTRELEME DEĞİL: girdinin KARARLI bir bölüntüsüdür — hiçbir
 * kategori düşmez, eklenmez, sırası küme içinde bozulmaz. Bilinmeyen köken
 * kimlikleri yok sayılır (girdide olmayan bir kimlik çıktıya kategori
 * ekleyemez). Saftır: I/O yok, rastgelelik yok, girdi mutasyonu yok.
 */
export function orderExpansionCategoriesForPresentation(
  categories: readonly ExpansionCategory[],
  origins: ExpansionCategoryOrigins = {}
): ExpansionCategory[] {
  const ideaSpecific = new Set(origins.ideaSpecificIds ?? []);
  const domainSpecific = new Set(origins.domainSpecificIds ?? []);
  const ideaBucket: ExpansionCategory[] = [];
  const domainBucket: ExpansionCategory[] = [];
  const coreBucket: ExpansionCategory[] = [];
  for (const category of categories) {
    if (ideaSpecific.has(category.id)) ideaBucket.push(category);
    else if (domainSpecific.has(category.id)) domainBucket.push(category);
    else coreBucket.push(category);
  }
  return [...ideaBucket, ...domainBucket, ...coreBucket];
}
