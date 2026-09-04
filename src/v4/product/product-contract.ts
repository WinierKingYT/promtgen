export type SupportLevel = 'candidate-stable' | 'stable' | 'beta' | 'experimental' | 'unsupported';
export type ProductLocale = 'tr-TR' | 'en-US';

/**
 * `unsupported`'in **iki** anlamı var ve tek kelimeyle söylenmesi yanıltıcıydı.
 *
 * - `unmeasured`: garanti vermiyoruz ve ölçmedik. Tasarım yardımı reddedilmiş
 *   değil, sadece kanıtlanmamış. Kanıt üretilirse seviye yükselebilir.
 * - `refused`: kanıt ne çıkarsa çıksın hizmet etmeyeceğimiz alan. Düzenleyici
 *   ve klinik/finansal sorumluluk devredilemez; bu bir veri sorunu değil.
 *
 * Ayrım gerçek bir çelişkiyi kapatıyor. Bugünkü örneği `game-3d` ile
 * `critical-health` yan yana konunca görünür: ikisi de `unsupported`, ama
 * hiç aynı şeyi söylemiyorlar. `game-3d` için bir alan paketi
 * (`domain-packs/game.ts`) ARTIK VAR ve `promtgen-comparison-v2` çalışması
 * tam o alanda bir senaryo içeriyor -- yine de üretime hazırlık ölçülmediği
 * için garanti verilmiyor: `unmeasured`. `critical-health` ise ölçüm
 * beklemiyor; kanıt ne çıkarsa çıksın kapsam dışı: `refused`. İkisi aynı
 * kelimeyle söylendiği sürece okuyan "3D oyunda hiç çalışmıyor" sonucuna
 * varıyor ve belgeler birbirini yalanlıyordu.
 */
export type UnsupportedReason = 'unmeasured' | 'refused';

export interface SupportedProjectType {
  id: string;
  label: string;
  support: SupportLevel;
  limitations: string[];
  /** Yalnız `support: 'unsupported'` için anlamlı. */
  unsupportedReason?: UnsupportedReason;
}

export interface MaturityPolicy {
  label: string;
  requirements: string[];
}

export interface ProductContract {
  id: 'promtgen-project-design-planner';
  version: 3;
  positioning: Record<ProductLocale, string>;
  primaryUser: Record<ProductLocale, string>;
  promise: Record<ProductLocale, string>;
  userProblems: string[];
  coreNavigation: string[];
  labsNavigation: string[];
  coreExports: string[];
  supportedProjects: SupportedProjectType[];
  nonGoals: string[];
  /**
   * Ürünün **olmadığı** şeyler — `nonGoals` ile karıştırılmamalı.
   *
   * `nonGoals` ürünün *yapmayacağı işleri* sayar ("Bulut senkronizasyonu …
   * sunmak"). Buradaki liste ise okuyanın yanlışlıkla *varsaydığı kimlikleri*
   * sayar: PromtGen'i bir prompt üreteci ya da otonom kodlama ajanı sanmak
   * bir hedef sapması değil, kimlik hatasıdır. İkisi tek listede toplansaydı
   * ayrım kaybolur ve "yapmayacağız" ile "değiliz" aynı cümle gibi okunurdu.
   */
  mistakenIdentities: string[];
  /**
   * V3'ün MVP kuralı. Tek cümle, tek yer.
   *
   * Bu kural bütün V3 çalışmasının dayanağıdır ve şimdiye kadar yalnız
   * `docs/LEGACY_MODEL_INVENTORY.md` içinde düzyazı olarak duruyordu. Düzyazı
   * kaynak değildir: alıntılayan her yer kendi kelimeleriyle yazar ve bir süre
   * sonra iki farklı kural olur.
   */
  mvpRule: string;
  codePolicy: string[];
  maturityPolicies: Record<Exclude<SupportLevel, 'unsupported'>, MaturityPolicy>;
  successMetrics: Array<{ id: string; target: string; evidenceRequired: boolean }>;
}

export const PRODUCT_CONTRACT = Object.freeze({
  id: 'promtgen-project-design-planner',
  version: 3,
  positioning: {
    'tr-TR': 'PromtGen, AI kodlama araçlarıyla çalışan bireysel geliştiricilerin dağınık proje fikirlerini; onaylanmış bir fikir tasarımına, gerekçeli teknik kararlara ve izlenebilir gereksinim-görev-test paketlerine dönüştüren local-first proje tasarım aracıdır.',
    'en-US': 'PromtGen is a local-first project design tool that turns an individual AI-assisted developer’s rough idea into an approved idea design, justified technical decisions, and traceable requirement-task-test packages.'
  },
  primaryUser: {
    'tr-TR': 'AI kodlama araçları kullanan ve kapsam, görev parçalama, dokümantasyon veya karar sürekliliğinde zorlanan bireysel geliştirici.',
    'en-US': 'An individual developer using AI coding tools who needs help maintaining scope, task decomposition, documentation, and decision continuity.'
  },
  promise: {
    'tr-TR': 'Fikrini anlat; birlikte netleştirelim ve onayla. Sonra nasıl kuracağımızı tasarlayıp onayla. Planını kodlama aracına dışa aktar.',
    'en-US': 'Describe your idea, clarify it together and approve it. Then design how to build it and approve that. Export the plan to your coding tool.'
  },
  userProblems: [
    'Dağınık proje fikrini net bir kapsama dönüştürememek.',
    'Teknik kararları hiç konuşmadan ya da gereksinimlerin içine gömerek ilerlemek.',
    'Kararların gerekçesini ve sonradan değişen etkilerini kaybetmek.',
    'Gereksinimleri doğrulanabilir geliştirme görevlerine bağlayamamak.',
    'AI kodlama araçlarına çelişkili veya eksik görev bağlamı vermek.'
  ],
  // `Yeni Plan` yanlıştı: kullanıcı ilk aşamada plan yapmıyor, proje tasarlıyor.
  coreNavigation: ['Projeler', 'Yeni Proje', 'Yaşayan Plan', 'Revizyonlar', 'Export'],
  labsNavigation: ['Görev Teslim Kanıtı', 'Proje Analizörü', 'Codex Yürütmesi', 'Mimari Karşılaştırma', 'Uzman Perspektifleri'],
  coreExports: ['PROJECT_BRIEF.md', 'REQUIREMENTS.md', 'DECISIONS.md', 'TASKS.md', 'AGENTS.md', 'project.promtgen'],
  supportedProjects: [
    { id: 'web-app', label: 'Web uygulaması', support: 'candidate-stable', limitations: ['Benchmark ve gerçek kullanıcı kanıtı henüz tamamlanmadı.'] },
    { id: 'backend-api', label: 'Backend / API', support: 'candidate-stable', limitations: ['Benchmark ve gerçek kullanıcı kanıtı henüz tamamlanmadı.'] },
    { id: 'small-saas', label: 'Küçük SaaS', support: 'candidate-stable', limitations: ['Benchmark ve gerçek kullanıcı kanıtı henüz tamamlanmadı.'] },
    { id: 'admin-panel', label: 'Yönetim paneli', support: 'candidate-stable', limitations: ['Benchmark ve gerçek kullanıcı kanıtı henüz tamamlanmadı.'] },
    { id: 'internal-tool', label: 'İç araç', support: 'candidate-stable', limitations: ['Benchmark ve gerçek kullanıcı kanıtı henüz tamamlanmadı.'] },
    { id: 'automation', label: 'Basit otomasyon', support: 'beta', limitations: ['Alan benchmark seti henüz tamamlanmadı.'] },
    { id: 'mobile-app', label: 'Mobil uygulama', support: 'beta', limitations: ['Platforma özel dağıtım ayrıntıları insan incelemesi gerektirir.'] },
    { id: 'desktop-app', label: 'Masaüstü uygulaması', support: 'beta', limitations: ['Platforma özel paketleme ayrıntıları insan incelemesi gerektirir.'] },
    { id: 'ai-rag', label: 'AI / RAG uygulaması', support: 'experimental', limitations: ['Model ve veri kalitesi değerlendirmesi otomatik doğrulanmaz.'] },
    { id: 'game-2d', label: '2D oyun', support: 'experimental', limitations: ['Oyun motoruna özel sonuçlar benchmark ile kanıtlanmadı.'] },
    { id: 'game-3d', label: '3D oyun', support: 'unsupported', unsupportedReason: 'unmeasured', limitations: ['Bir alan paketi (domain-packs/game.ts) artık var; ancak üretime hazırlık henüz ölçülmedi, garanti verilmez.', 'Tasarım aşaması yardımı reddedilmiş değil, ölçülmemiş: promtgen-comparison-v2 çalışmasında bu alandan bir senaryo var.'] },
    { id: 'multiplayer-game', label: 'Çok oyunculu oyun', support: 'unsupported', unsupportedReason: 'unmeasured', limitations: ['Bir alan paketi (domain-packs/game.ts) artık var; ancak dağıtık oyun mimarisi için üretime hazırlık henüz ölçülmedi, garanti verilmez.', 'Ölçülmemiş; kanıt üretilirse seviye yükselebilir.'] },
    { id: 'critical-health', label: 'Kritik sağlık sistemi', support: 'unsupported', unsupportedReason: 'refused', limitations: ['Düzenleyici ve klinik doğrulama sağlanmaz.', 'Bu bir ölçüm eksikliği DEĞİL: kanıt ne çıkarsa çıksın bu alan hizmet kapsamına alınmaz.'] },
    { id: 'critical-finance', label: 'Kritik finans sistemi', support: 'unsupported', unsupportedReason: 'refused', limitations: ['Düzenleyici ve finansal güvence sağlanmaz.', 'Bu bir ölçüm eksikliği DEĞİL: kanıt ne çıkarsa çıksın bu alan hizmet kapsamına alınmaz.'] },
    { id: 'large-distributed', label: 'Büyük dağıtık altyapı', support: 'unsupported', unsupportedReason: 'refused', limitations: ['Kurumsal kapasite ve operasyon garantisi verilmez.', 'Bu bir olcum eksikligi DEGIL: bu olcekte operasyon sorumlulugu devredilemez.'] }
  ],
  nonGoals: [
    'Canonical planı kullanıcı onayı olmadan değiştirmek.',
    'Her proje alanında uzman veya üretime hazır sonuç iddia etmek.',
    'Kaynak kodu doğrudan yazmayı veya değiştirmeyi ana ürün akışına dönüştürmek.',
    'Planner doğrulanmadan otomatik kod yürütmeyi ana ürün haline getirmek.',
    'Bulut senkronizasyonu, hesap veya çok kullanıcılı işbirliği sunmak.',
    'Antivirüs, SAST, hukuki, finansal veya klinik doğrulama sağlamak.'
  ],
  mistakenIdentities: [
    'PromtGen bir prompt üreteci değildir; çıktısı istem metni değil, onaylanmış proje tasarımıdır.',
    'PromtGen bir prompt pazarı veya hazır istem kütüphanesi değildir.',
    'PromtGen bir MVP anketi değildir; kullanıcıya sabit bir kapsam formu doldurtmaz.',
    'PromtGen otonom bir kodlama ajanı değildir; kodu kendisi yazıp yürütmez.',
    'PromtGen bir Fikir → MVP → Görevler hattı değildir; o model V3 ile birlikte bırakıldı.'
  ],
  mvpRule: 'MVP kavramı yasak değildir: bir projenin kendi kapsamını “MVP” diye adlandırması meşrudur. Yasak olan, MVP’nin PromtGen’in evrensel yaşam döngüsü aşaması olmasıdır.',
  codePolicy: [
    'PromtGen’in varsayılan çıktısı kod değil; onaylanmış plan, görev sözleşmesi ve doğrulama kanıtıdır.',
    'Plan–kod uyumluluk kontrolü salt okunurdur ve kaynak dosyaları değiştirmez.',
    'Kod üretimi veya yürütmesi yalnız kullanıcı açıkça istediğinde, Labs içinde ve görev kapsamı onaylandıktan sonra kullanılabilir.',
    'Hiçbir kod değişikliği canonical planı veya tamamlanma kanıtını kullanıcı onayı olmadan güncelleyemez.'
  ],
  maturityPolicies: {
    'candidate-stable': {
      label: 'Candidate Stable',
      requirements: [
        'Çekirdek üretim akışı otomatik entegrasyon testleriyle korunur.',
        'Stable terfi kapısı için benchmark ve gerçek kullanıcı kanıtı henüz tamamlanmamıştır.',
        'Bilinen sınırlamalar ve kurtarma yolu açıkça yayınlanır.'
      ]
    },
    stable: {
      label: 'Stable',
      requirements: [
        'Otomatik üretim entegrasyon testi vardır.',
        'Desteklenen her platform için kanıt kaydı vardır.',
        'Veri kaybında kurtarma veya geri alma yolu belgelenmiştir.',
        'Bilinen sınırlamalar kullanıcıya gösterilir.',
        'Gerçek senaryo ve kullanıcı kanıtı ayrıca CAPABILITY_EVIDENCE belgesinde izlenir.'
      ]
    },
    beta: {
      label: 'Beta',
      requirements: [
        'Çekirdek akış tamamlanabilir.',
        'Kenar durumlar ve veri formatı değişebilir.',
        'Sonuç insan onayı gerektirir ve kullanıcıya açık uyarı gösterilir.'
      ]
    },
    experimental: {
      label: 'Experimental',
      requirements: [
        'Ana Planner akışında öne çıkarılmaz.',
        'Üretim sonucu veya doğruluk garantisi olarak sunulmaz.',
        'Dosya veya plan değişikliğinden önce ek kullanıcı onayı gerekir.'
      ]
    }
  },
  successMetrics: [
    { id: 'must-requirement-task-trace', target: 'Must gereksinimlerin en az %95’i görevlere bağlı', evidenceRequired: true },
    { id: 'task-acceptance-criteria', target: 'Görevlerin en az %90’ında kabul kriteri var', evidenceRequired: true },
    { id: 'critical-requirement-verification', target: 'Kritik gereksinimlerin %100’ü doğrulama yöntemine bağlı', evidenceRequired: true },
    { id: 'first-export-completion', target: 'Kullanıcıların en az %80’i yardım almadan ilk export’a ulaşabiliyor', evidenceRequired: true },
    { id: 'recovery-success', target: 'Test edilen veri kaybı senaryolarında kurtarma başarısı %100', evidenceRequired: true }
  ]
} satisfies ProductContract);

export function getProductCopy(locale: ProductLocale) {
  return {
    positioning: PRODUCT_CONTRACT.positioning[locale],
    primaryUser: PRODUCT_CONTRACT.primaryUser[locale],
    promise: PRODUCT_CONTRACT.promise[locale]
  };
}
