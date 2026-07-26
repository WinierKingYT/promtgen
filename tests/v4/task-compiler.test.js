import assert from 'node:assert/strict';
import { createProjectDocument } from '../../src/v4/project-document.js';
import { normalizeRequirement } from '../../src/v4/canonical-entities.js';
import { applyCompiledTaskPlan, compileTaskPlan, topologicalOrder, assertValidCompilation } from '../../src/v4/task-compiler.js';

const project = createProjectDocument({ idea: 'Yerel çalışan bir planlama uygulaması' });
project.requirements = [
    normalizeRequirement({ id: 'req-local', title: 'Yerel kayıt', statement: 'Projeler cihazda saklanmalı', priority: 'must', acceptanceCriteria: ['Çevrimdışı kaydedilir', 'Yeniden açılabilir'], status: 'accepted' }),
    normalizeRequirement({ id: 'req-export', title: 'Plan exportu', statement: 'Plan Markdown olarak çıkarılmalı', priority: 'should', acceptanceCriteria: ['Dosya indirilebilir'], status: 'accepted' }),
    { ...normalizeRequirement({ id: 'req-proposed', title: 'Henüz onaysız özellik', statement: 'Kullanıcı kabul etmedi.', acceptanceCriteria: ['Onay gerekir'] }), status: 'proposed' }
];
const compilation = compileTaskPlan(project);
assert.equal(compilation.tasks.length, 2);
assert.ok(compilation.tasks.every(task => !task.requirementIds.includes('req-proposed')), 'Onaysız gereksinim görev üretmemeli');
assert.equal(compilation.testCases.length, 2);
assert.deepEqual(compilation.agentPrompts.map(prompt => prompt.role), ['planner', 'implementer', 'reviewer', 'verifier']);
assert.equal(compilation.traceLinks.length, 4);

assertValidCompilation(compilation);

assert.throws(() => assertValidCompilation(null), /non-null object/);
assert.throws(() => assertValidCompilation({}), /baseRevision/);
assert.throws(() => assertValidCompilation({ baseRevision: 1 }), /tasks must be an array/);
assert.throws(() => assertValidCompilation({ baseRevision: 1, tasks: [{ id: '', title: '' }], testCases: [], milestones: [], traceLinks: [], agentPrompts: [], warnings: [] }), /id and title/);

const waiting = applyCompiledTaskPlan(project, compilation);
assert.equal(waiting.success, false);
assert.match(waiting.reason, /onayı/);
assert.equal(typeof waiting.project, 'object');
assert.equal(typeof waiting.reason, 'string');
const stale = applyCompiledTaskPlan({ ...project, revision: 2 }, compilation, { approved: true });
assert.equal(stale.success, false);
assert.match(stale.reason, /revision/);
const applied = applyCompiledTaskPlan(project, compilation, { approved: true });
assert.equal(applied.success, true);
assert.equal(applied.project.revision, 2);
assert.equal(applied.project.revisions.at(-1).snapshot.tasks.length, 2);
assert.ok(Array.isArray(applied.warnings));

assert.throws(() => applyCompiledTaskPlan(project, null), /non-null object/);
assert.throws(() => applyCompiledTaskPlan(project, { baseRevision: 'wrong' }), /baseRevision must be a number/);

const ordered = topologicalOrder([
    { id: 'deploy', dependencies: ['build'] },
    { id: 'build', dependencies: [] }
]);
assert.deepEqual(ordered.ordered.map(task => task.id), ['build', 'deploy']);
assert.deepEqual(ordered.cycles, []);
console.log('✓ V4 task compiler and approval gate');
