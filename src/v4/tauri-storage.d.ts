import type { ProjectDocumentV5, ProjectRepository } from './contracts.js';

export class TauriSqliteProjectRepository implements ProjectRepository {
  list(): Promise<ProjectDocumentV5[]>;
  get(id: string): Promise<ProjectDocumentV5 | null>;
  save(project: ProjectDocumentV5): Promise<ProjectDocumentV5>;
  archive(id: string): Promise<boolean>;
}

export function restoreStorageBackupAsNewRevision(currentProject: ProjectDocumentV5, backupProject: ProjectDocumentV5): ProjectDocumentV5;
export function isDesktopStorageAvailable(): boolean;
export function getDesktopStorageHealth(): Promise<unknown>;
export function listDesktopProjectBackups(projectId: string): Promise<unknown[]>;
export function listDesktopQuarantinedProjects(): Promise<unknown[]>;
export function restoreDesktopProjectBackup(currentProject: ProjectDocumentV5, backupId: string): Promise<ProjectDocumentV5 | null>;
export function createPlatformRepository(): ProjectRepository;
