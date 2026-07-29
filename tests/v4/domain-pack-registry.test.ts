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
import type { TaskContractV2 } from '../../src/v4/contracts.js';

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

test('production domain pack registry exposes unique Web/SaaS and Backend/API runtimes', () => {
  const runtimes = DOMAIN_PACK_REGISTRY.list();
  assert.deepEqual(runtimes.map(item => item.id), ['web-saas', 'backend-api']);
  assert.equal(new Set(runtimes.map(item => item.id)).size, runtimes.length);
  assert.equal(new Set(runtimes.map(item => item.module.id)).size, runtimes.length);
  assert.equal(DOMAIN_PACK_REGISTRY.getByModuleId('software.web')?.id, 'web-saas');
  assert.equal(DOMAIN_PACK_REGISTRY.getByModuleId('software.backend-api')?.id, 'backend-api');
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

test('production consumers depend on the registry, not individual packs', () => {
  const consumerPaths = [
    'src/v4/module-registry.js',
    'src/v4/application/readiness-service.ts',
    'src/v4/review-engine.js',
    'src/v4/task-compiler.js',
    'src/react/components/DomainPackCard.tsx'
  ];
  for (const relativePath of consumerPaths) {
    const content = fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
    assert.match(content, /domain-packs\/registry/);
    assert.doesNotMatch(content, /domain-packs\/(?:web-saas|backend-api)/);
  }
});
