import { discoveryTask } from './tasks/discovery.js';
import { ideaLabTask } from './tasks/idea-lab.js';

export type AITaskType = 'discovery' | 'idea-lab';
export type AITaskDefinition = typeof discoveryTask | typeof ideaLabTask;

export const TASK_REGISTRY: Record<AITaskType, AITaskDefinition> = {
  discovery: discoveryTask,
  'idea-lab': ideaLabTask
};

export function getTaskDefinition(taskId: AITaskType): AITaskDefinition {
  return TASK_REGISTRY[taskId];
}
