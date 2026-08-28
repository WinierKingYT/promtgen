import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateReadiness } from '../../src/v4/application/readiness-service.js';
import { classifyProjectDomain } from '../../src/v4/ai/domain-classifier.js';
import { normalizeRequirement } from '../../src/v4/canonical-entities.js';
import { assessGamePack, getGameDiscoveryQuestions } from '../../src/v4/domain-packs/game.js';
import { getExpansionCategories } from '../../src/v4/idea-expansion/categories.js';
import { applyModuleActivation, previewModuleActivation } from '../../src/v4/module-registry.js';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import { runPlanReview } from '../../src/v4/review-engine.js';
import { compileTaskPlan } from '../../src/v4/task-compiler.js';

function activateGame(project: ReturnType<typeof analyzeIdea>) {
  const preview = previewModuleActivation(project, ['software.game']);
  const result = applyModuleActivation(project, preview, { approved: true });
  assert.equal(result.success, true);
  return result.project;
}

test('Game pack is conditional, experimental and exposes bounded support', () => {
  const project = analyzeIdea(
    'Unity ile yapılan, oyuncuların çok oyunculu (multiplayer) modda savaştığı, sunucu yetkili ağ mimarisi ve özel karakter animasyonlarına sahip bir 3D aksiyon oyunu.'
  );
  const assessment = assessGamePack(project);
  assert.equal(assessment.applicable, true);
  assert.equal(assessment.active, false);
  assert.equal(assessment.maturity, 'experimental');
  assert.ok(assessment.limitations.some(item => /benchmark veya gerçek kullanıcı kanıtı içermez/i.test(item)));

  const questionIds = getGameDiscoveryQuestions(project).map(item => item.id);
  assert.ok(questionIds.includes('game.core-loop'));
  assert.ok(questionIds.includes('game.frame-budget'));
  assert.ok(questionIds.includes('game.input-latency'));
  assert.ok(questionIds.includes('game.network-authority'));
  assert.ok(questionIds.includes('game.determinism-replay'));
  assert.ok(questionIds.includes('game.asset-pipeline'));

  const preview = previewModuleActivation(project, ['software.game']);
  assert.deepEqual(preview.moduleIds, ['software.core', 'software.game']);
  assert.equal(preview.domainQuestions.length, 6);
  assert.ok(preview.limitations.length > 0);
  assert.equal(project.modules.active.some(item => item.id === 'software.game'), false, 'Önizleme canonical planı değiştirmemeli');
});

test('approved Game pack drives sections, readiness and deterministic review', () => {
  const project = activateGame(analyzeIdea(
    'Sunucu yetkili ağ mimarisiyle çalışan çok oyunculu (multiplayer) bir arena oyunu.'
  ));
  assert.ok(project.modules.active.some(item => item.id === 'software.game' && item.version === '1.0.0'));

  const assessment = assessGamePack(project);
  assert.equal(assessment.active, true);
  assert.ok(assessment.checks.some(item => item.id === 'game.network-authority' && !item.passed && item.blocking));
  assert.ok(assessment.checks.some(item => item.id === 'game.determinism-replay' && !item.passed && item.blocking));

  const readiness = calculateReadiness(project).readiness;
  assert.ok(readiness.checks.some(item => item.id === 'domain.game.network-authority' && item.status === 'blocked'));
  assert.equal(readiness.checks.find(item => item.id === 'domain.game.network-authority')?.sectionId, 'architecture');

  const review = runPlanReview(project);
  assert.ok(review.findings.some(item => item.ruleId === 'GAME.NETWORK-AUTHORITY' && item.severity === 'high'));
  assert.ok(review.findings.some(item => item.ruleId === 'GAME.DETERMINISM-REPLAY' && item.severity === 'high'));
});

test('Game pack enriches TaskContract V2 and selects domain test kinds', () => {
  const project = activateGame(analyzeIdea('Godot ile 2D platform oyunu yapmak istiyorum.'));
  project.requirements = [
    normalizeRequirement({
      id: 'req-net',
      title: 'Ağ yetkisi karar testi',
      statement: 'Ağ üzerinden gelen konum verisi sunucu tarafından doğrulanmalıdır.',
      kind: 'quality',
      priority: 'must',
      acceptanceCriteria: ['Sunucu yetkisiz istemci konumunu reddeder.'],
      status: 'accepted'
    }),
    normalizeRequirement({
      id: 'req-loop',
      title: 'Ana oyun döngüsü akışı',
      statement: 'Oyuncu ana oyun döngüsünü kesintisiz tamamlayabilmelidir.',
      kind: 'functional',
      priority: 'must',
      acceptanceCriteria: ['Ana fiil tek girdiyle tetiklenir.'],
      status: 'accepted'
    })
  ];

  const compilation = compileTaskPlan(project);
  assert.equal(compilation.tasks.length, 2);
  assert.ok(compilation.tasks.every(task =>
    task.contract.expectedOutputs.includes('Etkilenen oyun döngüsü adımı ve oyuncuya görünen geri bildirim')
  ));
  assert.ok(compilation.tasks.every(task =>
    task.contract.completionEvidence.includes('Ana oyun döngüsü hedef kare hızı ve girdi gecikmesi sınırı içinde doğrulandı')
  ));
  assert.deepEqual(compilation.testCases.map(item => item.kind), ['integration', 'e2e']);
  assert.ok(compilation.agentPrompts.every(prompt => /Oyun paketi aktiftir/.test(prompt.instructions)));
});

test('non-game ideas do not receive Game domain rules', () => {
  const project = analyzeIdea('REST endpoint ve PostgreSQL kullanan backend API servisi.');
  const assessment = assessGamePack(project);
  assert.equal(assessment.applicable, false);
  assert.equal(assessment.active, false);
});

test('Game pack applicability matches classifyProjectDomain for representative game ideas', () => {
  const ideas = [
    'Unity ile multiplayer bir at sistemi',
    'Godot ile 2D platform oyunu',
    'Unity ile tek kişilik bulmaca oyunu'
  ];
  for (const idea of ideas) {
    const project = analyzeIdea(idea);
    assert.equal(classifyProjectDomain(project.identity.originalIdea || ''), 'game', `classifyProjectDomain: ${idea}`);
    assert.equal(assessGamePack(project).applicable, true, `Game pack applicable: ${idea}`);
  }
});

test('Game pack expansionAxes are a provable no-op on the idea-stage board (same ids as BY_DOMAIN.game, first-wins dedupe)', () => {
  const project = analyzeIdea('Unity ile multiplayer bir at sistemi');
  const axisIds = getExpansionCategories(project).map(item => item.id);
  assert.deepEqual(axisIds, [
    // CORE (sabit sıra)
    'onboarding', 'core-depth', 'data', 'trust', 'money', 'growth', 'measure', 'narrow',
    // BY_DOMAIN.game — pack'in aynı 5 kimliği kendi expansionAxes'inde tekrarlaması
    // bu listeye YENİ bir kimlik eklemez (registry ilk-kazanır kuralı, BY_DOMAIN her
    // zaman pack eksenlerinden önce birleştirilir).
    'game-loop', 'simulated-state', 'network-authority', 'input-and-feel', 'content-pipeline'
  ]);
});
