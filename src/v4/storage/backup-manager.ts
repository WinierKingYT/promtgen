import { CanonicalProject } from '../domain/types.js';

export interface StorageCheckpoint {
  id: string;
  projectId: string;
  revision: number;
  createdAt: string;
  checksumHash: string;
  projectSnapshot: CanonicalProject;
}

const checkpointsStore = new Map<string, StorageCheckpoint[]>();

export function computeDataChecksum(data: unknown): string {
  const jsonStr = JSON.stringify(data || {});
  let hash = 0;
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `crc32-${Math.abs(hash).toString(16)}`;
}

export function createCheckpoint(project: CanonicalProject): StorageCheckpoint {
  const pId = String(project.id);
  const checksumHash = computeDataChecksum(project);
  const checkpoint: StorageCheckpoint = {
    id: `chk-${Date.now()}-r${project.revision}`,
    projectId: pId,
    revision: project.revision,
    createdAt: new Date().toISOString(),
    checksumHash,
    projectSnapshot: structuredClone(project)
  };

  const existing = checkpointsStore.get(pId) || [];
  existing.push(checkpoint);
  // Keep maximum 5 rolling checkpoints per project
  if (existing.length > 5) existing.shift();

  checkpointsStore.set(pId, existing);
  return checkpoint;
}

export function getLatestCheckpoint(projectId: string): StorageCheckpoint | null {
  const list = checkpointsStore.get(projectId) || [];
  return list.length ? list[list.length - 1]! : null;
}

export function verifyDataIntegrity(project: CanonicalProject, expectedChecksum: string): boolean {
  const actualHash = computeDataChecksum(project);
  return actualHash === expectedChecksum;
}
