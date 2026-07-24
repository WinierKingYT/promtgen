export type PlanningDepthLevel = 'quick' | 'standard' | 'advanced' | 'enterprise'
export type ProjectLifecycleStatus = 'active' | 'finalized' | 'archived'
export type PlanningPhase = 'IDEA_EXPANSION' | 'DISCOVERY' | 'IDEA_LAB' | 'CONCEPT_CONFIRMATION' | 'SHAPING' | 'DESIGN' | 'PLANNING' | 'REVIEW' | 'READY'
export type SuggestionStatus = 'pending' | 'accepted' | 'edited' | 'deferred' | 'rejected'
export type PlanSectionStatus = 'empty' | 'draft' | 'ready' | 'stale'

export interface DesignApproach {
  id: string
  title: string
  description: string
  pros: string[]
  cons: string[]
  risks: string[]
  effort: Magnitude
  impact: Magnitude
  recommended: boolean
  metrics?: {
    effortScore: number // 1 to 5
    networkLoad: number // 1 to 5
    fpsImpact: number // 1 to 5
    maintainability: number // 1 to 5
  }
  presetAnswers?: string[]
}

export interface ConceptSummary {
  summary: string
  confirmedFeatures: string[]
  outOfScope: string[]
  technicalApproaches: string[]
  openQuestions: string[]
  knownRisks: string[]
  mvpTarget: string
  userConfirmed: boolean
  confirmedAt?: string
  simulationResult?: {
    riskCount: number
    taskEstimate: number
    completenessScore: number
  }
}

export interface IdeaLabSession {
  status: 'active' | 'concept_ready' | 'confirmed'
  approaches: DesignApproach[]
  selectedApproachId?: string
  ideaNotes: string[]
  candidateDecisions: string[]
  candidateRisks: string[]
  conceptSummary?: ConceptSummary
}

export interface ExpansionDimension {
  id: string
  label: string
  icon: string
  question: string
  options: string[]
}

export interface IdeaExpansionSession {
  originalIdea: string
  answers: Record<string, string>  // dimensionId -> selected or typed answer
  expandedIdea: string
  dimensions: ExpansionDimension[]
}

export interface ImpactAnalysis {
  id: string
  userRequest: string
  summary: string
  affectedSections: string[]
  newTasks: string[]
  architectureImpact: string
  newRisks: string[]
  contradictions: string[]
  contradictionDetails?: Array<{ decisionId: string; decisionTitle: string; decisionText: string }>
  status: 'proposed' | 'accepted' | 'rejected'
  createdAt: string
}


export interface PlanningDepth {
  recommended: PlanningDepthLevel
  selected: PlanningDepthLevel
  overridden: boolean
  rationale: string
  signals: {
    score: number
    features: number
    integrations: number
    sensitiveData: boolean
    multiPlatform: boolean
    scaleIntent: boolean
    uncertainty: number
  }
}

export type Priority = 'must' | 'should' | 'could'
export type Magnitude = 'low' | 'medium' | 'high'

export interface Objective {
  id: string
  title: string
  description: string
  metric: string
  target: string
  priority: Priority
  status: 'draft' | 'accepted' | 'achieved'
  sourceSuggestionIds: string[]
}

export interface Requirement {
  id: string
  title: string
  statement: string
  kind: 'functional' | 'quality' | 'constraint'
  priority: Priority
  acceptanceCriteria: string[]
  sourceObjectiveIds: string[]
  sourceSuggestionIds: string[]
  status: 'draft' | 'accepted' | 'implemented' | 'verified'
}

export interface Decision {
  id: string
  title: string
  decision: string
  rationale: string
  alternatives: string[]
  consequences: string[]
  status: 'proposed' | 'accepted' | 'superseded'
  sourceSuggestionId: string
  affectedSectionIds: string[]
}

export interface Assumption {
  id: string
  statement: string
  confidence: Magnitude
  validationPlan: string
  status: 'open' | 'validated' | 'invalidated'
}

export interface Risk {
  id: string
  title: string
  description: string
  probability: Magnitude
  impact: Magnitude
  mitigation: string
  owner: string
  status: 'open' | 'mitigated' | 'accepted'
  sourceSuggestionId: string
}

export interface Task {
  id: string
  title: string
  description: string
  status: 'backlog' | 'ready' | 'in_progress' | 'blocked' | 'done'
  priority: Priority
  effort: Magnitude
  dependencies: string[]
  requirementIds: string[]
  acceptanceCriteria: string[]
  verificationIds: string[]
}

export interface TestCase {
  id: string
  title: string
  kind: 'unit' | 'integration' | 'e2e' | 'security' | 'acceptance'
  preconditions: string[]
  steps: string[]
  expectedResult: string
  requirementIds: string[]
  status: 'draft' | 'ready' | 'passed' | 'failed'
}

export interface Milestone {
  id: string
  title: string
  outcome: string
  taskIds: string[]
  targetDate: string
  status: 'planned' | 'active' | 'complete'
}

export interface TraceLink {
  id: string
  fromType: string
  fromId: string
  toType: string
  toId: string
  relation: string
}

export interface AgentPrompt {
  id: string
  role: 'planner' | 'implementer' | 'reviewer' | 'verifier'
  title: string
  instructions: string
  taskIds: string[]
  dependsOnPromptIds: string[]
  expectedOutputs: string[]
  status: 'draft' | 'ready' | 'used' | 'verified'
}

export interface ResearchQuestion {
  id: string
  question: string
  rationale: string
  priority: Magnitude
  status: 'proposed' | 'active' | 'answered' | 'dismissed'
  affectedSectionIds: string[]
}

export interface ResearchSource {
  id: string
  title: string
  url: string
  publisher: string
  sourceType: 'primary' | 'secondary' | 'unknown'
  accessedAt: string
  status: 'candidate' | 'approved' | 'rejected'
  questionIds: string[]
}

export interface Evidence {
  id: string
  claim: string
  summary: string
  sourceId: string
  questionId: string
  confidence: Magnitude
  affectedSectionIds: string[]
  status: 'proposed' | 'accepted' | 'superseded'
}

export interface ReviewFinding {
  id: string
  ruleId: string
  category: string
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  recommendation: string
  entityIds: string[]
  sectionIds: string[]
  status: 'open' | 'resolved' | 'accepted_risk' | 'false_positive'
}

export interface SimulationRun {
  id: string
  scenario: string
  title: string
  status: 'passed' | 'warning' | 'failed'
  summary: string
  checks: Array<{ id: string; label: string; passed: boolean; detail: string }>
  createdAt: string
  projectRevision: number
}

export interface ExecutionSession {
  id: string
  adapterId: 'codex' | 'generic'
  sourceRevision: number
  status: 'proposed' | 'prepared' | 'running' | 'completed' | 'failed' | 'cancelled' | 'external'
  worktreeLabel: string
  steps: Array<{ role: 'planner' | 'implementer' | 'reviewer' | 'verifier'; risk: Magnitude; status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'; exitCode: number | null; outputSummary: string; startedAt: string; completedAt: string }>
  createdAt: string
  updatedAt: string
}

export interface ExportRecord {
  id: string
  format: string
  revision: number
  createdAt: string
  canonicalHash?: string
  adapterIds?: string[]
  fileNames?: string[]
}

export interface PlanSection {
  id: string
  title: string
  description: string
  content: string
  items: string[]
  status: PlanSectionStatus
  required: boolean
  warnings: string[]
  sourceSuggestionIds: string[]
  updatedAtRevision: number
}

export interface SuggestionItem {
  id: string
  fingerprint: string
  kind: 'feature' | 'decision' | 'risk' | 'question' | 'architecture'
  title: string
  description: string
  pros: string[]
  cons: string[]
  effort: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
  recommended: boolean
  recommendationReason: string
  affectedSections: string[]
  dependencies: string[]
  status: SuggestionStatus
  editedDescription?: string
}

export interface SuggestionBundle {
  id: string
  title: string
  phase: PlanningPhase
  status: 'open' | 'resolved'
  decisionComplete?: boolean
  createdAt: string
  items: SuggestionItem[]
  openQuestions?: string[]
  source?: { type: 'ai' | 'local'; providerId: string; fallbackReason?: string }
}

export interface PlanChangePreview {
  canApply: boolean
  reason: string
  acceptedCount: number
  pendingCount: number
  sections: Array<{ sectionId: string; title: string; additions: string[]; unchanged: string[]; sourceSuggestionIds: string[] }>
  records: { decisions: number; risks: number }
  nextRevision: number
}

export interface RevisionComparison {
  valid: boolean
  reason?: string
  from: { revision: number; label: string } | null
  to: { revision: number; label: string } | null
  sections: Array<{
    sectionId: string
    title: string
    beforeStatus: PlanSectionStatus
    afterStatus: PlanSectionStatus
    content: Array<{ type: 'equal' | 'added' | 'removed'; text: string }>
    addedItems: string[]
    removedItems: string[]
  }>
  summary: { changedSections: number; addedLines: number; removedLines: number; addedItems: number; removedItems: number }
}

export interface ReadinessResult {
  score: number
  dimensions: {
    completeness: number
    consistency: number
    traceability: number
    riskCoverage: number
    implementationReadiness: number
  }
  blockers: string[]
  warnings: string[]
  calculatedAtRevision: number
}

export interface PlanRevision {
  id: string
  number: number
  createdAt: string
  summary: string
  acceptedSuggestionIds: string[]
  affectedSections: string[]
  snapshot: Omit<ProjectStateV4, 'revisions'>
}

export interface ProjectStateV4 {
  schemaVersion: 4
  id: string
  revision: number
  lifecycle: {
    status: ProjectLifecycleStatus
    activePhase: PlanningPhase
    createdAt: string
    updatedAt: string
    finalizedAt: string | null
  }
  identity: {
    name: string
    originalIdea: string
    summary: string
    desiredOutcome: string
    outputLanguage: 'tr' | 'en'
  }
  planningDepth: PlanningDepth
  profile: {
    domains: Array<{ name: string; confidence: number }>
    platforms: string[]
    importedContext: Array<{ name: string; kind: string; summary: string }>
    projectInventory?: Record<string, unknown>
  }
  sections: Record<string, PlanSection>
  suggestionBundles: SuggestionBundle[]
  objectives: Objective[]
  requirements: Requirement[]
  decisions: Decision[]
  assumptions: Assumption[]
  risks: Risk[]
  tasks: Task[]
  testCases: TestCase[]
  milestones: Milestone[]
  traceLinks: TraceLink[]
  agentPrompts: AgentPrompt[]
  researchQuestions: ResearchQuestion[]
  sources: ResearchSource[]
  evidence: Evidence[]
  reviewFindings: ReviewFinding[]
  simulationRuns: SimulationRun[]
  executionSessions: ExecutionSession[]
  openQuestions: string[]
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; createdAt: string }>
  readiness: ReadinessResult
  revisions: PlanRevision[]
  exports: ExportRecord[]
  dismissedSuggestionFingerprints: string[]
  ideaLabSession?: IdeaLabSession
  ideaExpansionSession?: IdeaExpansionSession
  impactAnalyses?: ImpactAnalysis[]
  modules: {
    active: Array<{ id: string; version: string; enabledAtRevision: number; config: Record<string, unknown> }>
    dismissed: string[]
    localManifests: ModuleManifest[]
  }
  metadata: Record<string, unknown>
}

export interface ModuleManifest {
  id: string
  version: string
  name: string
  description: string
  category: 'core' | 'software' | 'quality' | 'research' | 'business' | 'content'
  dependencies: string[]
  conflicts: string[]
  triggers: string[]
  contributions: { requiredSections: string[]; suggestedSections: string[]; reviewerRuleIds: string[]; exportDocumentIds: string[] }
}

export interface ProjectRepository {
  list(): Promise<ProjectStateV4[]>
  get(id: string): Promise<ProjectStateV4 | null>
  save(project: ProjectStateV4): Promise<ProjectStateV4>
  archive(id: string): Promise<boolean>
  remove?(id: string): Promise<void>
}

export interface AIProvider {
  id: string
  label: string
  capabilities: { structured: boolean; streaming: boolean; local: boolean; contextWindow?: number }
  generateText(prompt: string, credential?: string): Promise<string>
  generateStructured<T>(prompt: string, schemaName: string, credential?: string): Promise<T>
}

export interface PlanExporter {
  id: string
  label: string
  export(project: ProjectStateV4, revision?: number | 'current'): Promise<Record<string, string>>
}
