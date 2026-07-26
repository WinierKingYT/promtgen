import type { ProjectDocumentV5 } from '../contracts.js';

export interface StorageCheckpoint {
  id: string;
  projectId: string;
  revision: number;
  createdAt: string;
  checksumAlgorithm: 'fnv1a32';
  checksumHash: string;
  projectSnapshot: ProjectDocumentV5;
}

// Synchronous compatibility checksum for local benchmarks only.
// Production persistence uses Web Crypto SHA-256 in infrastructure/storage/integrity.ts.
export function computeDataChecksum(data: unknown): string {
  const text = JSON.stringify(data ?? null);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function createCheckpoint(project: ProjectDocumentV5): StorageCheckpoint {
  return {
    id: `chk-${Date.now()}-r${project.revision}`,
    projectId: String(project.id),
    revision: project.revision,
    createdAt: new Date().toISOString(),
    checksumAlgorithm: 'fnv1a32',
    checksumHash: computeDataChecksum(project),
    projectSnapshot: structuredClone(project)
  };
}

export function verifyDataIntegrity(project: ProjectDocumentV5, expectedChecksum: string): boolean {
  return computeDataChecksum(project) === expectedChecksum;
}
