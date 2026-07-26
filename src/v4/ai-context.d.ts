// Type declarations for src/v4/ai-context.js
import { ProjectDocumentV5 } from './contracts.js';

export interface BudgetedContextResult {
  contextData: Record<string, any>;
  estimatedTokens: number;
  truncated: boolean;
}

export function buildPlanningContext(project: ProjectDocumentV5, sectionId: string | null): any;
export function redactSensitiveText(text: string): { redactedText: string; redactedCount: number };
export function validateSuggestionResponse(value: any, schema: any): any;
export function createProvider(id: string, configuration?: any): any;
export function buildBudgetedContext(project: ProjectDocumentV5, maxTokens?: number): BudgetedContextResult;
export function estimateTokenCount(text: string): number;
