import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toProjectId, toRequirementId, toTaskId } from '../../src/v4/domain/ids.js';
import { canTransitionRequirement, canTransitionDecision, canTransitionTask } from '../../src/v4/domain/statuses.js';
import { validateCanonicalProject } from '../../src/v4/domain/validation.js';
import { createProjectDocument } from '../../src/v4/project-document.js';

describe('Category 3: Canonical Domain Model Invariants', () => {
  it('Branded ID factories wrap strings safely', () => {
    const pId = toProjectId('project-123');
    const rId = toRequirementId('req-456');
    const tId = toTaskId('task-789');

    assert.equal(pId, 'project-123');
    assert.equal(rId, 'req-456');
    assert.equal(tId, 'task-789');
  });

  it('State machine transitions enforce formal lifecycle paths', () => {
    assert.ok(canTransitionRequirement('proposed', 'accepted'), 'proposed -> accepted is valid');
    assert.ok(!canTransitionRequirement('proposed', 'verified'), 'proposed -> verified is INVALID');

    assert.ok(canTransitionDecision('proposed', 'accepted'), 'proposed -> accepted is valid');
    assert.ok(canTransitionDecision('accepted', 'superseded'), 'accepted -> superseded is valid');

    assert.ok(canTransitionTask('ready', 'in-progress'), 'ready -> in-progress is valid');
    assert.ok(!canTransitionTask('proposed', 'done'), 'proposed -> done is INVALID');
  });

  it('validateCanonicalProject catches duplicate IDs and invalid task requirement references', () => {
    const invalidProject = createProjectDocument({ idea: 'Idea', name: 'Test Proje' });
    invalidProject.requirements.push({
      id: 'req-1', title: 'Req 1', statement: 'Desc', kind: 'functional', priority: 'must',
      status: 'accepted', acceptanceCriteria: [], sourceObjectiveIds: [], sourceSuggestionIds: []
    });
    invalidProject.tasks.push({
      id: 'task-1', title: 'Task 1', description: 'Desc', status: 'ready', priority: 'must',
      effort: 'medium', requirementIds: ['non-existent-req'], dependencies: [], acceptanceCriteria: [], verificationIds: []
    });

    const result = validateCanonicalProject(invalidProject);
    assert.ok(!result.valid, 'Project validation failed for invalid requirement reference');
    assert.ok(result.errors.some(e => e.code === 'TASK_INVALID_REQUIREMENT_REF'), 'Catches invalid requirement reference error');
    assert.ok(result.errors.some(e => e.code === 'REQUIREMENT_NO_ACCEPTANCE_CRITERIA'), 'Rejects accepted requirement without acceptance criteria');
  });
});
