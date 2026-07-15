import assert from 'assert';
import { getInitialV3State, validateV3State, applyV3StatePatch, activateModule, getModuleData, ensureModuleData, legacyMigrateToV3 } from '../../src/state/project-state-v3.js';
import { UNIVERSAL_PHASES } from '../../src/workflow/phases.js';
import { MODULE_NAMES } from '../../src/core/modules.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  ✅ ${name}`); passed++; }
    catch (e) { console.error(`  ❌ ${name}\n     ${e.message}`); failed++; }
}

console.log('\n📐 V3 state tests');

test('getInitialV3State returns schemaVersion 3', () => {
    const state = getInitialV3State();
    assert.strictEqual(state.schemaVersion, 3);
});

test('getInitialV3State starts at IDEA_CAPTURED phase', () => {
    const state = getInitialV3State();
    assert.strictEqual(state.phase, UNIVERSAL_PHASES.IDEA_CAPTURED);
});

test('getInitialV3State has moduleData with 5 null modules', () => {
    const state = getInitialV3State();
    assert.strictEqual(Object.keys(state.moduleData).length, 5);
    for (const v of Object.values(state.moduleData)) {
        assert.strictEqual(v, null);
    }
});

test('validateV3State returns true for initial state', () => {
    assert.ok(validateV3State(getInitialV3State()));
});

test('validateV3State returns false for null', () => {
    assert.strictEqual(validateV3State(null), false);
});

test('validateV3State returns false for empty object', () => {
    assert.strictEqual(validateV3State({}), false);
});

test('validateV3State rejects duplicate IDs across lists', () => {
    const state = getInitialV3State();
    state.objectives = [{ id: 'SAME-ID', text: 'A' }];
    state.decisions = [{ id: 'SAME-ID', title: 'B', decision: 'C', reason: 'D' }];
    assert.strictEqual(validateV3State(state), false);
});

test('applyV3StatePatch replaces a field', () => {
    const state = getInitialV3State();
    const result = applyV3StatePatch(state, { operation: 'replace', path: '/identity/name', value: 'Test' }, true);
    assert.strictEqual(result.identity.name, 'Test');
});

test('applyV3StatePatch increments revision', () => {
    const state = getInitialV3State();
    const rev = state.revision;
    const result = applyV3StatePatch(state, { operation: 'replace', path: '/identity/name', value: 'X' }, true);
    assert.strictEqual(result.revision, rev + 1);
});

test('applyV3StatePatch returns original state for invalid patches', () => {
    const state = getInitialV3State();
    const result = applyV3StatePatch(state, null);
    assert.strictEqual(result, state);
});

test('applyV3StatePatch prevents prototype pollution', () => {
    const state = getInitialV3State();
    const result = applyV3StatePatch(state, { operation: 'set', path: '/__proto__/polluted', value: true }, true);
    assert.strictEqual(result.__proto__.polluted, undefined);
});

test('activateModule adds module to activatedModules and creates moduleData', () => {
    const state = getInitialV3State();
    const result = activateModule(state, MODULE_NAMES.SOFTWARE);
    assert.ok(result.profile.activatedModules.includes(MODULE_NAMES.SOFTWARE));
    assert.ok(result.moduleData.software !== null);
    assert.ok(Array.isArray(result.moduleData.software.platforms));
});

test('activateModule is idempotent', () => {
    const state = getInitialV3State();
    const r1 = activateModule(state, MODULE_NAMES.GAME);
    const r2 = activateModule(r1, MODULE_NAMES.GAME);
    assert.strictEqual(r2.profile.activatedModules.filter(m => m === MODULE_NAMES.GAME).length, 1);
});

test('getModuleData returns null for unactivated module', () => {
    const state = getInitialV3State();
    assert.strictEqual(getModuleData(state, MODULE_NAMES.SOFTWARE), null);
});

test('getModuleData returns data for activated module', () => {
    const state = activateModule(getInitialV3State(), MODULE_NAMES.SOFTWARE);
    assert.ok(getModuleData(state, MODULE_NAMES.SOFTWARE) !== null);
});

test('ensureModuleData activates module if missing', () => {
    const state = ensureModuleData(getInitialV3State(), MODULE_NAMES.RESEARCH);
    assert.ok(state.moduleData.research !== null);
    assert.ok(state.profile.activatedModules.includes(MODULE_NAMES.RESEARCH));
});

test('legacyMigrateToV3 migrates V2 state with workflowStage', () => {
    const v2 = { revision: 5, workflowStage: 'TASKS_DRAFTED', approvals: { mvpScope: { status: 'approved', approvedAt: '2024-01-01', notes: '' } }, tasks: [{ id: 'T1', title: 'Build', description: 'Do' }] };
    const v3 = legacyMigrateToV3(v2);
    assert.strictEqual(v3.schemaVersion, 3);
    assert.strictEqual(v3.phase, 'EXECUTION_PLAN_DRAFTED');
    assert.strictEqual(v3.revision, 5);
    assert.strictEqual(v3.tasks.length, 1);
});

test('legacyMigrateToV3 maps approvals correctly', () => {
    const v2 = { approvals: { mvpScope: { status: 'approved', approvedAt: '2024-01-01', notes: '' } } };
    const v3 = legacyMigrateToV3(v2);
    assert.strictEqual(v3.approvals.scope.status, 'approved');
});

test('legacyMigrateToV3 converts requirements to objectives', () => {
    const v2 = { requirements: { functional: ['Login', 'CRUD'], nonFunctional: ['Fast'] } };
    const v3 = legacyMigrateToV3(v2);
    assert.strictEqual(v3.objectives.length, 3);
    assert.ok(v3.objectives.some(o => o.text === 'Login'));
});

test('legacyMigrateToV3 migrates architecture to moduleData', () => {
    const v2 = { profile: { platforms: ['web'] }, architecture: { components: ['App'], dataFlows: [], integrations: [] } };
    const v3 = legacyMigrateToV3(v2);
    assert.ok(v3.moduleData.software !== null);
    assert.strictEqual(v3.moduleData.software.architecture.components[0], 'App');
});

test('legacyMigrateToV3 handles null input', () => {
    const v3 = legacyMigrateToV3(null);
    assert.strictEqual(v3.schemaVersion, 3);
});

test('legacyMigrateToV3 preserves pendingChangeSet', () => {
    const v2 = { pendingChangeSet: { patches: [{ op: 'replace' }], approvalStatus: 'pending' } };
    const v3 = legacyMigrateToV3(v2);
    assert.strictEqual(v3.pendingChangeSet.approvalStatus, 'pending');
    assert.strictEqual(v3.pendingChangeSet.patches.length, 1);
});

test('applyV3StatePatch blocks patch when policy rejects it (non-system)', () => {
    const state = getInitialV3State();
    state.phase = UNIVERSAL_PHASES.IDEA_CAPTURED;
    const result = applyV3StatePatch(state, { operation: 'replace', path: '/scope/mustHave', value: ['x'] });
    assert.strictEqual(result, state);
});

test('applying patch does not mutate original state', () => {
    const state = getInitialV3State();
    const originalName = state.identity.name;
    applyV3StatePatch(state, { operation: 'replace', path: '/identity/name', value: 'Changed' }, true);
    assert.strictEqual(state.identity.name, originalName);
});

console.log(`\n  V3 State: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
