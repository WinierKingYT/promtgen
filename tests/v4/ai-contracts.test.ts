import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TASK_REGISTRY, getTaskDefinition } from '../../src/v4/ai/registry.js';
import {
  discoveryAnswerExtractionSchema,
  DISCOVERY_ANSWER_EXTRACTION_SCHEMA_ID,
  ideaLabSchema,
  discoverySchema,
  IDEA_LAB_SCHEMA_ID,
  DISCOVERY_SCHEMA_ID
} from '../../src/v4/ai-schemas.js';
import { validateSuggestionResponse } from '../../src/v4/ai-context.js';

describe('Category 2: AI & Prompt Architecture Contracts', () => {
  it('TASK_REGISTRY defines task definitions with explicit schema IDs and versions', () => {
    assert.ok(TASK_REGISTRY['discovery'], 'Discovery task registered');
    assert.ok(TASK_REGISTRY['idea-lab'], 'Idea Lab task registered');
    assert.equal(TASK_REGISTRY['idea-lab'].schemaId, IDEA_LAB_SCHEMA_ID);
    assert.equal(TASK_REGISTRY['discovery'].schemaId, DISCOVERY_SCHEMA_ID);
    assert.equal(TASK_REGISTRY['discovery-answer-extraction'].schemaId, DISCOVERY_ANSWER_EXTRACTION_SCHEMA_ID);
    assert.equal(getTaskDefinition('discovery').buildPrompt instanceof Function, true);
    assert.equal(getTaskDefinition('idea-lab').buildContext instanceof Function, true);
  });

  it('validates AI answer extraction without accepting unknown fields', () => {
    const parsed = discoveryAnswerExtractionSchema.parse({
      fields: [{
        field: 'targetUser',
        value: 'Bireysel geliştirici',
        confidence: 82,
        rationale: 'Yanıtta açıkça belirtilmiş.'
      }],
      warnings: []
    });
    assert.equal(parsed.fields[0].field, 'targetUser');
    assert.throws(() => discoveryAnswerExtractionSchema.parse({
      fields: [{ field: 'unknown', value: 'x', confidence: 80, rationale: 'x' }],
      warnings: []
    }));
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

  describe('discoverySchema contracts', () => {
    const validDiscoveryPayload = {
      reply: 'Mimari değerlendirmem...',
      analysisNote: 'Bu projeye özgü efor ve risk analizi',
      summary: 'Proje mimarisi için 3 kritik karar',
      options: [
        {
          kind: 'feature',
          title: 'Özellik 1',
          description: 'Açıklama',
          pros: ['Artı'],
          cons: ['Eksi'],
          effort: 'low',
          impact: 'high',
          affectedSections: ['scope'],
          recommended: true
        },
        {
          kind: 'decision',
          title: 'Özellik 2',
          description: 'Açıklama',
          pros: ['Artı'],
          cons: ['Eksi'],
          effort: 'medium',
          impact: 'medium',
          affectedSections: ['architecture'],
          recommended: false
        },
        {
          kind: 'risk',
          title: 'Özellik 3',
          description: 'Açıklama',
          pros: ['Artı'],
          cons: ['Eksi'],
          effort: 'high',
          impact: 'low',
          affectedSections: ['risks'],
          recommended: false
        }
      ],
      openQuestions: ['Soru 1?']
    };

    it('validates complete discovery payload with reply and analysisNote', () => {
      const parsed = validateSuggestionResponse(validDiscoveryPayload, discoverySchema);
      assert.equal(parsed.reply, 'Mimari değerlendirmem...');
      assert.equal(parsed.analysisNote, 'Bu projeye özgü efor ve risk analizi');
      assert.equal(parsed.summary, 'Proje mimarisi için 3 kritik karar');
      assert.equal(parsed.options.length, 3);
      assert.equal(parsed.openQuestions.length, 1);
    });

    it('provides defaults for missing reply and analysisNote', () => {
      const { reply, analysisNote, ...payloadWithoutOptional } = validDiscoveryPayload;
      const parsed = validateSuggestionResponse(payloadWithoutOptional, discoverySchema);
      assert.equal(parsed.reply, '', 'reply defaults to empty string');
      assert.equal(parsed.analysisNote, '', 'analysisNote defaults to empty string');
    });

    it('rejects discovery payload with invalid affectedSections', () => {
      const invalid = {
        ...validDiscoveryPayload,
        options: validDiscoveryPayload.options.map(o => ({
          ...o,
          affectedSections: ['unknown_section']
        }))
      };
      assert.throws(() => validateSuggestionResponse(invalid, discoverySchema));
    });

    it('rejects discovery payload with too few options', () => {
      const invalid = {
        ...validDiscoveryPayload,
        options: validDiscoveryPayload.options.slice(0, 2)
      };
      assert.throws(() => validateSuggestionResponse(invalid, discoverySchema));
    });

    it('rejects discovery payload with empty summary', () => {
      const invalid = { ...validDiscoveryPayload, summary: '' };
      assert.throws(() => validateSuggestionResponse(invalid, discoverySchema));
    });

    it('rejects discovery payload with summary exceeding 1200 chars', () => {
      const invalid = { ...validDiscoveryPayload, summary: 'x'.repeat(1201) };
      assert.throws(() => validateSuggestionResponse(invalid, discoverySchema));
    });
  });
});
