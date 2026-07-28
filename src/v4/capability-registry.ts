import { PLANNER_BENCHMARK_EVIDENCE } from './product/generated-benchmark-evidence.js';
import { COMPARISON_EVIDENCE } from './product/generated-comparison-evidence.js';

export type CapabilityMaturity = 'prototype' | 'experimental' | 'beta' | 'candidate-stable' | 'stable';

export type CapabilityEvidenceLevel = 'unit-test' | 'integration-test' | 'browser-e2e' | 'native-e2e' | 'manual-only';
export type ProductPlatform = 'web' | 'desktop';

export interface CapabilityEvidence {
  testId: string;
  level: CapabilityEvidenceLevel;
  platforms: ProductPlatform[];
}

export interface CapabilityPromotionEvidence {
  scenarios: {
    completed: number;
    passed: number;
    source: string | null;
  };
  users: {
    participants: number;
    source: string | null;
  };
  recovery: {
    documented: boolean;
    path: string | null;
  };
  criticalKnownDefects: number;
  lastVerifiedCommit: string;
  lastReviewed: string;
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
  supportedDomains: string[];
  promotionEvidence: CapabilityPromotionEvidence;
}

export const STABLE_PROMOTION_POLICY = Object.freeze({
  minimumScenarioCount: 5,
  minimumScenarioPassRate: 0.9,
  minimumUserParticipants: 5,
  productionEvidenceLevels: ['integration-test', 'browser-e2e', 'native-e2e'] as CapabilityEvidenceLevel[]
});

export interface StableEligibility {
  eligible: boolean;
  blockers: string[];
  metrics: {
    integrationTests: number;
    scenarioCount: number;
    scenarioPassRate: number;
    userParticipants: number;
  };
}

export function evaluateStableEligibility(capability: ProductCapability): StableEligibility {
  const integrationTests = capability.evidence.filter(item =>
    STABLE_PROMOTION_POLICY.productionEvidenceLevels.includes(item.level)
  ).length;
  const scenarioCount = capability.promotionEvidence.scenarios.completed;
  const scenarioPassRate = scenarioCount
    ? capability.promotionEvidence.scenarios.passed / scenarioCount
    : 0;
  const blockers = [
    ...(integrationTests > 0 ? [] : ['En az bir üretim entegrasyon testi gerekli.']),
    ...(capability.platforms.every(platform => capability.evidence.some(item => item.platforms.includes(platform)))
      ? []
      : ['Desteklenen her platform için otomatik kanıt gerekli.']),
    ...(scenarioCount >= STABLE_PROMOTION_POLICY.minimumScenarioCount
      ? []
      : [`En az ${STABLE_PROMOTION_POLICY.minimumScenarioCount} benchmark senaryosu gerekli.`]),
    ...(scenarioPassRate >= STABLE_PROMOTION_POLICY.minimumScenarioPassRate
      ? []
      : [`Benchmark başarı oranı en az %${STABLE_PROMOTION_POLICY.minimumScenarioPassRate * 100} olmalı.`]),
    ...(capability.promotionEvidence.criticalKnownDefects === 0 ? [] : ['Açık kritik kusur bulunmamalı.']),
    ...(capability.promotionEvidence.recovery.documented && capability.promotionEvidence.recovery.path
      ? []
      : ['Kurtarma veya geri alma yolu belgelenmeli.']),
    ...(capability.promotionEvidence.users.participants >= STABLE_PROMOTION_POLICY.minimumUserParticipants
      ? []
      : [`En az ${STABLE_PROMOTION_POLICY.minimumUserParticipants} kullanıcıdan kanıt gerekli.`]),
    ...(capability.promotionEvidence.lastVerifiedCommit ? [] : ['Son doğrulanan commit kaydı gerekli.'])
  ];
  return {
    eligible: blockers.length === 0,
    blockers,
    metrics: {
      integrationTests,
      scenarioCount,
      scenarioPassRate,
      userParticipants: capability.promotionEvidence.users.participants
    }
  };
}

const baselinePromotionEvidence = (
  recoveryPath: string | null,
  overrides: Partial<CapabilityPromotionEvidence> = {}
): CapabilityPromotionEvidence => ({
  scenarios: { completed: 0, passed: 0, source: null },
  users: { participants: 0, source: null },
  recovery: { documented: Boolean(recoveryPath), path: recoveryPath },
  criticalKnownDefects: 0,
  lastVerifiedCommit: '2acd7ba',
  lastReviewed: '2026-07-28',
  ...overrides
});

const benchmarkScenarios = (capabilityId: string): CapabilityPromotionEvidence['scenarios'] => {
  const evidence = PLANNER_BENCHMARK_EVIDENCE.capabilities[capabilityId];
  return evidence
    ? { ...evidence, source: PLANNER_BENCHMARK_EVIDENCE.reportPath }
    : { completed: 0, passed: 0, source: null };
};

const userEvidence = (capabilityId: string): CapabilityPromotionEvidence['users'] => ({
  participants: COMPARISON_EVIDENCE.userParticipantsByCapability[capabilityId] || 0,
  source: COMPARISON_EVIDENCE.reportPath
});

export const CAPABILITY_REGISTRY: ProductCapability[] = [
  {
    id: 'canonical-planning',
    publicName: 'Canonical Yaşayan Plan ve Revizyon Yönetimi',
    description: 'Proje durumunun JSON formatında saklanması, sürüm takibi ve geri alma.',
    maturity: 'candidate-stable',
    platforms: ['web', 'desktop'],
    platformMaturity: { web: 'candidate-stable', desktop: 'candidate-stable' },
    implementationMode: 'rule-engine',
    limitations: ['Tarayıcı profili tamamen silinirse web checkpointleri de silinir.'],
    evidence: [
      { testId: 'tests/v4/acceptance-flow.test.js', level: 'integration-test', platforms: ['web', 'desktop'] },
      { testId: 'tests/e2e/guided-workflow.spec.ts', level: 'browser-e2e', platforms: ['web'] }
    ],
    supportedDomains: ['web-app', 'backend-api', 'small-saas', 'admin-panel', 'internal-tool'],
    promotionEvidence: baselinePromotionEvidence('docs/release/rollback.md', {
      scenarios: benchmarkScenarios('canonical-planning'),
      users: userEvidence('canonical-planning')
    })
  },
  {
    id: 'local-storage-recovery',
    publicName: 'Local-First Depolama ve Yedekleme',
    description: 'Web IndexedDB ve desktop SQLite üzerinde checkpoint, karantina ve yeni revision olarak kurtarma.',
    maturity: 'candidate-stable',
    platforms: ['web', 'desktop'],
    platformMaturity: { web: 'candidate-stable', desktop: 'candidate-stable' },
    implementationMode: 'native-runtime',
    limitations: ['Web ve desktop yedekleri cihaz dışına otomatik eşitlenmez.'],
    evidence: [
      { testId: 'tests/v4/storage-durability.test.ts', level: 'integration-test', platforms: ['web'] },
      { testId: 'tests/v4/desktop-storage.test.js', level: 'native-e2e', platforms: ['desktop'] }
    ],
    supportedDomains: ['web-app', 'backend-api', 'small-saas', 'admin-panel', 'internal-tool'],
    promotionEvidence: baselinePromotionEvidence('docs/release/rollback.md', {
      users: userEvidence('local-storage-recovery')
    })
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
    evidence: [{ testId: 'tests/v4/review-engine.test.js', level: 'unit-test', platforms: ['web', 'desktop'] }],
    supportedDomains: ['web-app', 'backend-api'],
    promotionEvidence: baselinePromotionEvidence(null)
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
    evidence: [{ testId: 'tests/v4/idea-lab.test.js', level: 'unit-test', platforms: ['web', 'desktop'] }],
    supportedDomains: ['web-app', 'backend-api', 'small-saas'],
    promotionEvidence: baselinePromotionEvidence(null)
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
    ],
    supportedDomains: ['web-app', 'backend-api', 'small-saas', 'admin-panel', 'internal-tool'],
    promotionEvidence: baselinePromotionEvidence(null)
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
    evidence: [{ testId: 'src-tauri/src/execution.rs', level: 'native-e2e', platforms: ['desktop'] }],
    supportedDomains: ['web-app', 'backend-api'],
    promotionEvidence: baselinePromotionEvidence('docs/release/rollback.md')
  },
  {
    id: 'project-inventory-analyzer',
    publicName: 'Dosya Envanteri ve Güvenlik Filtresi',
    description: 'Yerel proje klasörünün envantere alınması ve hassas dosyaların dışarıda bırakılması.',
    maturity: 'candidate-stable',
    platforms: ['web', 'desktop'],
    platformMaturity: { web: 'candidate-stable', desktop: 'candidate-stable' },
    implementationMode: 'rule-engine',
    limitations: [
      'Browser ortamında dosya içeriği sınırlı taranır',
      'Masaüstü ortamında dosya yapısı incelenir; tam antivirüs veya SAST taraması yapılmaz'
    ],
    evidence: [
      { testId: 'tests/v4/project-analyzer.test.js', level: 'integration-test', platforms: ['web'] },
      { testId: 'src-tauri/src/lib.rs', level: 'native-e2e', platforms: ['desktop'] }
    ],
    supportedDomains: ['web-app', 'backend-api', 'small-saas', 'admin-panel', 'internal-tool'],
    promotionEvidence: baselinePromotionEvidence(null, {
      users: userEvidence('project-inventory-analyzer')
    })
  },
  {
    id: 'canonical-export',
    publicName: 'Gelişmiş Dışa Aktarım',
    description: 'Canonical revision üzerinden Markdown, görev, ajan ve taşınabilir paket çıktıları.',
    maturity: 'candidate-stable',
    platforms: ['web', 'desktop'],
    platformMaturity: { web: 'candidate-stable', desktop: 'candidate-stable' },
    implementationMode: 'rule-engine',
    limitations: ['IDE adaptörleri kodu otomatik çalıştırmaz; çalışma paketi üretir.'],
    evidence: [
      { testId: 'tests/v4/migration-export.test.js', level: 'integration-test', platforms: ['web', 'desktop'] }
    ],
    supportedDomains: ['web-app', 'backend-api', 'small-saas', 'admin-panel', 'internal-tool'],
    promotionEvidence: baselinePromotionEvidence('docs/release/rollback.md', {
      scenarios: benchmarkScenarios('canonical-export'),
      users: userEvidence('canonical-export')
    })
  }
];

export function getCapability(id: string): ProductCapability | undefined {
  return CAPABILITY_REGISTRY.find(cap => cap.id === id);
}
