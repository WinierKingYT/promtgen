import { validateProjectStateV4 } from './project-state-v4.js';
import { normalizeProjectStateV4 } from './canonical-entities.js';

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
        const request = operation(tx.objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export class IndexedDbProjectRepository {
    async list() {
        const db = await openDatabase();
        const projects = await transaction(db, 'readonly', store => store.getAll());
        return projects.map(normalizeProjectStateV4).sort((a, b) => b.lifecycle.updatedAt.localeCompare(a.lifecycle.updatedAt));
    }
    async get(id) { const value = await transaction(await openDatabase(), 'readonly', store => store.get(id)); return value ? normalizeProjectStateV4(value) : null; }
    async save(project) {
        const normalized = normalizeProjectStateV4(project);
        const validation = validateProjectStateV4(normalized);
        if (!validation.valid) throw new Error(validation.errors.join(' '));
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
    async list() { return [...this.projects.values()].map(normalizeProjectStateV4); }
    async get(id) { const value = this.projects.get(id); return value ? normalizeProjectStateV4(value) : null; }
    async save(project) { const normalized = normalizeProjectStateV4(project); this.projects.set(project.id, normalized); return normalized; }
    async archive(id) { const item = await this.get(id); if (!item) return false; item.lifecycle.status = 'archived'; return true; }
}

export function createProjectRepository() {
    return typeof indexedDB === 'undefined' ? new MemoryProjectRepository() : new IndexedDbProjectRepository();
}
