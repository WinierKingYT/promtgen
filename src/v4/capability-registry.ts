import { PLANNER_BENCHMARK_EVIDENCE } from './product/generated-benchmark-evidence.js';
import { COMPARISON_EVIDENCE } from './product/generated-comparison-evidence.js';
import { WEB_SAAS_BENCHMARK_EVIDENCE } from './product/generated-web-saas-evidence.js';
import { BACKEND_API_BENCHMARK_EVIDENCE } from './product/generated-backend-api-evidence.js';
import { IMPLEMENTATION_EVIDENCE_BENCHMARK } from './product/generated-implementation-evidence.js';
import { PLAN_CODE_ALIGNMENT_BENCHMARK } from './product/generated-plan-code-alignment-evidence.js';
import { PROJECT_INVENTORY_BENCHMARK_EVIDENCE } from './product/generated-project-inventory-evidence.js';
import { PROVIDER_INTEGRATION_BENCHMARK_EVIDENCE } from './product/generated-provider-integration-evidence.js';
import { NATIVE_EXECUTION_BENCHMARK_EVIDENCE } from './product/generated-native-execution-evidence.js';
import { STORAGE_DURABILITY_BENCHMARK_EVIDENCE } from './product/generated-storage-durability-evidence.js';
import { ARCHITECTURE_COMPARATOR_BENCHMARK_EVIDENCE } from './product/generated-architecture-comparator-evidence.js';
import { EXPERT_PERSPECTIVES_BENCHMARK_EVIDENCE } from './product/generated-expert-perspectives-evidence.js';

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
  /** Tüm engeller: yeteneğin kendi kanıtı + sürüm bağlamı. Terfi kararı bunu kullanır. */
  blockers: string[];
  /**
   * Yalnız yeteneğin kendi kanıtına bağlı engeller (test, senaryo, kullanıcı,
   * kurtarma). Bunlar kod ve kanıt üretilerek kapatılabilir.
   */
  capabilityBlockers: string[];
  /**
   * Yalnız sürüm bağlamına bağlı engeller (güncel build/CI commit eşleşmesi).
   * Bu boyut statik olarak doğrulanamaz; commit bağlamı verilmediğinde her
   * yetenek için aynı biçimde dolar. Yeteneğin olgunluğu hakkında bilgi
   * taşımaz, bu yüzden yetenek engellerinden ayrı raporlanır.
   */
  releaseContextBlockers: string[];
  metrics: {
    integrationTests: number;
    scenarioCount: number;
    scenarioPassRate: number;
    userParticipants: number;
    commitEvidenceCurrent: boolean;
  };
}

export interface StableVerificationContext {
  currentCommitSha?: string | null;
  verifiedCommitSha?: string | null;
}

export function commitEvidenceMatches(currentCommitSha?: string | null, verifiedCommitSha?: string | null): boolean {
  const current = currentCommitSha?.trim().toLowerCase() || '';
  const verified = verifiedCommitSha?.trim().toLowerCase() || '';
  const gitSha = /^[0-9a-f]{7,40}$/;
  if (!gitSha.test(current) || !gitSha.test(verified)) return false;
  return current.startsWith(verified) || verified.startsWith(current);
}

export function evaluateStableEligibility(
  capability: ProductCapability,
  verification: StableVerificationContext = {}
): StableEligibility {
  const integrationTests = capability.evidence.filter(item =>
    STABLE_PROMOTION_POLICY.productionEvidenceLevels.includes(item.level)
  ).length;
  const scenarioCount = capability.promotionEvidence.scenarios.completed;
  const scenarioPassRate = scenarioCount
    ? capability.promotionEvidence.scenarios.passed / scenarioCount
    : 0;
  const verifiedCommitSha = verification.verifiedCommitSha
    ?? capability.promotionEvidence.lastVerifiedCommit;
  const commitEvidenceCurrent = commitEvidenceMatches(verification.currentCommitSha, verifiedCommitSha);
  const capabilityBlockers = [
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
      : [`En az ${STABLE_PROMOTION_POLICY.minimumUserParticipants} kullanıcıdan kanıt gerekli.`])
  ];
  // Commit boyutu yeteneğin kendi kanıtı değil, kanıtın hangi sürüme ait
  // olduğudur. Statik belge üretiminde commit bağlamı yoktur ve bu engel her
  // yetenekte aynı şekilde çıkar; yetenek engelleriyle karıştırılmamalı.
  const releaseContextBlockers = !verification.currentCommitSha
    ? ['Güncel build/CI commit bağlamı olmadan Stable kanıtı doğrulanamaz.']
    : !verifiedCommitSha
      ? ['Doğrulanan commit kanıtı gerekli.']
      : commitEvidenceCurrent
        ? []
        : [`Kanıt commit'i güncel build ile eşleşmiyor (kanıt: ${verifiedCommitSha}, build: ${verification.currentCommitSha}).`];
  const blockers = [...capabilityBlockers, ...releaseContextBlockers];
  return {
    eligible: blockers.length === 0,
    blockers,
    capabilityBlockers,
    releaseContextBlockers,
    metrics: {
      integrationTests,
      scenarioCount,
      scenarioPassRate,
      userParticipants: capability.promotionEvidence.users.participants,
      commitEvidenceCurrent
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
    id: 'readiness-quality-gate',
    publicName: 'Açıklanabilir Plan Kalite Kapısı',
    description: 'Canonical planın tamlık, tutarlılık, izlenebilirlik, risk kapsamı ve uygulanabilirlik kanıtlarını ölçer; kritik koşullar çözülmeden hazır durumunu önermez.',
    maturity: 'candidate-stable',
    platforms: ['web', 'desktop'],
    platformMaturity: { web: 'candidate-stable', desktop: 'candidate-stable' },
    implementationMode: 'rule-engine',
    limitations: [
      'Skor proje sonucunu veya dış kodlama aracının başarıyla kod yazacağını garanti etmez',
      'Kanıt parmak izi deterministik değişiklik tespiti içindir; kriptografik imza değildir',
      'Stable yükseltmesi için gerçek kullanıcı sonuç kanıtı gereklidir'
    ],
    evidence: [
      { testId: 'tests/v4/readiness-service.test.ts', level: 'integration-test', platforms: ['web', 'desktop'] },
      { testId: 'tests/e2e/smoke.spec.ts', level: 'browser-e2e', platforms: ['web'] }
    ],
    supportedDomains: ['web-app', 'backend-api', 'small-saas', 'admin-panel', 'internal-tool'],
    promotionEvidence: baselinePromotionEvidence('docs/release/rollback.md', {
      scenarios: benchmarkScenarios('readiness-quality-gate'),
      users: userEvidence('readiness-quality-gate')
    })
  },
  {
    id: 'web-saas-domain-pack',
    publicName: 'Web/SaaS Planlama Paketi',
    description: 'Web uygulaması, küçük SaaS ve panel planlarında koşullu alan soruları, kalite kapıları ve görev doğrulama rehberi.',
    maturity: 'candidate-stable',
    platforms: ['web', 'desktop'],
    platformMaturity: { web: 'candidate-stable', desktop: 'candidate-stable' },
    implementationMode: 'rule-engine',
    limitations: [
      'Büyük dağıtık altyapı ve kritik finans/sağlık sistemleri destek kapsamında değildir',
      'Framework veya sağlayıcı seçmez; güvenlik garantisi ya da penetrasyon testi sunmaz',
      'Stable yükseltmesi için gerçek kullanıcı ve alan benchmark kanıtı henüz tamamlanmamıştır'
    ],
    evidence: [
      { testId: 'tests/v4/web-saas-domain-pack.test.ts', level: 'integration-test', platforms: ['web', 'desktop'] },
      { testId: 'tests/e2e/guided-workflow.spec.ts', level: 'browser-e2e', platforms: ['web'] }
    ],
    supportedDomains: ['web-app', 'small-saas', 'admin-panel', 'internal-tool'],
    promotionEvidence: baselinePromotionEvidence('docs/release/rollback.md', {
      scenarios: WEB_SAAS_BENCHMARK_EVIDENCE,
      users: userEvidence('web-saas-domain-pack')
    })
  },
  {
    id: 'backend-api-domain-pack',
    publicName: 'Backend/API Planlama Paketi',
    description: 'Backend ve API planlarında sözleşme, hata modeli, yetki, veri bütünlüğü, idempotency ve işletim için koşullu kalite rehberi.',
    maturity: 'beta',
    platforms: ['web', 'desktop'],
    platformMaturity: { web: 'beta', desktop: 'beta' },
    implementationMode: 'rule-engine',
    limitations: [
      'Büyük dağıtık altyapı ve kritik finans/sağlık sistemleri destek kapsamında değildir',
      'Dil, framework, veritabanı veya bulut sağlayıcısı seçmez',
      'Güvenlik, yük veya kaos testi garantisi sunmaz; gerçek kullanıcı kanıtı henüz yoktur'
    ],
    evidence: [
      { testId: 'tests/v4/backend-api-domain-pack.test.ts', level: 'integration-test', platforms: ['web', 'desktop'] },
      { testId: 'tests/e2e/guided-workflow.spec.ts', level: 'browser-e2e', platforms: ['web'] }
    ],
    supportedDomains: ['backend-api', 'internal-api', 'integration-service'],
    promotionEvidence: baselinePromotionEvidence('docs/release/rollback.md', {
      scenarios: BACKEND_API_BENCHMARK_EVIDENCE,
      users: userEvidence('backend-api-domain-pack')
    })
  },
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
    id: 'implementation-evidence-review',
    publicName: 'Görev Teslim Kanıtı',
    description: 'Dışarıda yapılan kod değişikliklerini TaskContract dosya kapsamı, doğrulama komutları ve kabul kriterlerine göre kullanıcı onayından önce inceleme.',
    maturity: 'beta',
    platforms: ['web', 'desktop'],
    platformMaturity: { web: 'beta', desktop: 'beta' },
    implementationMode: 'rule-engine',
    limitations: [
      'PromtGen kod yazmaz ve kanıtın doğruluğunu bağımsız olarak garanti etmez',
      'Test çıktı özeti kullanıcı veya dış araç tarafından sağlanır',
      'Görev durumu yalnız açık kullanıcı onayından sonra güncellenir'
    ],
    evidence: [
      { testId: 'tests/v4/implementation-evidence.test.ts', level: 'integration-test', platforms: ['web', 'desktop'] },
      { testId: 'tests/e2e/smoke.spec.ts', level: 'browser-e2e', platforms: ['web'] }
    ],
    supportedDomains: ['web-app', 'backend-api', 'small-saas', 'admin-panel', 'internal-tool'],
    promotionEvidence: baselinePromotionEvidence('docs/release/rollback.md', {
      scenarios: IMPLEMENTATION_EVIDENCE_BENCHMARK,
      users: userEvidence('implementation-evidence-review')
    })
  },
  {
    id: 'plan-code-alignment',
    publicName: 'Plan–Kod Hizalama',
    description: 'Canonical görev sözleşmelerini güvenli dosya envanteri ve kullanıcıca sağlanan teslim kanıtıyla karşılaştıran açıklanabilir karar desteği.',
    maturity: 'beta',
    platforms: ['web', 'desktop'],
    platformMaturity: { web: 'beta', desktop: 'beta' },
    implementationMode: 'rule-engine',
    limitations: [
      'PromtGen kodu veya dosyaları doğrudan değiştirmez',
      'Dosya envanteri bir dosyanın gerçekten değiştiğini kanıtlamaz',
      'Değişen dosya bilgisi kullanıcı veya dış araç tarafından sağlanan kanıt paketine dayanır'
    ],
    evidence: [
      { testId: 'tests/v4/plan-code-alignment.test.ts', level: 'integration-test', platforms: ['web', 'desktop'] },
      { testId: 'tests/e2e/guided-workflow.spec.ts', level: 'browser-e2e', platforms: ['web'] }
    ],
    supportedDomains: ['web-app', 'backend-api', 'small-saas', 'admin-panel', 'internal-tool'],
    promotionEvidence: baselinePromotionEvidence('docs/release/rollback.md', {
      scenarios: PLAN_CODE_ALIGNMENT_BENCHMARK,
      users: userEvidence('plan-code-alignment')
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
      scenarios: STORAGE_DURABILITY_BENCHMARK_EVIDENCE,
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
      'Alan tespiti yerel kural motoruna dayanır',
      'Öneri metinleri sabit kural şablonlarındandır; proje analizinden türetilmez',
      'Oylama skoru plan kalite ölçütü değildir; yalnız kabul edilmiş karar sayısına ve güvenlik kararının varlığına bakar'
    ],
    evidence: [
      { testId: 'tests/v4/review-engine.test.js', level: 'unit-test', platforms: ['web', 'desktop'] },
      { testId: 'tests/v4/expert-perspectives.test.ts', level: 'integration-test', platforms: ['web', 'desktop'] }
    ],
    supportedDomains: ['web-app', 'backend-api'],
    promotionEvidence: baselinePromotionEvidence('docs/release/perspectives-recovery.md', {
      scenarios: EXPERT_PERSPECTIVES_BENCHMARK_EVIDENCE,
      users: userEvidence('expert-perspectives')
    })
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
      'Otomatik benchmark hesaplanmaz; değerler kullanıcı varsayımıdır',
      'Metrikler proje verisinden türetilmez; alan değişse de aynı başlangıç puanları sunulur',
      'Önerilen yaklaşım sabit bir varsayılandır, proje analizinden çıkarılmaz'
    ],
    evidence: [
      { testId: 'tests/v4/idea-lab.test.js', level: 'unit-test', platforms: ['web', 'desktop'] },
      { testId: 'tests/v4/architecture-comparator.test.ts', level: 'integration-test', platforms: ['web', 'desktop'] }
    ],
    supportedDomains: ['web-app', 'backend-api', 'small-saas'],
    promotionEvidence: baselinePromotionEvidence('docs/release/comparator-recovery.md', {
      scenarios: ARCHITECTURE_COMPARATOR_BENCHMARK_EVIDENCE,
      users: userEvidence('architecture-comparator-template')
    })
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
      'Ollama performansı kullanıcı donanımına bağlıdır',
      'Benchmark sağlayıcı sözleşmesini stub taşıma üzerinden ölçer; sağlayıcının yanıt kalitesini ölçmez',
      'Sağlayıcıya gönderilmiş istek geri çağrılamaz; bulut sağlayıcısının saklama politikası kapsam dışıdır'
    ],
    evidence: [
      { testId: 'tests/v4/provider-orchestrator.test.ts', level: 'unit-test', platforms: ['web', 'desktop'] },
      { testId: 'tests/v4/provider-integration.test.js', level: 'integration-test', platforms: ['web', 'desktop'] }
    ],
    supportedDomains: ['web-app', 'backend-api', 'small-saas', 'admin-panel', 'internal-tool'],
    promotionEvidence: baselinePromotionEvidence('docs/release/provider-recovery.md', {
      scenarios: PROVIDER_INTEGRATION_BENCHMARK_EVIDENCE,
      users: userEvidence('ai-discovery-provider')
    })
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
      'Yayıncı imzası yalnız Windows üzerinde doğrulanır; diğer platformlarda durum "doğrulanamadı" olarak raporlanır ve kullanıcı onayına bırakılır',
      'İmza doğrulaması yayıncı kimliğini denetler; Codex CLI\'ın çalışma zamanı davranışını güvence altına almaz'
    ],
    evidence: [{ testId: 'src-tauri/src/execution.rs', level: 'native-e2e', platforms: ['desktop'] }],
    supportedDomains: ['web-app', 'backend-api'],
    promotionEvidence: baselinePromotionEvidence('docs/release/rollback.md', {
      scenarios: NATIVE_EXECUTION_BENCHMARK_EVIDENCE,
      users: userEvidence('native-codex-execution')
    })
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
      'Metin dosyaları yalnız 256 KB sınırına kadar okunur; büyük ve binary dosyalar taranmadan metadata olarak alınır',
      'Web ve masaüstü aynı sır ve injection kalıplarını uygular; tam antivirüs veya SAST taraması yapılmaz',
      'Sır tespiti kalıp tabanlıdır; bilinmeyen biçimdeki bir sır işaretlenmeyebilir',
      'Kalıplar iki çalışma zamanında ayrı ayrı uygulanır; eşdeğerlik ortak korpus testleriyle korunur'
    ],
    evidence: [
      { testId: 'tests/v4/project-analyzer.test.js', level: 'integration-test', platforms: ['web'] },
      { testId: 'src-tauri/src/lib.rs', level: 'native-e2e', platforms: ['desktop'] }
    ],
    supportedDomains: ['web-app', 'backend-api', 'small-saas', 'admin-panel', 'internal-tool'],
    promotionEvidence: baselinePromotionEvidence('docs/release/inventory-recovery.md', {
      scenarios: PROJECT_INVENTORY_BENCHMARK_EVIDENCE,
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
