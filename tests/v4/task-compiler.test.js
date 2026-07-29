import assert from 'node:assert/strict';
import { createProjectDocument } from '../../src/v4/project-document.js';
import { normalizeRequirement } from '../../src/v4/canonical-entities.js';
import { applyCompiledTaskPlan, compileTaskPlan, topologicalOrder, assertValidCompilation } from '../../src/v4/task-compiler.js';
import { buildAgentPrompt, createDocumentSet } from '../../src/v4/exporter.js';

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
assert.ok(compilation.tasks.every(task => task.contract.version === 2));
assert.ok(compilation.tasks.every(task => task.contract.filePolicy.status === 'requires_inventory'));
assert.ok(compilation.tasks.every(task => task.contract.verification.requiresCommandDiscovery));
assert.ok(compilation.tasks.every(task => task.contract.rollbackPlan));

assertValidCompilation(compilation);

assert.throws(() => assertValidCompilation(null), /non-null object/);
assert.throws(() => assertValidCompilation({}), /baseRevision/);
assert.throws(() => assertValidCompilation({ baseRevision: 1 }), /tasks must be an array/);
assert.throws(() => assertValidCompilation({ baseRevision: 1, tasks: [{ id: '', title: '' }], testCases: [], milestones: [], traceLinks: [], agentPrompts: [], warnings: [] }), /id and title/);
assert.throws(() => assertValidCompilation({ ...compilation, tasks: [{ ...compilation.tasks[0], contract: null }] }), /TaskContract V2/);

const waiting = applyCompiledTaskPlan(project, compilation);
assert.equal(waiting.success, false);
assert.match(waiting.reason, /onayı/);
assert.equal(typeof waiting.project, 'object');
assert.equal(typeof waiting.reason, 'string');
const stale = applyCompiledTaskPlan({ ...project, documentRevision: 2, canonicalRevision: 2 }, compilation, { approved: true });
assert.equal(stale.success, false);
assert.match(stale.reason, /revision/);
const applied = applyCompiledTaskPlan(project, compilation, { approved: true });
assert.equal(applied.success, true);
assert.equal(applied.project.canonicalRevision, 2);
assert.equal(applied.project.revisions.at(-1).snapshot.tasks.length, 2);
assert.ok(Array.isArray(applied.warnings));
const documents = createDocumentSet(applied.project);
assert.match(documents['documents/tasks.md'], /TaskContract V2/);
assert.match(documents['documents/tasks.md'], /Geri alma/);
assert.match(buildAgentPrompt(applied.project, 'codex'), /requires_inventory/);

const inventoryProject = structuredClone(project);
inventoryProject.profile.projectInventory = {
    version: 1,
    analyzedAt: '2026-07-29T00:00:00.000Z',
    source: 'folder',
    totals: { selected: 3, included: 3, excluded: 0, bytes: 100 },
    languages: [{ name: 'TypeScript', files: 2 }],
    frameworks: ['React'],
    manifests: ['package.json', 'pnpm-lock.yaml'],
    scriptNames: ['test', 'typecheck'],
    security: { secretFiles: [], injectionFiles: [] },
    inventory: [
        { path: 'src/app.ts', secretDetected: false, injectionDetected: false },
        { path: 'tests/app.test.ts', secretDetected: false, injectionDetected: false },
        { path: 'package.json', secretDetected: false, injectionDetected: false }
    ],
    excluded: []
};
const inventoryCompilation = compileTaskPlan(inventoryProject);
assert.deepEqual(inventoryCompilation.tasks[0].contract.filePolicy.allowedPaths, ['src/**', 'tests/**', 'package.json']);
assert.equal(inventoryCompilation.tasks[0].contract.filePolicy.status, 'inferred');
assert.deepEqual(inventoryCompilation.tasks[0].contract.verification.commands, ['pnpm test', 'pnpm typecheck']);
const inventoryApplied = applyCompiledTaskPlan(inventoryProject, inventoryCompilation, { approved: true });
assert.equal(inventoryApplied.project.tasks[0].contract.filePolicy.status, 'confirmed');

assert.throws(() => applyCompiledTaskPlan(project, null), /non-null object/);
assert.throws(() => applyCompiledTaskPlan(project, { baseRevision: 'wrong' }), /baseRevision must be a number/);

const ordered = topologicalOrder([
    { id: 'deploy', dependencies: ['build'] },
    { id: 'build', dependencies: [] }
]);
assert.deepEqual(ordered.ordered.map(task => task.id), ['build', 'deploy']);
assert.deepEqual(ordered.cycles, []);
console.log('✓ V4 task compiler and approval gate');
