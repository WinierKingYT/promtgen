export const CAPABILITY_REGISTRY = [
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
    description: 'Kullanıcının varsayımlarını girdiği başlangıç karşılaştırma matrisi.',
    maturity: 'experimental',
    platforms: ['web', 'desktop'],
    implementationMode: 'static-template',
    limitations: ['Otomatik benchmark hesaplanmaz; değerler kullanıcı varsayımıdır'],
    evidence: ['manual-only']
  },
  {
    id: 'ai-discovery-provider',
    publicName: 'AI Sağlayıcı Keşif Motoru',
    description: 'Ollama, OpenAI, Gemini ve NVIDIA NIM ile yapılandırılmış veri üretimi.',
    maturity: 'beta',
    platforms: ['web', 'desktop'],
    implementationMode: 'ai-generated',
    limitations: [
      'API anahtarı ve internet bağlantısı gerektirir',
      'Sağlayıcı kesintilerinde yerel kural motoruna düşer'
    ],
    evidence: ['integration-test']
  },
  {
    id: 'native-codex-execution',
    publicName: 'Yerel Codex Komut Çalıştırıcı',
    description: 'Masaüstünde Codex CLI ile komut çalıştırma simülasyonu.',
    maturity: 'experimental',
    platforms: ['desktop'],
    implementationMode: 'native-runtime',
    limitations: [
      'Web sürümünde çalışmaz',
      'Kullanıcı onayına bağlıdır',
      'Yayıncı imzası doğrulamaz'
    ],
    evidence: ['unit-test']
  },
  {
    id: 'project-inventory-analyzer',
    publicName: 'Proje Dosya Yapısı Analizcisi',
    description: 'Yerel proje klasörlerinin yapısını inceleme ve özetleme.',
    maturity: 'beta',
    platforms: ['desktop'],
    implementationMode: 'native-runtime',
    limitations: ['SAST veya güvenlik taraması yapmaz; yalnızca dosya haritası çıkarır'],
    evidence: ['unit-test']
  }
];

export function getCapability(id) {
  return CAPABILITY_REGISTRY.find(c => c.id === id);
}
