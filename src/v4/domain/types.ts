import {
  ProjectId, RequirementId, DecisionId, RiskId, TaskId, MilestoneId, ProposalId, ScopeItemId, AcceptanceCriterionId, TestCaseId
} from './ids.js';
import { GenerationProvenance } from '../contracts.js';

export type { ProjectId, RequirementId, DecisionId, RiskId, TaskId, MilestoneId, ProposalId, ScopeItemId, AcceptanceCriterionId, TestCaseId } from './ids.js';

export type KnowledgeStatus = 'user-stated' | 'user-approved' | 'imported' | 'inferred' | 'ai-proposed' | 'deprecated' | 'conflicted';

export type RequirementCategory = 'functional' | 'non-functional' | 'business' | 'compliance' | 'operational';
export type RequirementPriority = 'must' | 'should' | 'could' | 'wont';
export type RequirementStatus = 'proposed' | 'accepted' | 'in-development' | 'implemented' | 'verified' | 'rejected' | 'deprecated';

export type DecisionStatus = 'proposed' | 'accepted' | 'superseded' | 'rejected' | 'deprecated';

export type RiskCategory = 'product' | 'technical' | 'security' | 'privacy' | 'operational' | 'schedule' | 'dependency';
export type RiskStatus = 'identified' | 'mitigating' | 'accepted' | 'resolved' | 'materialized';

export type TaskType = 'implementation' | 'design' | 'research' | 'testing' | 'documentation' | 'operations';
export type TaskStatus = 'proposed' | 'ready' | 'in-progress' | 'blocked' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export type PlanningDepth = 'quick' | 'standard' | 'advanced' | 'enterprise';

export interface EntityProvenance {
  origin: 'user' | 'ai' | 'rule-engine' | 'import' | 'system';
  createdAt: string;
  createdBy?: string;
  generationRunId?: string;
  proposalId?: ProposalId;
  acceptedAt?: string;
  acceptedBy?: string;
}

export interface AcceptanceCriterion {
  id: AcceptanceCriterionId;
  statement: string;
  verificationMethod: 'automated-test' | 'manual-test' | 'inspection' | 'measurement' | 'user-acceptance';
  measurable: boolean;
  linkedTestCaseIds: TestCaseId[];
}

export interface Requirement {
  id: RequirementId;
  title: string;
  description: string;
  category: RequirementCategory;
  priority: RequirementPriority;
  status: RequirementStatus;
  acceptanceCriteria: AcceptanceCriterion[];
  relatedDecisionIds: DecisionId[];
  relatedRiskIds: RiskId[];
  relatedTaskIds: TaskId[];
  provenance: EntityProvenance;
}

export interface DecisionAlternative {
  title: string;
  description: string;
  pros: string[];
  cons: string[];
}

export interface Decision {
  id: DecisionId;
  title: string;
  context: string;
  decision: string;
  rationale: string;
  alternatives: DecisionAlternative[];
  status: DecisionStatus;
  supersedesDecisionId?: DecisionId;
  relatedRequirementIds: RequirementId[];
  relatedRiskIds: RiskId[];
  provenance: EntityProvenance;
  decidedAt?: string;
}

export interface Risk {
  id: RiskId;
  title: string;
  description: string;
  category: RiskCategory;
  probability: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  exposure: number; // probability * impact
  mitigationPlan?: string;
  status: RiskStatus;
  relatedRequirementIds: RequirementId[];
  relatedDecisionIds: DecisionId[];
  provenance: EntityProvenance;
}

export interface Task {
  id: TaskId;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  requirementIds: RequirementId[];
  decisionIds: DecisionId[];
  dependencyTaskIds: TaskId[];
  acceptanceCriterionIds: AcceptanceCriterionId[];
  testCaseIds: TestCaseId[];
  provenance: EntityProvenance;
}

export interface Milestone {
  id: MilestoneId;
  title: string;
  targetDate?: string;
  taskIds: TaskId[];
  status: 'planned' | 'in-progress' | 'completed';
}

export interface ScopeItem {
  id: ScopeItemId;
  title: string;
  type: 'in-scope' | 'out-of-scope';
  rationale?: string;
}

export interface ProposalItem {
  id: string;
  kind: 'feature' | 'decision' | 'risk' | 'question' | 'architecture';
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  recommended: boolean;
  status: 'pending' | 'accepted' | 'edited' | 'deferred' | 'rejected';
}

export interface ProposalBundle {
  id: ProposalId;
  title: string;
  phase: string;
  status: 'open' | 'resolved';
  createdAt: string;
  items: ProposalItem[];
  provenance: GenerationProvenance;
}

export interface CanonicalProject {
  id: ProjectId;
  schemaVersion: number;
  revision: number;
  identity: {
    name: string;
    originalIdea: string;
    summary: string;
  };
  lifecycle: {
    activePhase: string;
    status: 'active' | 'finalized' | 'archived';
    createdAt: string;
    updatedAt: string;
  };
  scope: {
    items: ScopeItem[];
  };
  requirements: Requirement[];
  decisions: Decision[];
  risks: Risk[];
  tasks: Task[];
  milestones: Milestone[];
  proposalStore: {
    bundles: ProposalBundle[];
  };
  metadata: Record<string, any>;
}
