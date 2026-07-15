import assert from 'assert';
import { getInitialCanonicalState, validateCanonicalState } from '../../src/state/project-state.js';
import { validateV3State } from '../../src/state/project-state-v3.js';
import { migrateProjectState } from '../../src/state/state-migrations.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (e) {
        console.error(`  ❌ ${name}`);
        console.error(`     ${e.message}`);
        failed++;
    }
}

console.log('\n💾 persistence & migration tests');

test('pendingChangeSet exists in initial state', () => {
    const state = getInitialCanonicalState();
    assert.ok(state.pendingChangeSet);
    assert.strictEqual(state.pendingChangeSet.baseRevision, 0);
    assert.ok(Array.isArray(state.pendingChangeSet.patches));
    assert.ok(Array.isArray(state.pendingChangeSet.rejectedPatches));
    assert.ok(Array.isArray(state.pendingChangeSet.editedPatches));
});

test('eventLog exists in initial state', () => {
    const state = getInitialCanonicalState();
    assert.ok(Array.isArray(state.eventLog));
    assert.strictEqual(state.eventLog.length, 0);
});

function makeValidV2State() {
    return JSON.parse(JSON.stringify(getInitialCanonicalState()));
}

test('migrateProjectState adds pendingChangeSet to v2 states', () => {
    const oldState = makeValidV2State();
    oldState.schemaVersion = 2;
    const result = migrateProjectState(oldState);
    assert.strictEqual(result.success, true);
    assert.ok(result.state.pendingChangeSet);
    assert.ok(result.state.eventLog);
});

test('migrateProjectState quarantines future schema version', () => {
    const result = migrateProjectState({ schemaVersion: 99, revision: 1 });
    assert.strictEqual(result.success, false);
    assert.ok(result.errors.length > 0);
    assert.ok(result.recoveryState);
});

test('migrateProjectState returns fresh state for empty input', () => {
    const result = migrateProjectState(null);
    assert.strictEqual(result.success, true);
    assert.ok(result.migrationsApplied.includes('fresh-start-v3'));
});

test('migrateProjectState migrates v1 to v3', () => {
    const oldState = makeValidV2State();
    oldState.schemaVersion = 1;
    const result = migrateProjectState(oldState);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.state.schemaVersion, 3);
    assert.ok(result.migrationsApplied.includes('v1-to-v2'));
    assert.ok(result.migrationsApplied.includes('v2-to-v3'));
});

test('migrateProjectState validates canonical state after migration', () => {
    const oldState = makeValidV2State();
    const result = migrateProjectState(oldState);
    assert.strictEqual(result.success, true);
    assert.ok(validateV3State(result.state));
});

test('rejectedPatches and editedPatches are preserved', () => {
    const state = getInitialCanonicalState();
    assert.ok(Array.isArray(state.pendingChangeSet.rejectedPatches));
    assert.ok(Array.isArray(state.pendingChangeSet.editedPatches));
    assert.strictEqual(state.pendingChangeSet.approvalStatus, 'pending');
});

test('approvalStatus in pendingChangeSet', () => {
    const state = getInitialCanonicalState();
    assert.ok(['pending', 'none', 'approved', 'rejected'].includes(state.pendingChangeSet.approvalStatus));
});

test('validateCanonicalState accepts full state with new fields', () => {
    const state = getInitialCanonicalState();
    assert.strictEqual(validateCanonicalState(state), true);
});

console.log(`\n  Persistence & Migration: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
