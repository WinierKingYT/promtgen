import assert from 'assert';
import { GraphStore } from '../../src/core/traceability/graph-store.js';
import { TraceabilityEngine } from '../../src/core/traceability/traceability-engine.js';
import { CoverageCalculator } from '../../src/core/traceability/coverage-calculator.js';
import { OrphanDetector } from '../../src/core/traceability/orphan-detector.js';
import { ImpactEngine } from '../../src/core/traceability/impact-engine.js';
import {
    NODE_TYPES, EDGE_TYPES, getAllNodeTypes, getAllEdgeTypes,
    getAllEdgeStrengths, getDefaultImpactRules, getDefaultMinTraceabilityRules
} from '../../src/core/traceability/traceability-types.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  ✅ ${name}`); passed++; }
    catch (e) { console.error(`  ❌ ${name}\n     ${e.message}`); failed++; }
}

console.log('\n🔗 traceability-types tests');

test('getAllNodeTypes returns all node types', () => {
    const types = getAllNodeTypes();
    assert.ok(types.length >= 20);
    assert.ok(types.includes(NODE_TYPES.OBJECTIVE));
    assert.ok(types.includes(NODE_TYPES.GAME_MECHANIC));
});

test('getAllEdgeTypes returns all edge types', () => {
    const types = getAllEdgeTypes();
    assert.ok(types.length >= 15);
    assert.ok(types.includes(EDGE_TYPES.SUPPORTS));
});

test('getAllEdgeStrengths returns 3 levels', () => {
    const s = getAllEdgeStrengths();
    assert.strictEqual(s.length, 3);
});

test('getDefaultImpactRules returns array', () => {
    const rules = getDefaultImpactRules();
    assert.ok(rules.length > 0);
    assert.ok(rules[0].sourceType);
});

test('getDefaultMinTraceabilityRules returns array', () => {
    const rules = getDefaultMinTraceabilityRules();
    assert.ok(rules.length > 0);
});

console.log('\n📦 graph-store tests');

test('addNode creates and stores node', () => {
    const g = new GraphStore();
    const n = g.addNode(NODE_TYPES.OBJECTIVE, 'OBJ-001', 'Test objective');
    assert.strictEqual(n.id, 'OBJ-001');
    assert.strictEqual(g.getNode('OBJ-001').label, 'Test objective');
});

test('addNode throws on duplicate', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    assert.throws(() => g.addNode(NODE_TYPES.DECISION, 'R1', 'D1'), /already exists/);
});

test('addNode throws on invalid type', () => {
    const g = new GraphStore();
    assert.throws(() => g.addNode('invalid', 'X', 'X'), /Invalid node type/);
});

test('getNode returns null for missing', () => {
    const g = new GraphStore();
    assert.strictEqual(g.getNode('missing'), null);
});

test('getNodesByType filters correctly', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.OBJECTIVE, 'O1', 'O1');
    g.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    g.addNode(NODE_TYPES.REQUIREMENT, 'R2', 'R2');
    assert.strictEqual(g.getNodesByType(NODE_TYPES.OBJECTIVE).length, 1);
    assert.strictEqual(g.getNodesByType(NODE_TYPES.REQUIREMENT).length, 2);
});

test('removeNode deletes node and edges', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    g.addNode(NODE_TYPES.DECISION, 'D1', 'D1');
    g.addEdge('D1', 'R1', EDGE_TYPES.SUPPORTS);
    assert.ok(g.removeNode('D1'));
    assert.strictEqual(g.getNode('D1'), null);
    assert.strictEqual(g.getEdgeCount(), 0);
});

test('addEdge creates edge', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.DECISION, 'D1', 'D1');
    g.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    const e = g.addEdge('D1', 'R1', EDGE_TYPES.SUPPORTS);
    assert.strictEqual(e.sourceId, 'D1');
    assert.strictEqual(e.type, EDGE_TYPES.SUPPORTS);
    assert.strictEqual(e.strength, 'required');
});

test('addEdge throws for missing source', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    assert.throws(() => g.addEdge('MISSING', 'R1', EDGE_TYPES.SUPPORTS), /Source node/);
});

test('getOutgoingEdges returns correct count', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.DECISION, 'D1', 'D1');
    g.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    g.addNode(NODE_TYPES.REQUIREMENT, 'R2', 'R2');
    g.addEdge('D1', 'R1', EDGE_TYPES.SUPPORTS);
    g.addEdge('D1', 'R2', EDGE_TYPES.SUPPORTS);
    assert.strictEqual(g.getOutgoingEdges('D1').length, 2);
});

test('getIncomingEdges returns correct count', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.DECISION, 'D1', 'D1');
    g.addNode(NODE_TYPES.DECISION, 'D2', 'D2');
    g.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    g.addEdge('D1', 'R1', EDGE_TYPES.SUPPORTS);
    g.addEdge('D2', 'R1', EDGE_TYPES.SUPPORTS);
    assert.strictEqual(g.getIncomingEdges('R1').length, 2);
});

test('getForwardTrace traverses correctly', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    g.addNode(NODE_TYPES.DECISION, 'D1', 'D1');
    g.addNode(NODE_TYPES.ARCHITECTURE_COMPONENT, 'C1', 'C1');
    g.addNode(NODE_TYPES.TASK, 'T1', 'T1');
    g.addEdge('D1', 'R1', EDGE_TYPES.SUPPORTS);
    g.addEdge('C1', 'D1', EDGE_TYPES.CONSTRAINED_BY);
    g.addEdge('T1', 'C1', EDGE_TYPES.IMPLEMENTS);
    const trace = g.getForwardTrace('T1');
    const ids = trace.map(n => n.id);
    assert.ok(ids.includes('C1'));
    assert.ok(ids.includes('D1'));
    assert.ok(ids.includes('R1'));
});

test('getBackwardTrace finds dependents', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    g.addNode(NODE_TYPES.DECISION, 'D1', 'D1');
    g.addNode(NODE_TYPES.ARCHITECTURE_COMPONENT, 'C1', 'C1');
    g.addNode(NODE_TYPES.TASK, 'T1', 'T1');
    g.addEdge('D1', 'R1', EDGE_TYPES.SUPPORTS);
    g.addEdge('C1', 'D1', EDGE_TYPES.CONSTRAINED_BY);
    g.addEdge('T1', 'C1', EDGE_TYPES.IMPLEMENTS);
    const trace = g.getBackwardTrace('R1');
    const ids = trace.map(n => n.id);
    assert.ok(ids.includes('D1'));
    assert.ok(ids.includes('C1'));
    assert.ok(ids.includes('T1'));
});

test('detectCycles finds dependency loops', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.TASK, 'T1', 'T1');
    g.addNode(NODE_TYPES.TASK, 'T2', 'T2');
    g.addNode(NODE_TYPES.TASK, 'T3', 'T3');
    g.addEdge('T1', 'T2', EDGE_TYPES.DEPENDS_ON);
    g.addEdge('T2', 'T3', EDGE_TYPES.DEPENDS_ON);
    g.addEdge('T3', 'T1', EDGE_TYPES.DEPENDS_ON);
    const cycles = g.detectCycles();
    assert.ok(cycles.length > 0);
});

test('no cycles for acyclic graph', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.TASK, 'T1', 'T1');
    g.addNode(NODE_TYPES.TASK, 'T2', 'T2');
    g.addEdge('T1', 'T2', EDGE_TYPES.DEPENDS_ON);
    assert.strictEqual(g.detectCycles().length, 0);
});

test('getStats returns node and edge counts', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.OBJECTIVE, 'O1', 'O1');
    g.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    g.addEdge('O1', 'R1', EDGE_TYPES.REFINES);
    const stats = g.getStats();
    assert.strictEqual(stats.totalNodes, 2);
    assert.strictEqual(stats.totalEdges, 1);
});

test('toJSON and fromJSON roundtrip', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    g.addNode(NODE_TYPES.DECISION, 'D1', 'D1');
    g.addEdge('D1', 'R1', EDGE_TYPES.SUPPORTS);
    const json = g.toJSON();
    const restored = GraphStore.fromJSON(json);
    assert.strictEqual(restored.getAllNodes().length, 2);
    assert.strictEqual(restored.getEdgeCount(), 1);
    assert.ok(restored.getNode('R1'));
});

test('createSnapshot stores revision', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    const snap = g.createSnapshot(5);
    assert.strictEqual(snap.projectRevision, 5);
    assert.strictEqual(snap.nodeCount, 1);
});

test('diff detects added nodes', () => {
    const g1 = new GraphStore();
    g1.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    const snap1 = g1.createSnapshot(1);

    const g2 = new GraphStore();
    g2.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    g2.addNode(NODE_TYPES.DECISION, 'D1', 'D1');
    const snap2 = g2.createSnapshot(2);

    const diff = GraphStore.diff(snap1, snap2);
    assert.strictEqual(diff.addedNodes.length, 1);
    assert.strictEqual(diff.nodeCountDiff, 1);
});

test('findPath returns path between nodes', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.TASK, 'T1', 'T1');
    g.addNode(NODE_TYPES.TASK, 'T2', 'T2');
    g.addNode(NODE_TYPES.TASK, 'T3', 'T3');
    g.addEdge('T1', 'T2', EDGE_TYPES.DEPENDS_ON);
    g.addEdge('T2', 'T3', EDGE_TYPES.DEPENDS_ON);
    const path = g.findPath('T1', 'T3');
    assert.ok(path);
    assert.strictEqual(path.length, 3);
});

test('getOutgoingNodes by type', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.DECISION, 'D1', 'D1');
    g.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    g.addNode(NODE_TYPES.TASK, 'T1', 'T1');
    g.addEdge('D1', 'R1', EDGE_TYPES.SUPPORTS);
    g.addEdge('D1', 'T1', EDGE_TYPES.IMPLEMENTS);
    const suppNodes = g.getOutgoingNodes('D1', EDGE_TYPES.SUPPORTS);
    assert.strictEqual(suppNodes.length, 1);
    assert.strictEqual(suppNodes[0].id, 'R1');
});

console.log('\n📊 coverage-calculator tests');

test('requirementCoverage returns metrics', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    g.addNode(NODE_TYPES.REQUIREMENT, 'R2', 'R2');
    g.addNode(NODE_TYPES.TASK, 'T1', 'T1');
    g.addNode(NODE_TYPES.TEST, 'TEST1', 'TEST1');
    g.addEdge('R1', 'T1', EDGE_TYPES.IMPLEMENTS);
    g.addEdge('R2', 'TEST1', EDGE_TYPES.VALIDATED_BY);
    const cc = new CoverageCalculator(g);
    const cov = cc.requirementCoverage();
    assert.strictEqual(cov.total, 2);
    assert.strictEqual(cov.withTasks, 1);
    assert.strictEqual(cov.withTests, 1);
});

test('requirementCoverage handles empty graph', () => {
    const cc = new CoverageCalculator(new GraphStore());
    const cov = cc.requirementCoverage();
    assert.strictEqual(cov.total, 0);
});

test('objectiveCoverage returns metrics', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.OBJECTIVE, 'O1', 'O1');
    g.addNode(NODE_TYPES.OBJECTIVE, 'O2', 'O2');
    g.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    g.addNode(NODE_TYPES.DELIVERABLE, 'D1', 'D1');
    g.addEdge('O1', 'R1', EDGE_TYPES.REFINES);
    g.addEdge('O2', 'D1', EDGE_TYPES.PRODUCES);
    const cc = new CoverageCalculator(g);
    const cov = cc.objectiveCoverage();
    assert.strictEqual(cov.total, 2);
    assert.strictEqual(cov.withRequirements, 1);
});

test('decisionCoverage returns metrics', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.DECISION, 'D1', 'Long rationale decision title');
    g.addNode(NODE_TYPES.DECISION, 'D2', 'Short');
    const cc = new CoverageCalculator(g);
    const cov = cc.decisionCoverage();
    assert.strictEqual(cov.total, 2);
    assert.strictEqual(cov.withRationale, 1);
});

test('allCoverage returns all metrics', () => {
    const cc = new CoverageCalculator(new GraphStore());
    const all = cc.allCoverage();
    assert.ok(all.requirements !== undefined);
    assert.ok(all.objectives !== undefined);
    assert.ok(all.decisions !== undefined);
});

console.log('\n👻 orphan-detector tests');

test('findOrphans detects unconnected nodes', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    g.addNode(NODE_TYPES.DECISION, 'D1', 'D1');
    g.addNode(NODE_TYPES.TASK, 'T1', 'T1');
    const od = new OrphanDetector(g);
    const orphans = od.findOrphans();
    assert.strictEqual(orphans.length, 3);
});

test('findOrphans excludes connected nodes', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    g.addNode(NODE_TYPES.DECISION, 'D1', 'D1');
    g.addEdge('D1', 'R1', EDGE_TYPES.SUPPORTS);
    const od = new OrphanDetector(g);
    const orphans = od.findOrphans();
    assert.strictEqual(orphans.length, 0);
});

test('findAll returns total count', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    const od = new OrphanDetector(g);
    const result = od.findAll();
    assert.ok(result.total > 0);
});

console.log('\n⚡ impact-engine tests');

test('analyzeChange returns effects for changed entity', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.DECISION, 'D1', 'D1');
    g.addNode(NODE_TYPES.ARCHITECTURE_COMPONENT, 'C1', 'C1');
    g.addEdge('D1', 'C1', EDGE_TYPES.DRIVES);

    const ie = new ImpactEngine(g);
    const result = ie.analyzeChange(['D1']);
    assert.ok(result.effects.length > 0);
    assert.ok(result.summary.total > 0);
});

test('analyzeChange returns direct changes', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    const ie = new ImpactEngine(g);
    const result = ie.analyzeChange(['R1']);
    assert.strictEqual(result.directChanges.length, 1);
    assert.strictEqual(result.directChanges[0].entityId, 'R1');
});

test('impact engine custom rules', () => {
    const g = new GraphStore();
    g.addNode(NODE_TYPES.TASK, 'T1', 'T1');
    g.addNode(NODE_TYPES.TASK, 'T2', 'T2');
    g.addEdge('T1', 'T2', EDGE_TYPES.DEPENDS_ON);

    const ie = new ImpactEngine(g, [
        { sourceType: 'task', edgeType: EDGE_TYPES.DEPENDS_ON, targetType: 'task', effect: 'invalidate', severity: 'high', propagate: true }
    ]);
    const result = ie.analyzeChange(['T1']);
    assert.ok(result.effects.length > 0);
});

test('registerRules adds new rules', () => {
    const ie = new ImpactEngine(new GraphStore());
    ie.registerRules([{ sourceType: 'test', edgeType: 'test', targetType: 'test', effect: 'review', severity: 'low', propagate: false }]);
    assert.strictEqual(ie.rules.length, getDefaultImpactRules().length + 1);
});

console.log('\n🧩 traceability-engine tests');

test('TraceabilityEngine creates empty graph', () => {
    const te = new TraceabilityEngine();
    assert.strictEqual(te.graph.getNodeCount(), 0);
});

test('TraceabilityEngine addNode and getNode', () => {
    const te = new TraceabilityEngine();
    te.addNode(NODE_TYPES.OBJECTIVE, 'O1', 'Test');
    assert.ok(te.getNode('O1'));
});

test('getFullReport returns structure', () => {
    const te = new TraceabilityEngine();
    te.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    const report = te.getFullReport();
    assert.ok(report.stats);
    assert.ok(report.coverage);
    assert.ok(report.orphans);
    assert.ok(report.findings);
    assert.ok(report.health);
});

test('buildGraphFromState creates graph', () => {
    const te = new TraceabilityEngine();
    const state = {
        objectives: [{ id: 'OBJ-001', title: 'Main objective' }],
        requirements: [{ id: 'REQ-001', title: 'Req 1' }],
        decisions: [{ id: 'DEC-001', title: 'Decision 1', rationale: 'Test' }],
        tasks: [{ id: 'TASK-001', title: 'Task 1', acceptanceCriteria: ['AC1'] }],
        architecture: [{ id: 'ARC-001', name: 'Component 1' }]
    };
    const te2 = te.buildGraphFromState(state);
    assert.ok(te2.graph.getNodeCount() >= 5);
});

test('buildGraphFromState handles null state', () => {
    const te = new TraceabilityEngine();
    const te2 = te.buildGraphFromState(null);
    assert.strictEqual(te2.graph.getNodeCount(), 0);
});

test('detectCycles via engine', () => {
    const te = new TraceabilityEngine();
    te.addNode(NODE_TYPES.TASK, 'T1', 'T1');
    te.addNode(NODE_TYPES.TASK, 'T2', 'T2');
    te.addEdge('T1', 'T2', EDGE_TYPES.DEPENDS_ON);
    te.addEdge('T2', 'T1', EDGE_TYPES.DEPENDS_ON);
    const cycles = te.detectCycles();
    assert.ok(cycles.length > 0);
});

test('toJSON and fromJSON via engine', () => {
    const te = new TraceabilityEngine();
    te.addNode(NODE_TYPES.REQUIREMENT, 'R1', 'R1');
    te.addNode(NODE_TYPES.DECISION, 'D1', 'D1');
    te.addEdge('D1', 'R1', EDGE_TYPES.SUPPORTS);
    const json = te.toJSON();
    const restored = TraceabilityEngine.fromJSON(json);
    assert.strictEqual(restored.graph.getNodeCount(), 2);
});

console.log(`\n  Section 11: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
