import assert from 'assert';
import {
    ENTITY_PREFIXES, resetEntityCounters,
    buildEntity, addToStore, getFromStore, updateInStore,
    removeFromStore, filterStore, storeCount, buildStoreArrays
} from '../../src/core/entity-store.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  ✅ ${name}`); passed++; }
    catch (e) { console.error(`  ❌ ${name}\n     ${e.message}`); failed++; }
}

console.log('\n🗃️ entity-store tests');

test('ENTITY_PREFIXES has 21 entity types', () => {
    assert.strictEqual(Object.keys(ENTITY_PREFIXES).length, 21);
});

test('buildEntity creates entity with metadata', () => {
    const e = buildEntity('decision', { title: 'Test Decision' }, 5);
    assert.strictEqual(e.entityType, 'decision');
    assert.strictEqual(e.title, 'Test Decision');
    assert.strictEqual(e.version, 1);
    assert.strictEqual(e.createdAtRevision, 5);
    assert.strictEqual(e.updatedAtRevision, 5);
    assert.ok(e.id);
    assert.ok(e.uid);
});

test('buildEntity generates unique IDs', () => {
    resetEntityCounters();
    const a = buildEntity('decision', {});
    const b = buildEntity('decision', {});
    assert.notStrictEqual(a.id, b.id);
});

test('buildEntity respects provided ID', () => {
    const e = buildEntity('task', { id: 'TASK-001' });
    assert.strictEqual(e.id, 'TASK-001');
});

test('buildEntity sets defaults', () => {
    const e = buildEntity('risk', {});
    assert.strictEqual(e.status, 'draft');
    assert.strictEqual(e.priority, 'medium');
    assert.strictEqual(e.sourceModule, 'universal');
    assert.strictEqual(e.sensitivity, 'internal');
    assert.deepStrictEqual(e.tags, []);
});

test('buildEntity merges extra data', () => {
    const e = buildEntity('objective', { title: 'X', extraField: 'hello' });
    assert.strictEqual(e.extraField, 'hello');
});

test('addToStore adds entity to store array', () => {
    resetEntityCounters();
    const store = { decision: [] };
    const e = addToStore(store, 'decision', { title: 'New Decision' }, 1);
    assert.ok(e);
    assert.strictEqual(store.decision.length, 1);
    assert.strictEqual(store.decision[0].title, 'New Decision');
});

test('addToStore returns null for duplicate ID', () => {
    const store = { decision: [{ id: 'DEC-001' }] };
    assert.strictEqual(addToStore(store, 'decision', { id: 'DEC-001' }), null);
});

test('getFromStore finds entity by ID', () => {
    const store = { task: [{ id: 'T-1', title: 'Do' }, { id: 'T-2', title: 'More' }] };
    const e = getFromStore(store, 'task', 'T-1');
    assert.strictEqual(e.title, 'Do');
});

test('getFromStore returns null for missing ID', () => {
    assert.strictEqual(getFromStore({}, 'task', 'NOPE'), null);
});

test('updateInStore modifies entity and bumps version', () => {
    const store = { decision: [{ id: 'DEC-001', title: 'Old', version: 1 }] };
    const updated = updateInStore(store, 'decision', 'DEC-001', { title: 'New' }, 10);
    assert.strictEqual(updated.title, 'New');
    assert.strictEqual(updated.version, 2);
    assert.strictEqual(updated.updatedAtRevision, 10);
    assert.strictEqual(store.decision[0].title, 'New');
});

test('updateInStore cannot change id/entityType/uid', () => {
    const store = { decision: [{ id: 'DEC-001', title: 'X', entityType: 'decision' }] };
    updateInStore(store, 'decision', 'DEC-001', { id: 'DEC-999', entityType: 'risk' }, 1);
    assert.strictEqual(store.decision[0].id, 'DEC-001');
    assert.strictEqual(store.decision[0].entityType, 'decision');
});

test('updateInStore returns null for missing entity', () => {
    assert.strictEqual(updateInStore({}, 'risk', 'NONE', {}, 1), null);
});

test('removeFromStore removes entity', () => {
    const store = { task: [{ id: 'T-1' }, { id: 'T-2' }] };
    assert.ok(removeFromStore(store, 'task', 'T-1'));
    assert.strictEqual(store.task.length, 1);
    assert.strictEqual(store.task[0].id, 'T-2');
});

test('removeFromStore returns false for missing entity', () => {
    assert.strictEqual(removeFromStore({}, 'task', 'NOPE'), false);
});

test('filterStore returns filtered results', () => {
    const store = { task: [{ id: 'T-1', status: 'done' }, { id: 'T-2', status: 'pending' }] };
    const done = filterStore(store, 'task', t => t.status === 'done');
    assert.strictEqual(done.length, 1);
    assert.strictEqual(done[0].id, 'T-1');
});

test('storeCount returns count', () => {
    const store = { task: [{ id: 'T-1' }, { id: 'T-2' }] };
    assert.strictEqual(storeCount(store, 'task'), 2);
    assert.strictEqual(storeCount(store, 'nonexistent'), 0);
});

test('buildStoreArrays creates empty arrays for all types', () => {
    const types = Object.keys(ENTITY_PREFIXES);
    const store = buildStoreArrays(types);
    for (const t of types) {
        assert.ok(Array.isArray(store[t]));
        assert.strictEqual(store[t].length, 0);
    }
});

console.log(`\n  Entity Store: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
