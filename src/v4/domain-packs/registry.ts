import type {
  DomainPackContribution,
  DomainPackDiscoveryQuestion,
  ModuleManifest,
  ProjectDocumentV5,
  ReadinessDimension,
  Requirement,
  TaskContractV2,
  TestCase
} from '../contracts.js';
import {
  WEB_SAAS_MODULE,
  assessWebSaasPack,
  enrichWebSaasTaskContract,
  getWebSaasDiscoveryQuestions,
  webSaasTestKind
} from './web-saas.js';
import {
  BACKEND_API_MODULE,
  assessBackendApiPack,
  backendApiTestKind,
  enrichBackendApiTaskContract,
  getBackendApiDiscoveryQuestions
} from './backend-api.js';

export interface DomainPackCheck {
  id: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  sectionId: string;
  message: string;
  entityIds: string[];
}

export interface DomainPackAssessment {
  applicable: boolean;
  active: boolean;
  maturity: DomainPackContribution['maturity'];
  signals: unknown;
  checks: DomainPackCheck[];
  discoveryQuestions: DomainPackDiscoveryQuestion[];
  limitations: string[];
}

export interface DomainPackRuntime {
  id: string;
  module: ModuleManifest;
  ui: {
    titleId: string;
    previewLabel: string;
    activationMessage: string;
    commandType: string;
    description: string;
    activeDescription: string;
  };
  promptInstruction: string;
  assess(project: ProjectDocumentV5): DomainPackAssessment;
  discoveryQuestions(project: ProjectDocumentV5): DomainPackDiscoveryQuestion[];
  enrichTaskContract(project: ProjectDocumentV5, requirement: Requirement, contract: TaskContractV2): TaskContractV2;
  testKind(requirement: Requirement): TestCase['kind'];
  readinessDimension(check: DomainPackCheck): ReadinessDimension;
  reviewCategory(check: DomainPackCheck): string;
  reviewPromptLabel: string;
}

export interface DomainPackRegistry {
  list(): DomainPackRuntime[];
  getById(id: string): DomainPackRuntime | null;
  getByModuleId(moduleId: string): DomainPackRuntime | null;
  applicable(project: ProjectDocumentV5): DomainPackRuntime[];
  active(project: ProjectDocumentV5): DomainPackRuntime[];
  collectDiscoveryQuestions(project: ProjectDocumentV5, moduleIds: string[]): DomainPackDiscoveryQuestion[];
  enrichTaskContract(project: ProjectDocumentV5, requirement: Requirement, contract: TaskContractV2): TaskContractV2;
  selectTestKind(project: ProjectDocumentV5, requirement: Requirement): TestCase['kind'];
}

function cloneRuntimeList(runtimes: readonly DomainPackRuntime[]): DomainPackRuntime[] {
  return [...runtimes];
}

export function createDomainPackRegistry(runtimes: readonly DomainPackRuntime[]): DomainPackRegistry {
  const byId = new Map<string, DomainPackRuntime>();
  const byModuleId = new Map<string, DomainPackRuntime>();
  for (const runtime of runtimes) {
    if (byId.has(runtime.id)) throw new Error(`Yinelenen domain pack kimliği: ${runtime.id}`);
    if (byModuleId.has(runtime.module.id)) throw new Error(`Yinelenen domain pack modülü: ${runtime.module.id}`);
    if (runtime.module.contributions.domainPack?.id !== runtime.id) {
      throw new Error(`Domain pack ve modül kimliği uyuşmuyor: ${runtime.id}`);
    }
    byId.set(runtime.id, runtime);
    byModuleId.set(runtime.module.id, runtime);
  }

  const active = (project: ProjectDocumentV5) =>
    runtimes.filter(runtime => runtime.assess(project).active);

  return {
    list: () => cloneRuntimeList(runtimes),
    getById: id => byId.get(id) || null,
    getByModuleId: moduleId => byModuleId.get(moduleId) || null,
    applicable: project => runtimes.filter(runtime => {
      const assessment = runtime.assess(project);
      return assessment.applicable || assessment.active;
    }),
    active,
    collectDiscoveryQuestions: (project, moduleIds) => {
      const questions = moduleIds.flatMap(moduleId =>
        byModuleId.get(moduleId)?.discoveryQuestions(project) || []
      );
      return [...new Map(questions.map(question => [question.id, question])).values()];
    },
    enrichTaskContract: (project, requirement, contract) =>
      active(project).reduce(
        (current, runtime) => runtime.enrichTaskContract(project, requirement, current),
        contract
      ),
    selectTestKind: (project, requirement) =>
      active(project).reduce<TestCase['kind']>((kind, runtime) => {
        const candidate = runtime.testKind(requirement);
        return candidate === 'acceptance' ? kind : candidate;
      }, 'acceptance')
  };
}

const WEB_SAAS_RUNTIME: DomainPackRuntime = {
  id: 'web-saas',
  module: WEB_SAAS_MODULE,
  ui: {
    titleId: 'web-saas-pack-title',
    previewLabel: 'Web SaaS paket aktivasyon önizlemesi',
    activationMessage: 'Web/SaaS planlama paketi kullanıcı onayıyla etkinleştirildi.',
    commandType: 'ApplyWebSaasDomainPack',
    description: 'Fikir web/SaaS sinyalleri taşıyor. Paket; doğru alan sorularını, kalite kapılarını ve görev doğrulamalarını ekler. Canonical plana otomatik karar yazmaz.',
    activeDescription: 'Alan kuralları readiness, plan incelemesi, görev sözleşmeleri ve test türlerinde etkin.'
  },
  promptInstruction: ' Web/SaaS paketi aktiftir: ana kullanıcı akışı, hata durumları, erişilebilirlik, sunucu yetkisi, veri yaşam döngüsü ve güvenli yayın sınırlarını ilgili olduklarında doğrula.',
  assess: assessWebSaasPack,
  discoveryQuestions: getWebSaasDiscoveryQuestions,
  enrichTaskContract: enrichWebSaasTaskContract,
  testKind: webSaasTestKind,
  readinessDimension: check =>
    check.id.includes('delivery')
      ? 'implementationReadiness'
      : check.id.includes('accessibility') || check.id.includes('core-flow')
        ? 'completeness'
        : 'riskCoverage',
  reviewCategory: check =>
    check.sectionId === 'security' ? 'security' : check.sectionId === 'deployment' ? 'deployment' : 'domain',
  reviewPromptLabel: 'Web/SaaS'
};

const BACKEND_API_RUNTIME: DomainPackRuntime = {
  id: 'backend-api',
  module: BACKEND_API_MODULE,
  ui: {
    titleId: 'backend-api-pack-title',
    previewLabel: 'Backend API paket aktivasyon önizlemesi',
    activationMessage: 'Backend/API planlama paketi kullanıcı onayıyla etkinleştirildi.',
    commandType: 'ApplyBackendApiDomainPack',
    description: 'Fikir backend/API sinyalleri taşıyor. Paket sözleşme, hata modeli, yetki, veri bütünlüğü, idempotency ve işletim sorularını ekler; teknoloji seçmez.',
    activeDescription: 'Backend/API kuralları readiness, plan incelemesi, görev sözleşmeleri ve test türlerinde etkin.'
  },
  promptInstruction: ' Backend/API paketi aktiftir: API sözleşmesi, ortak hata modeli, kaynak yetkisi, veri bütünlüğü, idempotency ve işletim kanıtlarını ilgili olduklarında doğrula; teknoloji seçimini değiştirme.',
  assess: assessBackendApiPack,
  discoveryQuestions: getBackendApiDiscoveryQuestions,
  enrichTaskContract: enrichBackendApiTaskContract,
  testKind: backendApiTestKind,
  readinessDimension: check =>
    check.id.includes('operations')
      ? 'implementationReadiness'
      : check.id.includes('contract') || check.id.includes('error-model')
        ? 'consistency'
        : 'riskCoverage',
  reviewCategory: check =>
    check.sectionId === 'security' ? 'security' : check.sectionId === 'operations' ? 'operations' : 'domain',
  reviewPromptLabel: 'Backend/API'
};

export const DOMAIN_PACK_REGISTRY = createDomainPackRegistry([
  WEB_SAAS_RUNTIME,
  BACKEND_API_RUNTIME
]);

export const DOMAIN_PACK_MODULES = DOMAIN_PACK_REGISTRY.list().map(runtime => runtime.module);
