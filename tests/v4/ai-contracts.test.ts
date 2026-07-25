import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TASK_REGISTRY, getTaskDefinition } from '../../src/v4/ai/registry.js';
import { ideaLabSchema, discoverySchema, IDEA_LAB_SCHEMA_ID, DISCOVERY_SCHEMA_ID } from '../../src/v4/ai-schemas.js';
import { validateSuggestionResponse } from '../../src/v4/ai-context.js';

describe('Category 2: AI & Prompt Architecture Contracts', () => {
  it('TASK_REGISTRY defines task definitions with explicit schema IDs and versions', () => {
    assert.ok(TASK_REGISTRY['discovery'], 'Discovery task registered');
    assert.ok(TASK_REGISTRY['approach-generation'], 'Approach generation task registered');
    assert.equal(TASK_REGISTRY['approach-generation'].schemaId, IDEA_LAB_SCHEMA_ID);
    assert.equal(TASK_REGISTRY['discovery'].schemaId, DISCOVERY_SCHEMA_ID);
  });

  it('validateSuggestionResponse validates IdeaLab output using ideaLabSchema without throwing', () => {
    const validIdeaLabPayload = {
      approaches: [
        {
          id: 'approach-1',
          title: 'Sade Web MVP',
          description: 'Monolitik hızlı başlangıç',
          pros: ['Hızlı', 'Sade'],
          cons: ['Ölçek sınırı'],
          risks: ['Tek nokta yükü'],
          effort: 'low',
          impact: 'medium',
          recommended: true
        },
        {
          id: 'approach-2',
          title: 'Modüler API-First',
          description: 'Katmanlı SaaS',
          pros: ['Esnek'],
          cons: ['Tasarım yükü'],
          risks: ['Katmanlaşma'],
          effort: 'medium',
          impact: 'high',
          recommended: false
        }
      ],
      ideaNotes: ['Çekirdek değer'],
      candidateDecisions: ['Modüler mimari'],
      candidateRisks: ['Ölçeklenme']
    };

    const parsed = validateSuggestionResponse(validIdeaLabPayload, ideaLabSchema);
    assert.ok(parsed, 'IdeaLab response parsed successfully');
    assert.equal(parsed.approaches.length, 2);
    assert.equal(parsed.approaches[0].title, 'Sade Web MVP');
  });
});
