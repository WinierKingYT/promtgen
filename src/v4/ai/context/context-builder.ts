import type { ProjectDocumentV5 } from '../../contracts.js';
import { buildIdeaDiscussionContext } from '../../application/idea-discussion-service.js';

export interface BudgetedContextResult {
  contextData: Record<string, unknown>;
  estimatedTokens: number;
  truncated: boolean;
  truncationReason: string | null;
}

export function estimateTokenCount(text: string): number {
  // Approximate 1 token ~= 4 characters for Turkish/English mixed technical text
  return Math.ceil(String(text || '').length / 4);
}

export function buildBudgetedContext(
  project: ProjectDocumentV5,
  maxTokens: number = 4000
): BudgetedContextResult {
  const identity = {
    name: project.identity.name,
    originalIdea: project.identity.originalIdea,
    summary: project.identity.summary
  };

  const acceptedDecisions = (project.decisions || [])
    .filter(d => d.status === 'accepted')
    .reverse()
    .map(d => ({ title: d.title, decision: d.decision, rationale: d.rationale }));

  const acceptedRequirements = (project.requirements || [])
    .filter(r => r.status === 'accepted')
    .sort((a, b) => {
      const weight = { must: 3, should: 2, could: 1, wont: 0 };
      return (weight[b.priority] || 0) - (weight[a.priority] || 0);
    })
    .map(r => ({ title: r.title, kind: r.kind, priority: r.priority }));

  const contextData: Record<string, unknown> = {
    identity,
    phase: project.lifecycle.activePhase,
    acceptedDecisions,
    acceptedRequirements,
    ideaDiscussion: buildIdeaDiscussionContext(project)
  };

  let jsonString = JSON.stringify(contextData);
  let estimatedTokens = estimateTokenCount(jsonString);
  let truncated = false;

  let truncationReason: string | null = null;
  while (estimatedTokens > maxTokens && (contextData.acceptedRequirements as unknown[]).length > 1) {
    (contextData.acceptedRequirements as unknown[]).pop();
    jsonString = JSON.stringify(contextData);
    estimatedTokens = estimateTokenCount(jsonString);
    truncated = true;
    truncationReason = 'lower-priority-requirements-removed';
  }
  while (estimatedTokens > maxTokens && (contextData.acceptedDecisions as unknown[]).length > 1) {
    (contextData.acceptedDecisions as unknown[]).pop();
    jsonString = JSON.stringify(contextData);
    estimatedTokens = estimateTokenCount(jsonString);
    truncated = true;
    truncationReason = 'older-decisions-removed';
  }
  const ideaDiscussion = contextData.ideaDiscussion as {
    accepted: unknown[];
    deferred: unknown[];
    rejected: unknown[];
    pending: unknown[];
  };
  for (const [key, reason] of [
    ['rejected', 'older-rejected-idea-records-removed'],
    ['deferred', 'older-deferred-idea-records-removed'],
    ['pending', 'older-pending-idea-records-removed'],
    ['accepted', 'older-accepted-idea-records-removed']
  ] as const) {
    while (estimatedTokens > maxTokens && ideaDiscussion[key].length > (key === 'accepted' ? 1 : 0)) {
      ideaDiscussion[key].shift();
      jsonString = JSON.stringify(contextData);
      estimatedTokens = estimateTokenCount(jsonString);
      truncated = true;
      truncationReason = reason;
    }
  }
  if (estimatedTokens > maxTokens) {
    identity.originalIdea = identity.originalIdea.slice(0, 800);
    identity.summary = identity.summary.slice(0, 800);
    jsonString = JSON.stringify(contextData);
    estimatedTokens = estimateTokenCount(jsonString);
    truncated = true;
    truncationReason = 'identity-text-shortened';
  }

  return {
    contextData,
    estimatedTokens,
    truncated,
    truncationReason
  };
}
