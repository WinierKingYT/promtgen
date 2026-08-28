import 'fake-indexeddb/auto';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { IndexedDbProjectRepository } from '../../src/v4/storage.js';
import { createProjectDocument } from '../../src/v4/project-document.js';
import { resetIndexedDbFixture } from './support/indexed-db-fixture.ts';

/**
 * `IndexedDbProjectRepository` — src/v4/storage.js'in gerçek üretim
 * kullanıcı verisi yolu. Node'da yerel `indexedDB` olmadığı için
 * `fake-indexeddb/auto` bu dosyaya özel yüklenir (paylaşılan test runner
 * yapılandırması değiştirilmedi).
 *
 * Test izolasyonu `resetIndexedDbFixture()` ile sağlanır — NEDEN
 * `indexedDB.deleteDatabase()` DEĞİL: bkz. support/indexed-db-fixture.ts
 * başındaki not (storage.js bağlantılarını hiç kapatmaz, bu yüzden delete
 * isteği sonsuza kadar "blocked" kalır).
 */

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('IndexedDbProjectRepository — save()/get() round trip', () => {
  beforeEach(resetIndexedDbFixture);

  it('save() ile kaydedilen belge get() ile eksiksiz geri döner', async () => {
    const repository = new IndexedDbProjectRepository();
    const project = createProjectDocument({ idea: 'IndexedDB round trip testi' });

    const saved = await repository.save(project, { createOnly: true });
    const fetched = await repository.get(project.id);

    assert.ok(fetched, 'get() null dönmemeli');
    assert.equal(fetched?.id, saved.id);
    assert.equal(fetched?.documentRevision, saved.documentRevision);
    assert.equal(fetched?.identity.originalIdea, 'IndexedDB round trip testi');
    assert.deepEqual(fetched, saved, 'get() tarafından okunan belge save() sonucuyla birebir eşleşmeli');
  });

  it('get(): kayıtlı olmayan proje kimliği için null döner', async () => {
    const repository = new IndexedDbProjectRepository();
    const fetched = await repository.get('no-such-project');
    assert.equal(fetched, null);
  });
});

describe('IndexedDbProjectRepository — list()', () => {
  beforeEach(resetIndexedDbFixture);

  it('list() kaydedilen tüm projeleri döndürür', async () => {
    const repository = new IndexedDbProjectRepository();
    const first = createProjectDocument({ idea: 'Birinci proje' });
    const second = createProjectDocument({ idea: 'İkinci proje' });
    await repository.save(first, { createOnly: true });
    await repository.save(second, { createOnly: true });

    const listed = await repository.list();

    assert.equal(listed.length, 2);
    assert.ok(listed.some(project => project.id === first.id));
    assert.ok(listed.some(project => project.id === second.id));
  });

  it('list(): hiç proje yokken boş dizi döner', async () => {
    const repository = new IndexedDbProjectRepository();
    const listed = await repository.list();
    assert.deepEqual(listed, []);
  });
});

describe('IndexedDbProjectRepository — archive()/restore() idempotency guard (storage.js:246-270)', () => {
  beforeEach(resetIndexedDbFixture);

  it('archive(): zaten arşivlenmiş projede tekrar çağrılırsa no-op olarak true döner, revizyon artmaz', async () => {
    const repository = new IndexedDbProjectRepository();
    const project = createProjectDocument({ idea: 'Arşiv idempotency testi' });
    await repository.save(project, { createOnly: true });

    const firstArchive = await repository.archive(project.id);
    assert.equal(firstArchive, true);
    const afterFirst = await repository.get(project.id);
    assert.equal(afterFirst?.lifecycle.status, 'archived');
    const revisionAfterFirst = afterFirst?.documentRevision;

    const secondArchive = await repository.archive(project.id);
    assert.equal(secondArchive, true, 'İkinci archive() çağrısı da true döner (no-op guard)');
    const afterSecond = await repository.get(project.id);
    assert.equal(afterSecond?.documentRevision, revisionAfterFirst, 'İkinci çağrı documentRevision artırmamalı');
  });

  it('restore(): arşivlenmemiş (aktif) projede çağrılırsa no-op olarak true döner, revizyon artmaz', async () => {
    const repository = new IndexedDbProjectRepository();
    const project = createProjectDocument({ idea: 'Restore no-op testi' });
    await repository.save(project, { createOnly: true });
    assert.equal(project.lifecycle.status, 'active');

    const restored = await repository.restore(project.id);

    assert.equal(restored, true, 'Aktif projede restore() true döner (silently no-op, false değil)');
    const after = await repository.get(project.id);
    assert.equal(after?.documentRevision, project.documentRevision, 'no-op restore documentRevision artırmamalı');
  });

  it('archive() sonrası restore() projeyi aktive eder; tekrar restore() no-op kalır', async () => {
    const repository = new IndexedDbProjectRepository();
    const project = createProjectDocument({ idea: 'Arşiv-restore döngüsü' });
    await repository.save(project, { createOnly: true });
    await repository.archive(project.id);

    const firstRestore = await repository.restore(project.id);
    assert.equal(firstRestore, true);
    const afterFirst = await repository.get(project.id);
    assert.equal(afterFirst?.lifecycle.status, 'active');
    const revisionAfterFirst = afterFirst?.documentRevision;

    const secondRestore = await repository.restore(project.id);
    assert.equal(secondRestore, true, 'İkinci restore() de true döner (artık aktif olduğu için no-op)');
    const afterSecond = await repository.get(project.id);
    assert.equal(afterSecond?.documentRevision, revisionAfterFirst, 'İkinci restore() documentRevision artırmamalı');
  });

  it('archive()/restore(): var olmayan proje kimliği için false döner', async () => {
    const repository = new IndexedDbProjectRepository();
    assert.equal(await repository.archive('no-such-project'), false);
    assert.equal(await repository.restore('no-such-project'), false);
  });
});

describe('IndexedDbProjectRepository — compare-and-swap (assertExpectedRevisions / revisionConflict, storage.js:76-98)', () => {
  beforeEach(resetIndexedDbFixture);

  it('stale expectedDocumentRevision ile save() PROJECT_REVISION_CONFLICT koduyla reddedilir', async () => {
    const repository = new IndexedDbProjectRepository();
    const project = createProjectDocument({ idea: 'CAS reddi testi' });
    await repository.save(project, { createOnly: true });

    const stale = structuredClone(project);
    stale.documentRevision += 1;
    stale.messages.push({ id: 'stale-writer', role: 'user', content: 'Bayat yazım', createdAt: '2026-08-01T00:00:00.000Z' });

    await assert.rejects(
      repository.save(stale, { expectedDocumentRevision: 99, expectedCanonicalRevision: project.canonicalRevision }),
      (error: unknown) => {
        assert.ok(error instanceof Error, 'reddedilme bir Error olmalı');
        assert.match(error.message, /Revision conflict/);
        assert.ok('code' in error, 'hata makine-okunur bir code taşımalı');
        assert.equal(error.code, 'PROJECT_REVISION_CONFLICT');
        return true;
      }
    );
  });

  it('createOnly: true ile var olan bir projeye tekrar yazmak PROJECT_REVISION_CONFLICT ile reddedilir', async () => {
    const repository = new IndexedDbProjectRepository();
    const project = createProjectDocument({ idea: 'createOnly ihlali testi' });
    await repository.save(project, { createOnly: true });

    await assert.rejects(
      repository.save(project, { createOnly: true }),
      (error: unknown) => {
        assert.ok(error instanceof Error, 'reddedilme bir Error olmalı');
        assert.ok('code' in error, 'hata makine-okunur bir code taşımalı');
        assert.equal(error.code, 'PROJECT_REVISION_CONFLICT');
        return true;
      }
    );
  });
});

describe('IndexedDbProjectRepository — checkpoint retention (CHECKPOINT_RETENTION = 10, storage.js:18)', () => {
  beforeEach(resetIndexedDbFixture);

  it('10 sınırını aşan revizyonlarda en eski checkpoint kayıtları budanır, yalnızca en yeni 10 tanesi kalır', async () => {
    const repository = new IndexedDbProjectRepository();
    let project = createProjectDocument({ idea: 'Checkpoint retention testi' });
    await repository.save(project, { createOnly: true });

    const totalRevisions = 12;
    for (let revision = 2; revision <= totalRevisions; revision += 1) {
      await sleep(2);
      const current = await repository.get(project.id);
      assert.ok(current);
      const candidate = structuredClone(current);
      candidate.messages.push({
        id: `message-${revision}`,
        role: 'user',
        content: `Revizyon ${revision}`,
        createdAt: new Date().toISOString()
      });
      candidate.documentRevision = current.documentRevision + 1;
      project = await repository.save(candidate, {
        expectedDocumentRevision: current.documentRevision,
        expectedCanonicalRevision: current.canonicalRevision
      });
    }

    const checkpoints = await repository.listCheckpoints(project.id);
    assert.equal(checkpoints.length, 10, 'Yalnızca CHECKPOINT_RETENTION kadar checkpoint kalmalı');
    const survivingRevisions = checkpoints.map(checkpoint => checkpoint.revision).sort((a, b) => a - b);
    assert.deepEqual(survivingRevisions, [3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'En eski 2 checkpoint (revizyon 1 ve 2) budanmalı');
  });
});
