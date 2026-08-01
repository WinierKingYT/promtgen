import { invoke, isTauri } from '@tauri-apps/api/core';
import { IndexedDbProjectRepository } from './storage.js';
import { validateProjectDocument } from './project-document.js';
import { normalizeProjectDocument } from './canonical-entities.js';
import { tryMigrateOrPassthrough } from './migrations.js';

export class TauriSqliteProjectRepository {
    async list() {
        const projects = [];
        for (const document of await invoke('list_projects')) {
            const migration = migrateStoredDocument(JSON.parse(document));
            if (migration.migrated) await this.save(migration.project);
            projects.push(migration.project);
        }
        return projects;
    }
    async get(id) {
        const document = await invoke('load_project', { id });
        if (!document) return null;
        const migration = migrateStoredDocument(JSON.parse(document));
        if (migration.migrated) await this.save(migration.project);
        return migration.project;
    }
    async save(project, options = {}) {
        const normalized = normalizeProjectDocument(project);
        const validation = validateProjectDocument(normalized);
        if (!validation.valid) throw new Error(validation.errors.join(' '));
        await invoke('save_project', {
            id: normalized.id,
            document: JSON.stringify(normalized),
            updatedAt: normalized.lifecycle.updatedAt,
            expectedDocumentRevision: options.expectedDocumentRevision,
            expectedCanonicalRevision: options.expectedCanonicalRevision,
            createOnly: options.createOnly === true
        });
        return normalized;
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
        return invoke('purge_project', { id });
    }
}

export function restoreStorageBackupAsNewRevision(currentProject, backupProject) {
    const current = normalizeProjectDocument(currentProject);
    const backup = normalizeProjectDocument(backupProject);
    if (current.id !== backup.id) throw new Error('Yedek başka bir projeye ait.');
    const restoredAt = new Date().toISOString();
    const next = structuredClone(backup);
    next.documentRevision = current.documentRevision + 1;
    next.canonicalRevision = current.canonicalRevision + 1;
    next.lifecycle.status = 'active';
    next.lifecycle.updatedAt = restoredAt;
    next.lifecycle.finalizedAt = '';
    next.revisions = structuredClone(current.revisions || []);
    next.exports = structuredClone(current.exports || []);
    next.executionSessions = structuredClone(current.executionSessions || []);
    next.commandLog = structuredClone(current.commandLog || []);
    next.metadata = { ...next.metadata, restoredFromStorageBackup: { sourceRevision: backup.canonicalRevision, restoredAt } };
    const snapshot = structuredClone(next);
    snapshot.revisions = [];
    next.revisions.push({
        id: `revision-storage-${Date.now()}`, number: next.canonicalRevision, createdAt: restoredAt,
        summary: `Yerel yedek r${backup.canonicalRevision} yeni revision olarak geri yüklendi`,
        acceptedSuggestionIds: [], affectedSections: Object.keys(next.sections), snapshot
    });
    const validation = validateProjectDocument(next);
    if (!validation.valid) throw new Error(`Yedek geri yükleme sonucu geçersiz: ${validation.errors.join(' ')}`);
    return next;
}

export function isDesktopStorageAvailable() { return isTauri(); }
export async function getDesktopStorageHealth() { return isTauri() ? invoke('storage_health') : null; }
export async function listDesktopProjectBackups(projectId) { return isTauri() ? invoke('list_project_backups', { projectId }) : []; }
export async function listDesktopQuarantinedProjects() { return isTauri() ? invoke('list_quarantined_projects') : []; }
export async function loadDesktopProjectBackup(currentProject, backupId) {
    if (!isTauri()) throw new Error('Yerel SQLite yedekleri yalnız masaüstünde kullanılabilir.');
    const document = await invoke('read_project_backup', { projectId: currentProject.id, backupId });
    if (!document) throw new Error('Yerel yedek bulunamadı.');
    const candidate = normalizeProjectDocument(JSON.parse(document));
    if (candidate.id !== currentProject.id) throw new Error('Yedek başka bir projeye ait.');
    const validation = validateProjectDocument(candidate);
    if (!validation.valid) throw new Error(`Yerel yedek şeması geçersiz: ${validation.errors.join(' ')}`);
    return candidate;
}

export function createPlatformRepository() { return isTauri() ? new TauriSqliteProjectRepository() : new IndexedDbProjectRepository(); }

function migrateStoredDocument(document) {
    const migration = tryMigrateOrPassthrough(document);
    if (migration.error) throw new Error(`Migration failure: ${migration.error}`);
    return { project: normalizeProjectDocument(migration.project), migrated: migration.migrated };
}
