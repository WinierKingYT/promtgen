import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as compatibilitySchemas from '../../../src/v4/ai-schemas.js';
import * as productionSchemas from '../../../src/v4/ai/schemas/schemas.js';
import { TASK_REGISTRY } from '../../../src/v4/ai/registry.js';
import { createProjectDocument } from '../../../src/v4/project-document.js';

const root = resolve(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const registeredTaskIds = [
  'discovery',
  'idea-lab',
  'regenerate-affected-sections'
] as const;

describe('AI schema ownership and prompt parity', () => {
  it('keeps ai-schemas.js as an export-only compatibility facade', () => {
    const source = read('src/v4/ai-schemas.js');
    assert.doesNotMatch(source, /\bz\.(?:object|array|enum|union)\s*\(/);
    assert.match(source, /export \* from ['"]\.\/ai\/schemas\/schemas\.ts['"]/);
    assert.equal(compatibilitySchemas.discoverySchema, productionSchemas.discoverySchema);
    assert.equal(compatibilitySchemas.ideaLabSchema, productionSchemas.ideaLabSchema);
    assert.equal(
      compatibilitySchemas.architectureReviewSchema,
      productionSchemas.architectureReviewSchema
    );
    assert.equal(
      compatibilitySchemas.sectionRegenerationSchema,
      productionSchemas.sectionRegenerationSchema
    );
  });

  it('prevents production AI modules from importing the compatibility schema facade', () => {
    for (const path of [
      'src/v4/ai-discovery.js',
      'src/v4/ai/provider-adapters.ts',
      'src/v4/ai/tasks/discovery.ts',
      'src/v4/ai/tasks/idea-lab.ts',
      'src/v4/ai/tasks/regenerate-affected-sections.ts'
    ]) {
      const source = read(path);
      assert.doesNotMatch(source, /from ['"][^'"]*ai-schemas(?:\.js)?['"]/);
    }
  });

  it('keeps each task prompt field list identical to its strict output schema', () => {
    const project = createProjectDocument({
      idea: 'Bireysel geliştiriciler için local-first proje planlama aracı',
      name: 'Schema parity'
    });

    for (const taskId of registeredTaskIds) {
      const task = TASK_REGISTRY[taskId];
      const schemaFields = Object.keys(task.schema.shape).sort();
      const declaredFields = [...task.outputFields].sort();
      assert.deepEqual(declaredFields, schemaFields, `${taskId} outputFields drifted from its schema`);

      const prompt = task.buildPrompt(project);
      for (const field of declaredFields) {
        assert.match(prompt, new RegExp(`"${field}"\\s*:`), `${taskId} prompt omits ${field}`);
      }
    }
  });
});
