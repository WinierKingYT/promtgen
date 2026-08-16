import { discoveryTask } from './tasks/discovery.js';
import { ideaLabTask } from './tasks/idea-lab.js';
import { ideaExpansionTask } from './tasks/idea-expansion.js';
import { regenerateAffectedSectionsTask } from './tasks/regenerate-affected-sections.js';
import { solutionDiscoveryTask } from './tasks/solution-discovery.js';

export type AITaskType = 'discovery' | 'idea-lab' | 'idea-expansion' | 'regenerate-affected-sections' | 'solution-discovery';
export type AITaskDefinition =
  | typeof discoveryTask
  | typeof ideaLabTask
  | typeof ideaExpansionTask
  | typeof regenerateAffectedSectionsTask
  | typeof solutionDiscoveryTask;

export const TASK_REGISTRY: Record<AITaskType, AITaskDefinition> = {
  discovery: discoveryTask,
  'idea-lab': ideaLabTask,
  'idea-expansion': ideaExpansionTask,
  'regenerate-affected-sections': regenerateAffectedSectionsTask,
  'solution-discovery': solutionDiscoveryTask
};

export function getTaskDefinition(taskId: AITaskType): AITaskDefinition {
  return TASK_REGISTRY[taskId];
}
