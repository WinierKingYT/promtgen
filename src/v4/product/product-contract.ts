export type SupportLevel = 'candidate-stable' | 'stable' | 'beta' | 'experimental' | 'unsupported';
export type ProductLocale = 'tr-TR' | 'en-US';

export interface SupportedProjectType {
  id: string;
  label: string;
  support: SupportLevel;
  limitations: string[];
}

export interface MaturityPolicy {
  label: string;
  requirements: string[];
}

export interface ProductContract {
  id: 'promtgen-focused-planner';
  version: 2;
  positioning: Record<ProductLocale, string>;
  primaryUser: Record<ProductLocale, string>;
  promise: Record<ProductLocale, string>;
  userProblems: string[];
  coreNavigation: string[];
  labsNavigation: string[];
  coreExports: string[];
  supportedProjects: SupportedProjectType[];
  nonGoals: string[];
  codePolicy: string[];
  maturityPolicies: Record<Exclude<SupportLevel, 'unsupported'>, MaturityPolicy>;
  successMetrics: Array<{ id: string; target: string; evidenceRequired: boolean }>;
}

export const PRODUCT_CONTRACT = Object.freeze({
  id: 'promtgen-focused-planner',
  version: 2,
  positioning: {
    'tr-TR': 'PromtGen, AI kodlama araçlarıyla çalışan bireysel geliştiricilerin dağınık proje fikirlerini; onaylanmış MVP kapsamına, izlenebilir gereksinimlere ve uygulanabilir görev paketlerine dönüştüren local-first proje planlama aracıdır.',
    'en-US': 'PromtGen is a local-first project planning tool that turns an individual AI-assisted developer’s rough idea into an approved MVP scope, traceable requirements, and actionable task packages.'
  },
  primaryUser: {
    'tr-TR': 'AI kodlama araçları kullanan ve kapsam, görev parçalama, dokümantasyon veya karar sürekliliğinde zorlanan bireysel geliştirici.',
    'en-US': 'An individual developer using AI coding tools who needs help maintaining scope, task decomposition, documentation, and decision continuity.'
  },
  promise: {
    'tr-TR': 'Fikrini anlat; yorumumuzu doğrula, MVP sınırlarını seç ve kodlama aracına uygulanabilir planını dışa aktar.',
    'en-US': 'Describe your idea, verify the interpretation, choose the MVP boundaries, and export an actionable plan for your coding tool.'
  },
  userProblems: [
    'Dağınık proje fikrini net bir MVP kapsamına dönüştürememek.',
    'Kararların gerekçesini ve sonradan değişen etkilerini kaybetmek.',
    'Gereksinimleri doğrulanabilir geliştirme görevlerine bağlayamamak.',
    'AI kodlama araçlarına çelişkili veya eksik görev bağlamı vermek.'
  ],
  coreNavigation: ['Projeler', 'Yeni Plan', 'Yaşayan Plan', 'Revizyonlar', 'Export'],
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
    { id: 'game-3d', label: '3D oyun', support: 'unsupported', limitations: ['Alan paketi bulunmuyor.'] },
    { id: 'multiplayer-game', label: 'Çok oyunculu oyun', support: 'unsupported', limitations: ['Dağıtık oyun mimarisi destek sözleşmesi dışında.'] },
    { id: 'critical-health', label: 'Kritik sağlık sistemi', support: 'unsupported', limitations: ['Düzenleyici ve klinik doğrulama sağlanmaz.'] },
    { id: 'critical-finance', label: 'Kritik finans sistemi', support: 'unsupported', limitations: ['Düzenleyici ve finansal güvence sağlanmaz.'] },
    { id: 'large-distributed', label: 'Büyük dağıtık altyapı', support: 'unsupported', limitations: ['Kurumsal kapasite ve operasyon garantisi verilmez.'] }
  ],
  nonGoals: [
    'Canonical planı kullanıcı onayı olmadan değiştirmek.',
    'Her proje alanında uzman veya üretime hazır sonuç iddia etmek.',
    'Kaynak kodu doğrudan yazmayı veya değiştirmeyi ana ürün akışına dönüştürmek.',
    'Planner doğrulanmadan otomatik kod yürütmeyi ana ürün haline getirmek.',
    'Bulut senkronizasyonu, hesap veya çok kullanıcılı işbirliği sunmak.',
    'Antivirüs, SAST, hukuki, finansal veya klinik doğrulama sağlamak.'
  ],
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
