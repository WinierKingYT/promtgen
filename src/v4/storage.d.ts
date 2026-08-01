// Type declarations for src/v4/storage.js
import { ProjectDocumentV5, ProjectPurgeResult, ProjectSaveOptions } from './contracts.js';

export class IndexedDbProjectRepository {
  list(): Promise<ProjectDocumentV5[]>;
  get(id: string): Promise<ProjectDocumentV5 | null>;
  save(project: ProjectDocumentV5, options?: ProjectSaveOptions): Promise<ProjectDocumentV5>;
  archive(id: string): Promise<boolean>;
  restore(id: string): Promise<boolean>;
  purge(id: string): Promise<ProjectPurgeResult>;
  listCheckpoints(projectId: string): Promise<Array<{ id: string; projectId: string; revision: number; createdAt: string; checksumAlgorithm: 'SHA-256'; checksumHash: string; projectSnapshot: ProjectDocumentV5 }>>;
  listQuarantined(): Promise<Array<{ id: string; projectId: string | null; quarantinedAt: string; reason: string; rawPayload: unknown }>>;
}

export class MemoryProjectRepository {
  projects: Map<string, ProjectDocumentV5>;
  migrationBackups: Map<string, { projectSnapshot: ProjectDocumentV5 }>;
  list(): Promise<ProjectDocumentV5[]>;
  get(id: string): Promise<ProjectDocumentV5 | null>;
  save(project: ProjectDocumentV5, options?: ProjectSaveOptions): Promise<ProjectDocumentV5>;
  archive(id: string): Promise<boolean>;
  restore(id: string): Promise<boolean>;
  purge(id: string): Promise<ProjectPurgeResult>;
}

export function createProjectRepository(): IndexedDbProjectRepository | MemoryProjectRepository;
export function restoreCheckpointAsNewRevision(currentProject: ProjectDocumentV5, checkpointProject: ProjectDocumentV5): ProjectDocumentV5;
export function listWebProjectCheckpoints(projectId: string): Promise<Array<{ id: string; projectId: string; revision: number; createdAt: string; checksumAlgorithm: 'SHA-256'; checksumHash: string; projectSnapshot: ProjectDocumentV5 }>>;
export function listWebQuarantinedProjects(): Promise<Array<{ id: string; projectId: string | null; quarantinedAt: string; reason: string; rawPayload: unknown }>>;
export function loadWebProjectCheckpoint(currentProject: ProjectDocumentV5, checkpointId: string): Promise<ProjectDocumentV5>;
