import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  acceptRequirementDraft,
  createRequirementDraftsFromConcept,
  evaluateRequirementQuality,
  removeRequirementDraft,
  updateRequirementDraft
} from '../../src/v4/application/requirement-quality-service.js';
import { createInitialConceptInterpretation } from '../../src/v4/application/idea-discussion-service.js';
import { normalizeObjective } from '../../src/v4/canonical-entities.js';
import { createProjectDocument, validateProjectDocument } from '../../src/v4/project-document.js';
import { applyCompiledTaskPlan, compileTaskPlan } from '../../src/v4/task-compiler.js';
import { finalizePlan, recalculateReadiness } from '../../src/v4/planning-engine.js';

function confirmedProject() {
  const project = createProjectDocument({ idea: 'Yerel çalışan bireysel proje planlama uygulaması' });
  project.ideaLabSession.conceptSummary = {
    ...createInitialConceptInterpretation(project),
    confirmedFeatures: ['Fikir yorumu', 'MVP kapsam yönetimi'],
    outOfScope: ['Bulut senkronizasyonu'],
    openQuestions: [],
    userConfirmed: true,
    confirmedAt: '2026-07-28T12:00:00.000Z'
  };
  project.lifecycle.activePhase = 'SHAPING';
  return project;
}

describe('Requirement Quality Gate', () => {
  it('creates idempotent editable drafts from confirmed MVP scope', () => {
    const project = confirmedProject();
    const first = createRequirementDraftsFromConcept(project);
    const second = createRequirementDraftsFromConcept(first);

    assert.equal(project.requirements.length, 0);
    assert.equal(first.requirements.length, 2);
    assert.equal(second.requirements.length, 2);
    assert.ok(first.requirements.every(item => item.status === 'draft'));
    assert.ok(first.requirements.every(item => item.priority === 'must'));
    assert.equal(evaluateRequirementQuality(first).readyForTaskCompilation, false);
    assert.equal(validateProjectDocument(first).valid, true);
  });

  it('requires observable criteria and an accepted objective link when objectives exist', () => {
    let project = confirmedProject();
    project.objectives.push(normalizeObjective({
      id: 'objective-1',
      title: 'Plan tekrar işini azalt',
      description: 'Kapsam sapmasını azalt',
      metric: 'Yeniden çalışma oranı',
      target: '%30 azalma',
      status: 'accepted'
    }));
    project = createRequirementDraftsFromConcept(project);
    const requirement = project.requirements[0];
    project = updateRequirementDraft(project, requirement.id, {
      acceptanceCriteria: [],
      sourceObjectiveIds: []
    });
    assert.throws(() => acceptRequirementDraft(project, requirement.id), /kabul kriteri.*proje hedefine/i);

    project = updateRequirementDraft(project, requirement.id, {
      acceptanceCriteria: ['Kullanıcı yorum sonucunu ekranda görür.'],
      sourceObjectiveIds: ['objective-1']
    });
    const accepted = acceptRequirementDraft(project, requirement.id);
    assert.equal(accepted.requirements[0].status, 'accepted');
    assert.ok(accepted.traceLinks.some(link => link.fromId === 'objective-1' && link.toId === requirement.id));
  });

  it('keeps accepted Must requirements blocked until task and test links exist', () => {
    let project = createRequirementDraftsFromConcept(confirmedProject());
    for (const requirement of project.requirements) project = acceptRequirementDraft(project, requirement.id);
    project = recalculateReadiness(project);
    const beforeTasks = evaluateRequirementQuality(project);

    assert.equal(beforeTasks.readyForTaskCompilation, true);
    assert.equal(beforeTasks.readyForFinalization, false);
    assert.equal(beforeTasks.mustWithoutTask.length, 2);
    assert.equal(finalizePlan(project).success, false);

    const compilation = compileTaskPlan(project);
    const applied = applyCompiledTaskPlan(project, compilation, { approved: true });
    assert.equal(applied.success, true);
    if (!applied.success) return;
    const afterTasks = evaluateRequirementQuality(applied.project);
    assert.equal(afterTasks.readyForFinalization, true);
    assert.equal(afterTasks.mustWithoutTask.length, 0);
    assert.equal(afterTasks.mustWithoutTest.length, 0);
  });

  it('protects accepted requirements from draft edits and only removes drafts', () => {
    let project = createRequirementDraftsFromConcept(confirmedProject());
    const id = project.requirements[0].id;
    project = acceptRequirementDraft(project, id);
    assert.throws(() => removeRequirementDraft(project, id), /Kabul edilmiş gereksinim silinemez/);
    assert.throws(
      () => updateRequirementDraft(project, id, { statement: 'Canonical etki analizi olmadan değiştirme.' }),
      /canonical etki analizi/
    );
    const removableId = project.requirements.find(item => item.status === 'draft')!.id;
    project = removeRequirementDraft(project, removableId);
    assert.equal(project.requirements.some(item => item.id === removableId), false);
  });

  it('preserves objective-to-requirement traces while applying compiled tasks', () => {
    let project = confirmedProject();
    project.objectives.push(normalizeObjective({ id: 'objective-1', title: 'İzlenebilir plan', status: 'accepted' }));
    project = createRequirementDraftsFromConcept(project);
    for (const requirement of project.requirements) {
      project = updateRequirementDraft(project, requirement.id, { sourceObjectiveIds: ['objective-1'] });
      project = acceptRequirementDraft(project, requirement.id);
    }
    const applied = applyCompiledTaskPlan(project, compileTaskPlan(project), { approved: true });
    assert.equal(applied.success, true);
    if (!applied.success) return;
    assert.ok(applied.project.traceLinks.some(link => link.fromType === 'objective' && link.toType === 'requirement'));
    assert.equal(validateProjectDocument(applied.project).valid, true);
  });
});
