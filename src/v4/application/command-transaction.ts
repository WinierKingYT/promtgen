import type { ProjectDocumentV5, ProjectRepository } from '../contracts.js';
import { normalizeProjectDocument } from '../canonical-entities.js';
import { validateProjectDocument } from '../project-document.js';
import { recalculateReadiness } from '../planning-engine.js';

export interface ProjectCommandEnvelope {
  commandId: string;
  commandType: string;
  projectId: string;
  expectedDocumentRevision: number;
  expectedCanonicalRevision: number;
  canonicalChange: boolean;
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
  if (current.documentRevision !== command.expectedDocumentRevision) {
    return { success: false, project: current, error: `Stale document revision: beklenen ${command.expectedDocumentRevision}, mevcut ${current.documentRevision}.` };
  }
  if (current.canonicalRevision !== command.expectedCanonicalRevision) {
    return { success: false, project: current, error: `Stale canonical revision: beklenen ${command.expectedCanonicalRevision}, mevcut ${current.canonicalRevision}.` };
  }

  const next = normalizeProjectDocument(structuredClone(candidate));
  next.commandLog = structuredClone(current.commandLog);
  next.documentRevision = Math.max(candidate.documentRevision, current.documentRevision + 1);
  next.canonicalRevision = command.canonicalChange
    ? Math.max(candidate.canonicalRevision, current.canonicalRevision + 1)
    : current.canonicalRevision;
  next.lifecycle.updatedAt = command.createdAt;
  next.commandLog.push({
    commandId: command.commandId,
    commandType: command.commandType,
    expectedDocumentRevision: command.expectedDocumentRevision,
    committedDocumentRevision: next.documentRevision,
    expectedCanonicalRevision: command.expectedCanonicalRevision,
    committedCanonicalRevision: next.canonicalRevision,
    createdAt: command.createdAt
  });
  const ready = recalculateReadiness(next);
  const validation = validateProjectDocument(ready);
  if (!validation.valid) {
    return { success: false, project: current, error: validation.errors.join('; ') };
  }

  try {
    const saved = await repository.save(ready, {
      expectedDocumentRevision: command.expectedDocumentRevision,
      expectedCanonicalRevision: command.expectedCanonicalRevision
    });
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
    expectedDocumentRevision: 0,
    committedDocumentRevision: next.documentRevision,
    expectedCanonicalRevision: 0,
    committedCanonicalRevision: next.canonicalRevision,
    createdAt
  });
  const validation = validateProjectDocument(next);
  if (!validation.valid) return { success: false, project, error: validation.errors.join('; ') };
  try {
    return { success: true, project: await repository.save(next, { createOnly: true }), alreadyApplied: false };
  } catch (error) {
    return { success: false, project, error: error instanceof Error ? error.message : String(error) };
  }
}
