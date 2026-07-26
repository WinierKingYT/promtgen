// Type declarations for src/v4/task-compiler.js
import { ProjectDocumentV5 } from './contracts.js';

export interface CompiledTask {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  effort: 'low' | 'medium' | 'high';
  status: 'backlog' | 'ready' | 'in_progress' | 'done';
  requirementIds: string[];
  acceptanceCriteria: string[];
  verificationIds: string[];
  dependencies: string[];
}

export interface CompiledTestCase {
  id: string;
  title: string;
  kind: 'acceptance' | 'integration' | 'unit';
  steps: string[];
  expectedResult: string;
  requirementIds: string[];
  status: 'draft' | 'ready';
}

export interface CompiledMilestone {
  id: string;
  title: string;
  outcome: string;
  taskIds: string[];
  status: 'planned' | 'in_progress' | 'done';
}

export interface CompiledTraceLink {
  id: string;
  fromType: 'requirement' | 'task' | 'test';
  fromId: string;
  toType: 'task' | 'test';
  toId: string;
  relation: 'implements' | 'validated_by';
}

export interface CompiledAgentPrompt {
  id: string;
  role: 'planner' | 'implementer' | 'reviewer' | 'verifier';
  title: string;
  taskIds: string[];
  dependsOnPromptIds: string[];
  instructions: string;
  expectedOutputs: string[];
  status: 'ready' | 'pending';
}

export interface TaskCompilationResult {
  baseRevision: number;
  tasks: CompiledTask[];
  testCases: CompiledTestCase[];
  milestones: CompiledMilestone[];
  traceLinks: CompiledTraceLink[];
  agentPrompts: CompiledAgentPrompt[];
  warnings: string[];
}

export interface ApplyResult {
  success: boolean;
  project: ProjectDocumentV5;
  reason: string;
  warnings?: string[];
}

export function compileTaskPlan(project: ProjectDocumentV5): TaskCompilationResult;
export function applyCompiledTaskPlan(project: ProjectDocumentV5, compilation: TaskCompilationResult, options?: { approved?: boolean }): ApplyResult;
export function assertValidCompilation(result: TaskCompilationResult): void;
export function topologicalOrder(tasks: { id: string; dependencies: string[] }[]): { ordered: { id: string; dependencies: string[] }[]; cycles: string[] };
