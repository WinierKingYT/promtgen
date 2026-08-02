export type PlanningDepthLevel = 'quick' | 'standard' | 'advanced' | 'enterprise'
export type ProjectLifecycleStatus = 'active' | 'finalized' | 'archived'
export type PlanningPhase = 'IDEA_EXPANSION' | 'DISCOVERY' | 'IDEA_LAB' | 'CONCEPT_CONFIRMATION' | 'SHAPING' | 'DESIGN' | 'PLANNING' | 'REVIEW' | 'READY'
export type SuggestionStatus = 'pending' | 'accepted' | 'edited' | 'deferred' | 'rejected'
export type PlanSectionStatus = 'empty' | 'draft' | 'ready' | 'stale'

  export interface GenerationProvenance {
    runId: string
    mode: 'cloud-ai' | 'local-ai' | 'rule-engine' | 'fallback'
    providerId: string | null
    model: string | null
    promptVersion: string
    requestedAt: string
    completedAt: string
    latencyMs: number
    retryCount: number
    fallbackReason: string | null
    schemaId: string
    schemaVersion: number
    inputHash: string
  }

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
  targetUser: string
  problemStatement: string
  currentAlternative: string
  desiredOutcome: string
  interpretationConfidence: number
  confidenceRationale: string[]
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

export type IdeaDocumentSnapshot = Pick<
  ConceptSummary,
  'summary' | 'targetUser' | 'problemStatement' | 'currentAlternative' | 'desiredOutcome' |
  'confirmedFeatures' | 'outOfScope' | 'technicalApproaches' | 'openQuestions' | 'knownRisks' | 'mvpTarget'
>

export interface IdeaDocumentRevision {
  id: string
  number: number
  documentRevision: number
  canonicalRevision: number
  createdAt: string
  summary: string
  source: 'initial' | 'edit' | 'discovery' | 'restore'
  status: 'draft' | 'converted' | 'superseded'
  convertedCanonicalRevision: number | null
  restoredFromRevision: number | null
  snapshot: IdeaDocumentSnapshot
}

export interface PlanAlignment {
  status: 'aligned' | 'stale' | 'review_required'
  sourceIdeaRevisionId: string | null
  sourceIdeaRevisionNumber: number | null
  currentIdeaRevisionId: string | null
  currentIdeaRevisionNumber: number | null
  changedFields: Array<keyof IdeaDocumentSnapshot>
  affectedSections: string[]
  reason: string
  detectedAt: string | null
  reviewedAt: string | null
  deferredAt: string | null
}

export interface IdeaLabSession {
  status: 'active' | 'concept_ready' | 'confirmed'
  approaches: DesignApproach[]
  selectedApproachId?: string
  ideaNotes: string[]
  candidateDecisions: string[]
  candidateRisks: string[]
  provenance?: GenerationProvenance
  conceptSummary?: ConceptSummary
}

export type IdeaDiscussionMode = 'explore' | 'challenge' | 'compare' | 'clarify'
export type IdeaRecordKind = 'decision' | 'hypothesis' | 'risk' | 'question'
export type IdeaRecordStatus = 'pending' | 'accepted' | 'deferred' | 'rejected'

export interface IdeaRecordRevision {
  editedAt: string
  text: string
  note: string
  answer: string
  rationale: string
  validationPlan: string
}

export interface IdeaDiscussionRecord {
  id: string
  kind: IdeaRecordKind
  text: string
  originalText: string
  note: string
  answer: string
  rationale: string
  validationPlan: string
  history: IdeaRecordRevision[]
  status: IdeaRecordStatus
  sourceBundleId: string
  sourceMessageId: string
  createdAt: string
  resolvedAt?: string
}

export interface IdeaDiscussionState {
  mode: IdeaDiscussionMode
  records: IdeaDiscussionRecord[]
  updatedAt: string
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
  baseCanonicalRevision: number
  sourceScenarioId?: string
  sourceKind?: 'user_request' | 'idea_alignment'
  sourceIdeaRevisionId?: string
  currentIdeaRevisionId?: string
  userRequest: string
  summary: string
  affectedSections: string[]
  changedEntityIds: string[]
  entityEffects: Array<{
    sourceEntityId: string
    sourceType: string
    targetEntityId: string
    targetType: string
    targetLabel: string
    effect: 'invalidate' | 'stale' | 'regenerate' | 'review' | 'no_action'
    severity: 'low' | 'medium' | 'high' | 'critical'
    depth: number
  }>
  effectSummary: {
    total: number
    byEffect: Record<string, number>
    bySeverity: Record<string, number>
  }
  newTasks: string[]
  architectureImpact: string
  newRisks: string[]
  contradictions: string[]
  contradictionDetails: Array<{
    decisionId: string
    decisionTitle: string
    decisionText: string
    resolution: 'supersede' | 'keep' | null
  }>
  preview: {
    nextCanonicalRevision: number
    requirementCount: number
    taskCount: number
    testCount: number
    riskCount: number
    traceLinkCount: number
  }
  status: 'proposed' | 'accepted' | 'rejected' | 'stale'
  createdAt: string
  resolvedAt: string | null
}

export interface PlanningScenarioDecision {
  id: string
  title: string
  decision: string
  rationale: string
  affectedSectionIds: string[]
  dependencies: string[]
}

export interface PlanningScenarioComparison {
  effortScore: number
  riskScore: number
  readinessDelta: number
  affectedSectionIds: string[]
  dependencies: string[]
}

export interface PlanningScenario {
  id: string
  name: string
  description: string
  baseCanonicalRevision: number
  decisions: PlanningScenarioDecision[]
  comparison: PlanningScenarioComparison
  status: 'draft' | 'selected' | 'discarded' | 'merged'
  createdAt: string
  updatedAt: string
  mergedAt: string | null
  impactAnalysisId: string | null
}

export interface SectionPatchProposal {
  id: string
  impactAnalysisId: string
  baseCanonicalRevision: number
  sectionId: string
  originalContent: string
  proposedContent: string
  editedContent: string
  rationale: string
  warnings: string[]
  status: 'pending' | 'accepted' | 'edited' | 'deferred' | 'rejected' | 'stale'
  provenance: GenerationProvenance
  createdAt: string
  resolvedAt: string | null
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

export interface TaskContractV2 {
  version: 2
  objective: string
  inScope: string[]
  outOfScope: string[]
  filePolicy: {
    status: 'requires_inventory' | 'inferred' | 'confirmed'
    allowedPaths: string[]
    forbiddenPaths: string[]
  }
  verification: {
    testCaseIds: string[]
    commands: string[]
    requiresCommandDiscovery: boolean
  }
  expectedOutputs: string[]
  completionEvidence: string[]
  rollbackPlan: string
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
  contract: TaskContractV2
}

export interface ImplementationEvidencePackage {
  id: string
  taskId: string
  baseCanonicalRevision: number
  source: 'manual' | 'codex' | 'cursor' | 'claude-code' | 'other'
  summary: string
  changedFiles: Array<{
    path: string
    changeType: 'added' | 'modified' | 'deleted'
    note: string
  }>
  testRuns: Array<{
    command: string
    status: 'passed' | 'failed' | 'not_run'
    outputSummary: string
  }>
  acceptanceEvidence: Array<{
    criterion: string
    status: 'met' | 'not_met' | 'unclear'
    evidence: string
  }>
  remainingIssues: string[]
  rollbackNotes: string
  review: {
    outcome: 'ready_for_approval' | 'needs_changes' | 'blocked'
    findings: string[]
    reviewedAt: string
    reviewerNote: string
  }
  status: 'review_required' | 'accepted' | 'rejected' | 'stale'
  createdAt: string
  resolvedAt: string | null
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
  canonicalRevision: number
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
  provenance?: GenerationProvenance
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

export type ReadinessDimension = 'completeness' | 'consistency' | 'traceability' | 'riskCoverage' | 'implementationReadiness'

export interface ReadinessCheck {
  id: string
  dimension: ReadinessDimension
  label: string
  status: 'passed' | 'warning' | 'blocked'
  earned: number
  possible: number
  message: string
  blocking: boolean
  entityIds: string[]
  sectionId?: string
  actionLabel?: string
  evidence?: {
    satisfied: number
    total: number
  }
}

export interface ReadinessAction {
  checkId: string
  label: string
  message: string
  priority: 'critical' | 'recommended'
  sectionId?: string
  entityIds: string[]
  scoreImpact: number
}

export interface ReadinessDimensionEvidence {
  earned: number
  possible: number
  passed: number
  warning: number
  blocked: number
}

export interface ReadinessGateCondition {
  id: string
  label: string
  passed: boolean
  message: string
  checkIds: string[]
}

export interface ReadinessResult {
  version: 3
  calculationProfile: 'readiness-3.0' | 'legacy-unverified'
  status: 'blocked' | 'needs_review' | 'ready'
  score: number
  dimensions: {
    completeness: number
    consistency: number
    traceability: number
    riskCoverage: number
    implementationReadiness: number
  }
  dimensionWeights: Record<ReadinessDimension, number>
  dimensionLabels: Record<ReadinessDimension, string>
  dimensionEvidence: Record<ReadinessDimension, ReadinessDimensionEvidence>
  checks: ReadinessCheck[]
  nextActions: ReadinessAction[]
  qualityGate: {
    passed: boolean
    blockingCheckIds: string[]
    conditions: ReadinessGateCondition[]
  }
  blockers: string[]
  warnings: string[]
  evidenceHash: string
  calculatedAtRevision: number
}

export interface CommandLogRecord {
  commandId: string
  commandType: string
  expectedDocumentRevision: number
  committedDocumentRevision: number
  expectedCanonicalRevision: number
  committedCanonicalRevision: number
  createdAt: string
}

export interface PlanRevision {
  id: string
  number: number
  createdAt: string
  summary: string
  acceptedSuggestionIds: string[]
  affectedSections: string[]
  snapshot: Omit<ProjectDocumentV5, 'revisions'>
}

export interface ProjectDocumentV5 {
  schemaVersion: 5
  schemaRevision: 5
  id: string
  documentRevision: number
  canonicalRevision: number
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
  proposalStore: {
    bundles: SuggestionBundle[]
  }
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
  messages: Array<{
    id: string
    role: 'user' | 'assistant'
    content: string
    analysisNote?: string
    createdAt: string
    uncertainty?: string[]
    optionalPaths?: Array<{ title: string; reason: string; prompt: string }>
    nextQuestionText?: string
    nextQuestionStep?: string
  }>
  readiness: ReadinessResult
  revisions: PlanRevision[]
  exports: ExportRecord[]
  commandLog: CommandLogRecord[]
  dismissedSuggestionFingerprints: string[]
  ideaLabSession?: IdeaLabSession
  ideaDocumentRevisions: IdeaDocumentRevision[]
  sourceIdeaRevisionId: string | null
  sourceIdeaRevisionNumber: number | null
  planAlignment: PlanAlignment
  ideaDiscussion: IdeaDiscussionState
  ideaExpansionSession?: IdeaExpansionSession
  impactAnalyses?: ImpactAnalysis[]
  planningScenarios: PlanningScenario[]
  sectionPatchProposals: SectionPatchProposal[]
  implementationEvidencePackages: ImplementationEvidencePackage[]
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
  category: 'core' | 'software' | 'quality' | 'research' | 'business' | 'content' | 'operations' | 'event'
  dependencies: string[]
  conflicts: string[]
  triggers: string[]
  contributions: {
    requiredSections: string[]
    suggestedSections: string[]
    reviewerRuleIds: string[]
    exportDocumentIds: string[]
    domainPack?: DomainPackContribution
  }
}

export interface DomainPackDiscoveryQuestion {
  id: string
  prompt: string
  rationale: string
  affectedSectionId: string
  appliesWhen:
    | 'always'
    | 'accounts'
    | 'multi_tenant'
    | 'payments'
    | 'stored_data'
    | 'authentication'
    | 'external_clients'
    | 'async_operations'
    | 'rate_sensitive'
}

export interface DomainPackContribution {
  id: string
  maturity: 'candidate-stable' | 'stable' | 'beta' | 'experimental'
  projectTypes: string[]
  limitations: string[]
  discoveryQuestions: DomainPackDiscoveryQuestion[]
  requirementGuidance: Array<{
    id: string
    label: string
    keywords: string[]
    acceptanceExamples: string[]
  }>
  riskGuidance: Array<{
    id: string
    title: string
    appliesWhen: DomainPackDiscoveryQuestion['appliesWhen']
    mitigationPrompt: string
  }>
  taskContractGuidance: {
    expectedOutputs: string[]
    completionEvidence: string[]
  }
}

export interface ProjectSaveOptions {
  expectedDocumentRevision?: number
  expectedCanonicalRevision?: number
  createOnly?: boolean
}

export interface ProjectPurgeResult {
  projectDeleted: boolean
  checkpointsDeleted: number
  commandLogEntriesDeleted: number
  quarantineEntriesDeleted: number
  backupsDeleted: number
}

export interface ProjectRepository {
  list(): Promise<ProjectDocumentV5[]>
  get(id: string): Promise<ProjectDocumentV5 | null>
  save(project: ProjectDocumentV5, options?: ProjectSaveOptions): Promise<ProjectDocumentV5>
  archive(id: string): Promise<boolean>
  restore(id: string): Promise<boolean>
  purge(id: string): Promise<ProjectPurgeResult>
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
  export(project: ProjectDocumentV5, revision?: number | 'current'): Promise<Record<string, string>>
}
