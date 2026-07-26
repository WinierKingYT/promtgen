// Type declarations for src/v4/planning-memory.js
import { CanonicalProject } from './domain/types.js';

export interface LocalPlanningMemory {
  projectId: string;
  recentDecisions: string[];
  recentContext: string[];
}

export function buildLocalPlanningMemory(project: CanonicalProject): LocalPlanningMemory;