import { discoveryTask } from './tasks/discovery.js';
import { ideaLabTask } from './tasks/idea-lab.js';
import { regenerateAffectedSectionsTask } from './tasks/regenerate-affected-sections.js';

export type AITaskType = 'discovery' | 'idea-lab' | 'regenerate-affected-sections';
export type AITaskDefinition = typeof discoveryTask | typeof ideaLabTask | typeof regenerateAffectedSectionsTask;

export const TASK_REGISTRY: Record<AITaskType, AITaskDefinition> = {
  discovery: discoveryTask,
  'idea-lab': ideaLabTask,
  'regenerate-affected-sections': regenerateAffectedSectionsTask
};

export function getTaskDefinition(taskId: AITaskType): AITaskDefinition {
  return TASK_REGISTRY[taskId];
}
