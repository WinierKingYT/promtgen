export type CapabilityMaturity = 'prototype' | 'experimental' | 'beta' | 'stable';

export type CapabilityEvidence = 'unit-test' | 'integration-test' | 'browser-e2e' | 'native-e2e' | 'manual-only';

export interface ProductCapability {
  id: string;
  publicName: string;
  description: string;
  maturity: CapabilityMaturity;
  platforms: Array<'web' | 'desktop'>;
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
    implementationMode: 'rule-engine',
    limitations: ['Revizyonlar cihaz hafızasında tutulur; silindiğinde kurtarılamaz.'],
    evidence: ['unit-test', 'integration-test']
  },
  {
    id: 'expert-perspectives',
    publicName: 'Uzman Perspektifleri',
    description: 'Proje alanına göre cihaz üzerinde oluşturulan mimari değerlendirme kartları.',
    maturity: 'experimental',
    platforms: ['web', 'desktop'],
    implementationMode: 'rule-engine',
    limitations: [
      'Bağımsız LLM ajanları çalıştırmaz',
      'Alan tespiti yerel kural motoruna dayanır'
    ],
    evidence: ['unit-test']
  },
  {
    id: 'architecture-comparator-template',
    publicName: 'Mimari Karşılaştırma Şablonu',
    description: 'Farklı mimari yaklaşımların maliyet ve efor kriterleriyle karşılaştırıldığı düzenlenebilir matris.',
    maturity: 'beta',
    platforms: ['web', 'desktop'],
    implementationMode: 'static-template',
    limitations: [
      'Otomatik benchmark hesaplanmaz; değerler kullanıcı varsayımıdır'
    ],
    evidence: ['unit-test']
  },
  {
    id: 'ai-discovery-provider',
    publicName: 'Yapay Zekâ Destekli Keşif & Sağlayıcı Entegrasyonu',
    description: 'Ollama, OpenAI, Gemini ve NVIDIA sağlayıcıları üzerinden plan önerileri üretimi.',
    maturity: 'beta',
    platforms: ['web', 'desktop'],
    implementationMode: 'ai-generated',
    limitations: [
      'AI çağrısı başarısız olduğunda Yerel Kural Motoru fallback olarak devreye girer',
      'Ollama performansı kullanıcı donanımına bağlıdır'
    ],
    evidence: ['unit-test', 'integration-test']
  },
  {
    id: 'native-codex-execution',
    publicName: 'İzole Codex Worktree Yürütmesi',
    description: 'Desktop modunda Codex CLI ile izole worktree üzerinde görev çalıştırma.',
    maturity: 'beta',
    platforms: ['desktop'],
    implementationMode: 'native-runtime',
    limitations: [
      'Codex CLI ayrıca kurulmalıdır',
      'Executable yayıncı imzası veya binary imza bütünlüğü doğrulanmaz'
    ],
    evidence: ['unit-test']
  },
  {
    id: 'project-inventory-analyzer',
    publicName: 'Dosya Envanteri ve Güvenlik Filtresi',
    description: 'Yerel proje klasörünün envantere alınması ve hassas dosyaların dışarıda bırakılması.',
    maturity: 'stable',
    platforms: ['web', 'desktop'],
    implementationMode: 'rule-engine',
    limitations: [
      'Browser ortamında dosya içeriği sınırlı taranır',
      'Masaüstü ortamında dosya yapısı incelenir; tam antivirüs veya SAST taraması yapılmaz'
    ],
    evidence: ['unit-test']
  }
];

export function getCapability(id: string): ProductCapability | undefined {
  return CAPABILITY_REGISTRY.find(cap => cap.id === id);
}
