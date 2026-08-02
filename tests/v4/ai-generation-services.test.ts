import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createProjectDocument } from '../../src/v4/project-document.js';
import { generateDiscoveryBundleService } from '../../src/v4/application/discovery-generation-service.js';
import { generateIdeaLabBundleService } from '../../src/v4/application/idea-lab-generation-service.js';
import { getDefaultProviderSettings } from '../../src/v4/provider-settings.js';

const offlineSettings = {
  ...getDefaultProviderSettings(),
  providerId: 'offline',
  useAiWhenAvailable: false
};

describe('typed AI generation application services', () => {
  it('uses the injected local discovery policy without invoking a provider', async () => {
    const project = createProjectDocument({
      idea: 'Bireysel geliştiriciler için local-first planlama aracı',
      name: 'Discovery service'
    });
    const result = await generateDiscoveryBundleService(
      project,
      { settings: offlineSettings, direction: 'MVP kapsamını netleştir' },
      {
        createFallback: (candidate, direction) => ({
          id: 'bundle-local',
          title: direction,
          phase: candidate.lifecycle.activePhase,
          status: 'open',
          createdAt: '2026-07-29T00:00:00.000Z',
          items: [],
          source: { type: 'local', providerId: 'offline' }
        }),
        mapProviderOutput: () => null
      }
    );

    assert.equal(result.usedFallback, true);
    assert.equal(result.bundle.title, 'MVP kapsamını netleştir');
    assert.equal(result.bundle.source?.type, 'local');
  });

  it('writes local Idea Lab output and provenance into a cloned project', async () => {
    const project = createProjectDocument({
      idea: 'Küçük ekipler için görev yönetimi uygulaması',
      name: 'Idea Lab service'
    });
    const result = await generateIdeaLabBundleService(
      project,
      { settings: offlineSettings },
      () => ({
        approaches: [
          {
            id: 'focused-mvp',
            title: 'Odaklı MVP',
            description: 'Tek kullanıcı akışına odaklanır.',
            pros: ['Hızlı doğrulama'],
            cons: ['Dar kapsam'],
            risks: ['Yanlış persona'],
            effort: 'low',
            impact: 'high',
            recommended: true
          },
          {
            id: 'modular',
            title: 'Modüler yaklaşım',
            description: 'Genişlemeyi modüllerle sınırlar.',
            pros: ['Sürdürülebilir'],
            cons: ['İlk tasarım eforu'],
            risks: ['Aşırı soyutlama'],
            effort: 'medium',
            impact: 'high',
            recommended: false
          }
        ],
        ideaNotes: ['Önce problem doğrulansın'],
        candidateDecisions: ['MVP kapsamı dar tutulacak'],
        candidateRisks: ['Persona belirsizliği']
      })
    );

    assert.notEqual(result.project, project);
    assert.equal(result.project.lifecycle.activePhase, 'IDEA_LAB');
    assert.equal(result.project.ideaLabSession?.provenance?.mode, 'rule-engine');
    assert.equal(result.approaches[0].id, 'focused-mvp');
  });
});
