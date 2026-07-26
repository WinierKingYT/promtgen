// Type declarations for the canonical production document.
import { ProjectDocumentV5 } from './contracts.js';

// PlanningDepth as used in runtime (object with selected/recommended)
export interface PlanningDepth {
  recommended: 'quick' | 'standard' | 'advanced' | 'enterprise';
  selected: 'quick' | 'standard' | 'advanced' | 'enterprise';
  overridden: boolean;
  rationale: string;
  signals: any;
}

export interface CreateProjectDocumentOptions {
  idea: string;
  name?: string;
  outputLanguage?: string;
  planningDepth?: PlanningDepth;
  profile?: any;
}

export const PHASE_REGISTRY: any;
export function createPlanSections(depth: 'quick' | 'standard' | 'advanced' | 'enterprise', revision: number): any;
export function createProjectDocument(options?: CreateProjectDocumentOptions): ProjectDocumentV5;
export function getRequiredSections(depth: PlanningDepth['selected']): string[];
export function applyDepthSelection(project: ProjectDocumentV5, selected: PlanningDepth['selected'], overridden: boolean): ProjectDocumentV5;
export function validateProjectDocument(project: unknown): { valid: boolean; errors: string[] };
