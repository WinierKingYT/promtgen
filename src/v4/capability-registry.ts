export type CapabilityMaturity = 'prototype' | 'experimental' | 'beta' | 'stable';

export type CapabilityEvidenceLevel = 'unit-test' | 'integration-test' | 'browser-e2e' | 'native-e2e' | 'manual-only';
export type ProductPlatform = 'web' | 'desktop';

export interface CapabilityEvidence {
  testId: string;
  level: CapabilityEvidenceLevel;
  platforms: ProductPlatform[];
}

export interface ProductCapability {
  id: string;
  publicName: string;
  description: string;
  maturity: CapabilityMaturity;
  platforms: ProductPlatform[];
  platformMaturity: Record<ProductPlatform, CapabilityMaturity | 'unsupported'>;
  implementationMode: 'static-template' | 'rule-engine' | 'ai-generated' | 'native-runtime';
  limitations: string[];
  evidence: CapabilityEvidence[];
}

export const CAPABILITY_REGISTRY: ProductCapability[] = [
  {
    id: 'canonical-planning',
    publicName: 'Canonical Yaşayan Plan ve Revizyon Yönetimi',
    description: 'Proje durumunun JSON formatında saklanması, sürüm takibi ve geri alma.',
    maturity: 'stable',
    platforms: ['web', 'desktop'],
    platformMaturity: { web: 'stable', desktop: 'stable' },
    implementationMode: 'rule-engine',
    limitations: ['Tarayıcı profili tamamen silinirse web checkpointleri de silinir.'],
    evidence: [
      { testId: 'tests/v4/acceptance-flow.test.js', level: 'integration-test', platforms: ['web', 'desktop'] },
      { testId: 'tests/e2e/guided-workflow.spec.ts', level: 'browser-e2e', platforms: ['web'] }
    ]
  },
  {
    id: 'local-storage-recovery',
    publicName: 'Local-First Depolama ve Yedekleme',
    description: 'Web IndexedDB ve desktop SQLite üzerinde checkpoint, karantina ve yeni revision olarak kurtarma.',
    maturity: 'stable',
    platforms: ['web', 'desktop'],
    platformMaturity: { web: 'stable', desktop: 'stable' },
    implementationMode: 'native-runtime',
    limitations: ['Web ve desktop yedekleri cihaz dışına otomatik eşitlenmez.'],
    evidence: [
      { testId: 'tests/v4/storage-durability.test.ts', level: 'integration-test', platforms: ['web'] },
      { testId: 'tests/v4/desktop-storage.test.js', level: 'native-e2e', platforms: ['desktop'] }
    ]
  },
  {
    id: 'expert-perspectives',
    publicName: 'Uzman Perspektifleri',
    description: 'Proje alanına göre cihaz üzerinde oluşturulan mimari değerlendirme kartları.',
    maturity: 'experimental',
    platforms: ['web', 'desktop'],
    platformMaturity: { web: 'experimental', desktop: 'experimental' },
    implementationMode: 'rule-engine',
    limitations: [
      'Bağımsız LLM ajanları çalıştırmaz',
      'Alan tespiti yerel kural motoruna dayanır'
    ],
    evidence: [{ testId: 'tests/v4/review-engine.test.js', level: 'unit-test', platforms: ['web', 'desktop'] }]
  },
  {
    id: 'architecture-comparator-template',
    publicName: 'Mimari Karşılaştırma Şablonu',
    description: 'Farklı mimari yaklaşımların maliyet ve efor kriterleriyle karşılaştırıldığı düzenlenebilir matris.',
    maturity: 'beta',
    platforms: ['web', 'desktop'],
    platformMaturity: { web: 'beta', desktop: 'beta' },
    implementationMode: 'static-template',
    limitations: [
      'Otomatik benchmark hesaplanmaz; değerler kullanıcı varsayımıdır'
    ],
    evidence: [{ testId: 'tests/v4/idea-lab.test.js', level: 'unit-test', platforms: ['web', 'desktop'] }]
  },
  {
    id: 'ai-discovery-provider',
    publicName: 'AI Sağlayıcı Entegrasyonu',
    description: 'Ollama, OpenAI, Gemini ve NVIDIA sağlayıcıları üzerinden plan önerileri üretimi.',
    maturity: 'beta',
    platforms: ['web', 'desktop'],
    platformMaturity: { web: 'beta', desktop: 'beta' },
    implementationMode: 'ai-generated',
    limitations: [
      'AI çağrısı başarısız olduğunda Yerel Kural Motoru fallback olarak devreye girer',
      'Ollama performansı kullanıcı donanımına bağlıdır'
    ],
    evidence: [
      { testId: 'tests/v4/provider-orchestrator.test.ts', level: 'unit-test', platforms: ['web', 'desktop'] },
      { testId: 'tests/v4/provider-integration.test.js', level: 'integration-test', platforms: ['web', 'desktop'] }
    ]
  },
  {
    id: 'native-codex-execution',
    publicName: 'İzole Codex Worktree Yürütmesi',
    description: 'Desktop modunda Codex CLI ile izole worktree üzerinde görev çalıştırma.',
    maturity: 'beta',
    platforms: ['desktop'],
    platformMaturity: { web: 'unsupported', desktop: 'beta' },
    implementationMode: 'native-runtime',
    limitations: [
      'Codex CLI ayrıca kurulmalıdır',
      'Executable yayıncı imzası veya binary imza bütünlüğü doğrulanmaz'
    ],
    evidence: [{ testId: 'src-tauri/src/execution.rs', level: 'native-e2e', platforms: ['desktop'] }]
  },
  {
    id: 'project-inventory-analyzer',
    publicName: 'Dosya Envanteri ve Güvenlik Filtresi',
    description: 'Yerel proje klasörünün envantere alınması ve hassas dosyaların dışarıda bırakılması.',
    maturity: 'stable',
    platforms: ['web', 'desktop'],
    platformMaturity: { web: 'stable', desktop: 'stable' },
    implementationMode: 'rule-engine',
    limitations: [
      'Browser ortamında dosya içeriği sınırlı taranır',
      'Masaüstü ortamında dosya yapısı incelenir; tam antivirüs veya SAST taraması yapılmaz'
    ],
    evidence: [
      { testId: 'tests/v4/project-analyzer.test.js', level: 'integration-test', platforms: ['web'] },
      { testId: 'src-tauri/src/lib.rs', level: 'native-e2e', platforms: ['desktop'] }
    ]
  },
  {
    id: 'canonical-export',
    publicName: 'Gelişmiş Dışa Aktarım',
    description: 'Canonical revision üzerinden Markdown, görev, ajan ve taşınabilir paket çıktıları.',
    maturity: 'stable',
    platforms: ['web', 'desktop'],
    platformMaturity: { web: 'stable', desktop: 'stable' },
    implementationMode: 'rule-engine',
    limitations: ['IDE adaptörleri kodu otomatik çalıştırmaz; çalışma paketi üretir.'],
    evidence: [
      { testId: 'tests/v4/migration-export.test.js', level: 'integration-test', platforms: ['web', 'desktop'] }
    ]
  }
];

export function getCapability(id: string): ProductCapability | undefined {
  return CAPABILITY_REGISTRY.find(cap => cap.id === id);
}
