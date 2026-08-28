import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { normalizeRequirement } from '../../src/v4/canonical-entities.js';
import {
  DOMAIN_PACK_REGISTRY,
  createDomainPackRegistry,
  type DomainPackRuntime
} from '../../src/v4/domain-packs/registry.js';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import type { DomainPackExpansionAxis, TaskContractV2 } from '../../src/v4/contracts.js';

const BASE_CONTRACT: TaskContractV2 = {
  version: 2,
  objective: 'Bir davranışı tamamla',
  inScope: ['Davranış'],
  outOfScope: ['Diğer davranışlar'],
  filePolicy: {
    status: 'requires_inventory',
    allowedPaths: [],
    forbiddenPaths: ['.git/**']
  },
  verification: {
    testCaseIds: ['test-one'],
    commands: [],
    requiresCommandDiscovery: true
  },
  expectedOutputs: ['Davranış çıktısı'],
  completionEvidence: ['Test kanıtı'],
  rollbackPlan: 'Görev değişikliklerini geri al.'
};

function fakeRuntime(): DomainPackRuntime {
  const module = {
    id: 'software.fake',
    version: '1.0.0',
    name: 'Sahte Alan Paketi',
    description: 'Registry genişletilebilirlik testi.',
    category: 'software' as const,
    dependencies: ['software.core'],
    conflicts: [],
    triggers: ['fake'],
    contributions: {
      requiredSections: ['requirements'],
      suggestedSections: ['testing'],
      reviewerRuleIds: ['FAKE-001'],
      exportDocumentIds: ['requirements'],
      domainPack: {
        id: 'fake-pack',
        maturity: 'experimental' as const,
        projectTypes: ['fake-project'],
        limitations: ['Yalnız test amacıyla kullanılır.'],
        discoveryQuestions: [{
          id: 'fake.question',
          prompt: 'Sahte alan sınırı nedir?',
          rationale: 'Genişletilebilirliği doğrular.',
          affectedSectionId: 'requirements',
          appliesWhen: 'always' as const
        }],
        requirementGuidance: [],
        riskGuidance: [],
        taskContractGuidance: {
          expectedOutputs: ['Sahte alan çıktısı'],
          completionEvidence: ['Sahte alan kanıtı']
        }
      }
    }
  };
  return {
    id: 'fake-pack',
    module,
    ui: {
      titleId: 'fake-pack-title',
      previewLabel: 'Sahte paket önizlemesi',
      activationMessage: 'Sahte paket etkinleştirildi.',
      commandType: 'ApplyFakePack',
      description: 'Sahte paket.',
      activeDescription: 'Sahte paket etkin.'
    },
    promptInstruction: ' Sahte alan kuralını doğrula.',
    assess: project => ({
      applicable: /fake/i.test(project.identity.originalIdea),
      active: project.modules.active.some(item => item.id === module.id),
      maturity: 'experimental',
      signals: { fake: true },
      checks: [],
      discoveryQuestions: module.contributions.domainPack?.discoveryQuestions || [],
      limitations: module.contributions.domainPack?.limitations || []
    }),
    discoveryQuestions: () => module.contributions.domainPack?.discoveryQuestions || [],
    enrichTaskContract: (_project, _requirement, contract) => ({
      ...contract,
      expectedOutputs: [...contract.expectedOutputs, 'Sahte alan çıktısı']
    }),
    testKind: () => 'integration',
    readinessDimension: () => 'consistency',
    reviewCategory: () => 'domain',
    reviewPromptLabel: 'Sahte'
  };
}

/**
 * fakeRuntime()'ın genişletme eksenleri (expansionAxes) sürümü: registry seviyesinde
 * collectExpansionAxes davranışını (applicable üzerinden, aktivasyon şartsız; kimlik
 * çakışmasında ilk pack kazanır) izole test etmek için kullanılır.
 */
function fakeRuntimeWithExpansionAxes(
  id: string,
  moduleId: string,
  axes: DomainPackExpansionAxis[]
): DomainPackRuntime {
  const module = {
    id: moduleId,
    version: '1.0.0',
    name: `Sahte Eksen Paketi ${id}`,
    description: 'Registry collectExpansionAxes testi.',
    category: 'software' as const,
    dependencies: [],
    conflicts: [],
    triggers: ['fake'],
    contributions: {
      requiredSections: [],
      suggestedSections: [],
      reviewerRuleIds: [],
      exportDocumentIds: [],
      domainPack: {
        id,
        maturity: 'experimental' as const,
        projectTypes: ['fake-project'],
        limitations: [],
        discoveryQuestions: [],
        expansionAxes: axes,
        requirementGuidance: [],
        riskGuidance: [],
        taskContractGuidance: {
          expectedOutputs: [],
          completionEvidence: []
        }
      }
    }
  };
  return {
    id,
    module,
    ui: {
      titleId: `${id}-title`,
      previewLabel: `${id} önizlemesi`,
      activationMessage: `${id} etkinleştirildi.`,
      commandType: `Apply${id}`,
      description: `${id} paketi.`,
      activeDescription: `${id} etkin.`
    },
    promptInstruction: '',
    // applicable: true, active: false her zaman -> aktivasyon gerektirmeden
    // fikir aşamasında görünmesi gerektiğini doğrular.
    assess: () => ({
      applicable: true,
      active: false,
      maturity: 'experimental',
      signals: {},
      checks: [],
      discoveryQuestions: [],
      limitations: []
    }),
    discoveryQuestions: () => [],
    enrichTaskContract: (_project, _requirement, contract) => contract,
    testKind: () => 'integration',
    readinessDimension: () => 'consistency',
    reviewCategory: () => 'domain',
    reviewPromptLabel: 'Sahte'
  };
}

test('production domain pack registry exposes unique Web/SaaS, Backend/API and Game runtimes', () => {
  const runtimes = DOMAIN_PACK_REGISTRY.list();
  // game.ts eklendi (üçüncü tam eş domain pack): registry artık üç runtime pinliyor.
  assert.deepEqual(runtimes.map(item => item.id), ['web-saas', 'backend-api', 'game']);
  assert.equal(new Set(runtimes.map(item => item.id)).size, runtimes.length);
  assert.equal(new Set(runtimes.map(item => item.module.id)).size, runtimes.length);
  assert.equal(DOMAIN_PACK_REGISTRY.getByModuleId('software.web')?.id, 'web-saas');
  assert.equal(DOMAIN_PACK_REGISTRY.getByModuleId('software.backend-api')?.id, 'backend-api');
  assert.equal(DOMAIN_PACK_REGISTRY.getByModuleId('software.game')?.id, 'game');
});

test('registry factory adds a third pack without changing consumers', () => {
  const runtime = fakeRuntime();
  const registry = createDomainPackRegistry([runtime]);
  const project = analyzeIdea('Fake proje fikri');
  assert.deepEqual(registry.applicable(project).map(item => item.id), ['fake-pack']);
  assert.deepEqual(
    registry.collectDiscoveryQuestions(project, ['software.fake']).map(item => item.id),
    ['fake.question']
  );

  project.modules.active.push({
    id: 'software.fake',
    version: '1.0.0',
    enabledAtRevision: project.canonicalRevision,
    config: {}
  });
  const requirement = normalizeRequirement({
    id: 'req-fake',
    title: 'Sahte gereksinim',
    statement: 'Sahte davranış doğrulanmalıdır.',
    kind: 'functional',
    priority: 'must',
    acceptanceCriteria: ['Davranış gözlenir.'],
    status: 'accepted'
  });
  assert.equal(registry.selectTestKind(project, requirement), 'integration');
  assert.ok(
    registry.enrichTaskContract(project, requirement, BASE_CONTRACT)
      .expectedOutputs.includes('Sahte alan çıktısı')
  );
});

test('registry rejects duplicate runtime and module identities', () => {
  const runtime = fakeRuntime();
  assert.throws(
    () => createDomainPackRegistry([runtime, { ...runtime }]),
    /Yinelenen domain pack kimliği/
  );
  assert.throws(
    () => createDomainPackRegistry([runtime, { ...runtime, id: 'another-pack' }]),
    /Yinelenen domain pack modülü/
  );
});

test('collectExpansionAxes surfaces applicable packs axes without requiring activation', () => {
  const axis: DomainPackExpansionAxis = {
    id: 'fake-axis-inactive',
    label: 'Sahte eksen',
    hint: 'Sahte ipucu?',
    seedTitles: ['Başlangıç 1', 'Başlangıç 2']
  };
  const runtime = fakeRuntimeWithExpansionAxes('fake-axis-pack', 'software.fake-axis-pack', [axis]);
  const registry = createDomainPackRegistry([runtime]);
  const project = analyzeIdea('Fake proje fikri');

  // Sahte modül henüz aktive edilmedi (yalnız varsayılan core.planning aktif) ama
  // applicable=true olduğu için eksen görünmeli — fikir aşaması aktivasyon şartı taşımaz.
  assert.equal(project.modules.active.some(item => item.id === 'software.fake-axis-pack'), false);
  assert.deepEqual(
    registry.collectExpansionAxes(project).map(item => item.id),
    ['fake-axis-inactive']
  );
});

test('collectExpansionAxes dedupes by id across packs, first pack wins', () => {
  const sharedFromA: DomainPackExpansionAxis = {
    id: 'shared-axis',
    label: 'A paketinin etiketi',
    hint: 'A ipucu',
    seedTitles: ['A1', 'A2']
  };
  const sharedFromB: DomainPackExpansionAxis = {
    id: 'shared-axis',
    label: 'B paketinin etiketi',
    hint: 'B ipucu',
    seedTitles: ['B1', 'B2']
  };
  const onlyInB: DomainPackExpansionAxis = {
    id: 'only-in-b',
    label: 'Yalnız B',
    hint: 'B ipucu 2',
    seedTitles: ['C1', 'C2']
  };
  const runtimeA = fakeRuntimeWithExpansionAxes('fake-axis-pack-a', 'software.fake-axis-pack-a', [sharedFromA]);
  const runtimeB = fakeRuntimeWithExpansionAxes('fake-axis-pack-b', 'software.fake-axis-pack-b', [sharedFromB, onlyInB]);
  const registry = createDomainPackRegistry([runtimeA, runtimeB]);
  const project = analyzeIdea('Fake proje fikri');

  const axes = registry.collectExpansionAxes(project);
  assert.deepEqual(axes.map(item => item.id), ['shared-axis', 'only-in-b']);
  assert.equal(axes.find(item => item.id === 'shared-axis')?.label, 'A paketinin etiketi', 'ilk pack (runtimeA) kazanmalı');
});

test('production consumers depend on the registry, not individual packs', () => {
  const consumerPaths = [
    'src/v4/module-registry.js',
    'src/v4/application/readiness-service.ts',
    'src/v4/review-engine.js',
    // task-compiler.js -> .ts donusumunun yansimasi; guard hala uzanti-bagimsiz
    // ve "registry'ye bagli, tekil pack'lere degil" mimari kuralini denetliyor.
    'src/v4/task-compiler.ts',
    // idea-expansion/categories.ts artik tier 2 eksenlerini registry.collectExpansionAxes
    // uzerinden okuyor; ayni mimari kural (tekil pack'lere degil, registry'ye bagli olmak)
    // burada da kilitlenir.
    'src/v4/idea-expansion/categories.ts'
  ];
  for (const relativePath of consumerPaths) {
    const content = fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
    assert.match(content, /domain-packs\/registry/);
    // game.ts eklendi: uc pack'e de dogrudan bagli olunmadigini denetler.
    assert.doesNotMatch(content, /domain-packs\/(?:web-saas|backend-api|game)/);
  }
});
