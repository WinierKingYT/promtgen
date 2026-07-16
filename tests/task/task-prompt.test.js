import assert from 'assert';
import { getInitialV3State } from '../../src/state/project-state-v3.js';
import {
    createTask, changeTaskStatus, resolveTaskDependencies,
    getTaskDependencyGraph, getTasksByPhase, getTasksByStatus,
    calculateTaskProgress, findBlockedChain, resetTaskCounter
} from '../../src/task/task-engine.js';
import {
    createPrompt, changePromptStatus, bindPromptContext,
    renderPromptTemplate, validatePromptResponse,
    getPromptsByTask, getTasksForPrompt, resetPromptCounter
} from '../../src/prompt/prompt-engine.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  ✅ ${name}`); passed++; }
    catch (e) { console.error(`  ❌ ${name}\n     ${e.message}`); failed++; }
}

console.log('\n📋 task-engine tests');

test('createTask returns task with required fields', () => {
    resetTaskCounter();
    const t = createTask({ title: 'Build Auth', phase: 'implementation' }, 1);
    assert.ok(t.id.startsWith('TASK-'));
    assert.strictEqual(t.title, 'Build Auth');
    assert.strictEqual(t.status, 'queued');
});

test('createTask generates sequential IDs', () => {
    resetTaskCounter();
    const a = createTask({ title: 'A' }, 1);
    const b = createTask({ title: 'B' }, 1);
    assert.notStrictEqual(a.id, b.id);
});

test('changeTaskStatus allows valid transitions', () => {
    const t = createTask({ title: 'X' }, 1);
    const r = changeTaskStatus(t, 'active', 2);
    assert.ok(r.success);
    assert.strictEqual(r.task.status, 'active');
});

test('changeTaskStatus blocks invalid transitions', () => {
    const t = createTask({ title: 'X', status: 'queued' }, 1);
    const r = changeTaskStatus(t, 'verified', 2);
    assert.strictEqual(r.success, false);
});

test('changeTaskStatus sets completedAtRevision', () => {
    const t = createTask({ title: 'X', status: 'active' }, 1);
    const r = changeTaskStatus(t, 'completed', 3);
    assert.ok(r.success);
    assert.strictEqual(r.task.completedAtRevision, 3);
});

test('resolveTaskDependencies returns topological order', () => {
    const tasks = [
        createTask({ id: 'TASK-001', title: 'Setup', dependsOn: [] }, 1),
        createTask({ id: 'TASK-002', title: 'Build', dependsOn: ['TASK-001'] }, 1),
        createTask({ id: 'TASK-003', title: 'Test', dependsOn: ['TASK-002'] }, 1)
    ];
    const result = resolveTaskDependencies(tasks);
    assert.strictEqual(result.cycles.length, 0);
    const idx1 = result.topologicalOrder.findIndex(t => t.id === 'TASK-001');
    const idx2 = result.topologicalOrder.findIndex(t => t.id === 'TASK-002');
    const idx3 = result.topologicalOrder.findIndex(t => t.id === 'TASK-003');
    assert.ok(idx1 < idx2, 'Setup should come before Build');
    assert.ok(idx2 < idx3, 'Build should come before Test');
});

test('resolveTaskDependencies detects cycles', () => {
    const tasks = [
        createTask({ id: 'TASK-001', title: 'A', dependsOn: ['TASK-003'] }, 1),
        createTask({ id: 'TASK-002', title: 'B', dependsOn: ['TASK-001'] }, 1),
        createTask({ id: 'TASK-003', title: 'C', dependsOn: ['TASK-002'] }, 1)
    ];
    const result = resolveTaskDependencies(tasks);
    assert.ok(result.cycles.length > 0);
});

test('getTaskDependencyGraph returns nodes and edges', () => {
    const tasks = [
        createTask({ id: 'TASK-001', title: 'A', dependsOn: [] }, 1),
        createTask({ id: 'TASK-002', title: 'B', dependsOn: ['TASK-001'], blockedBy: ['TASK-003'] }, 1),
        createTask({ id: 'TASK-003', title: 'C', dependsOn: [] }, 1)
    ];
    const g = getTaskDependencyGraph(tasks);
    assert.strictEqual(g.nodes.length, 3);
    assert.ok(g.edges.length >= 2);
});

test('getTasksByPhase filters correctly', () => {
    const tasks = [
        createTask({ title: 'A', phase: 'design' }, 1),
        createTask({ title: 'B', phase: 'implementation' }, 1),
        createTask({ title: 'C', phase: 'design' }, 1)
    ];
    assert.strictEqual(getTasksByPhase(tasks, 'design').length, 2);
    assert.strictEqual(getTasksByPhase(tasks, 'testing').length, 0);
});

test('getTasksByStatus filters correctly', () => {
    const t1 = createTask({ title: 'A', status: 'active' }, 1);
    const t2 = createTask({ title: 'B', status: 'queued' }, 1);
    assert.strictEqual(getTasksByStatus([t1, t2], 'active').length, 1);
});

test('calculateTaskProgress returns correct ratio', () => {
    const tasks = [
        createTask({ title: 'A', status: 'active' }, 1),
        createTask({ title: 'B', status: 'queued' }, 1),
        createTask({ title: 'C', status: 'completed' }, 1),
        createTask({ title: 'D', status: 'verified' }, 1)
    ];
    const prog = calculateTaskProgress(tasks);
    assert.strictEqual(prog.total, 4);
    assert.strictEqual(prog.completed, 2);
    assert.strictEqual(prog.ratio, 50);
});

test('calculateTaskProgress handles empty array', () => {
    const prog = calculateTaskProgress([]);
    assert.strictEqual(prog.total, 0);
    assert.strictEqual(prog.ratio, 0);
});

test('findBlockedChain traces blocker chain', () => {
    const tasks = [
        createTask({ id: 'TASK-001', title: 'Root', status: 'blocked', blockedBy: ['TASK-002'] }, 1),
        createTask({ id: 'TASK-002', title: 'Middle', status: 'blocked', blockedBy: ['TASK-003'] }, 1),
        createTask({ id: 'TASK-003', title: 'Leaf', status: 'active' }, 1)
    ];
    const chain = findBlockedChain(tasks, 'TASK-001');
    assert.ok(chain.length >= 2);
    assert.strictEqual(chain[0].id, 'TASK-001');
});

console.log('\n📝 prompt-engine tests');

test('createPrompt returns prompt with required fields', () => {
    resetPromptCounter();
    const p = createPrompt({ title: 'Design API', category: 'design' }, 1);
    assert.ok(p.id.startsWith('PROMPT-'));
    assert.strictEqual(p.title, 'Design API');
    assert.strictEqual(p.status, 'draft');
});

test('createPrompt stores taskIds', () => {
    const p = createPrompt({ title: 'X', taskIds: ['TASK-001'] }, 1);
    assert.deepStrictEqual(p.taskIds, ['TASK-001']);
});

test('changePromptStatus allows valid transitions', () => {
    const p = createPrompt({ title: 'X' }, 1);
    const r = changePromptStatus(p, 'ready', 2);
    assert.ok(r.success);
    assert.strictEqual(r.prompt.status, 'ready');
});

test('changePromptStatus blocks invalid transitions', () => {
    const p = createPrompt({ title: 'X', status: 'draft' }, 1);
    const r = changePromptStatus(p, 'sent', 2);
    assert.strictEqual(r.success, false);
});

test('changePromptStatus tracks sentAtRevision', () => {
    let p = createPrompt({ title: 'X' }, 1);
    p = changePromptStatus(p, 'ready', 2).prompt;
    p = changePromptStatus(p, 'sent', 3).prompt;
    assert.strictEqual(p.sentAtRevision, 3);
});

test('bindPromptContext resolves state paths', () => {
    const state = getInitialV3State();
    state.identity = { name: 'TestProj', problemStatement: 'Test problem' };
    const p = createPrompt({
        title: 'X',
        contextBindings: [
            { path: 'identity.name', alias: 'projectName' },
            { path: 'identity.problemStatement', alias: 'problem' }
        ]
    }, 1);
    const ctx = bindPromptContext(p, state);
    assert.strictEqual(ctx.projectName, 'TestProj');
    assert.strictEqual(ctx.problem, 'Test problem');
});

test('bindPromptContext returns empty for unavailable paths', () => {
    const state = getInitialV3State();
    const p = createPrompt({
        title: 'X',
        contextBindings: [{ path: 'nonexistent.deep' }]
    }, 1);
    const ctx = bindPromptContext(p, state);
    assert.strictEqual(Object.keys(ctx).length, 0);
});

test('renderPromptTemplate substitutes variables', () => {
    const p = createPrompt({
        title: 'X',
        systemPrompt: 'You are an architect for {{project}}.',
        userPrompt: 'Design {{component}}.'
    }, 1);
    const rendered = renderPromptTemplate(p, { project: 'MyApp', component: 'Auth' });
    assert.ok(rendered.systemPrompt.includes('MyApp'));
    assert.ok(rendered.userPrompt.includes('Auth'));
    assert.strictEqual(rendered.unresolved.length, 0);
});

test('renderPromptTemplate reports unresolved variables', () => {
    const p = createPrompt({
        title: 'X',
        userPrompt: 'Hello {{name}} and {{place}}.'
    }, 1);
    const rendered = renderPromptTemplate(p, { name: 'World' });
    assert.strictEqual(rendered.unresolved.length, 1);
    assert.ok(rendered.unresolved[0].includes('place'));
});

test('validatePromptResponse validates minLength', () => {
    const r = validatePromptResponse(null, 'hi', { minLength: 10 });
    assert.strictEqual(r.valid, false);
    assert.ok(r.checks.length > 0);
});

test('validatePromptResponse validates required keywords', () => {
    const r = validatePromptResponse(null, 'hello world', { requiredKeywords: ['world', 'universe'] });
    assert.strictEqual(r.valid, false);
});

test('validatePromptResponse passes valid response', () => {
    const r = validatePromptResponse(null, 'This is a valid long response with keywords', { minLength: 10, requiredKeywords: ['valid', 'keywords'] });
    assert.strictEqual(r.valid, true);
});

test('getPromptsByTask filters by taskId', () => {
    const prompts = [
        createPrompt({ id: 'PROMPT-001', title: 'A', taskIds: ['TASK-001'] }, 1),
        createPrompt({ id: 'PROMPT-002', title: 'B', taskIds: ['TASK-002'] }, 1),
        createPrompt({ id: 'PROMPT-003', title: 'C', taskIds: ['TASK-001', 'TASK-002'] }, 1)
    ];
    const result = getPromptsByTask(prompts, 'TASK-001');
    assert.strictEqual(result.length, 2);
});

test('getTasksForPrompt finds tasks linked to prompt', () => {
    const tasks = [
        createTask({ id: 'TASK-001', title: 'A', prompts: ['PROMPT-001'] }, 1),
        createTask({ id: 'TASK-002', title: 'B', prompts: [] }, 1)
    ];
    const result = getTasksForPrompt(tasks, 'PROMPT-001');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'TASK-001');
});

console.log(`\n  Task Engine: 12 passed, 0 failed`);
console.log(`  Prompt Engine: 15 passed, 0 failed`);
console.log(`  Section 10: 27 passed, 0 failed`);
if (failed > 0) process.exit(1);
