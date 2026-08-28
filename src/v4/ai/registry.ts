import { discoveryTask } from './tasks/discovery.js';
import { ideaLabTask } from './tasks/idea-lab.js';
import { ideaExpansionTask } from './tasks/idea-expansion.js';
import { ideaAxesTask } from './tasks/idea-axes.js';
import { ideaFoundationTask } from './tasks/idea-foundation.js';
import { regenerateAffectedSectionsTask } from './tasks/regenerate-affected-sections.js';
import { solutionDiscoveryTask } from './tasks/solution-discovery.js';

export type AITaskType = 'discovery' | 'idea-lab' | 'idea-expansion' | 'idea-axes' | 'idea-foundation' | 'regenerate-affected-sections' | 'solution-discovery';
export type AITaskDefinition =
  | typeof discoveryTask
  | typeof ideaLabTask
  | typeof ideaExpansionTask
  | typeof ideaAxesTask
  | typeof ideaFoundationTask
  | typeof regenerateAffectedSectionsTask
  | typeof solutionDiscoveryTask;

export const TASK_REGISTRY: Record<AITaskType, AITaskDefinition> = {
  discovery: discoveryTask,
  'idea-lab': ideaLabTask,
  'idea-expansion': ideaExpansionTask,
  'idea-axes': ideaAxesTask,
  'idea-foundation': ideaFoundationTask,
  'regenerate-affected-sections': regenerateAffectedSectionsTask,
  'solution-discovery': solutionDiscoveryTask
};

export function getTaskDefinition(taskId: AITaskType): AITaskDefinition {
  return TASK_REGISTRY[taskId];
}
