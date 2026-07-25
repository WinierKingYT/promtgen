export type ProjectId = string & { readonly __brand: unique symbol };
export type RequirementId = string & { readonly __brand: unique symbol };
export type DecisionId = string & { readonly __brand: unique symbol };
export type RiskId = string & { readonly __brand: unique symbol };
export type TaskId = string & { readonly __brand: unique symbol };
export type MilestoneId = string & { readonly __brand: unique symbol };
export type ProposalId = string & { readonly __brand: unique symbol };
export type ScopeItemId = string & { readonly __brand: unique symbol };
export type AcceptanceCriterionId = string & { readonly __brand: unique symbol };
export type TestCaseId = string & { readonly __brand: unique symbol };

export function toProjectId(id: string): ProjectId { return id as ProjectId; }
export function toRequirementId(id: string): RequirementId { return id as RequirementId; }
export function toDecisionId(id: string): DecisionId { return id as DecisionId; }
export function toRiskId(id: string): RiskId { return id as RiskId; }
export function toTaskId(id: string): TaskId { return id as TaskId; }
export function toProposalId(id: string): ProposalId { return id as ProposalId; }
