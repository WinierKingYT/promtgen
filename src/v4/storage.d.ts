// Type declarations for src/v4/storage.js
import { CanonicalProject, ProjectId } from './domain/types.js';

export class IndexedDbProjectRepository {
  list(): Promise<CanonicalProject[]>;
  get(id: ProjectId): Promise<CanonicalProject | null>;
  save(project: CanonicalProject): Promise<CanonicalProject>;
  archive(id: ProjectId): Promise<boolean>;
  remove(id: ProjectId): Promise<void>;
}

export class MemoryProjectRepository {
  list(): Promise<CanonicalProject[]>;
  get(id: ProjectId): Promise<CanonicalProject | null>;
  save(project: CanonicalProject): Promise<CanonicalProject>;
  archive(id: ProjectId): Promise<boolean>;
  remove(id: ProjectId): Promise<void>;
}

export function createProjectRepository(): IndexedDbProjectRepository | MemoryProjectRepository;