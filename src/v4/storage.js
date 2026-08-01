import { validateProjectDocument } from './project-document.js';
import { normalizeProjectDocument } from './canonical-entities.js';
import { createQuarantineRecord } from './storage/quarantine.ts';
import { createCheckpoint } from './storage/backup-manager.ts';
import { computeSha256, verifySha256, INTEGRITY_ALGORITHM } from './infrastructure/storage/integrity.ts';
import { tryMigrateOrPassthrough } from './migrations.js';

const DB_NAME = 'promtgen-v4';
const DB_VERSION = 2;
const STORES = {
    projects: 'projects',
    checkpoints: 'checkpoints',
    quarantine: 'quarantine',
    commandLog: 'commandLog',
    metadata: 'metadata'
};
const CHECKPOINT_RETENTION = 10;

function ensureStore(db, name, options, indexes = []) {
    const store = db.objectStoreNames.contains(name)
        ? null
        : db.createObjectStore(name, options);
    for (const index of indexes) store?.createIndex(index.name, index.keyPath, index.options);
}

function openDatabase() {
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

function requestResult(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transactionDone(tx) {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted.'));
    });
}

function deleteRecordsForProject(store, projectId) {
    return new Promise((resolve, reject) => {
        const request = store.index('projectId').getAllKeys(projectId);
        request.onsuccess = () => {
            for (const key of request.result) store.delete(key);
            resolve(request.result.length);
        };
        request.onerror = () => reject(request.error);
    });
}

function revisionConflict(projectId, expectedDocumentRevision, expectedCanonicalRevision, stored) {
    const actualDocumentRevision = stored?.documentRevision ?? null;
    const actualCanonicalRevision = stored?.canonicalRevision ?? null;
    const error = new Error(
        `Revision conflict (${projectId}): document ${expectedDocumentRevision ?? '*'} / canonical ${expectedCanonicalRevision ?? '*'} beklenirken ${actualDocumentRevision ?? 'yok'} / ${actualCanonicalRevision ?? 'yok'} bulundu.`
    );
    error.code = 'PROJECT_REVISION_CONFLICT';
    return error;
}

function assertExpectedRevisions(projectId, stored, options = {}) {
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

function buildPersistentCheckpoint(project, digest) {
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

async function quarantinePersistently(db, rawPayload, reason) {
    const record = createQuarantineRecord(rawPayload, reason);
    const tx = db.transaction(STORES.quarantine, 'readwrite');
    tx.objectStore(STORES.quarantine).put(record);
    await transactionDone(tx);
    return record;
}

async function listProjectCheckpoints(db, projectId) {
    const tx = db.transaction(STORES.checkpoints, 'readonly');
    const done = transactionDone(tx);
    const records = await requestResult(tx.objectStore(STORES.checkpoints).getAll());
    await done;
    return records
        .filter(record => record.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export class IndexedDbProjectRepository {
    async list() {
        const db = await openDatabase();
        const tx = db.transaction(STORES.projects, 'readonly');
        const done = transactionDone(tx);
        const storedProjects = await requestResult(tx.objectStore(STORES.projects).getAll());
        await done;
        const projects = [];
        for (const stored of storedProjects) {
            const project = await this.#loadStored(db, stored);
            if (project) projects.push(project);
        }
        return projects.sort((a, b) => b.lifecycle.updatedAt.localeCompare(a.lifecycle.updatedAt));
    }

    async get(id) {
        const db = await openDatabase();
        const tx = db.transaction(STORES.projects, 'readonly');
        const done = transactionDone(tx);
        const stored = await requestResult(tx.objectStore(STORES.projects).get(id));
        await done;
        return stored ? this.#loadStored(db, stored) : null;
    }

    async #loadStored(db, stored) {
        try {
            const checkpoints = await listProjectCheckpoints(db, stored.id);
            const matching = checkpoints.find(item => item.revision === stored.documentRevision);
            if (matching && !(await verifySha256(stored, matching.checksumHash))) {
                await quarantinePersistently(db, stored, 'SHA-256 integrity mismatch');
                return null;
            }
            const migration = tryMigrateOrPassthrough(stored);
            if (migration.error) {
                await quarantinePersistently(db, stored, `Migration failure: ${migration.error}`);
                return null;
            }
            const normalized = normalizeProjectDocument(migration.project);
            if (migration.migrated) await this.#saveValidated(normalized, stored);
            return normalized;
        } catch (error) {
            await quarantinePersistently(db, stored, `IndexedDB read corruption: ${error}`);
            return null;
        }
    }

    async save(project, options = {}) {
        const normalized = normalizeProjectDocument(project);
        const validation = validateProjectDocument(normalized);
        if (!validation.valid) {
            const db = await openDatabase();
            await quarantinePersistently(db, project, `Schema validation failure: ${validation.errors.join(' ')}`);
            throw new Error(validation.errors.join(' '));
        }
        return this.#saveValidated(normalized, null, options);
    }

    async #saveValidated(normalized, migrationBackup = null, options = {}) {
        const db = await openDatabase();
        const digest = await computeSha256(normalized);
        const checkpoint = buildPersistentCheckpoint(normalized, digest);
        const backupCheckpoint = migrationBackup
            ? buildPersistentCheckpoint(migrationBackup, await computeSha256(migrationBackup))
            : null;
        const tx = db.transaction(Object.values(STORES), 'readwrite');
        const done = transactionDone(tx);
        const projectsStore = tx.objectStore(STORES.projects);
        const stored = await requestResult(projectsStore.get(normalized.id));
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
        const checkpointRequest = tx.objectStore(STORES.checkpoints).getAll();
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
    }

    async listCheckpoints(projectId) {
        return listProjectCheckpoints(await openDatabase(), projectId);
    }

    async listQuarantined() {
        const db = await openDatabase();
        const tx = db.transaction(STORES.quarantine, 'readonly');
        const done = transactionDone(tx);
        const records = await requestResult(tx.objectStore(STORES.quarantine).getAll());
        await done;
        return records.sort((a, b) => b.quarantinedAt.localeCompare(a.quarantinedAt));
    }

    async archive(id) {
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

    async restore(id) {
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

    async purge(id) {
        const db = await openDatabase();
        const tx = db.transaction(Object.values(STORES), 'readwrite');
        const done = transactionDone(tx);
        const projects = tx.objectStore(STORES.projects);
        const existing = await requestResult(projects.get(id));
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
    }
}

export class MemoryProjectRepository {
    constructor() {
        this.projects = new Map();
        this.migrationBackups = new Map();
    }
    async list() {
        const projects = [];
        for (const value of this.projects.values()) {
            const project = await this.#migrate(value);
            if (project) projects.push(project);
        }
        return projects;
    }
    async get(id) {
        const value = this.projects.get(id);
        return value ? this.#migrate(value) : null;
    }
    async #migrate(value) {
        const migration = tryMigrateOrPassthrough(value);
        if (migration.error) throw new Error(migration.error);
        const normalized = normalizeProjectDocument(migration.project);
        if (migration.migrated) {
            this.migrationBackups.set(normalized.id, createCheckpoint(value));
            this.projects.set(normalized.id, normalized);
        }
        return normalized;
    }
    async save(project, options = {}) {
        const normalized = normalizeProjectDocument(project);
        const validation = validateProjectDocument(normalized);
        if (!validation.valid) throw new Error(validation.errors.join(' '));
        assertExpectedRevisions(normalized.id, this.projects.get(normalized.id), options);
        this.projects.set(normalized.id, normalized);
        return normalized;
    }
    async archive(id) {
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
    async restore(id) {
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
    async purge(id) {
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

export function createProjectRepository() {
    return typeof indexedDB === 'undefined' ? new MemoryProjectRepository() : new IndexedDbProjectRepository();
}

export function restoreCheckpointAsNewRevision(currentProject, checkpointProject) {
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

export async function listWebProjectCheckpoints(projectId) {
    if (typeof indexedDB === 'undefined') return [];
    return new IndexedDbProjectRepository().listCheckpoints(projectId);
}

export async function listWebQuarantinedProjects() {
    if (typeof indexedDB === 'undefined') return [];
    return new IndexedDbProjectRepository().listQuarantined();
}

export async function loadWebProjectCheckpoint(currentProject, checkpointId) {
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
