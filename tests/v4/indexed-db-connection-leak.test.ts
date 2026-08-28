import 'fake-indexeddb/auto';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { IndexedDbProjectRepository, DB_NAME } from '../../src/v4/storage.js';
import { createProjectDocument } from '../../src/v4/project-document.js';
import { resetIndexedDbFixture } from './support/indexed-db-fixture.ts';

/**
 * Regression test for the `openDatabase()` connection leak in
 * src/v4/storage.ts (every repository call opened a fresh `IDBDatabase`
 * and never closed it). An open connection blocks
 * `indexedDB.deleteDatabase()`/version-upgrade `open()` calls indefinitely
 * (they sit in the `blocked` state forever) — see the long comment at the
 * top of support/indexed-db-fixture.ts for the full story of how this was
 * found.
 *
 * `deleteDatabaseWithTimeout` races the real `deleteDatabase()` request
 * against a short timer so that — pre-fix — this test fails FAST with a
 * clear "did not resolve" message instead of hanging the whole suite
 * forever. 2000ms is comfortably above what a healthy close/delete cycle
 * needs (single-digit ms against fake-indexeddb, and this is web-local
 * IndexedDB in the real browser too — no network round trip), while still
 * keeping a genuine regression fast to detect in CI.
 */
const DELETE_DATABASE_TIMEOUT_MS = 2000;

function deleteDatabaseWithTimeout(name: string, timeoutMs: number): Promise<void> {
  const deletion = new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    // onblocked intentionally left unhandled: a still-open connection means
    // this request never fires success/error either, so the timeout below
    // is what turns that hang into a fast, readable test failure.
  });
  const timeout = new Promise<void>((_resolve, reject) => {
    setTimeout(() => {
      reject(new Error(
        `indexedDB.deleteDatabase("${name}") did not resolve within ${timeoutMs}ms — ` +
        'a connection opened by the repository is still open (connection leak).'
      ));
    }, timeoutMs);
  });
  return Promise.race([deletion, timeout]);
}

describe('IndexedDbProjectRepository — connection lifecycle (leak regression)', () => {
  beforeEach(resetIndexedDbFixture);

  it('indexedDB.deleteDatabase() resolves after repository operations complete (no leaked open connections)', async () => {
    const repository = new IndexedDbProjectRepository();
    const project = createProjectDocument({ idea: 'Bağlantı sızıntısı regresyon testi' });

    await repository.save(project, { createOnly: true });
    await repository.get(project.id);
    await repository.list();

    await assert.doesNotReject(
      deleteDatabaseWithTimeout(DB_NAME, DELETE_DATABASE_TIMEOUT_MS),
      'her repository çağrısı kendi IDBDatabase bağlantısını kapatmalı; aksi halde deleteDatabase() sonsuza kadar bloklanır'
    );
  });
});
