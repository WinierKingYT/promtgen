import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryProjectRepository } from '../../src/v4/storage.js';
import { createCanonicalProjectInstance } from '../../src/v4/domain/services/project-creation.js';

describe('Category 9: Storage & Provider Contracts Matrix Suite', () => {
  it('MemoryProjectRepository satisfies standard repository contracts', async () => {
    const repo = new MemoryProjectRepository();

    const proj = createCanonicalProjectInstance({ ideaText: 'Test Projesi' });

    // Save
    await repo.save(proj);

    // List
    const list = await repo.list();
    assert.equal(list.length, 1);
    assert.equal(list[0].id, proj.id);

    // Get
    const fetched = await repo.get(String(proj.id));
    assert.ok(fetched);
    assert.equal(fetched?.identity.name, proj.identity.name);

    // Archive
    const archived = await repo.archive(String(proj.id));
    assert.ok(archived);

    const reFetched = await repo.get(String(proj.id));
    assert.equal(reFetched?.lifecycle.status, 'archived');

    // Remove
    await repo.remove(String(proj.id));
    const finalList = await repo.list();
    assert.equal(finalList.length, 0);
  });
});
