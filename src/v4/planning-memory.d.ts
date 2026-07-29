// Type declarations for src/v4/planning-memory.js
import type { ProjectDocumentV5 } from './contracts.js';

export interface RankedPlanningSignal {
  id: string;
  count: number;
}

export interface LocalPlanningMemory {
  version: 1;
  sourceProjectCount: number;
  depthAffinity: RankedPlanningSignal[];
  moduleAffinity: RankedPlanningSignal[];
  acceptedSuggestionKinds: RankedPlanningSignal[];
  rejectedSuggestionKinds: RankedPlanningSignal[];
  sectionAffinity: RankedPlanningSignal[];
  recurringDecisionThemes: RankedPlanningSignal[];
}

export function buildLocalPlanningMemory(projects: ProjectDocumentV5[], excludeProjectId?: string): LocalPlanningMemory | null;
export function hasUsefulPlanningMemory(memory: LocalPlanningMemory | null | undefined): boolean;
