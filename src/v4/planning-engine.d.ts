// Type declarations for src/v4/planning-engine.js
import { ProjectDocumentV5 } from './contracts.js';

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

export function assessPlanningDepth(idea: string, importedContext?: any[]): PlanningDepthAssessment;
export function analyzeIdea(idea: string, options?: AnalyzeIdeaOptions): ProjectDocumentV5;
export function applyIdeaExpansion(project: ProjectDocumentV5, options: { answers: Record<string, string>; dimensions: any[] }): ProjectDocumentV5;
export function proposeNextOptions(project: ProjectDocumentV5, options?: { direction?: string }): any;
export function updateSuggestionStatus(project: ProjectDocumentV5, bundleId: string, suggestionId: string, status: string, editedDescription?: string): ProjectDocumentV5;
export function previewApprovedChanges(project: ProjectDocumentV5, bundleId: string): any;
export function applyApprovedChanges(project: ProjectDocumentV5, bundleId: string): ProjectDocumentV5;
export function updatePlanSection(project: ProjectDocumentV5, sectionId: string, options: { content?: string; items?: string[] }): ProjectDocumentV5;
export function overridePlanningDepth(project: ProjectDocumentV5, selected: 'quick' | 'standard' | 'advanced' | 'enterprise'): ProjectDocumentV5;
export function recalculateReadiness(project: ProjectDocumentV5): ProjectDocumentV5;
export function finalizePlan(project: ProjectDocumentV5, force?: boolean): { success: boolean; project: ProjectDocumentV5; blockers: string[] };
export function reopenPlan(project: ProjectDocumentV5): ProjectDocumentV5;
export function addExplorationMessage(project: ProjectDocumentV5, role: string, content: string): ProjectDocumentV5;
export function diffTextLines(before: string, after: string): any[];
export function comparePlanRevisions(project: ProjectDocumentV5, fromReference: any, toReference?: any): any;
export function captureCurrentRevision(project: ProjectDocumentV5, summary?: string): ProjectDocumentV5;
export function restorePlanRevision(project: ProjectDocumentV5, reference: any): { success: boolean; project: ProjectDocumentV5; reason: string; restoredFromRevision?: number };
export function confirmConceptSummary(project: ProjectDocumentV5): ProjectDocumentV5;
export function applyImpactAnalysis(project: ProjectDocumentV5, impactId: string): ProjectDocumentV5;
export function applyExtensionModules(project: ProjectDocumentV5, extensionPackageNames: string[]): ProjectDocumentV5;
export function resolveImpactContradiction(project: ProjectDocumentV5, impactId: string, decisionId: string, action?: string): ProjectDocumentV5;
export function runConceptSimulation(project: ProjectDocumentV5, approachId: string): any;
