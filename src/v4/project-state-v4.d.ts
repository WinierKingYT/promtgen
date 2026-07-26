// Type declarations for src/v4/project-state-v4.js
import { CanonicalProject, ProjectId } from './domain/types.js';

// PlanningDepth as used in runtime (object with selected/recommended)
export interface PlanningDepth {
  recommended: 'quick' | 'standard' | 'advanced' | 'enterprise';
  selected: 'quick' | 'standard' | 'advanced' | 'enterprise';
  overridden: boolean;
  rationale: string;
  signals: any;
}

export interface CreateProjectStateOptions {
  idea: string;
  name?: string;
  outputLanguage?: string;
  planningDepth?: PlanningDepth;
  profile?: any;
}

// Legacy V3-compatible exports used by App.tsx
export const PHASE_REGISTRY: any;
export function createPlanSections(depth: 'quick' | 'standard' | 'advanced' | 'enterprise', revision: number): any;
export function getInitialV3State(): any;
export function ensureApproval(state: any, key: string): any;
export function applyV3StatePatch(state: any, patch: any): any;
export function isV3State(project: any): boolean;
export function getStageOrPhase(project: any): string;
export function getStageLabel(stage: string): string;
export function getApprovalKeyForStage(stage: string): string;
export function applyStatePatchVersionAware(state: any, patch: any, revision: number): any;

export function createProjectStateV4(options: CreateProjectStateOptions): CanonicalProject;
export function getRequiredSections(depth: PlanningDepth['selected']): string[];
export function applyDepthSelection(project: CanonicalProject, selected: PlanningDepth['selected'], overridden: boolean): CanonicalProject;
export function validateProjectStateV4(project: any): { valid: boolean; errors: string[] };
export function migrateToV4(oldProject: any): CanonicalProject;