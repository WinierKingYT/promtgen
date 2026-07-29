import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateReadiness } from '../../src/v4/application/readiness-service.js';
import { normalizeRequirement } from '../../src/v4/canonical-entities.js';
import { assessWebSaasPack, getWebSaasDiscoveryQuestions } from '../../src/v4/domain-packs/web-saas.js';
import { applyModuleActivation, previewModuleActivation } from '../../src/v4/module-registry.js';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import { runPlanReview } from '../../src/v4/review-engine.js';
import { compileTaskPlan } from '../../src/v4/task-compiler.js';

function activateWebSaas(project: ReturnType<typeof analyzeIdea>) {
  const preview = previewModuleActivation(project, ['software.web']);
  const result = applyModuleActivation(project, preview, { approved: true });
  assert.equal(result.success, true);
  return result.project;
}

test('Web/SaaS pack is conditional, explicit and exposes bounded support', () => {
  const project = analyzeIdea(
    'Küçük ekiplerin hesap açıp çalışma alanlarında veri sakladığı ve Stripe aboneliği kullandığı bir SaaS web paneli.'
  );
  const assessment = assessWebSaasPack(project);
  assert.equal(assessment.applicable, true);
  assert.equal(assessment.active, false);
  assert.equal(assessment.maturity, 'candidate-stable');
  assert.ok(assessment.limitations.some(item => /kritik finans\/sağlık/i.test(item)));

  const questionIds = getWebSaasDiscoveryQuestions(project).map(item => item.id);
  assert.ok(questionIds.includes('web.core-flow'));
  assert.ok(questionIds.includes('web.account-boundary'));
  assert.ok(questionIds.includes('web.data-lifecycle'));
  assert.ok(questionIds.includes('web.tenant-isolation'));
  assert.ok(questionIds.includes('web.payment-lifecycle'));
  assert.ok(questionIds.includes('web.delivery'));

  const preview = previewModuleActivation(project, ['software.web']);
  assert.deepEqual(preview.moduleIds, ['software.core', 'software.web']);
  assert.equal(preview.domainQuestions.length, 6);
  assert.ok(preview.limitations.length > 0);
  assert.equal(project.modules.active.some(item => item.id === 'software.web'), false, 'Önizleme canonical planı değiştirmemeli');
});

test('approved Web/SaaS pack drives sections, readiness and deterministic review', () => {
  const project = analyzeIdea('Kullanıcı hesabı ve takım çalışma alanları olan bir SaaS web uygulaması.');
  const active = activateWebSaas(project);
  assert.ok(active.modules.active.some(item => item.id === 'software.web' && item.version === '2.0.0'));
  assert.equal(active.sections.deployment.required, true);
  assert.ok(active.sections.security.warnings.some(item => item.startsWith('Alan sorusu:')));

  const assessment = assessWebSaasPack(active);
  assert.equal(assessment.active, true);
  assert.ok(assessment.checks.some(item => item.id === 'web.authorization' && !item.passed && item.blocking));
  assert.ok(assessment.checks.some(item => item.id === 'web.tenant-isolation' && !item.passed && item.blocking));

  const readiness = calculateReadiness(active).readiness;
  assert.ok(readiness.checks.some(item => item.id === 'domain.web.authorization' && item.status === 'blocked'));
  assert.equal(readiness.checks.find(item => item.id === 'domain.web.authorization')?.sectionId, 'security');

  const review = runPlanReview(active);
  assert.ok(review.findings.some(item => item.ruleId === 'WEB.AUTHORIZATION' && item.severity === 'high'));
  assert.ok(review.findings.some(item => item.ruleId === 'WEB.TENANT-ISOLATION' && item.severity === 'high'));
});

test('Web/SaaS pack enriches TaskContract V2 and selects domain test kinds', () => {
  const project = activateWebSaas(analyzeIdea('Yetkili kullanıcıların REST API üzerinden kayıt yönettiği web uygulaması.'));
  project.requirements = [
    normalizeRequirement({
      id: 'req-auth',
      title: 'Sunucu yetkilendirmesi',
      statement: 'Yetkisiz API istekleri sunucu tarafından reddedilmelidir.',
      kind: 'quality',
      priority: 'must',
      acceptanceCriteria: ['Yetkisiz istek 403 yanıtı alır.'],
      status: 'accepted'
    }),
    normalizeRequirement({
      id: 'req-a11y',
      title: 'Klavye erişilebilirliği',
      statement: 'Ana kullanıcı akışı yalnız klavye ile tamamlanabilmelidir.',
      kind: 'quality',
      priority: 'should',
      acceptanceCriteria: ['Ana akışta görünür odak sırası korunur.'],
      status: 'accepted'
    })
  ];

  const compilation = compileTaskPlan(project);
  assert.equal(compilation.tasks.length, 2);
  assert.ok(compilation.tasks.every(task =>
    task.contract.expectedOutputs.includes('Etkilenen kullanıcı akışı ve hata durumlarının listesi')
  ));
  assert.ok(compilation.tasks.every(task =>
    task.contract.completionEvidence.includes('Ana akışın başarılı ve başarısız durumları doğrulandı')
  ));
  assert.deepEqual(compilation.testCases.map(item => item.kind), ['security', 'e2e']);
  assert.ok(compilation.agentPrompts.every(prompt => /Web\/SaaS paketi aktiftir/.test(prompt.instructions)));
});

test('non-web ideas do not receive Web/SaaS domain rules', () => {
  const project = analyzeIdea('Tek oyunculu 2D platform oyunu yapmak istiyorum.');
  const assessment = assessWebSaasPack(project);
  assert.equal(assessment.applicable, false);
  assert.equal(assessment.active, false);
});

test('legacy software.web module requires an explicit 2.0 upgrade', () => {
  const project = analyzeIdea('Küçük bir web paneli yapmak istiyorum.');
  project.modules.active.push({ id: 'software.web', version: '1.0.0', enabledAtRevision: 1, config: {} });
  assert.equal(assessWebSaasPack(project).active, false);

  const preview = previewModuleActivation(project, ['software.web']);
  assert.deepEqual(preview.upgrades, [{ id: 'software.web', fromVersion: '1.0.0', toVersion: '2.0.0' }]);
  assert.equal(project.modules.active.find(item => item.id === 'software.web')?.version, '1.0.0');

  const upgraded = applyModuleActivation(project, preview, { approved: true });
  assert.equal(upgraded.success, true);
  assert.equal(upgraded.project.modules.active.filter(item => item.id === 'software.web').length, 1);
  assert.equal(upgraded.project.modules.active.find(item => item.id === 'software.web')?.version, '2.0.0');
  assert.equal(assessWebSaasPack(upgraded.project).active, true);
});
