import type {
  DomainPackContribution,
  DomainPackDiscoveryQuestion,
  ModuleManifest,
  ProjectDocumentV5,
  Requirement,
  TaskContractV2,
  TestCase
} from '../contracts.js';

const ACCOUNT_PATTERN = /hesap|hesab|account|login|giriş|auth|kimlik|rol|role|yetki|permission/i;
const MULTI_TENANT_PATTERN = /multi[\s-]?tenant|çok kiracılı|tenant|workspace|çalışma alanı|takım|team|ekip|organizasyon|organization/i;
const PAYMENT_PATTERN = /ödeme|payment|stripe|abonelik|subscription|fatura|billing|ücret/i;
const STORED_DATA_PATTERN = /veri|data|kayıt|record|database|veritabanı|sakla|store|dosya|file/i;
const WEB_PATTERN = /web|saas|site|portal|dashboard|panel|browser|tarayıcı|frontend|backend|api|react|next|vue|svelte|html/i;

const DOMAIN_PACK: DomainPackContribution = {
  id: 'web-saas',
  maturity: 'candidate-stable',
  projectTypes: ['web-app', 'backend-api', 'small-saas', 'admin-panel', 'internal-tool'],
  limitations: [
    'Büyük dağıtık altyapı ve kritik finans/sağlık sistemleri bu paketin destek kapsamı dışındadır.',
    'Teknoloji seçimi kullanıcı kararıdır; paket framework veya sağlayıcıyı otomatik seçmez.',
    'Güvenlik kontrolleri planlama rehberidir; penetrasyon testi veya güvenlik garantisi değildir.'
  ],
  discoveryQuestions: [
    {
      id: 'web.core-flow',
      prompt: 'Birincil kullanıcı tarayıcıyı açtıktan sonra hangi tek sonucu tamamlamalı?',
      rationale: 'Sayfa listesinden önce uçtan uca ana kullanıcı akışını sınırlar.',
      affectedSectionId: 'scope',
      appliesWhen: 'always'
    },
    {
      id: 'web.account-boundary',
      prompt: 'Kimlik doğrulama gerekiyor mu; hangi roller hangi kayıtlara erişebilir?',
      rationale: 'Hesap, rol ve veri erişimi aynı güvenlik sınırında kararlaştırılmalıdır.',
      affectedSectionId: 'security',
      appliesWhen: 'accounts'
    },
    {
      id: 'web.data-lifecycle',
      prompt: 'Hangi veriler saklanacak, kim sahibi olacak ve ne zaman silinecek?',
      rationale: 'Veri modeli kadar saklama, silme ve sahiplik davranışını da netleştirir.',
      affectedSectionId: 'requirements',
      appliesWhen: 'stored_data'
    },
    {
      id: 'web.tenant-isolation',
      prompt: 'Takım veya çalışma alanı verileri birbirinden nasıl ayrılacak?',
      rationale: 'Çok kiracılı veri sızıntısı riskini tasarım aşamasında görünür kılar.',
      affectedSectionId: 'architecture',
      appliesWhen: 'multi_tenant'
    },
    {
      id: 'web.payment-lifecycle',
      prompt: 'Ödeme başarısızlığı, iptal, iade ve webhook tekrarları nasıl ele alınacak?',
      rationale: 'Başarılı ödeme dışındaki gerçek yaşam döngüsünü kapsama alır.',
      affectedSectionId: 'requirements',
      appliesWhen: 'payments'
    },
    {
      id: 'web.delivery',
      prompt: 'Yayın ortamı, gözlenebilirlik ve güvenli geri alma yaklaşımı nedir?',
      rationale: 'Kodun çalışması ile güvenle yayınlanması arasındaki boşluğu kapatır.',
      affectedSectionId: 'deployment',
      appliesWhen: 'always'
    }
  ],
  requirementGuidance: [
    {
      id: 'web.a11y',
      label: 'Klavye ve temel erişilebilirlik davranışı',
      keywords: ['erişilebilir', 'accessibility', 'klavye', 'keyboard', 'screen reader', 'aria'],
      acceptanceExamples: ['Ana akış yalnız klavye ile tamamlanabilir', 'Kritik axe ihlali bulunmaz']
    },
    {
      id: 'web.error-states',
      label: 'Yükleme, boş, hata ve yeniden deneme durumları',
      keywords: ['hata', 'error', 'loading', 'yüklen', 'boş durum', 'retry', 'yeniden dene'],
      acceptanceExamples: ['Ağ hatasında veri kaybı olmadan yeniden deneme sunulur']
    },
    {
      id: 'web.authorization',
      label: 'Sunucu tarafı yetkilendirme',
      keywords: ['yetki', 'authorization', 'permission', 'rol', 'role', 'erişim'],
      acceptanceExamples: ['Yetkisiz istek sunucu tarafından reddedilir']
    },
    {
      id: 'web.deployment',
      label: 'Yayın ve geri alma doğrulaması',
      keywords: ['deploy', 'yayın', 'rollback', 'geri alma', 'health check', 'smoke'],
      acceptanceExamples: ['Yayın sonrası smoke kontrolü başarısızsa geri alma uygulanabilir']
    }
  ],
  riskGuidance: [
    {
      id: 'web.auth-bypass',
      title: 'Kimlik veya yetki kontrolünün atlanması',
      appliesWhen: 'accounts',
      mitigationPrompt: 'Sunucu tarafı yetki kontrolü, oturum sonlandırma ve negatif güvenlik testlerini tanımla.'
    },
    {
      id: 'web.tenant-leak',
      title: 'Kiracılar arasında veri sızıntısı',
      appliesWhen: 'multi_tenant',
      mitigationPrompt: 'Tenant kapsamını veri erişim katmanında zorunlu kıl ve çapraz-tenant negatif test ekle.'
    },
    {
      id: 'web.payment-duplication',
      title: 'Tekrarlanan ödeme veya webhook işlemi',
      appliesWhen: 'payments',
      mitigationPrompt: 'Idempotency anahtarı, webhook imzası ve tekrar işleme politikasını tanımla.'
    },
    {
      id: 'web.data-loss',
      title: 'Kayıt veya kullanıcı verisi kaybı',
      appliesWhen: 'stored_data',
      mitigationPrompt: 'Yedekleme, bütünlük kontrolü ve geri yükleme kabul testini tanımla.'
    }
  ],
  taskContractGuidance: {
    expectedOutputs: [
      'Etkilenen kullanıcı akışı ve hata durumlarının listesi',
      'Gerekliyse erişilebilirlik, yetki ve veri yaşam döngüsü kanıtı'
    ],
    completionEvidence: [
      'Ana akışın başarılı ve başarısız durumları doğrulandı',
      'İstemci doğrulamasına güvenen sunucu güvenlik sınırı bırakılmadı'
    ]
  }
};

export const WEB_SAAS_MODULE: ModuleManifest = {
  id: 'software.web',
  version: '2.0.0',
  name: 'Web/SaaS Planlama Paketi',
  description: 'Web uygulaması, küçük SaaS, panel ve API projeleri için kapsam, güvenlik, erişilebilirlik ve teslim kuralları.',
  category: 'software',
  dependencies: ['software.core'],
  conflicts: [],
  triggers: ['web', 'saas', 'react', 'vue', 'svelte', 'next', 'vite', 'html', 'dashboard', 'portal', 'panel', 'api'],
  contributions: {
    requiredSections: ['requirements', 'architecture', 'testing', 'deployment'],
    suggestedSections: ['security', 'risks', 'operations'],
    reviewerRuleIds: [
      'WEB-CORE-FLOW',
      'WEB-ACCESSIBILITY',
      'WEB-AUTHORIZATION',
      'WEB-DATA-LIFECYCLE',
      'WEB-TENANT-ISOLATION',
      'WEB-DELIVERY'
    ],
    exportDocumentIds: ['requirements', 'architecture', 'test-strategy', 'deployment'],
    domainPack: DOMAIN_PACK
  }
};

export interface WebSaasSignalSet {
  web: boolean;
  accounts: boolean;
  multiTenant: boolean;
  payments: boolean;
  storedData: boolean;
}

export interface WebSaasPackCheck {
  id: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  sectionId: string;
  message: string;
  entityIds: string[];
}

function projectText(project: ProjectDocumentV5): string {
  const summary = project.ideaLabSession?.conceptSummary;
  return [
    project.identity.originalIdea,
    ...(summary?.confirmedFeatures || []),
    ...(project.requirements || []).map(item => `${item.title} ${item.statement} ${item.acceptanceCriteria.join(' ')}`),
    ...(project.decisions || []).map(item => `${item.title} ${item.decision} ${item.rationale}`)
  ].join(' ');
}

export function detectWebSaasSignals(project: ProjectDocumentV5): WebSaasSignalSet {
  const text = projectText(project);
  const domains = (project.profile?.domains || []).map(item => item.name).join(' ');
  const accountNegated = /hesapsız|hesap gerektirmez|girişsiz|anonim|without (an )?account|no account/i.test(text);
  const storedDataNegated = /veri saklamayan|veri saklamaz|kayıt tutmayan|no storage|without storing|does not store/i.test(text);
  return {
    web: WEB_PATTERN.test(`${text} ${domains}`),
    accounts: ACCOUNT_PATTERN.test(text) && !accountNegated,
    multiTenant: MULTI_TENANT_PATTERN.test(text),
    payments: PAYMENT_PATTERN.test(text),
    storedData: STORED_DATA_PATTERN.test(text) && !storedDataNegated
  };
}

function applies(question: DomainPackDiscoveryQuestion, signals: WebSaasSignalSet): boolean {
  if (question.appliesWhen === 'always') return true;
  if (question.appliesWhen === 'accounts') return signals.accounts;
  if (question.appliesWhen === 'multi_tenant') return signals.multiTenant;
  if (question.appliesWhen === 'payments') return signals.payments;
  return signals.storedData;
}

export function getWebSaasDiscoveryQuestions(project: ProjectDocumentV5): DomainPackDiscoveryQuestion[] {
  const signals = detectWebSaasSignals(project);
  return DOMAIN_PACK.discoveryQuestions.filter(question => applies(question, signals));
}

function acceptedText(project: ProjectDocumentV5, kind: 'requirement' | 'decision' | 'risk'): string {
  if (kind === 'requirement') {
    return project.requirements
      .filter(item => item.status === 'accepted' || item.status === 'implemented' || item.status === 'verified')
      .map(item => `${item.title} ${item.statement} ${item.acceptanceCriteria.join(' ')}`)
      .join(' ');
  }
  if (kind === 'decision') {
    return project.decisions
      .filter(item => item.status === 'accepted')
      .map(item => `${item.title} ${item.decision} ${item.rationale}`)
      .join(' ');
  }
  return project.risks.map(item => `${item.title} ${item.description} ${item.mitigation}`).join(' ');
}

export function assessWebSaasPack(project: ProjectDocumentV5): {
  applicable: boolean;
  active: boolean;
  maturity: DomainPackContribution['maturity'];
  signals: WebSaasSignalSet;
  checks: WebSaasPackCheck[];
  discoveryQuestions: DomainPackDiscoveryQuestion[];
  limitations: string[];
} {
  const signals = detectWebSaasSignals(project);
  const active = (project.modules?.active || []).some(item =>
    item.id === WEB_SAAS_MODULE.id && item.version === WEB_SAAS_MODULE.version
  );
  const requirementText = acceptedText(project, 'requirement');
  const decisionText = acceptedText(project, 'decision');
  const riskText = acceptedText(project, 'risk');
  const checks: WebSaasPackCheck[] = [
    {
      id: 'web.core-flow',
      label: 'Ana web kullanıcı akışı doğrulanmış',
      passed: Boolean(project.ideaLabSession?.conceptSummary?.userConfirmed && project.ideaLabSession.conceptSummary.confirmedFeatures.length),
      blocking: true,
      sectionId: 'scope',
      message: 'Birincil kullanıcının başlangıçtan sonuca ana akışı MVP kapsamında onaylanmalı.',
      entityIds: []
    },
    {
      id: 'web.accessibility',
      label: 'Erişilebilirlik gereksinimi kabul edilmiş',
      passed: /erişilebilir|accessibility|klavye|keyboard|screen reader|aria/i.test(requirementText),
      blocking: false,
      sectionId: 'requirements',
      message: 'Klavye kullanımı ve temel erişilebilirlik için gözlenebilir bir kalite gereksinimi eklenmeli.',
      entityIds: []
    },
    {
      id: 'web.delivery',
      label: 'Yayın ve geri alma yaklaşımı belirli',
      passed: /deploy|yayın|rollback|geri alma|health check|smoke/i.test(`${decisionText} ${project.sections.deployment?.content || ''} ${(project.sections.deployment?.items || []).join(' ')}`),
      blocking: false,
      sectionId: 'deployment',
      message: 'Yayın ortamı, smoke kontrolü ve geri alma yaklaşımı karara bağlanmalı.',
      entityIds: []
    }
  ];
  if (signals.accounts) {
    checks.push({
      id: 'web.authorization',
      label: 'Kimlik ve yetki sınırı belirli',
      passed: /auth|kimlik|oturum|session|jwt|oauth|yetki|authorization|permission|rol/i.test(`${requirementText} ${decisionText}`),
      blocking: true,
      sectionId: 'security',
      message: 'Hesap kullanan projede kimlik doğrulama ve sunucu tarafı yetki modeli kabul edilmelidir.',
      entityIds: []
    });
  }
  if (signals.storedData) {
    checks.push({
      id: 'web.data-lifecycle',
      label: 'Veri yaşam döngüsü belirli',
      passed: /sil|delete|retention|saklama|yedek|backup|restore|geri yükle|sahip/i.test(`${requirementText} ${decisionText}`),
      blocking: false,
      sectionId: 'requirements',
      message: 'Saklanan verinin sahipliği, silinmesi ve geri yükleme davranışı tanımlanmalı.',
      entityIds: []
    });
  }
  if (signals.multiTenant) {
    checks.push({
      id: 'web.tenant-isolation',
      label: 'Tenant veri izolasyonu kararı kabul edilmiş',
      passed: /tenant|kiracı|workspace|çalışma alanı|organizasyon.*izol|veri.*ayr/i.test(`${requirementText} ${decisionText} ${riskText}`),
      blocking: true,
      sectionId: 'architecture',
      message: 'Takım/çalışma alanı projesinde tenant veri izolasyonu açıkça karara bağlanmalıdır.',
      entityIds: []
    });
  }
  if (signals.payments) {
    checks.push({
      id: 'web.payment-safety',
      label: 'Ödeme tekrar ve başarısızlık akışları tanımlı',
      passed: /idempoten|webhook|iade|refund|iptal|ödeme başarısız|payment fail/i.test(`${requirementText} ${decisionText} ${riskText}`),
      blocking: true,
      sectionId: 'requirements',
      message: 'Ödeme tekrarları, başarısızlık, iptal/iade ve webhook doğrulaması tanımlanmalıdır.',
      entityIds: []
    });
  }
  return {
    applicable: signals.web,
    active,
    maturity: DOMAIN_PACK.maturity,
    signals,
    checks,
    discoveryQuestions: getWebSaasDiscoveryQuestions(project),
    limitations: DOMAIN_PACK.limitations
  };
}

export function enrichWebSaasTaskContract(
  project: ProjectDocumentV5,
  requirement: Requirement,
  contract: TaskContractV2
): TaskContractV2 {
  const assessment = assessWebSaasPack(project);
  if (!assessment.active) return contract;
  const guidance = DOMAIN_PACK.requirementGuidance
    .filter(item => item.keywords.some(keyword => `${requirement.title} ${requirement.statement}`.toLocaleLowerCase('tr-TR').includes(keyword)))
    .flatMap(item => item.acceptanceExamples);
  return {
    ...contract,
    expectedOutputs: [...new Set([...contract.expectedOutputs, ...DOMAIN_PACK.taskContractGuidance.expectedOutputs])],
    completionEvidence: [
      ...new Set([
        ...contract.completionEvidence,
        ...DOMAIN_PACK.taskContractGuidance.completionEvidence,
        ...guidance.map(item => `Alan kabul örneği: ${item}`)
      ])
    ]
  };
}

export function webSaasTestKind(requirement: Requirement): TestCase['kind'] {
  const text = `${requirement.title} ${requirement.statement}`.toLocaleLowerCase('tr-TR');
  if (/güven|security|auth|kimlik|yetki|permission|rol|tenant/.test(text)) return 'security';
  if (/api|entegrasyon|integration|webhook|veritaban|database/.test(text)) return 'integration';
  if (/erişilebilir|accessibility|klavye|keyboard|ana akış|kullanıcı akışı/.test(text)) return 'e2e';
  return requirement.kind === 'quality' ? 'integration' : 'acceptance';
}
