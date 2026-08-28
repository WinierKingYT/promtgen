import { validateProjectDocument } from './project-document.js';
import { normalizeProjectDocument } from './canonical-entities.js';
import { migrateToStageModel } from './application/stage-migration.js';
import { createQuarantineRecord } from './storage/quarantine.js';
import type { QuarantinedRecord } from './storage/quarantine.js';
import { createCheckpoint } from './storage/backup-manager.js';
import type { StorageCheckpoint } from './storage/backup-manager.js';
import { computeSha256, verifySha256, INTEGRITY_ALGORITHM } from './infrastructure/storage/integrity.js';
import { tryMigrateOrPassthrough } from './migrations.js';
import type { ProjectDocumentV5, ProjectSaveOptions, ProjectPurgeResult } from './contracts.js';

export const DB_NAME = 'promtgen-v4';
const DB_VERSION = 2;
const STORES = {
    projects: 'projects',
    checkpoints: 'checkpoints',
    quarantine: 'quarantine',
    commandLog: 'commandLog',
    metadata: 'metadata'
};
const CHECKPOINT_RETENTION = 10;

/**
 * A record read back from the `projects` IndexedDB store before it has
 * passed through `tryMigrateOrPassthrough`/`normalizeProjectDocument`. This
 * is NOT a claim that the record is a valid `ProjectDocumentV5` — every
 * field but `id` is optional, so any field this file inspects pre-migration
 * (`documentRevision`, `canonicalRevision`) is honestly typed as possibly
 * absent. `id` is required because it is the store's `keyPath` (every
 * record that can exist in this store was written with a string `id`).
 * Legacy/corrupt documents may still hold the WRONG runtime type for a
 * present field (e.g. a stringified revision) — `Partial<>` cannot express
 * that, but this file never trusts these fields for anything beyond a
 * `===`/template-interpolation comparison before handing the raw value to
 * `tryMigrateOrPassthrough`, which is what actually validates shape.
 */
type RawStoredProjectRecord = Partial<ProjectDocumentV5> & { id: string };

/**
 * The checkpoint shape this file actually persists to the `checkpoints`
 * IndexedDB store (`buildPersistentCheckpoint` below). Deliberately
 * distinct from `StorageCheckpoint` (storage/backup-manager.ts), which
 * MemoryProjectRepository uses instead and hardcodes a different checksum
 * algorithm ('fnv1a32'). `checksumAlgorithm` is typed from the imported
 * `INTEGRITY_ALGORITHM` constant (not a re-typed literal) so this type and
 * the runtime constant can never silently drift apart again.
 */
interface PersistedCheckpoint {
    id: string;
    projectId: string;
    revision: number;
    createdAt: string;
    checksumAlgorithm: typeof INTEGRITY_ALGORITHM;
    checksumHash: string;
    projectSnapshot: ProjectDocumentV5;
}

/**
 * The subset of `tryMigrateOrPassthrough`'s (src/v4/migrations.js) return
 * value this file actually reads. migrations.js is plain JS with no type
 * annotations and is out of scope for this conversion, so TypeScript infers
 * its return type as a union of the function's several return-statement
 * shapes; because one of those branches types `project` from the raw,
 * unvalidated input (itself untyped), that field's inferred type collapses
 * to `any`. Declaring the narrower, honest contract here — `project` is
 * `unknown` until `normalizeProjectDocument`/`migrateToStageModel` have run
 * on it, exactly as every call site below already does — keeps `any` from
 * leaking into this file without asserting anything migrations.js doesn't
 * already guarantee.
 */
interface MigrationOutcome {
    project: unknown;
    migrated: boolean;
    error: string | null;
}

/**
 * `storage.js`'s original `revisionConflict()` attached a `code` property to
 * a plain `Error`, which TypeScript rejects. A named subclass preserves the
 * exact same `instanceof Error` narrowing, the exact same `message`, and
 * adds a real, typed `code` field instead of a runtime-only bolt-on.
 */
export class RevisionConflictError extends Error {
    readonly code = 'PROJECT_REVISION_CONFLICT' as const;
}

function ensureStore(
    db: IDBDatabase,
    name: string,
    options: IDBObjectStoreParameters,
    indexes: Array<{ name: string; keyPath: string; options: IDBIndexParameters }> = []
): void {
    const store = db.objectStoreNames.contains(name)
        ? null
        : db.createObjectStore(name, options);
    for (const index of indexes) store?.createIndex(index.name, index.keyPath, index.options);
}

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            ensureStore(db, STORES.projects, { keyPath: 'id' });
            ensureStore(db, STORES.checkpoints, { keyPath: 'id' }, [
                { name: 'projectId', keyPath: 'projectId', options: { unique: false } },
                { name: 'createdAt', keyPath: 'createdAt', options: { unique: false } }
            ]);
            ensureStore(db, STORES.quarantine, { keyPath: 'id' }, [
                { name: 'projectId', keyPath: 'projectId', options: { unique: false } }
            ]);
            ensureStore(db, STORES.commandLog, { keyPath: 'id' }, [
                { name: 'projectId', keyPath: 'projectId', options: { unique: false } }
            ]);
            ensureStore(db, STORES.metadata, { keyPath: 'key' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted.'));
    });
}

function deleteRecordsForProject(store: IDBObjectStore, projectId: string): Promise<number> {
    return new Promise((resolve, reject) => {
        const request = store.index('projectId').getAllKeys(projectId);
        request.onsuccess = () => {
            for (const key of request.result) store.delete(key);
            resolve(request.result.length);
        };
        request.onerror = () => reject(request.error);
    });
}

function revisionConflict(
    projectId: string,
    expectedDocumentRevision: number | null | undefined,
    expectedCanonicalRevision: number | null | undefined,
    stored: RawStoredProjectRecord | undefined
): RevisionConflictError {
    const actualDocumentRevision = stored?.documentRevision ?? null;
    const actualCanonicalRevision = stored?.canonicalRevision ?? null;
    return new RevisionConflictError(
        `Revision conflict (${projectId}): document ${expectedDocumentRevision ?? '*'} / canonical ${expectedCanonicalRevision ?? '*'} beklenirken ${actualDocumentRevision ?? 'yok'} / ${actualCanonicalRevision ?? 'yok'} bulundu.`
    );
}

function assertExpectedRevisions(
    projectId: string,
    stored: RawStoredProjectRecord | undefined,
    options: ProjectSaveOptions = {}
): void {
    if (options.createOnly && stored) {
        throw revisionConflict(projectId, null, null, stored);
    }
    if (options.expectedDocumentRevision !== undefined
        && stored?.documentRevision !== options.expectedDocumentRevision) {
        throw revisionConflict(projectId, options.expectedDocumentRevision, options.expectedCanonicalRevision, stored);
    }
    if (options.expectedCanonicalRevision !== undefined
        && stored?.canonicalRevision !== options.expectedCanonicalRevision) {
        throw revisionConflict(projectId, options.expectedDocumentRevision, options.expectedCanonicalRevision, stored);
    }
}

function buildPersistentCheckpoint(project: ProjectDocumentV5, digest: string): PersistedCheckpoint {
    return {
        id: `checkpoint:${project.id}:${project.documentRevision}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
        projectId: project.id,
        revision: project.documentRevision,
        createdAt: new Date().toISOString(),
        checksumAlgorithm: INTEGRITY_ALGORITHM,
        checksumHash: digest,
        projectSnapshot: structuredClone(project)
    };
}

async function quarantinePersistently(db: IDBDatabase, rawPayload: unknown, reason: string): Promise<QuarantinedRecord> {
    const record = createQuarantineRecord(rawPayload, reason);
    const tx = db.transaction(STORES.quarantine, 'readwrite');
    tx.objectStore(STORES.quarantine).put(record);
    await transactionDone(tx);
    return record;
}

/**
 * Aynı ifade masaüstünde `tauri-storage.js`'teki
 * `buildUnreadableProjectsWarning()` tarafından kullanılıyor; kullanıcının
 * gördüğü sonuç iki platformda birebir aynı olsun diye metin kasıtlı
 * olarak eşleştirildi.
 */
function buildSkippedProjectsWarning(skippedCount: number): string {
    return `${skippedCount} proje okunamadı ve listede gösterilemedi; bu projelerin verileri silinmedi, yerel veritabanında güvende duruyor. Okunabilen diğer projeleriniz aşağıda listelendi.`;
}

async function listProjectCheckpoints(db: IDBDatabase, projectId: string): Promise<PersistedCheckpoint[]> {
    const tx = db.transaction(STORES.checkpoints, 'readonly');
    const done = transactionDone(tx);
    const records = await requestResult<PersistedCheckpoint[]>(tx.objectStore(STORES.checkpoints).getAll());
    await done;
    return records
        .filter(record => record.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export class IndexedDbProjectRepository {
    // Son list() çağrısında atlanan (karantinaya alınan) kayıt varsa
    // kullanıcıya gösterilecek Türkçe uyarı burada, BU ÖRNEĞE ÖZEL olarak
    // tutulur. Masaüstündeki `TauriSqliteProjectRepository.takeListWarning()`
    // (src/v4/tauri-storage.ts) birebir aynı tasarımı kullanır: kendi
    // `#lastListWarning` özel alanı. Burada da durum bilerek instance alanına
    // taşındı: testler bu sınıftan onlarca `new IndexedDbProjectRepository()`
    // örneği üretiyor (bkz. tests/v4/indexed-db-*.test.ts) — modül kapsamında
    // paylaşılan bir değişken, paralel/aralıklı list() çağrıları arasında
    // örnekler arası "sızıntıya" açık olurdu. Instance alanı bunu yapısal
    // olarak imkânsız kılar; `takeListWarning()` de tıpkı masaüstü eşdeğeri
    // gibi "bir kez tüket" semantiğini korur.
    #lastListWarning: string | null = null;

    async list(): Promise<ProjectDocumentV5[]> {
        const db = await openDatabase();
        try {
            const tx = db.transaction(STORES.projects, 'readonly');
            const done = transactionDone(tx);
            const storedProjects = await requestResult<RawStoredProjectRecord[]>(tx.objectStore(STORES.projects).getAll());
            await done;
            const projects: ProjectDocumentV5[] = [];
            let skippedCount = 0;
            for (const stored of storedProjects) {
                const project = await this.#loadStored(db, stored);
                if (project) projects.push(project);
                else skippedCount += 1;
            }
            this.#lastListWarning = skippedCount > 0 ? buildSkippedProjectsWarning(skippedCount) : null;
            return projects.sort((a, b) => b.lifecycle.updatedAt.localeCompare(a.lifecycle.updatedAt));
        } finally {
            db.close();
        }
    }

    /**
     * Son list() çağrısında atlanan (bütünlük ihlali veya migration hatası
     * yüzünden karantinaya alınan) proje varsa Türkçe bir uyarı metni
     * döndürür ve durumu tüketir (bir sonraki çağrıda aynı uyarı tekrar
     * dönmez). Atlanan kayıt yoksa `null` döner. Masaüstündeki
     * `TauriSqliteProjectRepository.takeListWarning()`'ün (src/v4/tauri-storage.ts)
     * web (IndexedDB) eşdeğeri — kullanıcıya iletilen sonuç aynıdır: bazı
     * projelerin okunamadığı, geri kalanının listelendiği ve hiçbir verinin
     * silinmediği.
     */
    takeListWarning(): string | null {
        const warning = this.#lastListWarning;
        this.#lastListWarning = null;
        return warning;
    }

    async get(id: string): Promise<ProjectDocumentV5 | null> {
        const db = await openDatabase();
        try {
            const tx = db.transaction(STORES.projects, 'readonly');
            const done = transactionDone(tx);
            const stored = await requestResult<RawStoredProjectRecord | undefined>(tx.objectStore(STORES.projects).get(id));
            await done;
            return stored ? await this.#loadStored(db, stored) : null;
        } finally {
            db.close();
        }
    }

    async #loadStored(db: IDBDatabase, stored: RawStoredProjectRecord): Promise<ProjectDocumentV5 | null> {
        try {
            const checkpoints = await listProjectCheckpoints(db, stored.id);
            const matching = checkpoints.find(item => item.revision === stored.documentRevision);
            if (matching && !(await verifySha256(stored, matching.checksumHash))) {
                await quarantinePersistently(db, stored, 'SHA-256 integrity mismatch');
                return null;
            }
            const migration: MigrationOutcome = tryMigrateOrPassthrough(stored);
            if (migration.error) {
                await quarantinePersistently(db, stored, `Migration failure: ${migration.error}`);
                return null;
            }
            // Şekil normalleştirmesinden sonra ANLAMSAL göç: eski kararlar
            // aşamalara yerleşir, çerçeveleme eski metinden türetilir. İşlem
            // idempotent olduğu için her yüklemede güvenle çalışır ve V3
            // belgelerinde hiçbir şeyi değiştirmez.
            const normalized = migrateToStageModel(normalizeProjectDocument(migration.project)).project;
            if (migration.migrated) await this.#saveValidated(normalized, stored);
            return normalized;
        } catch (error) {
            await quarantinePersistently(db, stored, `IndexedDB read corruption: ${error}`);
            return null;
        }
    }

    async save(project: ProjectDocumentV5, options: ProjectSaveOptions = {}): Promise<ProjectDocumentV5> {
        const normalized = normalizeProjectDocument(project);
        const validation = validateProjectDocument(normalized);
        if (!validation.valid) {
            const db = await openDatabase();
            try {
                await quarantinePersistently(db, project, `Schema validation failure: ${validation.errors.join(' ')}`);
            } finally {
                db.close();
            }
            throw new Error(validation.errors.join(' '));
        }
        return this.#saveValidated(normalized, null, options);
    }

    async #saveValidated(
        normalized: ProjectDocumentV5,
        migrationBackup: RawStoredProjectRecord | null = null,
        options: ProjectSaveOptions = {}
    ): Promise<ProjectDocumentV5> {
        const db = await openDatabase();
        try {
            const digest = await computeSha256(normalized);
            const checkpoint = buildPersistentCheckpoint(normalized, digest);
            const backupCheckpoint = migrationBackup
                // `migrationBackup` is the pre-migration raw record read back from
                // the `projects` store (possibly a legacy, pre-V5 schema shape).
                // The migration-backup checkpoint has always persisted that raw
                // object verbatim as `projectSnapshot` (see buildPersistentCheckpoint
                // above) — this cast documents that the value may not structurally
                // satisfy ProjectDocumentV5 for legacy documents; it does not change
                // what gets written.
                ? buildPersistentCheckpoint(migrationBackup as ProjectDocumentV5, await computeSha256(migrationBackup))
                : null;
            const tx = db.transaction(Object.values(STORES), 'readwrite');
            const done = transactionDone(tx);
            const projectsStore = tx.objectStore(STORES.projects);
            const stored = await requestResult<RawStoredProjectRecord | undefined>(projectsStore.get(normalized.id));
            try {
                assertExpectedRevisions(normalized.id, stored, options);
            } catch (error) {
                tx.abort();
                await done.catch(() => undefined);
                throw error;
            }
            projectsStore.put(structuredClone(normalized));
            tx.objectStore(STORES.checkpoints).put(checkpoint);
            if (backupCheckpoint) tx.objectStore(STORES.checkpoints).put(backupCheckpoint);
            for (const record of normalized.commandLog) {
                tx.objectStore(STORES.commandLog).put({
                    id: `${normalized.id}:${record.commandId}`,
                    projectId: normalized.id,
                    ...structuredClone(record)
                });
            }
            tx.objectStore(STORES.metadata).put({ key: 'schema', dbVersion: DB_VERSION, updatedAt: new Date().toISOString() });
            const checkpointRequest: IDBRequest<PersistedCheckpoint[]> = tx.objectStore(STORES.checkpoints).getAll();
            checkpointRequest.onsuccess = () => {
                const projectRecords = checkpointRequest.result
                    .filter(item => item.projectId === normalized.id)
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
                for (const expired of projectRecords.slice(CHECKPOINT_RETENTION)) {
                    tx.objectStore(STORES.checkpoints).delete(expired.id);
                }
            };
            await done;
            return normalized;
        } finally {
            db.close();
        }
    }

    async listCheckpoints(projectId: string): Promise<PersistedCheckpoint[]> {
        const db = await openDatabase();
        try {
            return await listProjectCheckpoints(db, projectId);
        } finally {
            db.close();
        }
    }

    async listQuarantined(): Promise<QuarantinedRecord[]> {
        const db = await openDatabase();
        try {
            const tx = db.transaction(STORES.quarantine, 'readonly');
            const done = transactionDone(tx);
            const records = await requestResult<QuarantinedRecord[]>(tx.objectStore(STORES.quarantine).getAll());
            await done;
            return records.sort((a, b) => b.quarantinedAt.localeCompare(a.quarantinedAt));
        } finally {
            db.close();
        }
    }

    async archive(id: string): Promise<boolean> {
        const project = await this.get(id);
        if (!project) return false;
        if (project.lifecycle.status === 'archived') return true;
        const expectedDocumentRevision = project.documentRevision;
        const expectedCanonicalRevision = project.canonicalRevision;
        project.lifecycle.status = 'archived';
        project.lifecycle.updatedAt = new Date().toISOString();
        project.documentRevision += 1;
        await this.save(project, { expectedDocumentRevision, expectedCanonicalRevision });
        return true;
    }

    async restore(id: string): Promise<boolean> {
        const project = await this.get(id);
        if (!project) return false;
        if (project.lifecycle.status !== 'archived') return true;
        const expectedDocumentRevision = project.documentRevision;
        const expectedCanonicalRevision = project.canonicalRevision;
        project.lifecycle.status = 'active';
        project.lifecycle.updatedAt = new Date().toISOString();
        project.documentRevision += 1;
        await this.save(project, { expectedDocumentRevision, expectedCanonicalRevision });
        return true;
    }

    async purge(id: string): Promise<ProjectPurgeResult> {
        const db = await openDatabase();
        try {
            const tx = db.transaction(Object.values(STORES), 'readwrite');
            const done = transactionDone(tx);
            const projects = tx.objectStore(STORES.projects);
            const existing = await requestResult<RawStoredProjectRecord | undefined>(projects.get(id));
            const [checkpointsDeleted, commandLogEntriesDeleted, quarantineEntriesDeleted] = await Promise.all([
                deleteRecordsForProject(tx.objectStore(STORES.checkpoints), id),
                deleteRecordsForProject(tx.objectStore(STORES.commandLog), id),
                deleteRecordsForProject(tx.objectStore(STORES.quarantine), id)
            ]);
            projects.delete(id);
            await done;
            return {
                projectDeleted: Boolean(existing),
                checkpointsDeleted,
                commandLogEntriesDeleted,
                quarantineEntriesDeleted,
                backupsDeleted: 0
            };
        } finally {
            db.close();
        }
    }
}

export class MemoryProjectRepository {
    projects: Map<string, ProjectDocumentV5>;
    migrationBackups: Map<string, StorageCheckpoint>;
    constructor() {
        this.projects = new Map();
        this.migrationBackups = new Map();
    }
    async list(): Promise<ProjectDocumentV5[]> {
        const projects: ProjectDocumentV5[] = [];
        for (const value of this.projects.values()) {
            const project = await this.#migrate(value);
            if (project) projects.push(project);
        }
        return projects;
    }
    async get(id: string): Promise<ProjectDocumentV5 | null> {
        const value = this.projects.get(id);
        return value ? this.#migrate(value) : null;
    }
    async #migrate(value: ProjectDocumentV5): Promise<ProjectDocumentV5> {
        const migration: MigrationOutcome = tryMigrateOrPassthrough(value);
        if (migration.error) throw new Error(migration.error);
        const normalized = normalizeProjectDocument(migration.project);
        if (migration.migrated) {
            this.migrationBackups.set(normalized.id, createCheckpoint(value));
            this.projects.set(normalized.id, normalized);
        }
        return normalized;
    }
    async save(project: ProjectDocumentV5, options: ProjectSaveOptions = {}): Promise<ProjectDocumentV5> {
        const normalized = normalizeProjectDocument(project);
        const validation = validateProjectDocument(normalized);
        if (!validation.valid) throw new Error(validation.errors.join(' '));
        assertExpectedRevisions(normalized.id, this.projects.get(normalized.id), options);
        this.projects.set(normalized.id, normalized);
        return normalized;
    }
    async archive(id: string): Promise<boolean> {
        const item = await this.get(id);
        if (!item) return false;
        if (item.lifecycle.status === 'archived') return true;
        const expectedDocumentRevision = item.documentRevision;
        const expectedCanonicalRevision = item.canonicalRevision;
        item.lifecycle.status = 'archived';
        item.lifecycle.updatedAt = new Date().toISOString();
        item.documentRevision += 1;
        await this.save(item, { expectedDocumentRevision, expectedCanonicalRevision });
        return true;
    }
    async restore(id: string): Promise<boolean> {
        const item = await this.get(id);
        if (!item) return false;
        if (item.lifecycle.status !== 'archived') return true;
        const expectedDocumentRevision = item.documentRevision;
        const expectedCanonicalRevision = item.canonicalRevision;
        item.lifecycle.status = 'active';
        item.lifecycle.updatedAt = new Date().toISOString();
        item.documentRevision += 1;
        await this.save(item, { expectedDocumentRevision, expectedCanonicalRevision });
        return true;
    }
    async purge(id: string): Promise<ProjectPurgeResult> {
        const project = this.projects.get(id);
        const projectDeleted = this.projects.delete(id);
        const backupsDeleted = this.migrationBackups.delete(id) ? 1 : 0;
        return {
            projectDeleted,
            checkpointsDeleted: 0,
            commandLogEntriesDeleted: project?.commandLog?.length || 0,
            quarantineEntriesDeleted: 0,
            backupsDeleted
        };
    }
}

export function createProjectRepository(): IndexedDbProjectRepository | MemoryProjectRepository {
    return typeof indexedDB === 'undefined' ? new MemoryProjectRepository() : new IndexedDbProjectRepository();
}

export function restoreCheckpointAsNewRevision(currentProject: ProjectDocumentV5, checkpointProject: ProjectDocumentV5): ProjectDocumentV5 {
    const current = normalizeProjectDocument(currentProject);
    const checkpoint = normalizeProjectDocument(checkpointProject);
    if (current.id !== checkpoint.id) throw new Error('Checkpoint başka bir projeye ait.');
    const restoredAt = new Date().toISOString();
    const next = structuredClone(checkpoint);
    next.documentRevision = current.documentRevision + 1;
    next.canonicalRevision = current.canonicalRevision + 1;
    next.lifecycle.status = 'active';
    next.lifecycle.updatedAt = restoredAt;
    next.lifecycle.finalizedAt = null;
    next.revisions = structuredClone(current.revisions);
    next.exports = structuredClone(current.exports);
    next.executionSessions = structuredClone(current.executionSessions);
    next.commandLog = structuredClone(current.commandLog);
    next.metadata = {
        ...next.metadata,
        restoredFromCheckpoint: { sourceRevision: checkpoint.canonicalRevision, restoredAt }
    };
    const snapshot = structuredClone(next);
    snapshot.revisions = [];
    next.revisions.push({
        id: `revision-checkpoint-${Date.now()}`,
        number: next.canonicalRevision,
        createdAt: restoredAt,
        summary: `Web checkpoint r${checkpoint.canonicalRevision} yeni revision olarak geri yüklendi`,
        acceptedSuggestionIds: [],
        affectedSections: Object.keys(next.sections),
        snapshot
    });
    const validation = validateProjectDocument(next);
    if (!validation.valid) throw new Error(validation.errors.join(' '));
    return next;
}

export async function listWebProjectCheckpoints(projectId: string): Promise<PersistedCheckpoint[]> {
    if (typeof indexedDB === 'undefined') return [];
    return new IndexedDbProjectRepository().listCheckpoints(projectId);
}

export async function listWebQuarantinedProjects(): Promise<QuarantinedRecord[]> {
    if (typeof indexedDB === 'undefined') return [];
    return new IndexedDbProjectRepository().listQuarantined();
}

export async function loadWebProjectCheckpoint(currentProject: ProjectDocumentV5, checkpointId: string): Promise<ProjectDocumentV5> {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB checkpoint deposu bu ortamda kullanılamıyor.');
    const checkpoints = await listWebProjectCheckpoints(currentProject.id);
    const checkpoint = checkpoints.find(item => item.id === checkpointId);
    if (!checkpoint) throw new Error('Checkpoint bulunamadı. Listeyi yenileyip tekrar deneyin.');
    if (checkpoint.projectId !== currentProject.id) throw new Error('Checkpoint başka bir projeye ait.');
    if (!(await verifySha256(checkpoint.projectSnapshot, checkpoint.checksumHash))) {
        throw new Error('Checkpoint bütünlük doğrulamasını geçemedi; geri yükleme engellendi.');
    }
    const candidate = normalizeProjectDocument(checkpoint.projectSnapshot);
    const validation = validateProjectDocument(candidate);
    if (!validation.valid) throw new Error(`Checkpoint şeması geçersiz: ${validation.errors.join(' ')}`);
    return candidate;
}
