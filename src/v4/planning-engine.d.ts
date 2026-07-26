// Type declarations for src/v4/planning-engine.js
import { CanonicalProject, PlanningDepth } from './domain/types.js';

export interface AnalyzeIdeaOptions {
  name?: string;
  outputLanguage?: string;
  profile?: any;
  importedContext?: any[];
}

export interface PlanningDepthAssessment {
  recommended: 'quick' | 'standard' | 'advanced' | 'enterprise';
  selected: 'quick' | 'standard' | 'advanced' | 'enterprise';
  overridden: boolean;
  rationale: string;
  signals: any;
}

export interface IdeaAnalysisResult {
  project: CanonicalProject;
  suggestionBundles: any[];
  planningDepth: PlanningDepthAssessment;
}

export function assessPlanningDepth(idea: string, importedContext?: any[]): PlanningDepthAssessment;
export function analyzeIdea(idea: string, options?: AnalyzeIdeaOptions): IdeaAnalysisResult;
export function applyIdeaExpansion(project: CanonicalProject, options: { answers: Record<string, string>; dimensions: any[] }): CanonicalProject;
export function proposeNextOptions(project: CanonicalProject, options?: { direction?: string }): any;
export function updateSuggestionStatus(project: CanonicalProject, bundleId: string, suggestionId: string, status: string, editedDescription?: string): CanonicalProject;
export function previewApprovedChanges(project: CanonicalProject, bundleId: string): any;
export function applyApprovedChanges(project: CanonicalProject, bundleId: string): CanonicalProject;
export function updatePlanSection(project: CanonicalProject, sectionId: string, options: { content?: string; items?: string[] }): CanonicalProject;
export function overridePlanningDepth(project: CanonicalProject, selected: 'quick' | 'standard' | 'advanced' | 'enterprise'): CanonicalProject;
export function recalculateReadiness(project: CanonicalProject): CanonicalProject;
export function finalizePlan(project: CanonicalProject, force?: boolean): { success: boolean; project: CanonicalProject; blockers: string[] };
export function reopenPlan(project: CanonicalProject): CanonicalProject;
export function addExplorationMessage(project: CanonicalProject, role: string, content: string): CanonicalProject;
export function diffTextLines(before: string, after: string): any[];
export function comparePlanRevisions(project: CanonicalProject, fromReference: any, toReference?: any): any;
export function captureCurrentRevision(project: CanonicalProject, summary?: string): CanonicalProject;
export function restorePlanRevision(project: CanonicalProject, reference: any): { success: boolean; project: CanonicalProject; reason: string; restoredFromRevision?: number };
export function confirmConceptSummary(project: CanonicalProject): CanonicalProject;
export function applyImpactAnalysis(project: CanonicalProject, impactId: string): CanonicalProject;
export function applyExtensionModules(project: CanonicalProject, extensionPackageNames: string[]): CanonicalProject;
export function resolveImpactContradiction(project: CanonicalProject, impactId: string, decisionId: string, action?: string): CanonicalProject;
export function runConceptSimulation(project: CanonicalProject, approachId: string): any;