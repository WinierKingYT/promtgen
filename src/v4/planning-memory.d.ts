// Type declarations for src/v4/planning-memory.js
import { ProjectDocumentV5 } from './contracts.js';

export interface LocalPlanningMemory {
  projectId: string;
  recentDecisions: string[];
  recentContext: string[];
}

export function buildLocalPlanningMemory(projects: ProjectDocumentV5[], excludeProjectId?: string): LocalPlanningMemory | null;
