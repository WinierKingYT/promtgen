import { CanonicalProject } from '../types.js';
import { ProjectId } from '../ids.js';
import { Result } from '../common/result.js';
import { ZodSchema } from 'zod';

export interface ProjectRepositoryPort {
  list(): Promise<Result<CanonicalProject[]>>;
  get(id: ProjectId): Promise<Result<CanonicalProject | null>>;
  save(project: CanonicalProject): Promise<Result<CanonicalProject>>;
  remove(id: ProjectId): Promise<Result<boolean>>;
}

export interface StructuredAiRequest<T> {
  systemPrompt: string;
  userContext: Record<string, any>;
  schema: ZodSchema<T>;
  schemaId: string;
  signal?: AbortSignal;
}

export interface AIProviderPort {
  id: string;
  label: string;
  isLocal: boolean;
  text(system: string, userContext: Record<string, any>, signal?: AbortSignal): Promise<Result<string>>;
  structured<T>(request: StructuredAiRequest<T>): Promise<Result<T>>;
}

export interface ClockPort {
  nowIso(): string;
  nowTimestamp(): number;
}

export interface IdGeneratorPort {
  nextId(prefix: string): string;
}

export class SystemClock implements ClockPort {
  nowIso(): string { return new Date().toISOString(); }
  nowTimestamp(): number { return Date.now(); }
}

export class CryptoIdGenerator implements IdGeneratorPort {
  nextId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
