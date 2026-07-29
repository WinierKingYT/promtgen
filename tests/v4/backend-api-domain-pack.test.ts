import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateReadiness } from '../../src/v4/application/readiness-service.js';
import { normalizeRequirement } from '../../src/v4/canonical-entities.js';
import {
  assessBackendApiPack,
  getBackendApiDiscoveryQuestions
} from '../../src/v4/domain-packs/backend-api.js';
import { assessWebSaasPack } from '../../src/v4/domain-packs/web-saas.js';
import { applyModuleActivation, previewModuleActivation } from '../../src/v4/module-registry.js';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import { runPlanReview } from '../../src/v4/review-engine.js';
import { compileTaskPlan } from '../../src/v4/task-compiler.js';

function activateBackendApi(project: ReturnType<typeof analyzeIdea>) {
  const preview = previewModuleActivation(project, ['software.backend-api']);
  const result = applyModuleActivation(project, preview, { approved: true });
  assert.equal(result.success, true);
  return result.project;
}

test('Backend/API pack is conditional, beta and requires explicit approval', () => {
  const project = analyzeIdea(
    'Harici istemcilerin API anahtarıyla sipariş yazdığı, webhook ve kuyruk kullanan REST backend API.'
  );
  const assessment = assessBackendApiPack(project);
  assert.equal(assessment.applicable, true);
  assert.equal(assessment.active, false);
  assert.equal(assessment.maturity, 'beta');
  assert.ok(assessment.limitations.some(item => /framework.*seçmez/i.test(item)));

  const questionIds = getBackendApiDiscoveryQuestions(project).map(item => item.id);
  assert.ok(questionIds.includes('api.contract'));
  assert.ok(questionIds.includes('api.error-model'));
  assert.ok(questionIds.includes('api.authentication'));
  assert.ok(questionIds.includes('api.data-consistency'));
  assert.ok(questionIds.includes('api.idempotency'));
  assert.ok(questionIds.includes('api.operations'));

  const preview = previewModuleActivation(project, ['software.backend-api']);
  assert.deepEqual(preview.moduleIds, ['software.core', 'software.backend-api']);
  assert.equal(preview.domainQuestions.length, 6);
  assert.ok(preview.limitations.length > 0);
  assert.equal(project.modules.active.some(item => item.id === 'software.backend-api'), false);
});

test('approved Backend/API pack drives sections, readiness and review findings', () => {
  const project = activateBackendApi(analyzeIdea(
    'Token ile yetkilendirilen istemcilerin veritabanına kayıt yazdığı REST backend API.'
  ));
  assert.equal(project.sections.operations.required, true);
  assert.ok(project.sections.security.warnings.some(item => item.startsWith('Alan sorusu:')));

  const assessment = assessBackendApiPack(project);
  assert.ok(assessment.checks.some(item => item.id === 'api.contract' && item.blocking && !item.passed));
  assert.ok(assessment.checks.some(item => item.id === 'api.authentication' && item.blocking && !item.passed));
  assert.ok(assessment.checks.some(item => item.id === 'api.data-consistency' && item.blocking && !item.passed));

  const readiness = calculateReadiness(project).readiness;
  assert.equal(readiness.checks.find(item => item.id === 'domain.api.contract')?.status, 'blocked');
  assert.equal(readiness.checks.find(item => item.id === 'domain.api.authentication')?.sectionId, 'security');

  const review = runPlanReview(project);
  assert.ok(review.findings.some(item => item.ruleId === 'API.CONTRACT' && item.severity === 'high'));
  assert.ok(review.findings.some(item => item.ruleId === 'API.AUTHENTICATION' && item.severity === 'high'));
});

test('Backend/API pack enriches TaskContract V2 and chooses security/integration tests', () => {
  const project = activateBackendApi(analyzeIdea('REST API üzerinden kayıt yöneten backend servisi.'));
  project.requirements = [
    normalizeRequirement({
      id: 'req-auth',
      title: 'API kaynak yetkilendirmesi',
      statement: 'Yetkisiz token ile kaynak erişimi sunucu tarafından reddedilmelidir.',
      kind: 'quality',
      priority: 'must',
      acceptanceCriteria: ['Kimliği olmayan istek 401, yetkisiz kaynak erişimi 403 alır.'],
      status: 'accepted'
    }),
    normalizeRequirement({
      id: 'req-contract',
      title: 'API sözleşmesi',
      statement: 'REST endpoint istek ve yanıt şeması contract testinde doğrulanmalıdır.',
      kind: 'functional',
      priority: 'must',
      acceptanceCriteria: ['Belgelenen response şeması contract testi geçer.'],
      status: 'accepted'
    })
  ];

  const compilation = compileTaskPlan(project);
  assert.equal(compilation.tasks.length, 2);
  assert.ok(compilation.tasks.every(task =>
    task.contract.expectedOutputs.includes('Etkilenen API sözleşmesi ve geriye uyumluluk etkisi')
  ));
  assert.ok(compilation.tasks.every(task =>
    task.contract.completionEvidence.includes('API contract ve negatif hata senaryoları doğrulandı')
  ));
  assert.deepEqual(compilation.testCases.map(item => item.kind), ['security', 'integration']);
  assert.ok(compilation.agentPrompts.every(prompt => /Backend\/API paketi aktiftir/.test(prompt.instructions)));
});

test('pure backend API is not claimed by the Web/SaaS pack', () => {
  const project = analyzeIdea('REST endpoint ve PostgreSQL kullanan backend API servisi.');
  assert.equal(assessBackendApiPack(project).applicable, true);
  assert.equal(assessWebSaasPack(project).applicable, false);
});

test('non-API idea does not receive Backend/API rules', () => {
  const project = analyzeIdea('Tek oyunculu 2D platform oyunu yapmak istiyorum.');
  const assessment = assessBackendApiPack(project);
  assert.equal(assessment.applicable, false);
  assert.equal(assessment.active, false);
});
