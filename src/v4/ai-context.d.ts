// Type declarations for src/v4/ai-context.js
import { CanonicalProject } from './domain/types.js';

export interface BudgetedContextResult {
  contextData: Record<string, any>;
  estimatedTokens: number;
  truncated: boolean;
}

export function buildPlanningContext(project: CanonicalProject, sectionId: string | null): any;
export function redactSensitiveText(text: string): { redactedText: string; redactedCount: number };
export function validateSuggestionResponse(value: any, schema: any): any;
export function createProvider(id: string, configuration?: any): any;
export function buildBudgetedContext(project: CanonicalProject, maxTokens?: number): BudgetedContextResult;
export function estimateTokenCount(text: string): number;