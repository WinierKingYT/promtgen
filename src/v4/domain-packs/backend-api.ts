import type {
  DomainPackContribution,
  DomainPackDiscoveryQuestion,
  ModuleManifest,
  ProjectDocumentV5,
  Requirement,
  TaskContractV2,
  TestCase
} from '../contracts.js';

const API_PATTERN = /\bapi\b|rest|graphql|endpoint|web servis|web service|backend|sunucu|server|mikroservis|microservice/i;
const AUTH_PATTERN = /auth|kimlik|yetki|authorization|permission|oauth|jwt|api key|anahtar|token|rol|role/i;
const DATA_PATTERN = /veri|data|database|veritaban|kayıt|record|persist|sakla|store|sql|nosql/i;
const EXTERNAL_PATTERN = /entegrasyon|integration|harici|external|istemci|client|partner|third.party|üçüncü taraf/i;
const ASYNC_PATTERN = /webhook|queue|kuyruk|event|olay|async|asenkron|job|worker|retry|yeniden dene/i;
const RATE_PATTERN = /yüksek trafik|high traffic|rate limit|throttl|ölçek|scale|saniyede|rps|concurrent|eşzamanlı/i;

const DOMAIN_PACK: DomainPackContribution = {
  id: 'backend-api',
  maturity: 'beta',
  projectTypes: ['backend-api', 'internal-api', 'integration-service'],
  limitations: [
    'Büyük dağıtık sistem, yüksek frekanslı finans ve kritik sağlık altyapısı destek kapsamında değildir.',
    'Paket programlama dili, framework, veritabanı veya bulut sağlayıcısı seçmez.',
    'Güvenlik ve dayanıklılık maddeleri planlama kontrolüdür; penetrasyon, yük veya kaos testi garantisi değildir.'
  ],
  discoveryQuestions: [
    {
      id: 'api.contract',
      prompt: 'API tüketicileri kim ve istek/yanıt sözleşmesi ile sürüm uyumluluğu nasıl korunacak?',
      rationale: 'Endpoint listesinden önce tüketici, sözleşme ve geriye uyumluluk sınırını belirler.',
      affectedSectionId: 'requirements',
      appliesWhen: 'always'
    },
    {
      id: 'api.error-model',
      prompt: 'Doğrulama, bulunamadı, yetkisiz erişim ve sunucu hataları hangi ortak hata sözleşmesiyle dönecek?',
      rationale: 'Başarılı yanıt dışındaki davranışları test edilebilir kılar.',
      affectedSectionId: 'requirements',
      appliesWhen: 'always'
    },
    {
      id: 'api.authentication',
      prompt: 'İstemciler nasıl doğrulanacak ve her kaynak için sunucu tarafı yetki sınırı ne olacak?',
      rationale: 'Kimlik doğrulama ile kaynak yetkilendirmesini ayrı kararlar olarak görünür kılar.',
      affectedSectionId: 'security',
      appliesWhen: 'authentication'
    },
    {
      id: 'api.data-consistency',
      prompt: 'Yazma işlemlerinde transaction, tekrar deneme ve kısmi başarısızlık nasıl ele alınacak?',
      rationale: 'Veri bütünlüğünü yalnız mutlu akışa bırakmaz.',
      affectedSectionId: 'architecture',
      appliesWhen: 'stored_data'
    },
    {
      id: 'api.idempotency',
      prompt: 'Tekrarlanan istek, webhook veya kuyruk mesajı aynı işlemi ikinci kez üretmeden nasıl işlenecek?',
      rationale: 'Ağ ve asenkron teslim tekrarlarını tasarımın parçası yapar.',
      affectedSectionId: 'architecture',
      appliesWhen: 'async_operations'
    },
    {
      id: 'api.operations',
      prompt: 'Health check, yapılandırılmış log, correlation ID, metrik ve güvenli geri alma yaklaşımı nedir?',
      rationale: 'API’nin çalışması ile işletilebilir olması arasındaki boşluğu kapatır.',
      affectedSectionId: 'operations',
      appliesWhen: 'always'
    },
    {
      id: 'api.rate-boundary',
      prompt: 'İstemci veya kaynak bazlı rate limit ve kapasite sınırı nasıl davranacak?',
      rationale: 'Kapasite sınırını belirsiz bir ölçek hedefi yerine gözlenebilir davranışa dönüştürür.',
      affectedSectionId: 'requirements',
      appliesWhen: 'rate_sensitive'
    }
  ],
  requirementGuidance: [
    {
      id: 'api.contract-versioning',
      label: 'API sözleşmesi ve geriye uyumluluk',
      keywords: ['api', 'endpoint', 'sözleşme', 'contract', 'version', 'sürüm'],
      acceptanceExamples: ['Belgelenen istek ve yanıt şeması contract testini geçer', 'Geriye uyumsuz değişiklik açık sürüm kararı olmadan yayımlanmaz']
    },
    {
      id: 'api-errors',
      label: 'Tutarlı hata modeli',
      keywords: ['hata', 'error', 'status', 'doğrulama', 'validation'],
      acceptanceExamples: ['Hata yanıtı kararlı kod, güvenli mesaj ve correlation ID taşır']
    },
    {
      id: 'api-security',
      label: 'Sunucu tarafı kimlik ve yetki',
      keywords: ['auth', 'kimlik', 'yetki', 'permission', 'token', 'api key'],
      acceptanceExamples: ['Kimliği doğrulanmamış istek 401, yetkisiz kaynak erişimi 403 alır']
    },
    {
      id: 'api-idempotency',
      label: 'Tekrarlı işlem güvenliği',
      keywords: ['idempot', 'webhook', 'retry', 'kuyruk', 'queue', 'event'],
      acceptanceExamples: ['Aynı idempotency anahtarıyla yinelenen istek ikinci yan etki oluşturmaz']
    }
  ],
  riskGuidance: [
    {
      id: 'api.contract-break',
      title: 'API tüketicilerinin geriye uyumsuz değişiklikle kırılması',
      appliesWhen: 'external_clients',
      mitigationPrompt: 'Contract testi, sürümleme ve deprecation sürecini tanımla.'
    },
    {
      id: 'api.authorization-bypass',
      title: 'Kaynak yetkilendirmesinin atlanması',
      appliesWhen: 'authentication',
      mitigationPrompt: 'Kaynak bazlı sunucu yetkisi ve negatif güvenlik testlerini tanımla.'
    },
    {
      id: 'api-duplicate-side-effect',
      title: 'Tekrarlanan isteğin ikinci yan etki üretmesi',
      appliesWhen: 'async_operations',
      mitigationPrompt: 'Idempotency anahtarı, deduplication ve tekrar işleme politikasını tanımla.'
    },
    {
      id: 'api-partial-write',
      title: 'Kısmi başarısızlıkta veri bütünlüğünün bozulması',
      appliesWhen: 'stored_data',
      mitigationPrompt: 'Transaction sınırı, telafi davranışı ve bütünlük testini tanımla.'
    }
  ],
  taskContractGuidance: {
    expectedOutputs: [
      'Etkilenen API sözleşmesi ve geriye uyumluluk etkisi',
      'Başarılı, hatalı ve yetkisiz yanıt davranışları',
      'Gerekliyse migration, idempotency ve operasyon kanıtı'
    ],
    completionEvidence: [
      'API contract ve negatif hata senaryoları doğrulandı',
      'Secret veya hassas iç ayrıntı hata yanıtına sızdırılmadı',
      'Canonical karar olmadan framework veya veri deposu değiştirilmedi'
    ]
  }
};

export const BACKEND_API_MODULE: ModuleManifest = {
  id: 'software.backend-api',
  version: '1.0.0',
  name: 'Backend/API Planlama Paketi',
  description: 'Backend ve API projeleri için sözleşme, hata modeli, yetki, veri bütünlüğü, idempotency ve işletim kuralları.',
  category: 'software',
  dependencies: ['software.core'],
  conflicts: [],
  triggers: ['api', 'rest', 'graphql', 'backend', 'server', 'sunucu', 'endpoint', 'webhook', 'microservice'],
  contributions: {
    requiredSections: ['requirements', 'architecture', 'security', 'testing', 'operations'],
    suggestedSections: ['risks', 'deployment'],
    reviewerRuleIds: [
      'API-CONTRACT',
      'API-ERROR-MODEL',
      'API-AUTHORIZATION',
      'API-DATA-CONSISTENCY',
      'API-IDEMPOTENCY',
      'API-OPERATIONS'
    ],
    exportDocumentIds: ['requirements', 'architecture', 'security', 'test-strategy', 'operations'],
    domainPack: DOMAIN_PACK
  }
};

export interface BackendApiSignalSet {
  api: boolean;
  authentication: boolean;
  storedData: boolean;
  externalClients: boolean;
  asyncOperations: boolean;
  rateSensitive: boolean;
}

export interface BackendApiPackCheck {
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

export function detectBackendApiSignals(project: ProjectDocumentV5): BackendApiSignalSet {
  const text = projectText(project);
  const domains = (project.profile?.domains || []).map(item => item.name).join(' ');
  return {
    api: API_PATTERN.test(`${text} ${domains}`),
    authentication: AUTH_PATTERN.test(text),
    storedData: DATA_PATTERN.test(text),
    externalClients: EXTERNAL_PATTERN.test(text),
    asyncOperations: ASYNC_PATTERN.test(text),
    rateSensitive: RATE_PATTERN.test(text)
  };
}

function applies(question: DomainPackDiscoveryQuestion, signals: BackendApiSignalSet): boolean {
  if (question.appliesWhen === 'always') return true;
  if (question.appliesWhen === 'authentication') return signals.authentication;
  if (question.appliesWhen === 'stored_data') return signals.storedData;
  if (question.appliesWhen === 'external_clients') return signals.externalClients;
  if (question.appliesWhen === 'async_operations') return signals.asyncOperations;
  return question.appliesWhen === 'rate_sensitive' && signals.rateSensitive;
}

export function getBackendApiDiscoveryQuestions(project: ProjectDocumentV5): DomainPackDiscoveryQuestion[] {
  const signals = detectBackendApiSignals(project);
  return DOMAIN_PACK.discoveryQuestions.filter(question => applies(question, signals));
}

function acceptedText(project: ProjectDocumentV5): string {
  return [
    ...project.requirements
      .filter(item => ['accepted', 'implemented', 'verified'].includes(item.status))
      .map(item => `${item.title} ${item.statement} ${item.acceptanceCriteria.join(' ')}`),
    ...project.decisions
      .filter(item => item.status === 'accepted')
      .map(item => `${item.title} ${item.decision} ${item.rationale}`),
    ...project.risks.map(item => `${item.title} ${item.description} ${item.mitigation}`),
    ...Object.values(project.sections).flatMap(section => [section.content, ...section.items])
  ].join(' ');
}

export function assessBackendApiPack(project: ProjectDocumentV5): {
  applicable: boolean;
  active: boolean;
  maturity: DomainPackContribution['maturity'];
  signals: BackendApiSignalSet;
  checks: BackendApiPackCheck[];
  discoveryQuestions: DomainPackDiscoveryQuestion[];
  limitations: string[];
} {
  const signals = detectBackendApiSignals(project);
  const active = (project.modules?.active || []).some(item =>
    item.id === BACKEND_API_MODULE.id && item.version === BACKEND_API_MODULE.version
  );
  const text = acceptedText(project);
  const checks: BackendApiPackCheck[] = [
    {
      id: 'api.contract',
      label: 'API sözleşmesi ve sürüm sınırı belirli',
      passed: /openapi|schema|şema|contract|sözleşme|version|sürüm|request|response|istek|yanıt/i.test(text),
      blocking: true,
      sectionId: 'requirements',
      message: 'API tüketicisi, istek/yanıt şeması ve geriye uyumluluk davranışı kabul edilmelidir.',
      entityIds: []
    },
    {
      id: 'api.error-model',
      label: 'Hata modeli test edilebilir',
      passed: /400|401|403|404|409|422|500|hata kod|error code|problem details|correlation/i.test(text),
      blocking: true,
      sectionId: 'requirements',
      message: 'Doğrulama, yetki, bulunamadı ve sunucu hataları için ortak yanıt sözleşmesi tanımlanmalıdır.',
      entityIds: []
    },
    {
      id: 'api.operations',
      label: 'API işletim ve geri alma yaklaşımı belirli',
      passed: /health|readiness|liveness|log|correlation|metric|metrik|rollback|geri alma/i.test(text),
      blocking: false,
      sectionId: 'operations',
      message: 'Health check, yapılandırılmış log ve güvenli geri alma yaklaşımı tanımlanmalıdır.',
      entityIds: []
    }
  ];
  if (signals.authentication) {
    checks.push({
      id: 'api.authentication',
      label: 'Kimlik ve kaynak yetkisi ayrılmış',
      passed: /401.*403|403.*401|kaynak.{0,24}yetki|resource.{0,24}authoriz|scope|claim/i.test(text),
      blocking: true,
      sectionId: 'security',
      message: 'Kimlik doğrulama ile kaynak bazlı sunucu yetkilendirmesi ayrı davranışlar olarak kabul edilmelidir.',
      entityIds: []
    });
  }
  if (signals.storedData) {
    checks.push({
      id: 'api.data-consistency',
      label: 'Yazma bütünlüğü ve kısmi başarısızlık belirli',
      passed: /transaction|işlem sınırı|atomic|atomik|rollback|telafi|compensat|migration|göç/i.test(text),
      blocking: true,
      sectionId: 'architecture',
      message: 'Yazma transaction sınırı, kısmi başarısızlık ve migration davranışı karara bağlanmalıdır.',
      entityIds: []
    });
  }
  if (signals.asyncOperations) {
    checks.push({
      id: 'api.idempotency',
      label: 'Tekrarlı istek ve mesaj davranışı belirli',
      passed: /idempoten|dedup|tekrar.*yan etki|duplicate|aynı anahtar/i.test(text),
      blocking: true,
      sectionId: 'architecture',
      message: 'Tekrarlanan istek, webhook veya mesajın ikinci yan etki üretmemesi tanımlanmalıdır.',
      entityIds: []
    });
  }
  if (signals.rateSensitive) {
    checks.push({
      id: 'api.rate-boundary',
      label: 'Kapasite ve rate limit sınırı gözlenebilir',
      passed: /rate limit|throttl|429|rps|kapasite|eşzamanlı/i.test(text),
      blocking: false,
      sectionId: 'requirements',
      message: 'İstemci veya kaynak bazlı kapasite sınırı ve 429 davranışı tanımlanmalıdır.',
      entityIds: []
    });
  }
  return {
    applicable: signals.api,
    active,
    maturity: DOMAIN_PACK.maturity,
    signals,
    checks,
    discoveryQuestions: getBackendApiDiscoveryQuestions(project),
    limitations: DOMAIN_PACK.limitations
  };
}

export function enrichBackendApiTaskContract(
  project: ProjectDocumentV5,
  requirement: Requirement,
  contract: TaskContractV2
): TaskContractV2 {
  if (!assessBackendApiPack(project).active) return contract;
  const requirementText = `${requirement.title} ${requirement.statement}`.toLocaleLowerCase('tr-TR');
  const examples = DOMAIN_PACK.requirementGuidance
    .filter(item => item.keywords.some(keyword => requirementText.includes(keyword)))
    .flatMap(item => item.acceptanceExamples);
  return {
    ...contract,
    expectedOutputs: [...new Set([...contract.expectedOutputs, ...DOMAIN_PACK.taskContractGuidance.expectedOutputs])],
    completionEvidence: [...new Set([
      ...contract.completionEvidence,
      ...DOMAIN_PACK.taskContractGuidance.completionEvidence,
      ...examples.map(item => `Backend/API kabul örneği: ${item}`)
    ])]
  };
}

export function backendApiTestKind(requirement: Requirement): TestCase['kind'] {
  const text = `${requirement.title} ${requirement.statement}`.toLocaleLowerCase('tr-TR');
  if (/auth|kimlik|yetki|permission|token|api key|secret|güven/.test(text)) return 'security';
  if (/api|endpoint|request|response|istek|yanıt|database|veritaban|webhook|queue|kuyruk|transaction/.test(text)) return 'integration';
  return 'acceptance';
}
