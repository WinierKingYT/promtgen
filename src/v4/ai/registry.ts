import { discoveryTask } from './tasks/discovery.js';
import { ideaLabTask } from './tasks/idea-lab.js';
import { regenerateAffectedSectionsTask } from './tasks/regenerate-affected-sections.js';
import { discoveryAnswerExtractionTask } from './tasks/discovery-answer-extraction.js';

export type AITaskType = 'discovery' | 'idea-lab' | 'regenerate-affected-sections' | 'discovery-answer-extraction';
export type AITaskDefinition = typeof discoveryTask | typeof ideaLabTask | typeof regenerateAffectedSectionsTask | typeof discoveryAnswerExtractionTask;

export const TASK_REGISTRY: Record<AITaskType, AITaskDefinition> = {
  discovery: discoveryTask,
  'idea-lab': ideaLabTask,
  'regenerate-affected-sections': regenerateAffectedSectionsTask,
  'discovery-answer-extraction': discoveryAnswerExtractionTask
};

export function getTaskDefinition(taskId: AITaskType): AITaskDefinition {
  return TASK_REGISTRY[taskId];
}
