import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeRequirement, normalizeRisk } from '../../src/v4/canonical-entities.js';
import { acceptRequirementDraft, createRequirementDraftsFromConcept } from '../../src/v4/application/requirement-quality-service.js';
import { calculateReadiness } from '../../src/v4/application/readiness-service.js';
import { analyzeIdea, confirmConceptSummary, finalizePlan, recalculateReadiness, updatePlanSection } from '../../src/v4/planning-engine.js';
import { applyCompiledTaskPlan, compileTaskPlan } from '../../src/v4/task-compiler.js';
import type { ProjectDocumentV5 } from '../../src/v4/contracts.js';

function readyProject(): ProjectDocumentV5 {
  let project = analyzeIdea('Yerel çalışan, kabul kriterli görevleri ve test bağlantılarını yöneten küçük bir web planlama uygulaması yapmak istiyorum.');
  project.ideaLabSession.conceptSummary!.openQuestions = [];
  project = confirmConceptSummary(project);
  project = createRequirementDraftsFromConcept(project);
  for (const requirement of project.requirements) project = acceptRequirementDraft(project, requirement.id);
  const applied = applyCompiledTaskPlan(project, compileTaskPlan(project), { approved: true });
  assert.equal(applied.success, true);
  project = applied.project;
  for (let pass = 0; pass < 3; pass += 1) {
    for (const [id, section] of Object.entries(project.sections)) {
      if (section.required && (section.status === 'stale' || (!section.content && !section.items.length))) {
        project = updatePlanSection(project, id, { content: section.content || `${section.title} kullanıcı kararlarıyla doğrulandı.` });
      }
    }
  }
  return recalculateReadiness(project);
}

describe('Readiness Score 2.1 and completion gate', () => {
  it('uses the documented five dimensions and evidence checks instead of entity counts', () => {
    const project = readyProject();
    assert.deepEqual(project.readiness.dimensionWeights, {
      completeness: 20,
      consistency: 20,
      traceability: 25,
      riskCoverage: 15,
      implementationReadiness: 20
    });
    assert.equal(project.readiness.version, 2);
    assert.ok(project.readiness.checks.length >= 20);
    assert.ok(project.readiness.checks.every(item => item.possible > 0 && item.message));

    const inflated = structuredClone(project);
    for (let index = 0; index < 100; index += 1) {
      inflated.requirements.push(normalizeRequirement({
        id: `draft-noise-${index}`,
        title: `Taslak gürültü ${index}`,
        statement: 'Henüz kullanıcı tarafından kabul edilmemiş bir taslak.',
        status: 'draft'
      }));
    }
    assert.equal(calculateReadiness(inflated).readiness.score, project.readiness.score, 'Kayıt sayısı skoru yapay biçimde yükseltmemeli.');
  });

  it('blocks scope contradictions, critical risk gaps and dependency cycles', () => {
    const project = readyProject();
    const excluded = project.ideaLabSession.conceptSummary!.outOfScope[0];
    project.tasks[0].description = `${project.tasks[0].description} ${excluded}`;
    project.risks.push(normalizeRisk({
      id: 'risk-critical-ownerless',
      title: 'Kritik veri kaybı',
      description: 'Kalıcı kayıt bozulabilir.',
      impact: 'high',
      probability: 'medium',
      mitigation: '',
      owner: '',
      status: 'open'
    }));
    if (project.tasks.length === 1) {
      project.tasks.push({ ...structuredClone(project.tasks[0]), id: 'task-cycle-peer', title: 'Döngü eşi' });
    }
    project.tasks[0].dependencies = [project.tasks[1].id];
    project.tasks[1].dependencies = [project.tasks[0].id];

    const result = recalculateReadiness(project);
    assert.equal(result.readiness.status, 'blocked');
    assert.ok(result.readiness.checks.find(item => item.id === 'consistent.scope')?.status === 'blocked');
    assert.ok(result.readiness.checks.find(item => item.id === 'risk.owner')?.status === 'blocked');
    assert.ok(result.readiness.checks.find(item => item.id === 'implementation.dependencies')?.status === 'blocked');
    assert.equal(finalizePlan(result, true).success, false, 'Kritik tamamlanma kapıları force ile atlanamamalı.');
  });

  it('allows warnings but requires every hard completion condition', () => {
    const project = readyProject();
    assert.equal(project.readiness.blockers.length, 0);
    assert.ok(project.readiness.warnings.length > 0, 'Ölçülebilir hedef veya risk trace uyarıları görünür kalmalı.');
    const finalized = finalizePlan(project);
    assert.equal(finalized.success, true);
    assert.equal(finalized.project.lifecycle.status, 'finalized');

    const blocked = readyProject();
    blocked.requirements.push(normalizeRequirement({
      id: 'req-unaccepted',
      title: 'Kritik ama kabul edilmemiş gereksinim',
      statement: 'Bu kayıt canonical görev üretmemeli.',
      priority: 'must',
      acceptanceCriteria: ['Davranış gözlenebilir olmalı.'],
      status: 'draft'
    }));
    assert.equal(finalizePlan(blocked).success, true, 'Taslak kayıt tek başına canonical tamamlanma kapısını kapatmamalı.');
  });

  it('reports proportional evidence and ordered actions instead of only a percentage', () => {
    const project = readyProject();
    assert.ok(project.tasks.length > 0);
    project.tasks[0].acceptanceCriteria = [];

    const result = recalculateReadiness(project);
    const taskCheck = result.readiness.checks.find(item => item.id === 'implementation.tasks');
    const taskAction = result.readiness.nextActions.find(item => item.checkId === 'implementation.tasks');

    assert.equal(taskCheck?.status, 'blocked');
    assert.deepEqual(taskCheck?.evidence, {
      satisfied: project.tasks.length - 1,
      total: project.tasks.length
    });
    assert.equal(taskAction?.priority, 'critical');
    assert.equal(taskAction?.sectionId, 'tasks');
    assert.ok((taskAction?.scoreImpact || 0) > 0);
    assert.ok(result.readiness.nextActions.length <= 5);
  });

  it('blocks invalid task sources and weak test contracts', () => {
    const project = readyProject();
    project.tasks[0].requirementIds = ['req-not-accepted'];
    project.testCases[0].requirementIds = ['req-not-accepted'];
    project.testCases[0].steps = [];
    project.testCases[0].expectedResult = '';
    project.tasks[0].contract.completionEvidence = [];

    const result = recalculateReadiness(project);

    assert.equal(result.readiness.checks.find(item => item.id === 'implementation.links')?.status, 'blocked');
    assert.equal(result.readiness.checks.find(item => item.id === 'implementation.test-quality')?.status, 'blocked');
    assert.equal(result.readiness.checks.find(item => item.id === 'implementation.contracts')?.status, 'blocked');
    assert.equal(finalizePlan(result).success, false);
  });

  it('detects reordered scope leakage and warns about oversized tasks', () => {
    const project = readyProject();
    project.ideaLabSession.conceptSummary!.outOfScope = ['Bulut senkronizasyonu ve çok kullanıcılı işbirliği'];
    project.tasks[0].description = 'Çok kullanıcılı çalışma için bulut tabanlı senkronizasyonu uygula.';
    project.tasks[0].effort = 'high';
    project.tasks[0].requirementIds = [
      project.requirements[0].id,
      project.requirements[1]?.id || project.requirements[0].id,
      project.requirements[2]?.id || project.requirements[0].id
    ];

    const result = recalculateReadiness(project);

    assert.equal(result.readiness.checks.find(item => item.id === 'consistent.scope')?.status, 'blocked');
    assert.equal(result.readiness.checks.find(item => item.id === 'implementation.size')?.status, 'warning');
  });
});
