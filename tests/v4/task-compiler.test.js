import assert from 'node:assert/strict';
import { createProjectStateV4 } from '../../src/v4/project-state-v4.js';
import { normalizeRequirement } from '../../src/v4/canonical-entities.js';
import { applyCompiledTaskPlan, compileTaskPlan, topologicalOrder } from '../../src/v4/task-compiler.js';

const project = createProjectStateV4({ idea: 'Yerel çalışan bir planlama uygulaması' });
project.requirements = [
    normalizeRequirement({ id: 'req-local', title: 'Yerel kayıt', statement: 'Projeler cihazda saklanmalı', priority: 'must', acceptanceCriteria: ['Çevrimdışı kaydedilir', 'Yeniden açılabilir'] }),
    normalizeRequirement({ id: 'req-export', title: 'Plan exportu', statement: 'Plan Markdown olarak çıkarılmalı', priority: 'should', acceptanceCriteria: ['Dosya indirilebilir'] })
];
const compilation = compileTaskPlan(project);
assert.equal(compilation.tasks.length, 2);
assert.equal(compilation.testCases.length, 2);
assert.deepEqual(compilation.agentPrompts.map(prompt => prompt.role), ['planner', 'implementer', 'reviewer', 'verifier']);
assert.equal(compilation.traceLinks.length, 4);

const waiting = applyCompiledTaskPlan(project, compilation);
assert.equal(waiting.success, false);
assert.match(waiting.reason, /onayı/);
const stale = applyCompiledTaskPlan({ ...project, revision: 2 }, compilation, { approved: true });
assert.equal(stale.success, false);
assert.match(stale.reason, /revision/);
const applied = applyCompiledTaskPlan(project, compilation, { approved: true });
assert.equal(applied.success, true);
assert.equal(applied.project.revision, 2);
assert.equal(applied.project.revisions.at(-1).snapshot.tasks.length, 2);

const ordered = topologicalOrder([
    { id: 'deploy', dependencies: ['build'] },
    { id: 'build', dependencies: [] }
]);
assert.deepEqual(ordered.ordered.map(task => task.id), ['build', 'deploy']);
assert.deepEqual(ordered.cycles, []);
console.log('✓ V4 task compiler and approval gate');
