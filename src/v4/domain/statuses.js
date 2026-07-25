export const REQUIREMENT_TRANSITIONS = {
  proposed: ['accepted', 'rejected'],
  accepted: ['in-development', 'deprecated'],
  'in-development': ['implemented', 'deprecated'],
  implemented: ['verified', 'in-development'],
  verified: ['deprecated'],
  rejected: [],
  deprecated: []
};

export const DECISION_TRANSITIONS = {
  proposed: ['accepted', 'rejected'],
  accepted: ['superseded', 'deprecated'],
  superseded: [],
  rejected: [],
  deprecated: []
};

export const RISK_TRANSITIONS = {
  identified: ['mitigating', 'accepted', 'resolved'],
  mitigating: ['resolved', 'materialized'],
  accepted: ['resolved'],
  resolved: [],
  materialized: ['mitigating']
};

export const TASK_TRANSITIONS = {
  proposed: ['ready', 'cancelled'],
  ready: ['in-progress', 'blocked', 'cancelled'],
  'in-progress': ['done', 'blocked', 'cancelled'],
  blocked: ['in-progress', 'cancelled'],
  done: [],
  cancelled: []
};

export function canTransitionRequirement(from, to) {
  return (REQUIREMENT_TRANSITIONS[from] || []).includes(to);
}

export function canTransitionDecision(from, to) {
  return (DECISION_TRANSITIONS[from] || []).includes(to);
}

export function canTransitionTask(from, to) {
  return (TASK_TRANSITIONS[from] || []).includes(to);
}
