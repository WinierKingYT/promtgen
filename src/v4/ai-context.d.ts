// Type declarations for src/v4/ai-context.js
import { ProjectDocumentV5 } from './contracts.js';

export interface BudgetedContextResult {
  contextData: Record<string, unknown>;
  estimatedTokens: number;
  truncated: boolean;
  truncationReason: string | null;
}

export function buildPlanningContext(project: ProjectDocumentV5, sectionId?: string | null): unknown;
export function redactSensitiveText(text: string): string;
export function validateSuggestionResponse(value: unknown, schema?: { parse(value: unknown): unknown }): unknown;
export function createProvider(id: string, configuration?: {
  model?: string;
  baseUrl?: string;
  credential?: string;
}): {
  model?: string;
  structured(input: {
    system: string;
    context: unknown;
    schema: { parse(value: unknown): unknown };
    signal?: AbortSignal;
  }): Promise<unknown>;
};
export function buildBudgetedContext(project: ProjectDocumentV5, maxTokens?: number): BudgetedContextResult;
export function estimateTokenCount(text: string): number;
