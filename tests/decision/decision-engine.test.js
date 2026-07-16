import assert from 'assert';
import { getInitialV3State } from '../../src/state/project-state-v3.js';
import {
    createDecision, evaluateOptions, changeDecisionStatus,
    calculateDecisionImpact, resetDecisionCounter
} from '../../src/decision/decision-engine.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  ✅ ${name}`); passed++; }
    catch (e) { console.error(`  ❌ ${name}\n     ${e.message}`); failed++; }
}

console.log('\n⚖️ decision-engine tests');

test('createDecision returns decision with required fields', () => {
    resetDecisionCounter();
    const d = createDecision({ title: 'Test Decision', category: 'technical' }, 5);
    assert.ok(d.id);
    assert.strictEqual(d.title, 'Test Decision');
    assert.strictEqual(d.category, 'technical');
    assert.strictEqual(d.status, 'detected');
    assert.strictEqual(d.createdAtRevision, 5);
});

test('createDecision generates sequential IDs', () => {
    resetDecisionCounter();
    const a = createDecision({ title: 'A' }, 1);
    const b = createDecision({ title: 'B' }, 1);
    assert.notStrictEqual(a.id, b.id);
});

test('createDecision accepts options array', () => {
    const d = createDecision({
        title: 'Stack',
        options: [
            { label: 'React', pros: ['Popular'], cons: ['Heavy'] },
            { label: 'Vue', pros: ['Light'], cons: ['Smaller community'] }
        ]
    }, 1);
    assert.strictEqual(d.options.length, 2);
    assert.ok(d.options[0].id);
});

test('createDecision records status history', () => {
    const d = createDecision({ title: 'X' }, 1);
    assert.ok(Array.isArray(d.statusHistory));
    assert.strictEqual(d.statusHistory.length, 1);
    assert.strictEqual(d.statusHistory[0].status, 'detected');
});

test('evaluateOptions returns scored options with recommendation', () => {
    const d = createDecision({
        title: 'DB',
        options: [
            { label: 'SQLite', confidence: 0.9, reversibility: 'easy', effort: 'low', cost: 'low', risks: [] },
            { label: 'PostgreSQL', confidence: 0.7, reversibility: 'medium', effort: 'medium', cost: 'medium', risks: ['Setup'] }
        ]
    }, 1);
    const results = evaluateOptions(d);
    assert.strictEqual(results.length, 2);
    assert.ok(results[0].total >= 0);
    assert.ok(typeof results[0].recommended === 'boolean');
    assert.ok(results.some(r => r.recommended === true));
});

test('evaluateOptions with custom weights', () => {
    const d = createDecision({
        title: 'DB',
        options: [
            { label: 'SQLite', confidence: 0.9, reversibility: 'easy', effort: 'low', cost: 'low', risks: [] },
            { label: 'PG', confidence: 0.9, reversibility: 'easy', effort: 'low', cost: 'low', risks: [] }
        ]
    }, 1);
    const results = evaluateOptions(d, { confidence: 1.0, reversibility: 0, effort: 0, cost: 0, riskLevel: 0 });
    assert.strictEqual(results[0].total, results[1].total);
});

test('changeDecisionStatus allows valid transitions', () => {
    resetDecisionCounter();
    const d = createDecision({ title: 'X' }, 1);
    const r1 = changeDecisionStatus(d, 'exploring', 2);
    assert.ok(r1.success);
    assert.strictEqual(r1.decision.status, 'exploring');
});

test('changeDecisionStatus blocks invalid transitions', () => {
    const d = createDecision({ title: 'X', status: 'approved' }, 1);
    const r = changeDecisionStatus(d, 'detected', 2);
    assert.strictEqual(r.success, false);
    assert.ok(r.reason);
});

test('changeDecisionStatus records status history', () => {
    const d = createDecision({ title: 'X' }, 1);
    const r1 = changeDecisionStatus(d, 'exploring', 2);
    assert.strictEqual(r1.decision.statusHistory.length, 2);
});

test('changeDecisionStatus sets approvedAtRevision on approval', () => {
    const d = createDecision({ title: 'X', status: 'options_ready' }, 1);
    const r = changeDecisionStatus(d, 'proposed', 2);
    assert.ok(r.success);
    const r2 = changeDecisionStatus(r.decision, 'approved', 3);
    assert.strictEqual(r2.decision.approvedAtRevision, 3);
});

test('calculateDecisionImpact returns impacts for existing decision', () => {
    const state = getInitialV3State();
    state.decisions = [{ id: 'DEC-001', title: 'Tech', affectedEntityIds: ['TASK-001'] }];
    state.tasks = [{ id: 'TASK-001', title: 'Build', sourceEntityIds: ['DEC-001'] }];
    const impact = calculateDecisionImpact(state, 'DEC-001');
    assert.strictEqual(impact.found, true);
    assert.ok(impact.directImpacts.length > 0);
});

test('calculateDecisionImpact returns not found for missing decision', () => {
    const impact = calculateDecisionImpact(getInitialV3State(), 'NONEXISTENT');
    assert.strictEqual(impact.found, false);
});

test('changeDecisionStatus for superseded stores reason', () => {
    const d = createDecision({ title: 'X', status: 'approved' }, 1);
    const r = changeDecisionStatus(d, 'superseded', 2, 'New approach discovered');
    assert.ok(r.success);
    assert.strictEqual(r.decision.supersededBy, 'New approach discovered');
});

console.log(`\n  Decision Engine: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
