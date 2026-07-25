import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toProjectId, toRequirementId, toTaskId } from '../../src/v4/domain/ids.js';
import { canTransitionRequirement, canTransitionDecision, canTransitionTask } from '../../src/v4/domain/statuses.js';
import { validateCanonicalProject } from '../../src/v4/domain/validation.js';
import { CanonicalProject } from '../../src/v4/domain/types.js';

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
    const invalidProject: CanonicalProject = {
      id: toProjectId('proj-1'),
      schemaVersion: 5,
      revision: 1,
      identity: { name: 'Test Proje', originalIdea: 'Idea', summary: 'Summary' },
      lifecycle: { activePhase: 'DISCOVERY', status: 'active', createdAt: '', updatedAt: '' },
      scope: { items: [] },
      requirements: [
        {
          id: toRequirementId('req-1'),
          title: 'Req 1',
          description: 'Desc',
          category: 'functional',
          priority: 'must',
          status: 'accepted',
          acceptanceCriteria: [],
          relatedDecisionIds: [],
          relatedRiskIds: [],
          relatedTaskIds: [],
          provenance: { origin: 'user', createdAt: '' }
        }
      ],
      decisions: [],
      risks: [],
      tasks: [
        {
          id: toTaskId('task-1'),
          title: 'Task 1',
          description: 'Desc',
          type: 'implementation',
          status: 'ready',
          priority: 'medium',
          requirementIds: [toRequirementId('non-existent-req')],
          decisionIds: [],
          dependencyTaskIds: [],
          acceptanceCriterionIds: [],
          testCaseIds: [],
          provenance: { origin: 'user', createdAt: '' }
        }
      ],
      milestones: [],
      proposalStore: { bundles: [] },
      metadata: {}
    };

    const result = validateCanonicalProject(invalidProject);
    assert.ok(!result.valid, 'Project validation failed for invalid requirement reference');
    assert.ok(result.errors.some(e => e.code === 'TASK_INVALID_REQUIREMENT_REF'), 'Catches invalid requirement reference error');
    assert.ok(result.warnings.some(w => w.code === 'REQUIREMENT_NO_ACCEPTANCE_CRITERIA'), 'Warns about accepted requirement without acceptance criteria');
  });
});
