import { CanonicalProject } from '../domain/types.js';
import { redactSensitiveData } from '../security/secret-guard.js';

export interface DiagnosticReport {
  generatedAt: string;
  appVersion: string;
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

export function generateDiagnosticReport(project?: CanonicalProject, recentLogs: string[] = []): DiagnosticReport {
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
    appVersion: '4.0.0-rc1',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node-CLI-Environment',
    projectSummary,
    sanitizedLogs
  };
}
