import type { ProjectDocumentV5, ProjectPurgeResult, ProjectRepository, ProjectSaveOptions } from './contracts.js';

export interface StorageHealthSummary {
  ok: boolean;
  quickCheck: string;
  projectCount: number;
  backupCount: number;
  quarantineCount: number;
  databaseBytes: number;
  journalMode: string;
}

export interface DesktopBackupSummary {
  id: number;
  projectId: string;
  revision: number;
  createdAt: string;
  bytes: number;
}

export interface DesktopQuarantineSummary {
  id: number;
  projectId: string;
  reason: string;
  quarantinedAt: string;
  bytes: number;
}

export class TauriSqliteProjectRepository implements ProjectRepository {
  list(): Promise<ProjectDocumentV5[]>;
  get(id: string): Promise<ProjectDocumentV5 | null>;
  save(project: ProjectDocumentV5, options?: ProjectSaveOptions): Promise<ProjectDocumentV5>;
  archive(id: string): Promise<boolean>;
  restore(id: string): Promise<boolean>;
  purge(id: string): Promise<ProjectPurgeResult>;
}

export function restoreStorageBackupAsNewRevision(currentProject: ProjectDocumentV5, backupProject: ProjectDocumentV5): ProjectDocumentV5;
export function isDesktopStorageAvailable(): boolean;
export function getDesktopStorageHealth(): Promise<StorageHealthSummary | null>;
export function listDesktopProjectBackups(projectId: string): Promise<DesktopBackupSummary[]>;
export function listDesktopQuarantinedProjects(): Promise<DesktopQuarantineSummary[]>;
export function loadDesktopProjectBackup(currentProject: ProjectDocumentV5, backupId: number): Promise<ProjectDocumentV5>;
export function createPlatformRepository(): ProjectRepository;
