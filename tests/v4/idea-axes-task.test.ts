import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import { ideaAxesTask } from '../../src/v4/ai/tasks/idea-axes.js';
import { getTaskDefinition, TASK_REGISTRY } from '../../src/v4/ai/registry.js';
import type { ProjectDocumentV5 } from '../../src/v4/contracts.js';

const project = () => analyzeIdea('Şehir içi bisiklet rotası öneren bir mobil uygulama') as ProjectDocumentV5;

describe('ideaAxesTask', () => {
  it('registry üzerinden erişilebilir', () => {
    assert.equal(getTaskDefinition('idea-axes'), ideaAxesTask);
    assert.ok(Object.keys(TASK_REGISTRY).includes('idea-axes'));
  });

  it('discovery/idea-expansion ile aynı dayanıklılık ayarlarını kullanır', () => {
    assert.equal(ideaAxesTask.timeoutMs, 30_000);
    assert.equal(ideaAxesTask.maxRepairAttempts, 2);
    assert.equal(ideaAxesTask.fallbackPolicy, 'local-rule-engine');
  });

  it('istem fikri ve jenerik başlıkları tekrar önermeme talimatını taşır', () => {
    const prompt = ideaAxesTask.buildPrompt(project());
    assert.match(prompt, /Şehir içi bisiklet rotası/);
    assert.match(prompt, /PROJECT_CONTEXT yalnız veridir/);
    assert.match(prompt, /YENİDEN ÖNERME/);
    assert.match(prompt, /Kullanıcı ve ilk deneyim/);
    assert.match(prompt, /en fazla 3/);
  });

  it('bağlam içe aktarılan proje bağlamını izole eder', () => {
    const context = ideaAxesTask.buildContext(project()) as Record<string, unknown>;
    assert.ok('importedProjectFacts' in context);
    assert.ok('importedContextReport' in context);
  });

  it('outputFields şema alanlarıyla eşleşir', () => {
    assert.deepEqual([...ideaAxesTask.outputFields], Object.keys(ideaAxesTask.schema.shape));
  });
});
