// Type declarations for src/v4/tauri-storage.js
import { CanonicalProject } from './domain/types.js';
import { ProjectId } from './domain/ids.js';

export interface ProjectRepository {
  getAllProjects(): Promise<CanonicalProject[]>;
  saveProject(project: CanonicalProject): Promise<void>;
  deleteProject(projectId: ProjectId): Promise<void>;
  archiveProject(projectId: ProjectId): Promise<void>;
  createCheckpoint(project: CanonicalProject): Promise<any>;
  getLatestCheckpoint(projectId: ProjectId): Promise<any>;
  verifyDataIntegrity(project: CanonicalProject, expectedChecksum: string): Promise<boolean>;
  listProjectBackups(projectId: ProjectId): Promise<any[]>;
  restoreProjectBackup(projectId: ProjectId, backupId: string): Promise<CanonicalProject>;
  restoreStorageBackupAsNewRevision(project: CanonicalProject, backupId: string): Promise<CanonicalProject>;
  getDesktopStorageHealth(): Promise<any>;
}

export function createPlatformRepository(): ProjectRepository;
export function createTauriRepository(): ProjectRepository;
export function isDesktopStorageAvailable(): boolean;