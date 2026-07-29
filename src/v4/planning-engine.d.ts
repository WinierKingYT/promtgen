// Type declarations for src/v4/planning-engine.js
import {
  ExpansionDimension,
  PlanChangePreview,
  PlanningDepth,
  ProjectDocumentV5,
  RevisionComparison,
  SuggestionBundle,
  SuggestionStatus
} from './contracts.js';

type ImportedContextItem = ProjectDocumentV5['profile']['importedContext'][number];
type RevisionReference = string | number;

export interface AnalyzeIdeaOptions {
  name?: string;
  outputLanguage?: string;
  profile?: ProjectDocumentV5['profile'];
  importedContext?: ImportedContextItem[];
}

export type PlanningDepthAssessment = PlanningDepth;

export function assessPlanningDepth(idea: string, importedContext?: ImportedContextItem[]): PlanningDepthAssessment;
export function analyzeIdea(idea: string, options?: AnalyzeIdeaOptions): ProjectDocumentV5;
export function applyIdeaExpansion(project: ProjectDocumentV5, options: { answers: Record<string, string>; dimensions: ExpansionDimension[] }): ProjectDocumentV5;
export function proposeNextOptions(project: ProjectDocumentV5, options?: { direction?: string }): SuggestionBundle;
export function updateSuggestionStatus(project: ProjectDocumentV5, bundleId: string, suggestionId: string, status: SuggestionStatus, editedDescription?: string): ProjectDocumentV5;
export function previewApprovedChanges(project: ProjectDocumentV5, bundleId: string): PlanChangePreview;
export function applyApprovedChanges(project: ProjectDocumentV5, bundleId: string): ProjectDocumentV5;
export function updatePlanSection(project: ProjectDocumentV5, sectionId: string, options: { content?: string; items?: string[] }): ProjectDocumentV5;
export function overridePlanningDepth(project: ProjectDocumentV5, selected: 'quick' | 'standard' | 'advanced' | 'enterprise'): ProjectDocumentV5;
export function recalculateReadiness(project: ProjectDocumentV5): ProjectDocumentV5;
export function finalizePlan(project: ProjectDocumentV5, force?: boolean): { success: boolean; project: ProjectDocumentV5; blockers: string[] };
export function reopenPlan(project: ProjectDocumentV5): ProjectDocumentV5;
export function addExplorationMessage(project: ProjectDocumentV5, role: string, content: string): ProjectDocumentV5;
export function diffTextLines(before: string, after: string): Array<{ type: 'equal' | 'added' | 'removed'; text: string }>;
export function comparePlanRevisions(project: ProjectDocumentV5, fromReference: RevisionReference, toReference?: RevisionReference): RevisionComparison;
export function captureCurrentRevision(project: ProjectDocumentV5, summary?: string): ProjectDocumentV5;
export function restorePlanRevision(project: ProjectDocumentV5, reference: RevisionReference): { success: boolean; project: ProjectDocumentV5; reason: string; restoredFromRevision?: number };
export function confirmConceptSummary(project: ProjectDocumentV5): ProjectDocumentV5;
export function applyExtensionModules(project: ProjectDocumentV5, extensionPackageNames: string[]): ProjectDocumentV5;
export function runConceptSimulation(project: ProjectDocumentV5, approachId: string): {
  riskCount: number;
  taskEstimate: number;
  completenessScore: number;
};
