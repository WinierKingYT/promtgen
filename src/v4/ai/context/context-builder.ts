import { CanonicalProject } from '../../domain/types.js';

export interface BudgetedContextResult {
  contextData: Record<string, any>;
  estimatedTokens: number;
  truncated: boolean;
}

export function estimateTokenCount(text: string): number {
  // Approximate 1 token ~= 4 characters for Turkish/English mixed technical text
  return Math.ceil(String(text || '').length / 4);
}

export function buildBudgetedContext(
  project: CanonicalProject,
  maxTokens: number = 4000
): BudgetedContextResult {
  const identity = {
    name: project.identity.name,
    originalIdea: project.identity.originalIdea,
    summary: project.identity.summary
  };

  const acceptedDecisions = (project.decisions || [])
    .filter(d => d.status === 'accepted')
    .slice(0, 10)
    .map(d => ({ title: d.title, decision: d.decision }));

  const acceptedRequirements = (project.requirements || [])
    .filter(r => r.status === 'accepted')
    .slice(0, 15)
    .map(r => ({ title: r.title, category: r.category, priority: r.priority }));

  let contextData: Record<string, any> = {
    identity,
    phase: project.lifecycle.activePhase,
    acceptedDecisions,
    acceptedRequirements
  };

  let jsonString = JSON.stringify(contextData);
  let estimatedTokens = estimateTokenCount(jsonString);
  let truncated = false;

  // Truncate requirements if over budget
  if (estimatedTokens > maxTokens && acceptedRequirements.length > 5) {
    contextData['acceptedRequirements'] = acceptedRequirements.slice(0, 5);
    jsonString = JSON.stringify(contextData);
    estimatedTokens = estimateTokenCount(jsonString);
    truncated = true;
  }

  return {
    contextData,
    estimatedTokens,
    truncated
  };
}
