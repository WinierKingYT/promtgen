import { validateProjectStateV4 } from './project-state-v4.js';
import { normalizeProjectStateV4 } from './canonical-entities.js';
import { quarantineProject } from './storage/quarantine.js';
import { createCheckpoint, computeDataChecksum } from './storage/backup-manager.js';
import { tryMigrateOrPassthrough } from './migrations.js';

const DB_NAME = 'promtgen-v4';
const STORE_NAME = 'projects';

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transaction(db, mode, operation) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        let result;
        const req = operation(tx.objectStore(STORE_NAME));
        req.onsuccess = () => { result = req.result; };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted.'));
    });
}

export class IndexedDbProjectRepository {
    async list() {
        const db = await openDatabase();
        const projects = await transaction(db, 'readonly', store => store.getAll());
        return projects.map(project => {
            const { project: migrated } = tryMigrateOrPassthrough(project);
            return normalizeProjectStateV4(migrated);
        }).sort((a, b) => b.lifecycle.updatedAt.localeCompare(a.lifecycle.updatedAt));
    }
    async get(id) {
        try {
            const value = await transaction(await openDatabase(), 'readonly', store => store.get(id));
            if (!value) return null;
            const { project: migrated } = tryMigrateOrPassthrough(value);
            return normalizeProjectStateV4(migrated);
        } catch (error) {
            quarantineProject({ id, error: String(error) }, `IndexedDB read corruption: ${error}`);
            return null;
        }
    }
    async save(project) {
        const normalized = normalizeProjectStateV4(project);
        const validation = validateProjectStateV4(normalized);
        if (!validation.valid) {
            quarantineProject(project, `Schema validation failure: ${validation.errors.join(' ')}`);
            throw new Error(validation.errors.join(' '));
        }
        createCheckpoint(normalized);
        await transaction(await openDatabase(), 'readwrite', store => store.put(structuredClone(normalized)));
        return normalized;
    }
    async archive(id) {
        const project = await this.get(id);
        if (!project) return false;
        project.lifecycle.status = 'archived'; project.lifecycle.updatedAt = new Date().toISOString();
        await this.save(project); return true;
    }
    async remove(id) { await transaction(await openDatabase(), 'readwrite', store => store.delete(id)); }
}

export class MemoryProjectRepository {
    constructor() { this.projects = new Map(); }
    async list() { return [...this.projects.values()].map(project => { const { project: migrated } = tryMigrateOrPassthrough(project); return normalizeProjectStateV4(migrated); }); }
    async get(id) { const value = this.projects.get(id); if (!value) return null; const { project: migrated } = tryMigrateOrPassthrough(value); return normalizeProjectStateV4(migrated); }
    async save(project) { const normalized = normalizeProjectStateV4(project); this.projects.set(project.id, normalized); return normalized; }
    async archive(id) { const item = await this.get(id); if (!item) return false; item.lifecycle.status = 'archived'; await this.save(item); return true; }
    async remove(id) { this.projects.delete(id); }
}

export function createProjectRepository() {
    return typeof indexedDB === 'undefined' ? new MemoryProjectRepository() : new IndexedDbProjectRepository();
}
