import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createProjectDocument } from '../../src/v4/project-document.js';
import { normalizeRequirement } from '../../src/v4/canonical-entities.js';
import { assertValidCompilation, compileTaskPlan } from '../../src/v4/task-compiler.js';

// Bu dosya, src/v4/task-compiler.js -> .ts donusumunden ONCE, o an yururlukte
// olan davranisi sabitler (characterization tests). Amac: `assertValidCompilation`in
// ACCEPT/REJECT kapilarindan ve `compileTaskPlan`in erken-donus uyari metinlerinden
// hicbiri tur donusumu sirasinda sessizce degismesin.

function baseProjectWithTwoAcceptedRequirements() {
  const project = createProjectDocument({ idea: 'Karakterizasyon projesi' });
  project.requirements = [
    normalizeRequirement({
      id: 'req-a',
      title: 'Gereksinim A',
      statement: 'Kullanici A davranisini tamamlayabilmeli',
      priority: 'must',
      acceptanceCriteria: ['A davranisi gozlenir'],
      status: 'accepted'
    }),
    normalizeRequirement({
      id: 'req-b',
      title: 'Gereksinim B',
      statement: 'Kullanici B davranisini tamamlayabilmeli',
      priority: 'should',
      acceptanceCriteria: ['B davranisi gozlenir'],
      status: 'accepted'
    })
  ];
  return project;
}

describe('assertValidCompilation -- dizi tipi kapilari (REJECT dallari)', () => {
  it('testCases dizi degilse reddeder', () => {
    const compilation = compileTaskPlan(baseProjectWithTwoAcceptedRequirements());
    assert.throws(
      () => assertValidCompilation({ ...compilation, testCases: null }),
      /testCases must be an array/
    );
  });

  it('milestones dizi degilse reddeder', () => {
    const compilation = compileTaskPlan(baseProjectWithTwoAcceptedRequirements());
    assert.throws(
      () => assertValidCompilation({ ...compilation, milestones: undefined }),
      /milestones must be an array/
    );
  });

  it('traceLinks dizi degilse reddeder', () => {
    const compilation = compileTaskPlan(baseProjectWithTwoAcceptedRequirements());
    assert.throws(
      () => assertValidCompilation({ ...compilation, traceLinks: 'not-an-array' }),
      /traceLinks must be an array/
    );
  });

  it('agentPrompts dizi degilse reddeder', () => {
    const compilation = compileTaskPlan(baseProjectWithTwoAcceptedRequirements());
    assert.throws(
      () => assertValidCompilation({ ...compilation, agentPrompts: {} }),
      /agentPrompts must be an array/
    );
  });

  it('warnings dizi degilse reddeder', () => {
    const compilation = compileTaskPlan(baseProjectWithTwoAcceptedRequirements());
    assert.throws(
      () => assertValidCompilation({ ...compilation, warnings: null }),
      /warnings must be an array/
    );
  });
});

describe('assertValidCompilation -- TaskContract V2 tamlik kapilari (REJECT dallari)', () => {
  it('objective, inScope veya outOfScope bossa reddeder', () => {
    const compilation = compileTaskPlan(baseProjectWithTwoAcceptedRequirements());
    const brokenTask = { ...compilation.tasks[0], contract: { ...compilation.tasks[0].contract, objective: '' } };
    assert.throws(
      () => assertValidCompilation({ ...compilation, tasks: [brokenTask, ...compilation.tasks.slice(1)] }),
      /scope contract is incomplete/
    );
  });

  it('filePolicy.forbiddenPaths bossa reddeder', () => {
    const compilation = compileTaskPlan(baseProjectWithTwoAcceptedRequirements());
    const brokenTask = {
      ...compilation.tasks[0],
      contract: { ...compilation.tasks[0].contract, filePolicy: { ...compilation.tasks[0].contract.filePolicy, forbiddenPaths: [] } }
    };
    assert.throws(
      () => assertValidCompilation({ ...compilation, tasks: [brokenTask, ...compilation.tasks.slice(1)] }),
      /file policy is incomplete/
    );
  });

  it('verification.testCaseIds bossa reddeder', () => {
    const compilation = compileTaskPlan(baseProjectWithTwoAcceptedRequirements());
    const brokenTask = {
      ...compilation.tasks[0],
      contract: { ...compilation.tasks[0].contract, verification: { ...compilation.tasks[0].contract.verification, testCaseIds: [] } }
    };
    assert.throws(
      () => assertValidCompilation({ ...compilation, tasks: [brokenTask, ...compilation.tasks.slice(1)] }),
      /verification contract is incomplete/
    );
  });

  it('completionEvidence bossa reddeder', () => {
    const compilation = compileTaskPlan(baseProjectWithTwoAcceptedRequirements());
    const brokenTask = { ...compilation.tasks[0], contract: { ...compilation.tasks[0].contract, completionEvidence: [] } };
    assert.throws(
      () => assertValidCompilation({ ...compilation, tasks: [brokenTask, ...compilation.tasks.slice(1)] }),
      /verification contract is incomplete/
    );
  });

  it('rollbackPlan bossa reddeder', () => {
    const compilation = compileTaskPlan(baseProjectWithTwoAcceptedRequirements());
    const brokenTask = { ...compilation.tasks[0], contract: { ...compilation.tasks[0].contract, rollbackPlan: '' } };
    assert.throws(
      () => assertValidCompilation({ ...compilation, tasks: [brokenTask, ...compilation.tasks.slice(1)] }),
      /verification contract is incomplete/
    );
  });

  it('verification.testCaseIds derlenmis bir test case referans etmiyorsa reddeder', () => {
    const compilation = compileTaskPlan(baseProjectWithTwoAcceptedRequirements());
    const brokenTask = {
      ...compilation.tasks[0],
      contract: { ...compilation.tasks[0].contract, verification: { ...compilation.tasks[0].contract.verification, testCaseIds: ['test-yok'] } }
    };
    assert.throws(
      () => assertValidCompilation({ ...compilation, tasks: [brokenTask, ...compilation.tasks.slice(1)] }),
      /references a missing contract test case/
    );
  });

  it('requiresCommandDiscovery false iken komut listesi bossa reddeder', () => {
    const compilation = compileTaskPlan(baseProjectWithTwoAcceptedRequirements());
    const brokenTask = {
      ...compilation.tasks[0],
      contract: {
        ...compilation.tasks[0].contract,
        verification: { ...compilation.tasks[0].contract.verification, requiresCommandDiscovery: false, commands: [] }
      }
    };
    assert.throws(
      () => assertValidCompilation({ ...compilation, tasks: [brokenTask, ...compilation.tasks.slice(1)] }),
      /must define verification commands/
    );
  });

  it('filePolicy.status "confirmed" iken allowedPaths bossa reddeder', () => {
    const compilation = compileTaskPlan(baseProjectWithTwoAcceptedRequirements());
    const brokenTask = {
      ...compilation.tasks[0],
      contract: {
        ...compilation.tasks[0].contract,
        filePolicy: { ...compilation.tasks[0].contract.filePolicy, status: 'confirmed', allowedPaths: [] }
      }
    };
    assert.throws(
      () => assertValidCompilation({ ...compilation, tasks: [brokenTask, ...compilation.tasks.slice(1)] }),
      /confirmed file policy must have allowed paths/
    );
  });

  it('test case id veya title eksikse reddeder', () => {
    const compilation = compileTaskPlan(baseProjectWithTwoAcceptedRequirements());
    const brokenTestCase = { ...compilation.testCases[0], title: '' };
    assert.throws(
      () => assertValidCompilation({ ...compilation, testCases: [brokenTestCase, ...compilation.testCases.slice(1)] }),
      /Each compiled test case must have id and title/
    );
  });
});

describe('compileTaskPlan -- erken donus uyari metinleri (kullanici-gorunur cikti)', () => {
  it('kabul edilmis gereksinim yokken bos plan ve sabit uyari doner', () => {
    const project = createProjectDocument({ idea: 'Bos plan projesi' });
    project.requirements = [
      normalizeRequirement({ id: 'req-taslak', title: 'Taslak gereksinim', statement: 'Henuz kabul edilmedi', status: 'draft' })
    ];

    const compilation = compileTaskPlan(project);

    assert.deepEqual(compilation.tasks, []);
    assert.deepEqual(compilation.testCases, []);
    assert.deepEqual(compilation.milestones, []);
    assert.deepEqual(compilation.traceLinks, []);
    assert.deepEqual(compilation.agentPrompts, []);
    assert.deepEqual(compilation.warnings, ['Görev üretmek için en az bir kabul edilmiş (accepted) gereksinim bulunmalıdır.']);
    assert.equal(compilation.baseRevision, project.canonicalRevision);
  });

  it('kabul edilmis gereksinim kalite kapisindan gecemezse quality.issues aynen uyari olarak doner', () => {
    const project = createProjectDocument({ idea: 'Kalitesiz plan projesi' });
    project.requirements = [
      normalizeRequirement({
        id: 'req-bos-kriter',
        title: 'Boş kabul kriteri',
        statement: 'Gözlenebilir davranış olmalı burada',
        priority: 'must',
        acceptanceCriteria: [],
        status: 'accepted'
      })
    ];

    const compilation = compileTaskPlan(project);

    assert.deepEqual(compilation.tasks, []);
    assert.deepEqual(compilation.testCases, []);
    assert.deepEqual(compilation.warnings, [
      'Boş kabul kriteri: En az bir kabul kriteri gerekli.',
      'Boş kabul kriteri: Must gereksinimi bir göreve bağlı değil.',
      'Boş kabul kriteri: Must gereksinimi bir doğrulama senaryosuna bağlı değil.'
    ]);
  });
});
