import type { ProjectDocumentV5 } from '../contracts.js';
import { redactSensitiveData } from '../security/secret-guard.js';

export interface DiagnosticReport {
  generatedAt: string;
  appVersion: string;
  commitSha: string;
  userAgent: string;
  projectSummary?: {
    id: string;
    revision: number;
    schemaVersion: number;
    phase: string;
    requirementCount: number;
    decisionCount: number;
    taskCount: number;
  };
  sanitizedLogs: string[];
}

export function generateDiagnosticReport(project?: ProjectDocumentV5, recentLogs: string[] = []): DiagnosticReport {
  const sanitizedLogs = recentLogs.map(log => redactSensitiveData(log).redactedText);

  let projectSummary;
  if (project) {
    projectSummary = {
      id: String(project.id),
      revision: project.revision,
      schemaVersion: project.schemaVersion,
      phase: project.lifecycle.activePhase,
      requirementCount: (project.requirements || []).length,
      decisionCount: (project.decisions || []).length,
      taskCount: (project.tasks || []).length
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    appVersion: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'development',
    commitSha: typeof __COMMIT_SHA__ === 'string' ? __COMMIT_SHA__ : 'development',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node-CLI-Environment',
    projectSummary,
    sanitizedLogs
  };
}
