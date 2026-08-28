/**
 * Test-local IndexedDB fixture helper for `IndexedDbProjectRepository`
 * (src/v4/storage.ts).
 *
 * WHY THIS EXISTS AND WHY IT DUPLICATES SCHEMA DETAILS:
 * `openDatabase()` in storage.ts now closes every connection it opens once
 * its work is done (each repository call wraps its transaction in
 * `try { ... } finally { db.close(); }`), so `indexedDB.deleteDatabase()`
 * resolves cleanly after repository operations — see
 * `../indexed-db-connection-leak.test.ts` for a regression test that pins
 * this directly. This fixture is NOT working around a connection leak
 * anymore.
 *
 * It still exists, and still duplicates the store/index layout from
 * `openDatabase()`, for a different, still-current reason: `putRawRecord()`
 * and `getAllRawRecords()` below open their own connections with no
 * `onupgradeneeded` handler (they only read/write records, deliberately
 * bypassing the repository API to inject malformed data for
 * integrity/migration-failure tests). Several tests call `putRawRecord()`
 * as their very first IndexedDB operation, before any repository method
 * has run — if the database/object stores didn't already exist at that
 * point, `putRawRecord()`'s transaction would throw (`NotFoundError`)
 * because it has no upgrade path of its own. `resetIndexedDbFixture()`
 * guarantees the schema exists (creating it on first run, a no-op
 * afterwards) and gives every test a clean, isolated set of stores.
 * Because `DB_NAME`, `DB_VERSION` and `STORES` are not exported from
 * storage.ts (only `DB_NAME` is, for the regression test above), and
 * because `putRawRecord`/`getAllRawRecords` need their own schema
 * awareness independent of the repository's internal `openDatabase()`,
 * this fixture keeps its own copy of the layout rather than depending on
 * production internals. Multiple simultaneous connections to one
 * IndexedDB database are legal (spec-wise) and fake-indexeddb honours
 * that, so this does not collide with the (now short-lived) connections
 * storage.ts opens.
 */

const DB_NAME = 'promtgen-v4';
const DB_VERSION = 2;

interface StoreDefinition {
  name: string;
  keyPath: string;
  indexes: string[];
}

const STORE_DEFINITIONS: StoreDefinition[] = [
  { name: 'projects', keyPath: 'id', indexes: [] },
  { name: 'checkpoints', keyPath: 'id', indexes: ['projectId', 'createdAt'] },
  { name: 'quarantine', keyPath: 'id', indexes: ['projectId'] },
  { name: 'commandLog', keyPath: 'id', indexes: ['projectId'] },
  { name: 'metadata', keyPath: 'key', indexes: [] }
];

export function resetIndexedDbFixture(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const definition of STORE_DEFINITIONS) {
        if (db.objectStoreNames.contains(definition.name)) continue;
        const store = db.createObjectStore(definition.name, { keyPath: definition.keyPath });
        for (const indexName of definition.indexes) {
          store.createIndex(indexName, indexName, { unique: false });
        }
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const storeNames = Array.from(db.objectStoreNames);
      if (storeNames.length === 0) {
        db.close();
        resolve();
        return;
      }
      const tx = db.transaction(storeNames, 'readwrite');
      for (const name of storeNames) tx.objectStore(name).clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Repository store'larına dokunmadan doğrudan ham kayıt okuma/yazma —
 * bütünlük ihlali ve migration hatası senaryolarını `IndexedDbProjectRepository`
 * API'sini bypass ederek üretmek için kullanılır (ör. `save()` her zaman
 * geçerli/normalize edilmiş bir belge yazar, bozuk veriyi doğrudan enjekte
 * etmenin başka yolu yok).
 */
export function putRawRecord(storeName: string, record: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(record);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
    request.onerror = () => reject(request.error);
  });
}

export function getAllRawRecords<T>(storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(storeName, 'readonly');
      const getAllRequest = tx.objectStore(storeName).getAll();
      getAllRequest.onsuccess = () => {
        db.close();
        resolve(getAllRequest.result as T[]);
      };
      getAllRequest.onerror = () => {
        db.close();
        reject(getAllRequest.error);
      };
    };
    request.onerror = () => reject(request.error);
  });
}
