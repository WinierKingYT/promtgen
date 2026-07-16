import assert from 'assert';
import { RuleRegistry } from '../../src/core/reviewer/rule-registry.js';
import { FindingStore } from '../../src/core/reviewer/finding-store.js';
import { QualityGate } from '../../src/core/reviewer/quality-gate.js';
import { HealthScore } from '../../src/core/reviewer/health-score.js';
import { ReviewEngine } from '../../src/core/reviewer/review-engine.js';
import {
    REVIEW_CATEGORIES, SEVERITY, FINDING_STATUS, READINESS_LEVELS,
    GATES, GATE_CONFIG, HEALTH_CATEGORIES, CRITICAL_CAPS
} from '../../src/core/reviewer/reviewer-types.js';
import { TraceabilityEngine } from '../../src/core/traceability/traceability-engine.js';
import { NODE_TYPES } from '../../src/core/traceability/traceability-types.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  ✅ ${name}`); passed++; }
    catch (e) { console.error(`  ❌ ${name}\n     ${e.message}`); failed++; }
}

console.log('\n🏥 reviewer-types tests');

test('REVIEW_CATEGORIES has defined categories', () => {
    assert.ok(REVIEW_CATEGORIES.SCHEMA);
    assert.ok(REVIEW_CATEGORIES.TASK);
    assert.ok(REVIEW_CATEGORIES.EXPORT);
});

test('SEVERITY has 5 levels', () => {
    assert.strictEqual(Object.keys(SEVERITY).length, 5);
});

test('FINDING_STATUS has defined statuses', () => {
    assert.ok(FINDING_STATUS.OPEN);
    assert.ok(FINDING_STATUS.FALSE_POSITIVE);
});

test('READINESS_LEVELS has 7 levels', () => {
    assert.strictEqual(READINESS_LEVELS.length, 7);
});

test('GATE_CONFIG has 4 gates', () => {
    assert.strictEqual(Object.keys(GATE_CONFIG).length, 4);
});

test('HEALTH_CATEGORIES sum weight ~1', () => {
    const total = HEALTH_CATEGORIES.reduce((s, c) => s + c.weight, 0);
    assert.ok(Math.abs(total - 1) < 0.01);
});

console.log('\n📋 rule-registry tests');

test('RuleRegistry has default rules', () => {
    const reg = new RuleRegistry();
    const rules = reg.getAllRules();
    assert.ok(rules.length > 15);
});

test('getRules filters by category', () => {
    const reg = new RuleRegistry();
    const schemaRules = reg.getRules(REVIEW_CATEGORIES.SCHEMA);
    assert.ok(schemaRules.length >= 1);
});

test('getRules filters by severity', () => {
    const reg = new RuleRegistry();
    const criticalRules = reg.getRules(null, SEVERITY.CRITICAL);
    assert.ok(criticalRules.length >= 1);
});

test('registerRule adds new rule', () => {
    const reg = new RuleRegistry();
    const rule = { id: 'TEST-001', category: REVIEW_CATEGORIES.SCHEMA, severity: SEVERITY.LOW, title: 'Test', check: () => true };
    reg.register(rule);
    assert.strictEqual(reg.getRule('TEST-001').id, 'TEST-001');
});

test('registerModuleRules adds rules with moduleId', () => {
    const reg = new RuleRegistry();
    reg.registerModuleRules('test.module', [
        { id: 'MOD-TEST', category: REVIEW_CATEGORIES.MODULE_SPECIFIC, severity: SEVERITY.MEDIUM, title: 'Module test', check: () => true }
    ]);
    const rule = reg.getRule('MOD-TEST');
    assert.strictEqual(rule.moduleId, 'test.module');
});

test('evaluateRule passes when check returns true', () => {
    const reg = new RuleRegistry();
    const result = reg.evaluateRule({ id: 'X', category: 'schema', severity: 'high', title: 'X', check: () => true }, {});
    assert.strictEqual(result.passed, true);
});

test('evaluateRule fails when check returns false', () => {
    const reg = new RuleRegistry();
    const result = reg.evaluateRule({ id: 'X', category: 'schema', severity: 'high', title: 'X', message: 'Failed', check: () => false }, {});
    assert.strictEqual(result.passed, false);
    assert.ok(result.finding);
});

test('getCountsByCategory returns category counts', () => {
    const reg = new RuleRegistry();
    const counts = reg.getCountsByCategory();
    assert.ok(Object.keys(counts).length > 3);
});

console.log('\n📁 finding-store tests');

test('addFinding creates finding with ID', () => {
    const store = new FindingStore();
    const f = store.addFinding({ ruleId: 'TEST', category: 'schema', severity: 'high', title: 'Test Finding', message: 'Test' });
    assert.ok(f.id);
    assert.strictEqual(f.status, FINDING_STATUS.OPEN);
});

test('getFinding returns null for missing', () => {
    const store = new FindingStore();
    assert.strictEqual(store.getFinding('NONEXISTENT'), null);
});

test('addFindings adds multiple', () => {
    const store = new FindingStore();
    store.addFindings([
        { ruleId: 'A', category: 'schema', severity: 'high', title: 'A', message: 'A' },
        { ruleId: 'B', category: 'task', severity: 'medium', title: 'B', message: 'B' }
    ]);
    assert.strictEqual(store.getFindings().length, 2);
});

test('getFindings filters by severity', () => {
    const store = new FindingStore();
    store.addFindings([
        { ruleId: 'A', category: 'schema', severity: 'high', title: 'A', message: 'A' },
        { ruleId: 'B', category: 'task', severity: 'low', title: 'B', message: 'B' }
    ]);
    const high = store.getFindings({ severity: 'high' });
    assert.strictEqual(high.length, 1);
});

test('changeStatus validates transitions', () => {
    const store = new FindingStore();
    const f = store.addFinding({ ruleId: 'T', category: 'schema', severity: 'high', title: 'T', message: 'T' });
    const r1 = store.changeStatus(f.id, FINDING_STATUS.ACKNOWLEDGED);
    assert.ok(r1.success);
    const r2 = store.changeStatus(f.id, FINDING_STATUS.IN_PROGRESS);
    assert.ok(r2.success);
    const r3 = store.changeStatus(f.id, FINDING_STATUS.RESOLVED);
    assert.ok(r3.success);
});

test('changeStatus blocks invalid transitions', () => {
    const store = new FindingStore();
    const f = store.addFinding({ ruleId: 'T', category: 'schema', severity: 'high', title: 'T', message: 'T' });
    const r = store.changeStatus(f.id, FINDING_STATUS.RESOLVED);
    assert.strictEqual(r.success, false);
});

test('markFalsePositive sets status', () => {
    const store = new FindingStore();
    const f = store.addFinding({ ruleId: 'T', category: 'schema', severity: 'high', title: 'T', message: 'T' });
    store.markFalsePositive(f.id, 'Not applicable');
    assert.strictEqual(store.getFinding(f.id).status, FINDING_STATUS.FALSE_POSITIVE);
});

test('getFindingsByEntity finds related findings', () => {
    const store = new FindingStore();
    store.addFinding({ ruleId: 'T', category: 'task', severity: 'high', title: 'T', message: 'T', affectedEntities: ['TASK-001'] });
    const found = store.getFindingsByEntity('TASK-001');
    assert.strictEqual(found.length, 1);
});

test('getStats returns counts', () => {
    const store = new FindingStore();
    store.addFinding({ ruleId: 'T', category: 'schema', severity: 'critical', title: 'T', message: 'T' });
    const stats = store.getStats();
    assert.strictEqual(stats.total, 1);
    assert.strictEqual(stats.open, 1);
});

test('toJSON and fromJSON roundtrip', () => {
    const store = new FindingStore();
    store.addFinding({ ruleId: 'T', category: 'schema', severity: 'high', title: 'T', message: 'T' });
    const json = store.toJSON();
    const restored = FindingStore.fromJSON(json);
    assert.strictEqual(restored.getFindings().length, 1);
});

console.log('\n🚪 quality-gate tests');

test('QualityGate evaluate returns result', () => {
    const qg = new QualityGate();
    const result = qg.evaluate(GATES.PLAN_ONLY, { findings: [], healthScore: 50 });
    assert.ok('passed' in result);
    assert.ok(result.metrics);
});

test('QualityGate evaluate fails with critical findings', () => {
    const qg = new QualityGate();
    const findings = [
        { severity: SEVERITY.CRITICAL, status: FINDING_STATUS.OPEN },
        { severity: SEVERITY.HIGH, status: FINDING_STATUS.OPEN }
    ];
    const completeResult = qg.evaluate(GATES.COMPLETE, { findings, healthScore: 90 });
    assert.strictEqual(completeResult.passed, false);
});

test('QualityGate evaluateAll returns all gates', () => {
    const qg = new QualityGate();
    const results = qg.evaluateAll({ findings: [], healthScore: 50 });
    assert.strictEqual(Object.keys(results).length, 4);
});

test('determineReadinessLevel returns level', () => {
    const level = QualityGate.determineReadinessLevel(85, []);
    assert.ok(level);
    assert.ok(level.label);
});

test('determineReadinessLevel caps with critical findings', () => {
    const findings = [{ severity: SEVERITY.CRITICAL, status: FINDING_STATUS.OPEN }];
    const level = QualityGate.determineReadinessLevel(90, findings);
    assert.strictEqual(level.id, 'discovery_ready');
});

console.log('\n❤️ health-score tests');

test('HealthScore calculate returns structure', () => {
    const hs = new HealthScore();
    const result = hs.calculate([]);
    assert.ok('overall' in result);
    assert.ok(result.categories);
    assert.strictEqual(result.overall, 100);
});

test('HealthScore penalizes findings', () => {
    const hs = new HealthScore();
    const result = hs.calculate([
        { category: 'tasks', severity: SEVERITY.CRITICAL, status: FINDING_STATUS.OPEN },
        { category: 'tasks', severity: SEVERITY.HIGH, status: FINDING_STATUS.OPEN }
    ]);
    assert.ok(result.overall < 100);
    assert.ok(result.categories.tasks < 100);
});

test('HealthScore respects resolved findings', () => {
    const hs = new HealthScore();
    const result = hs.calculate([
        { category: 'tasks', severity: SEVERITY.CRITICAL, status: FINDING_STATUS.RESOLVED }
    ]);
    assert.strictEqual(result.overall, 100);
});

test('HealthScore critical caps lower score', () => {
    const hs = new HealthScore(null, [
        { condition: { category: 'schema', minSeverity: 'critical' }, maxScore: 20, message: 'Critical error' }
    ]);
    const result = hs.calculate([
        { category: 'schema', severity: SEVERITY.CRITICAL, status: FINDING_STATUS.OPEN }
    ]);
    assert.ok(result.overall <= 20);
});

console.log('\n🧪 review-engine tests');

test('ReviewEngine runReview returns report', () => {
    const engine = new ReviewEngine();
    const report = engine.runReview({ state: {} });
    assert.ok(report.health);
    assert.ok(report.readiness);
    assert.ok(report.gates);
    assert.ok(report.findings);
    assert.ok(report.summary);
});

test('ReviewEngine runQuickReview uses quick profile', () => {
    const engine = new ReviewEngine();
    const report = engine.runQuickReview({ state: {} });
    assert.strictEqual(report.profile, 'quick');
});

test('ReviewEngine runDeepReview uses deep profile', () => {
    const engine = new ReviewEngine();
    const report = engine.runDeepReview({ state: {} });
    assert.strictEqual(report.profile, 'deep');
});

test('ReviewEngine with traceability adds findings', () => {
    const te = new TraceabilityEngine();
    te.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    const engine = new ReviewEngine({ traceability: te });
    const report = engine.runReview({ state: {} });
    const orphanFindings = report.findings.items.filter(f => f.ruleId === 'TRACE-ORPHAN');
    assert.ok(orphanFindings.length > 0);
});

test('ReviewEngine runIncrementalReview returns new findings', () => {
    const engine = new ReviewEngine();
    const result = engine.runIncrementalReview({ state: {} }, ['TASK-001']);
    assert.strictEqual(result.profile, 'incremental');
    assert.ok(Array.isArray(result.newFindings));
});

test('evaluateGate returns gate result', () => {
    const engine = new ReviewEngine();
    const result = engine.evaluateGate(GATES.PLAN_ONLY);
    assert.ok('passed' in result);
});

test('toMarkdownReport returns string', () => {
    const engine = new ReviewEngine();
    engine.runReview({ state: {} });
    const md = engine.toMarkdownReport();
    assert.ok(typeof md === 'string');
    assert.ok(md.length > 20);
    assert.ok(md.includes('Proje Sağlık Raporu'));
});

test('ReviewEngine scores from state context', () => {
    const engine = new ReviewEngine();
    const report = engine.runReview({
        state: {
            identity: { name: 'Test', problemStatement: 'Test prob' },
            stakeholders: [{ id: 'STK-001', name: 'User' }],
            scope: { mustHave: ['Feature A'] }
        },
        decisions: [{ id: 'DEC-001', title: 'Test', rationale: 'Testing', sourceRequirementIds: ['R1'] }],
        tasks: [{ id: 'TASK-001', title: 'Test', acceptanceCriteria: ['AC1'], filesToCreate: ['test.js'] }]
    });
    assert.ok(report.health.overall >= 0);
});

console.log(`\n  Section 12: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
