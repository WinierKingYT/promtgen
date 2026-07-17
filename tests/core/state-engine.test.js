import assert from 'assert';
import { StateValidator, StateSerializer, StateSnapshot, migrateState, getDefaultState } from '../../src/core/state/state-engine.js';
import { EventLog, EVENT_TYPES, resetEventCounter } from '../../src/core/state/event-log.js';
import { StatePrivacy, SENSITIVITY_LEVELS } from '../../src/core/state/state-privacy.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  ✅ ${name}`); passed++; }
    catch (e) { console.error(`  ❌ ${name}\n     ${e.message}`); failed++; }
}

console.log('\n🔍 state-validator tests');

test('StateValidator validates valid state', () => {
    const v = new StateValidator();
    const state = getDefaultState();
    const result = v.validate(state);
    assert.strictEqual(result.valid, true);
});

test('StateValidator rejects null state', () => {
    const v = new StateValidator();
    const result = v.validate(null);
    assert.strictEqual(result.valid, false);
});

test('StateValidator validates patch', () => {
    const v = new StateValidator();
    const result = v.validatePatch({ path: '/identity/name' });
    assert.strictEqual(result.valid, true);
});

test('StateValidator rejects patch with prototype pollution', () => {
    const v = new StateValidator();
    const r1 = v.validatePatch({ path: '/__proto__' });
    assert.strictEqual(r1.valid, false);
    const r2 = v.validatePatch({ path: '/constructor' });
    assert.strictEqual(r2.valid, false);
});

test('StateValidator rejects empty path', () => {
    const v = new StateValidator();
    const result = v.validatePatch({ path: '/' });
    assert.strictEqual(result.valid, false);
});

test('StateValidator validateExport checks export readiness', () => {
    const v = new StateValidator();
    const state = getDefaultState();
    const result = v.validateExport(state);
    assert.ok('valid' in result);
});

console.log('\n📦 state-serializer tests');

test('StateSerializer serialize returns wrapped output', () => {
    const s = new StateSerializer();
    const state = getDefaultState();
    const result = s.serialize(state);
    assert.strictEqual(result.schemaVersion, 3);
    assert.ok(result.state);
    assert.ok(result.exportedAt);
});

test('StateSerializer serialize includes metadata', () => {
    const s = new StateSerializer();
    const result = s.serialize(getDefaultState());
    assert.ok(result.metadata);
    assert.ok(result.metadata.nodeCount > 0);
});

test('StateSerializer deserialize restores state', () => {
    const s = new StateSerializer();
    const state = getDefaultState();
    const serialized = s.serialize(state);
    const restored = s.deserialize(serialized);
    assert.ok(restored.identity);
    assert.strictEqual(restored.schemaVersion, 3);
});

test('StateSerializer toJSON and fromJSON roundtrip', () => {
    const s = new StateSerializer();
    const state = getDefaultState();
    const json = s.toJSON(state);
    const restored = s.fromJSON(json);
    assert.ok(restored.identity);
});

test('StateSerializer rejects unsupported schema version', () => {
    const s = new StateSerializer();
    assert.throws(() => s.deserialize({ schemaVersion: 99, state: {} }), /Desteklenmeyen/);
});

test('StateSerializer handles circular references gracefully', () => {
    const s = new StateSerializer({ maxDepth: 3 });
    const deep = { a: { b: { c: { d: { e: 'deep' } } } } };
    const result = s.serialize(deep);
    assert.ok(result.state);
});

console.log('\n📸 state-snapshot tests');

test('StateSnapshot create stores snapshot', () => {
    const snap = new StateSnapshot();
    const s = snap.create({ a: 1 }, 1, 'Initial');
    assert.ok(s.id);
    assert.strictEqual(s.revision, 1);
    assert.strictEqual(s.label, 'Initial');
});

test('StateSnapshot restore returns deep copy', () => {
    const snap = new StateSnapshot();
    const s = snap.create({ a: 1, b: { c: 2 } }, 1);
    const restored = snap.restore(s.id);
    assert.strictEqual(restored.a, 1);
    restored.a = 99;
    assert.strictEqual(snap.restore(s.id).a, 1);
});

test('StateSnapshot getLatest returns most recent', () => {
    const snap = new StateSnapshot();
    snap.create({ a: 1 }, 1);
    snap.create({ a: 2 }, 2);
    assert.strictEqual(snap.getLatest().revision, 2);
});

test('StateSnapshot getByRevision finds correct', () => {
    const snap = new StateSnapshot();
    snap.create({ a: 1 }, 1);
    snap.create({ a: 2 }, 2);
    assert.strictEqual(snap.getByRevision(1).revision, 1);
});

test('StateSnapshot diff detects changes', () => {
    const snap = new StateSnapshot();
    const s1 = snap.create({ name: 'Proj', version: 1 }, 1);
    const s2 = snap.create({ name: 'Proj Updated', version: 2 }, 2);
    const diff = snap.diff(s1.id, s2.id);
    assert.ok(diff.length > 0);
    assert.ok(diff.some(d => d.path === '/name'));
});

test('StateSnapshot diff detects added keys', () => {
    const snap = new StateSnapshot();
    const s1 = snap.create({ a: 1 }, 1);
    const s2 = snap.create({ a: 1, b: 2 }, 2);
    const diff = snap.diff(s1.id, s2.id);
    assert.ok(diff.some(d => d.path === '/b' && d.type === 'added'));
});

test('StateSnapshot list returns summaries', () => {
    const snap = new StateSnapshot();
    snap.create({ a: 1 }, 1);
    snap.create({ a: 2 }, 2);
    assert.strictEqual(snap.list().length, 2);
});

test('StateSnapshot prune keeps only N', () => {
    const snap = new StateSnapshot();
    for (let i = 0; i < 5; i++) snap.create({ i }, i);
    snap.prune(3);
    assert.strictEqual(snap.list().length, 3);
});

test('migrateState returns default for null', () => {
    const migrated = migrateState(null, 3);
    assert.ok(migrated);
    assert.strictEqual(migrated.schemaVersion, 3);
});

test('migrateState returns valid V3 via project migration', () => {
    const v2 = {
        schemaVersion: 2,
        identity: { name: 'test', problemStatement: 'test', summary: '' },
        profile: { domains: [], projectModes: [], activatedModules: [], uncertainties: [] },
        phase: 'IDEA_CAPTURED',
        configuration: { language: 'tr', planningDepth: 'standard', exportMode: 'complete', activeModuleIds: [], privacyMode: 'local_private' },
        lifecycle: { status: 'active', createdAt: null, updatedAt: null },
        approvals: { profile: null, objectives: null, scope: null, deliverables: null, executionPlan: null, finalReview: null },
        moduleData: {},
        scope: { mustHave: [], shouldHave: [], couldHave: [], notNow: [], outOfScope: [] },
        documents: [],
        revision: 1,
        assumptions: [], decisions: [], risks: [], openQuestions: [],
        objectives: [], stakeholders: [], constraints: [],
        deliverables: [], workstreams: [], tasks: [], artifacts: [], dependencies: []
    };
    const migrated = migrateState(v2, 3);
    assert.ok(migrated);
    assert.strictEqual(migrated.schemaVersion, 3);
    assert.ok(migrated.entityStores);
});

test('migrateState skips for same version', () => {
    const v3 = getDefaultState();
    const result = migrateState(v3, 3);
    assert.strictEqual(result, v3);
});

test('getDefaultState returns valid V3 state', () => {
    const state = getDefaultState();
    assert.strictEqual(state.schemaVersion, 3);
    assert.ok(state.identity);
    assert.ok(state.entityStores);
});

console.log('\n📜 event-log tests');

test('EventLog log creates event', () => {
    resetEventCounter();
    const log = new EventLog();
    const event = log.log(EVENT_TYPES.STATE_CREATED, { description: 'Project created' });
    assert.ok(event.id);
    assert.strictEqual(event.type, EVENT_TYPES.STATE_CREATED);
});

test('EventLog log generates sequential IDs', () => {
    resetEventCounter();
    const log = new EventLog();
    const a = log.log(EVENT_TYPES.STATE_CREATED, {});
    const b = log.log(EVENT_TYPES.STATE_PATCHED, {});
    assert.notStrictEqual(a.id, b.id);
    assert.ok(a.id.startsWith('EVT-'));
});

test('EventLog getEvents returns filtered by type', () => {
    const log = new EventLog();
    log.log(EVENT_TYPES.STATE_CREATED, {});
    log.log(EVENT_TYPES.STATE_PATCHED, {});
    log.log(EVENT_TYPES.STATE_PATCHED, {});
    assert.strictEqual(log.getEvents({ type: EVENT_TYPES.STATE_PATCHED }).length, 2);
});

test('EventLog getEventsByType returns correct', () => {
    const log = new EventLog();
    log.log(EVENT_TYPES.STATE_CREATED, {});
    assert.strictEqual(log.getEventsByType(EVENT_TYPES.STATE_CREATED).length, 1);
});

test('EventLog getEventsByEntity finds entity events', () => {
    const log = new EventLog();
    log.log(EVENT_TYPES.ENTITY_ADDED, { entityId: 'TASK-001', entityType: 'task' });
    assert.strictEqual(log.getEventsByEntity('TASK-001').length, 1);
});

test('EventLog getTimeline returns sorted', () => {
    const log = new EventLog();
    log.log(EVENT_TYPES.STATE_CREATED, {});
    log.log(EVENT_TYPES.STATE_PATCHED, {});
    const timeline = log.getTimeline(false);
    assert.strictEqual(timeline.length, 2);
    assert.strictEqual(timeline[0].type, EVENT_TYPES.STATE_CREATED);
});

test('EventLog getStats returns counts', () => {
    const log = new EventLog();
    log.log(EVENT_TYPES.STATE_CREATED, {});
    log.log(EVENT_TYPES.STATE_PATCHED, {});
    const stats = log.getStats();
    assert.strictEqual(stats.total, 2);
    assert.ok(stats.byType[EVENT_TYPES.STATE_CREATED] === 1);
});

test('EventLog search finds by text', () => {
    const log = new EventLog();
    log.log(EVENT_TYPES.STATE_CREATED, { description: 'Initial project setup' });
    const results = log.search('project');
    assert.ok(results.length > 0);
});

test('EventLog getStateHistory returns entity changes', () => {
    const log = new EventLog();
    log.log(EVENT_TYPES.ENTITY_ADDED, { entityId: 'OBJ-001', entityType: 'objective' });
    log.log(EVENT_TYPES.ENTITY_UPDATED, { entityId: 'OBJ-001' });
    const history = log.getStateHistory('objective', 'OBJ-001');
    assert.strictEqual(history.length, 2);
});

test('EventLog toJSON and fromJSON roundtrip', () => {
    const log = new EventLog();
    log.log(EVENT_TYPES.STATE_CREATED, {});
    const json = log.toJSON();
    const restored = EventLog.fromJSON(json);
    assert.strictEqual(restored.getEvents().length, 1);
});

test('EventLog filters by revision range', () => {
    const log = new EventLog();
    log.log(EVENT_TYPES.STATE_CREATED, {}, { revision: 1 });
    log.log(EVENT_TYPES.STATE_PATCHED, {}, { revision: 5 });
    const filtered = log.getEvents({ fromRevision: 3 });
    assert.strictEqual(filtered.length, 1);
});

console.log('\n🔒 state-privacy tests');

test('StatePrivacy redact leaves public data', () => {
    const sp = new StatePrivacy();
    const state = { name: 'Test Proj', description: 'Açıklama' };
    const redacted = sp.redact(state, SENSITIVITY_LEVELS.PUBLIC);
    assert.ok(redacted.name.includes('****'));
    assert.strictEqual(redacted.description, 'Açıklama');
});

test('StatePrivacy redact preserves internal data', () => {
    const sp = new StatePrivacy();
    const state = { name: 'Test', description: 'Desc' };
    const redacted = sp.redact(state, SENSITIVITY_LEVELS.INTERNAL);
    assert.strictEqual(redacted.name, 'Test');
});

test('StatePrivacy redact masks sensitive patterns', () => {
    const sp = new StatePrivacy();
    const state = { apiKey: 'sk-1234567890abcdef' };
    const redacted = sp.redact(state);
    assert.ok(redacted.apiKey.includes('****'));
});

test('StatePrivacy redact handles nested sensitive data', () => {
    const sp = new StatePrivacy();
    const state = { config: { apiKey: 'secret123', normal: 'value' } };
    const redacted = sp.redact(state);
    assert.ok(redacted.config.apiKey.includes('****'));
    assert.strictEqual(redacted.config.normal, 'value');
});

test('StatePrivacy getSafeExport returns wrapped output', () => {
    const sp = new StatePrivacy();
    const result = sp.getSafeExport({ name: 'Test' });
    assert.ok(result.exportedAt);
    assert.strictEqual(result.sensitivityLevel, SENSITIVITY_LEVELS.PUBLIC);
    assert.ok(result.redactionRules);
});

test('StatePrivacy addSensitivePath adds new path', () => {
    const sp = new StatePrivacy();
    sp.addSensitivePath('/custom/path');
    assert.ok(sp.sensitivePaths.includes('/custom/path'));
});

test('StatePrivacy addSensitivePattern adds new pattern', () => {
    const sp = new StatePrivacy();
    sp.addSensitivePattern('mySecret');
    assert.ok(sp.sensitivePatterns.some(p => p.test('mySecret')));
});

console.log(`\n  Section 14: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
