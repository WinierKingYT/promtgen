import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryProjectRepository } from '../../src/v4/storage.js';
import { createProjectDocument } from '../../src/v4/project-document.js';
import { commitProjectCandidate } from '../../src/v4/application/command-transaction.js';

describe('Project repository compare-and-swap boundary', () => {
  it('rejects the second writer when two candidates start from the same revisions', async () => {
    const repository = new MemoryProjectRepository();
    const initial = createProjectDocument({ idea: 'Eşzamanlı kayıt güvenliği' });
    await repository.save(initial, { createOnly: true });

    const firstCandidate = structuredClone(initial);
    firstCandidate.documentRevision += 1;
    firstCandidate.messages.push({
      id: 'first-writer',
      role: 'user',
      content: 'Birinci işlem',
      createdAt: '2026-08-01T00:00:00.000Z'
    });
    const staleCandidate = structuredClone(initial);
    staleCandidate.documentRevision += 1;
    staleCandidate.messages.push({
      id: 'second-writer',
      role: 'user',
      content: 'İkinci işlem',
      createdAt: '2026-08-01T00:00:01.000Z'
    });

    await repository.save(firstCandidate, {
      expectedDocumentRevision: initial.documentRevision,
      expectedCanonicalRevision: initial.canonicalRevision
    });
    await assert.rejects(
      repository.save(staleCandidate, {
        expectedDocumentRevision: initial.documentRevision,
        expectedCanonicalRevision: initial.canonicalRevision
      }),
      /Revision conflict/
    );

    const stored = await repository.get(initial.id);
    assert.equal(stored?.messages.some(message => message.id === 'first-writer'), true);
    assert.equal(stored?.messages.some(message => message.id === 'second-writer'), false);
  });

  it('refuses a duplicate create-only write', async () => {
    const repository = new MemoryProjectRepository();
    const project = createProjectDocument({ idea: 'Tekil proje oluşturma' });
    await repository.save(project, { createOnly: true });
    await assert.rejects(repository.save(project, { createOnly: true }), /Revision conflict/);
  });

  it('allows only one concurrent production command to commit', async () => {
    const repository = new MemoryProjectRepository();
    const current = createProjectDocument({ idea: 'Command transaction yarış testi' });
    await repository.save(current, { createOnly: true });
    const firstCandidate = structuredClone(current);
    firstCandidate.messages.push({ id: 'command-a', role: 'user', content: 'A', createdAt: '2026-08-01T00:00:00.000Z' });
    const secondCandidate = structuredClone(current);
    secondCandidate.messages.push({ id: 'command-b', role: 'user', content: 'B', createdAt: '2026-08-01T00:00:01.000Z' });

    const [first, second] = await Promise.all([
      commitProjectCandidate(repository, current, firstCandidate, {
        commandId: 'command-a', commandType: 'AddDiscoveryTurn', projectId: current.id,
        expectedDocumentRevision: current.documentRevision,
        expectedCanonicalRevision: current.canonicalRevision,
        canonicalChange: false, createdAt: '2026-08-01T00:00:00.000Z'
      }),
      commitProjectCandidate(repository, current, secondCandidate, {
        commandId: 'command-b', commandType: 'AddDiscoveryTurn', projectId: current.id,
        expectedDocumentRevision: current.documentRevision,
        expectedCanonicalRevision: current.canonicalRevision,
        canonicalChange: false, createdAt: '2026-08-01T00:00:01.000Z'
      })
    ]);

    assert.equal([first.success, second.success].filter(Boolean).length, 1);
    assert.equal([first.success, second.success].filter(success => !success).length, 1);
    const stored = await repository.get(current.id);
    assert.equal(stored?.documentRevision, current.documentRevision + 1);
  });
});
