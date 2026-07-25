import { RequirementStatus, DecisionStatus, RiskStatus, TaskStatus } from './types.js';

export const REQUIREMENT_TRANSITIONS: Record<RequirementStatus, RequirementStatus[]> = {
  proposed: ['accepted', 'rejected'],
  accepted: ['in-development', 'deprecated'],
  'in-development': ['implemented', 'deprecated'],
  implemented: ['verified', 'in-development'],
  verified: ['deprecated'],
  rejected: [],
  deprecated: []
};

export const DECISION_TRANSITIONS: Record<DecisionStatus, DecisionStatus[]> = {
  proposed: ['accepted', 'rejected'],
  accepted: ['superseded', 'deprecated'],
  superseded: [],
  rejected: [],
  deprecated: []
};

export const RISK_TRANSITIONS: Record<RiskStatus, RiskStatus[]> = {
  identified: ['mitigating', 'accepted', 'resolved'],
  mitigating: ['resolved', 'materialized'],
  accepted: ['resolved'],
  resolved: [],
  materialized: ['mitigating']
};

export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  proposed: ['ready', 'cancelled'],
  ready: ['in-progress', 'blocked', 'cancelled'],
  'in-progress': ['done', 'blocked', 'cancelled'],
  blocked: ['in-progress', 'cancelled'],
  done: [],
  cancelled: []
};

export function canTransitionRequirement(from: RequirementStatus, to: RequirementStatus): boolean {
  return (REQUIREMENT_TRANSITIONS[from] || []).includes(to);
}

export function canTransitionDecision(from: DecisionStatus, to: DecisionStatus): boolean {
  return (DECISION_TRANSITIONS[from] || []).includes(to);
}

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return (TASK_TRANSITIONS[from] || []).includes(to);
}
