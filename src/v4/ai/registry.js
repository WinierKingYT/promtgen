import { discoverySchema, DISCOVERY_SCHEMA_ID, ideaLabSchema, IDEA_LAB_SCHEMA_ID, architectureReviewSchema, ARCHITECTURE_REVIEW_SCHEMA_ID } from '../ai-schemas.js';

export const TASK_REGISTRY = {
  discovery: {
    id: 'discovery',
    promptVersion: '1.0.0',
    schemaId: DISCOVERY_SCHEMA_ID,
    schema: discoverySchema,
    description: 'Ham fikri keşif önerileri ve belirsizlik soruları ile derinleştirir.'
  },
  'approach-generation': {
    id: 'approach-generation',
    promptVersion: '1.0.0',
    schemaId: IDEA_LAB_SCHEMA_ID,
    schema: ideaLabSchema,
    description: 'Fikir Laboratuvarı için 3 alternatif mimari yaklaşım ve metrik matrisi üretir.'
  },
  'architecture-review': {
    id: 'architecture-review',
    promptVersion: '1.0.0',
    schemaId: ARCHITECTURE_REVIEW_SCHEMA_ID,
    schema: architectureReviewSchema,
    description: 'Planın mimari çelişkilerini, risklerini ve kalite skorunu değerlendirir.'
  }
};

export function getTaskDefinition(taskId) {
  return TASK_REGISTRY[taskId] || TASK_REGISTRY.discovery;
}
