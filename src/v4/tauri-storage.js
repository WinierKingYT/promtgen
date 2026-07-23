import { invoke, isTauri } from '@tauri-apps/api/core';
import { IndexedDbProjectRepository } from './storage.js';
import { validateProjectStateV4 } from './project-state-v4.js';
import { normalizeProjectStateV4 } from './canonical-entities.js';

export class TauriSqliteProjectRepository {
    async list() { return (await invoke('list_projects')).map(document => normalizeProjectStateV4(JSON.parse(document))); }
    async get(id) { const document = await invoke('load_project', { id }); return document ? normalizeProjectStateV4(JSON.parse(document)) : null; }
    async save(project) {
        const normalized = normalizeProjectStateV4(project);
        const validation = validateProjectStateV4(normalized);
        if (!validation.valid) throw new Error(validation.errors.join(' '));
        await invoke('save_project', { id: normalized.id, document: JSON.stringify(normalized), updatedAt: normalized.lifecycle.updatedAt });
        return normalized;
    }
    async archive(id) { const project = await this.get(id); if (!project) return false; project.lifecycle.status = 'archived'; await this.save(project); return true; }
}

export function restoreStorageBackupAsNewRevision(currentProject, backupProject) {
    const current = normalizeProjectStateV4(currentProject);
    const backup = normalizeProjectStateV4(backupProject);
    if (current.id !== backup.id) throw new Error('Yedek başka bir projeye ait.');
    const restoredAt = new Date().toISOString();
    const next = structuredClone(backup);
    next.revision = current.revision + 1;
    next.lifecycle.status = 'active';
    next.lifecycle.updatedAt = restoredAt;
    next.lifecycle.finalizedAt = '';
    next.revisions = structuredClone(current.revisions || []);
    next.exports = structuredClone(current.exports || []);
    next.executionSessions = structuredClone(current.executionSessions || []);
    next.metadata = { ...next.metadata, restoredFromStorageBackup: { sourceRevision: backup.revision, restoredAt } };
    const snapshot = structuredClone(next);
    snapshot.revisions = [];
    next.revisions.push({
        id: `revision-storage-${Date.now()}`, number: next.revision, createdAt: restoredAt,
        summary: `Yerel yedek r${backup.revision} yeni revision olarak geri yüklendi`,
        acceptedSuggestionIds: [], affectedSections: Object.keys(next.sections), snapshot
    });
    const validation = validateProjectStateV4(next);
    if (!validation.valid) throw new Error(`Yedek geri yükleme sonucu geçersiz: ${validation.errors.join(' ')}`);
    return next;
}

export function isDesktopStorageAvailable() { return isTauri(); }
export async function getDesktopStorageHealth() { return isTauri() ? invoke('storage_health') : null; }
export async function listDesktopProjectBackups(projectId) { return isTauri() ? invoke('list_project_backups', { projectId }) : []; }
export async function listDesktopQuarantinedProjects() { return isTauri() ? invoke('list_quarantined_projects') : []; }
export async function restoreDesktopProjectBackup(currentProject, backupId) {
    if (!isTauri()) throw new Error('Yerel SQLite yedekleri yalnız masaüstünde kullanılabilir.');
    const document = await invoke('read_project_backup_with_confirmation', { projectId: currentProject.id, backupId });
    return document ? restoreStorageBackupAsNewRevision(currentProject, JSON.parse(document)) : null;
}

export function createPlatformRepository() { return isTauri() ? new TauriSqliteProjectRepository() : new IndexedDbProjectRepository(); }
