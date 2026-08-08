import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createProvider as compatibilityCreateProvider } from '../../../src/v4/ai-context.js';
import { createProvider as productionCreateProvider } from '../../../src/v4/ai/provider-adapters.js';
import { runRegisteredAITask } from '../../../src/v4/ai/runtime.js';
import { createProjectDocument } from '../../../src/v4/project-document.js';

const root = resolve(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('AI production runtime ownership', () => {
  it('keeps ai-context as an export-only compatibility boundary', () => {
    const source = read('src/v4/ai-context.js');
    assert.equal(compatibilityCreateProvider, productionCreateProvider);
    assert.doesNotMatch(source, /\b(?:class|function)\s+\w+/);
    assert.match(source, /Compatibility boundary/);
  });

  it('keeps the transitional discovery facade away from provider and runtime ownership', () => {
    const source = read('src/v4/ai-discovery.js');
    assert.doesNotMatch(source, /from ['"].*ai-context/);
    assert.doesNotMatch(source, /\bcreateProvider\s*\(/);
    assert.doesNotMatch(source, /\brunAITask\s*\(/);
    assert.doesNotMatch(source, /\brunRegisteredAITask\s*\(/);
    assert.doesNotMatch(source, /\b(?:class|function)\s+\w+/);
    assert.match(source, /export \* from ['"]\.\/application\/idea-planning-api\.ts['"]/);

    const apiSource = read('src/v4/application/idea-planning-api.ts');
    assert.match(apiSource, /generateDiscoveryBundleService/);
    assert.match(apiSource, /generateIdeaLabBundleService/);
  });

  it('lets typed application services call only the registered AI runtime', () => {
    for (const path of [
      'src/v4/application/discovery-generation-service.ts',
      'src/v4/application/idea-lab-generation-service.ts',
      'src/v4/application/section-regeneration-service.ts',
      'src/v4/application/idea-expansion-service.ts'
    ]) {
      const source = read(path);
      assert.doesNotMatch(source, /from ['"].*ai-context/);
      assert.doesNotMatch(source, /\bcreateProvider\s*\(/);
      assert.doesNotMatch(source, /\brunAITask\s*\(/);
      assert.match(source, /runRegisteredAITask/);
    }
  });

  it('keeps React and production benchmarks off the discovery compatibility facade', () => {
    for (const path of [
      'src/react/Workspace.tsx',
      'src/react/hooks/useProjectState.ts',
      'src/react/components/PlanningScenarioPanel.tsx',
      'src/react/components/ProviderSettingsDialog.tsx',
      'src/v4/benchmarks/discovery-benchmark.ts'
    ]) {
      assert.doesNotMatch(read(path), /from ['"][^'"]*ai-discovery(?:\.js)?['"]/);
    }
  });

  it('keeps the primary idea and provider UI boundaries free of explicit any types', () => {
    for (const path of [
      'src/react/hooks/useProjectState.ts',
      'src/react/Workspace.tsx',
      'src/react/components/StartScreen.tsx',
      'src/react/components/ProjectInventoryModal.tsx',
      'src/react/components/RevisionHistoryDialog.tsx',
      'src/react/components/ProviderSettingsDialog.tsx',
      'src/react/components/WorkspaceChrome.tsx',
      'src/v4/planning-engine.d.ts'
    ]) {
      assert.doesNotMatch(read(path), /\bany\b/);
    }
  });

  it('keeps the typed inventory flow while the minimal recent-project list stays in production', () => {
    const startScreen = read('src/react/components/StartScreen.tsx');
    assert.match(startScreen, /from ['"]\.\/ProjectInventoryModal\.js['"]/);
    assert.match(startScreen, /<ProjectInventoryModal/);
    assert.match(startScreen, /pg-onboarding-projects/);
    assert.doesNotMatch(read('src/v4/portfolio-engine.d.ts'), /\bany\b/);
  });

  it('selects a registered task and records normalized provider provenance', async () => {
    const project = createProjectDocument({
      idea: 'Yerel geliştiriciler için kapsamı netleştiren planlama aracı',
      name: 'Runtime ownership'
    });
    const provider = {
      model: 'registry-mock',
      async structured(input: { schema: { parse(value: unknown): unknown } }) {
        return input.schema.parse({
          reply: 'Üç karar alanı belirledim.',
          analysisNote: 'Kapsam ve riskler karşılaştırıldı.',
          summary: 'Sıradaki kararlar',
          options: [1, 2, 3].map(index => ({
            kind: 'decision',
            title: `Karar ${index}`,
            description: `Karar ${index} açıklaması`,
            pros: ['Artı'],
            cons: ['Eksi'],
            effort: 'medium',
            impact: 'high',
            affectedSections: ['scope'],
            recommended: index === 1
          })),
          openQuestions: []
        });
      }
    };
    const result = await runRegisteredAITask<{ summary: string }>('discovery', {
      project,
      settings: {
        providerId: 'openai',
        model: 'registry-mock',
        baseUrl: 'https://ignored.example/v1',
        useAiWhenAvailable: true,
        useLocalMemory: false
      },
      provider
    });
    assert.equal(result.output.summary, 'Sıradaki kararlar');
    assert.equal(result.provenance.providerId, 'openai');
    assert.equal(result.provenance.model, 'registry-mock');
    assert.equal(result.provenance.schemaId, 'discovery-v1');
    assert.match(result.provenance.inputHash, /^[a-f0-9]{64}$/);
  });

  it('keeps the idea expansion task away from canonical write paths', () => {
    const task = read('src/v4/ai/tasks/idea-expansion.ts');
    // Görev yalnız istem ve bağlam üretir; plana yazan hiçbir modülü tanımaz.
    assert.doesNotMatch(task, /planning-engine/);
    assert.doesNotMatch(task, /idea-plan-conversion-service/);
    assert.doesNotMatch(task, /canonical-entities/);

    const intake = read('src/v4/application/idea-expansion-intake.ts');
    assert.doesNotMatch(intake, /confirmConceptSummary|applyApprovedChanges/);
    assert.match(intake, /status: 'pending'/);
  });
});
