import type { ProjectDocumentV5, ProjectRepository } from '../contracts.js';
import { normalizeProjectDocument } from '../canonical-entities.js';
import { validateProjectDocument } from '../project-document.js';
import { recalculateReadiness } from '../planning-engine.js';

export interface ProjectCommandEnvelope {
  commandId: string;
  commandType: string;
  projectId: string;
  expectedRevision: number;
  createdAt: string;
}

export type ProjectCommandResult =
  | { success: true; project: ProjectDocumentV5; alreadyApplied: boolean }
  | { success: false; project: ProjectDocumentV5; error: string };

export async function commitProjectCandidate(
  repository: ProjectRepository,
  current: ProjectDocumentV5,
  candidate: ProjectDocumentV5,
  command: ProjectCommandEnvelope
): Promise<ProjectCommandResult> {
  if (command.projectId !== current.id || candidate.id !== current.id) {
    return { success: false, project: current, error: 'Command proje kimliği eşleşmiyor.' };
  }
  if (current.commandLog.some(record => record.commandId === command.commandId)) {
    return { success: true, project: current, alreadyApplied: true };
  }
  if (current.revision !== command.expectedRevision) {
    return { success: false, project: current, error: `Stale revision: beklenen ${command.expectedRevision}, mevcut ${current.revision}.` };
  }

  const next = normalizeProjectDocument(structuredClone(candidate));
  next.commandLog = structuredClone(current.commandLog);
  next.revision = Math.max(candidate.revision, current.revision + 1);
  next.lifecycle.updatedAt = command.createdAt;
  next.commandLog.push({
    commandId: command.commandId,
    commandType: command.commandType,
    expectedRevision: command.expectedRevision,
    committedRevision: next.revision,
    createdAt: command.createdAt
  });
  const ready = recalculateReadiness(next);
  const validation = validateProjectDocument(ready);
  if (!validation.valid) {
    return { success: false, project: current, error: validation.errors.join('; ') };
  }

  try {
    const saved = await repository.save(ready);
    return { success: true, project: saved, alreadyApplied: false };
  } catch (error) {
    return { success: false, project: current, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function saveInitialProject(
  repository: ProjectRepository,
  project: ProjectDocumentV5,
  commandId: string,
  createdAt = new Date().toISOString()
): Promise<ProjectCommandResult> {
  const next = normalizeProjectDocument(structuredClone(project));
  next.commandLog.push({
    commandId,
    commandType: 'CreateProject',
    expectedRevision: 0,
    committedRevision: next.revision,
    createdAt
  });
  const validation = validateProjectDocument(next);
  if (!validation.valid) return { success: false, project, error: validation.errors.join('; ') };
  try {
    return { success: true, project: await repository.save(next), alreadyApplied: false };
  } catch (error) {
    return { success: false, project, error: error instanceof Error ? error.message : String(error) };
  }
}
