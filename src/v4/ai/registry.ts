import { discoveryTask } from './tasks/discovery.js';
import { ideaLabTask } from './tasks/idea-lab.js';
import { ideaExpansionTask } from './tasks/idea-expansion.js';
import { regenerateAffectedSectionsTask } from './tasks/regenerate-affected-sections.js';

export type AITaskType = 'discovery' | 'idea-lab' | 'idea-expansion' | 'regenerate-affected-sections';
export type AITaskDefinition =
  | typeof discoveryTask
  | typeof ideaLabTask
  | typeof ideaExpansionTask
  | typeof regenerateAffectedSectionsTask;

export const TASK_REGISTRY: Record<AITaskType, AITaskDefinition> = {
  discovery: discoveryTask,
  'idea-lab': ideaLabTask,
  'idea-expansion': ideaExpansionTask,
  'regenerate-affected-sections': regenerateAffectedSectionsTask
};

export function getTaskDefinition(taskId: AITaskType): AITaskDefinition {
  return TASK_REGISTRY[taskId];
}
