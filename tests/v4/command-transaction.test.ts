import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ProjectDocumentV5, ProjectRepository } from '../../src/v4/contracts.js';
import { createProjectDocument } from '../../src/v4/project-document.js';
import { updatePlanSection } from '../../src/v4/planning-engine.js';
import { commitProjectCandidate, saveInitialProject } from '../../src/v4/application/command-transaction.js';

class FakeRepository implements ProjectRepository {
  stored: ProjectDocumentV5 | null = null;
  failSave = false;

  async list() { return this.stored ? [structuredClone(this.stored)] : []; }
  async get(id: string) { return this.stored?.id === id ? structuredClone(this.stored) : null; }
  async save(project: ProjectDocumentV5) {
    if (this.failSave) throw new Error('disk full');
    this.stored = structuredClone(project);
    return structuredClone(project);
  }
  async archive() { return false; }
}

describe('Persistent command transaction boundary', () => {
  it('persists idempotency in ProjectDocument and survives a repository reload', async () => {
    const repository = new FakeRepository();
    const initial = createProjectDocument({ idea: 'Command log ile planlama' });
    const created = await saveInitialProject(repository, initial, 'cmd-create', '2026-01-01T00:00:00.000Z');
    assert.equal(created.success, true);
    if (!created.success) return;

    const candidate = updatePlanSection(created.project, 'vision', { content: 'Yeni vizyon' });
    const command = {
      commandId: 'cmd-update-1',
      commandType: 'UpdatePlanSection',
      projectId: created.project.id,
      expectedRevision: created.project.revision,
      createdAt: '2026-01-01T00:01:00.000Z'
    };
    const first = await commitProjectCandidate(repository, created.project, candidate, command);
    assert.equal(first.success, true);
    if (!first.success) return;

    const reloaded = await repository.get(initial.id);
    assert.ok(reloaded);
    const replay = await commitProjectCandidate(repository, reloaded!, candidate, command);
    assert.equal(replay.success, true);
    assert.equal(replay.success && replay.alreadyApplied, true);
    assert.equal(replay.project.revision, first.project.revision);
  });

  it('rejects stale revisions and does not commit UI candidate when save fails', async () => {
    const repository = new FakeRepository();
    const current = createProjectDocument({ idea: 'Revision lock testi' });
    const candidate = updatePlanSection(current, 'vision', { content: 'Değişiklik' });
    const stale = await commitProjectCandidate(repository, current, candidate, {
      commandId: 'cmd-stale',
      commandType: 'UpdatePlanSection',
      projectId: current.id,
      expectedRevision: current.revision - 1,
      createdAt: '2026-01-01T00:00:00.000Z'
    });
    assert.equal(stale.success, false);
    assert.equal(stale.project, current);

    repository.failSave = true;
    const failedSave = await commitProjectCandidate(repository, current, candidate, {
      commandId: 'cmd-save-fail',
      commandType: 'UpdatePlanSection',
      projectId: current.id,
      expectedRevision: current.revision,
      createdAt: '2026-01-01T00:00:00.000Z'
    });
    assert.equal(failedSave.success, false);
    assert.equal(failedSave.project, current);
    assert.equal(repository.stored, null);
  });
});
