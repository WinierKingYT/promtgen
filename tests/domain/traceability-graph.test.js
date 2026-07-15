import assert from 'assert';
import { TraceabilityGraph, NODE_TYPES, EDGE_TYPES } from '../../src/domain/traceability-graph.js';
import { getInitialCanonicalState } from '../../src/state/project-state.js';

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

console.log('\n🔗 traceability-graph tests');

test('addNode creates a node and stores it', () => {
    const g = new TraceabilityGraph();
    const node = g.addNode(NODE_TYPES.REQUIREMENT, 'req-1', 'User login');
    assert.strictEqual(node.id, 'req-1');
    assert.strictEqual(node.label, 'User login');
    assert.strictEqual(node.type, 'requirement');
    assert.ok(node.createdAt);
});

test('addNode throws on duplicate id', () => {
    const g = new TraceabilityGraph();
    g.addNode(NODE_TYPES.REQUIREMENT, 'req-1', 'First');
    assert.throws(() => g.addNode(NODE_TYPES.DECISION, 'req-1', 'Second'), /already exists/);
});

test('addNode throws on invalid type', () => {
    const g = new TraceabilityGraph();
    assert.throws(() => g.addNode('invalid', 'x', 'X'), /Invalid node type/);
});

test('getNode returns node by id', () => {
    const g = new TraceabilityGraph();
    g.addNode(NODE_TYPES.DECISION, 'dec-1', 'Use React');
    const node = g.getNode('dec-1');
    assert.ok(node);
    assert.strictEqual(node.label, 'Use React');
});

test('getNode returns undefined for missing id', () => {
    const g = new TraceabilityGraph();
    assert.strictEqual(g.getNode('nonexistent'), undefined);
});

test('getNodesByType filters correctly', () => {
    const g = new TraceabilityGraph();
    g.addNode(NODE_TYPES.REQUIREMENT, 'r1', 'Req A');
    g.addNode(NODE_TYPES.DECISION, 'd1', 'Dec A');
    g.addNode(NODE_TYPES.COMPONENT, 'c1', 'Comp A');
    g.addNode(NODE_TYPES.TASK, 't1', 'Task A');
    g.addNode(NODE_TYPES.REQUIREMENT, 'r2', 'Req B');
    assert.strictEqual(g.getNodesByType(NODE_TYPES.REQUIREMENT).length, 2);
    assert.strictEqual(g.getNodesByType(NODE_TYPES.TASK).length, 1);
    assert.strictEqual(g.getNodesByType(NODE_TYPES.DECISION).length, 1);
});

test('removeNode deletes node and its edges', () => {
    const g = new TraceabilityGraph();
    g.addNode(NODE_TYPES.REQUIREMENT, 'r1', 'Req');
    g.addNode(NODE_TYPES.DECISION, 'd1', 'Dec');
    g.addEdge('d1', 'r1', EDGE_TYPES.REALIZES);
    assert.ok(g.removeNode('d1'));
    assert.strictEqual(g.getNode('d1'), undefined);
    assert.strictEqual(g.getEdgesForNode('r1').length, 0);
});

test('addEdge creates edge between existing nodes', () => {
    const g = new TraceabilityGraph();
    g.addNode(NODE_TYPES.DECISION, 'd1', 'Decision');
    g.addNode(NODE_TYPES.REQUIREMENT, 'r1', 'Requirement');
    const edge = g.addEdge('d1', 'r1', EDGE_TYPES.REALIZES);
    assert.strictEqual(edge.sourceId, 'd1');
    assert.strictEqual(edge.targetId, 'r1');
    assert.strictEqual(edge.type, EDGE_TYPES.REALIZES);
});

test('addEdge throws if source missing', () => {
    const g = new TraceabilityGraph();
    g.addNode(NODE_TYPES.REQUIREMENT, 'r1', 'Req');
    assert.throws(() => g.addEdge('missing', 'r1'), /Source node/);
});

test('addEdge throws if target missing', () => {
    const g = new TraceabilityGraph();
    g.addNode(NODE_TYPES.DECISION, 'd1', 'Dec');
    assert.throws(() => g.addEdge('d1', 'missing'), /Target node/);
});

test('getOutgoingEdges returns edges from node', () => {
    const g = new TraceabilityGraph();
    g.addNode(NODE_TYPES.DECISION, 'd1', 'D1');
    g.addNode(NODE_TYPES.REQUIREMENT, 'r1', 'R1');
    g.addNode(NODE_TYPES.REQUIREMENT, 'r2', 'R2');
    g.addEdge('d1', 'r1', EDGE_TYPES.REALIZES);
    g.addEdge('d1', 'r2', EDGE_TYPES.REALIZES);
    assert.strictEqual(g.getOutgoingEdges('d1').length, 2);
});

test('getIncomingEdges returns edges to node', () => {
    const g = new TraceabilityGraph();
    g.addNode(NODE_TYPES.DECISION, 'd1', 'D1');
    g.addNode(NODE_TYPES.DECISION, 'd2', 'D2');
    g.addNode(NODE_TYPES.REQUIREMENT, 'r1', 'R1');
    g.addEdge('d1', 'r1', EDGE_TYPES.REALIZES);
    g.addEdge('d2', 'r1', EDGE_TYPES.REALIZES);
    assert.strictEqual(g.getIncomingEdges('r1').length, 2);
});

test('getForwardTrace traverses outgoing edges', () => {
    const g = new TraceabilityGraph();
    g.addNode(NODE_TYPES.REQUIREMENT, 'r1', 'Req');
    g.addNode(NODE_TYPES.DECISION, 'd1', 'Dec');
    g.addNode(NODE_TYPES.COMPONENT, 'c1', 'Comp');
    g.addNode(NODE_TYPES.TASK, 't1', 'Task');
    g.addEdge('d1', 'r1', EDGE_TYPES.REALIZES);
    g.addEdge('c1', 'd1', EDGE_TYPES.IMPLEMENTS);
    g.addEdge('t1', 'c1', EDGE_TYPES.IMPLEMENTS);
    const trace = g.getForwardTrace('r1');
    assert.strictEqual(trace.length, 0);
});

test('getForwardTrace from task finds all ancestors', () => {
    const g = new TraceabilityGraph();
    g.addNode(NODE_TYPES.REQUIREMENT, 'r1', 'Req');
    g.addNode(NODE_TYPES.DECISION, 'd1', 'Dec');
    g.addNode(NODE_TYPES.COMPONENT, 'c1', 'Comp');
    g.addNode(NODE_TYPES.TASK, 't1', 'Task');
    g.addEdge('d1', 'r1', EDGE_TYPES.REALIZES);
    g.addEdge('c1', 'd1', EDGE_TYPES.IMPLEMENTS);
    g.addEdge('t1', 'c1', EDGE_TYPES.IMPLEMENTS);
    const trace = g.getForwardTrace('t1');
    const ids = trace.map(n => n.id);
    assert.ok(ids.includes('c1'));
    assert.ok(ids.includes('d1'));
    assert.ok(ids.includes('r1'));
});

test('getBackwardTrace from requirement finds all dependents', () => {
    const g = new TraceabilityGraph();
    g.addNode(NODE_TYPES.REQUIREMENT, 'r1', 'Req');
    g.addNode(NODE_TYPES.DECISION, 'd1', 'Dec');
    g.addNode(NODE_TYPES.COMPONENT, 'c1', 'Comp');
    g.addNode(NODE_TYPES.TASK, 't1', 'Task');
    g.addEdge('d1', 'r1', EDGE_TYPES.REALIZES);
    g.addEdge('c1', 'd1', EDGE_TYPES.IMPLEMENTS);
    g.addEdge('t1', 'c1', EDGE_TYPES.IMPLEMENTS);
    const trace = g.getBackwardTrace('r1');
    const ids = trace.map(n => n.id);
    assert.ok(ids.includes('d1'));
    assert.ok(ids.includes('c1'));
    assert.ok(ids.includes('t1'));
});

test('getTraceChain returns combined forward and backward', () => {
    const g = new TraceabilityGraph();
    g.addNode(NODE_TYPES.REQUIREMENT, 'r1', 'Req');
    g.addNode(NODE_TYPES.DECISION, 'd1', 'Dec');
    g.addNode(NODE_TYPES.COMPONENT, 'c1', 'Comp');
    g.addNode(NODE_TYPES.TASK, 't1', 'Task');
    g.addEdge('d1', 'r1', EDGE_TYPES.REALIZES);
    g.addEdge('c1', 'd1', EDGE_TYPES.IMPLEMENTS);
    g.addEdge('t1', 'c1', EDGE_TYPES.IMPLEMENTS);
    const chain = g.getTraceChain('d1');
    const ids = chain.map(n => n.id);
    assert.ok(ids.includes('r1'));
    assert.ok(ids.includes('c1'));
    assert.ok(ids.includes('t1'));
});

test('getImpactAnalysis returns affected nodes with reasons', () => {
    const g = new TraceabilityGraph();
    g.addNode(NODE_TYPES.REQUIREMENT, 'r1', 'Req A');
    g.addNode(NODE_TYPES.DECISION, 'd1', 'Dec for A');
    g.addNode(NODE_TYPES.COMPONENT, 'c1', 'Comp for A');
    g.addNode(NODE_TYPES.TASK, 't1', 'Task for A');
    g.addEdge('d1', 'r1', EDGE_TYPES.REALIZES);
    g.addEdge('c1', 'd1', EDGE_TYPES.IMPLEMENTS);
    g.addEdge('t1', 'c1', EDGE_TYPES.IMPLEMENTS);
    const impact = g.getImpactAnalysis(['r1']);
    assert.ok(impact.length > 0);
    const affectedIds = impact.map(i => i.node.id);
    assert.ok(affectedIds.includes('d1'));
    assert.ok(affectedIds.includes('c1'));
    assert.ok(affectedIds.includes('t1'));
});

test('getCoverageGaps detects unlinked nodes', () => {
    const g = new TraceabilityGraph();
    g.addNode(NODE_TYPES.REQUIREMENT, 'r1', 'Orphan Req');
    g.addNode(NODE_TYPES.DECISION, 'd1', 'Orphan Dec');
    const gaps = g.getCoverageGaps();
    assert.strictEqual(gaps.requirementsWithoutDecisions.length, 1);
    assert.strictEqual(gaps.decisionsWithoutComponents.length, 1);
    assert.strictEqual(gaps.unlinkedNodes.length, 2);
});

test('getCoverageGaps detects fully linked graph', () => {
    const g = new TraceabilityGraph();
    g.addNode(NODE_TYPES.REQUIREMENT, 'r1', 'Req');
    g.addNode(NODE_TYPES.DECISION, 'd1', 'Dec');
    g.addNode(NODE_TYPES.COMPONENT, 'c1', 'Comp');
    g.addNode(NODE_TYPES.TASK, 't1', 'Task');
    g.addEdge('d1', 'r1', EDGE_TYPES.REALIZES);
    g.addEdge('c1', 'd1', EDGE_TYPES.IMPLEMENTS);
    g.addEdge('t1', 'c1', EDGE_TYPES.IMPLEMENTS);
    const gaps = g.getCoverageGaps();
    assert.strictEqual(gaps.requirementsWithoutDecisions.length, 0);
    assert.strictEqual(gaps.decisionsWithoutComponents.length, 0);
    assert.strictEqual(gaps.componentsWithoutTasks.length, 0);
    assert.strictEqual(gaps.unlinkedNodes.length, 0);
});

test('buildFromState creates nodes from canonical state', () => {
    const state = getInitialCanonicalState();
    state.requirements.functional = ['User authentication', 'Dashboard'];
    state.requirements.nonFunctional = ['Performance under load'];
    state.decisions = [
        { id: 'dec-1', title: 'Use JWT', decision: 'JWT for auth', reason: 'Stateless' },
        { id: 'dec-2', title: 'Use React', decision: 'React for UI', reason: 'Ecosystem' }
    ];
    state.architecture.components = ['AuthService', 'DashboardWidget'];
    state.tasks = [
        { id: 'T-001', title: 'Implement JWT middleware' },
        { id: 'T-002', title: 'Build dashboard' },
        { id: 'T-003', title: 'Write tests' }
    ];
    const g = TraceabilityGraph.buildFromState(state);
    assert.strictEqual(g.getNodesByType(NODE_TYPES.REQUIREMENT).length, 3);
    assert.strictEqual(g.getNodesByType(NODE_TYPES.DECISION).length, 2);
    assert.strictEqual(g.getNodesByType(NODE_TYPES.COMPONENT).length, 2);
    assert.strictEqual(g.getNodesByType(NODE_TYPES.TASK).length, 3);
    assert.ok(g.getEdgesForNode('dec-1').length > 0);
});

test('buildFromState creates edges between nodes', () => {
    const state = getInitialCanonicalState();
    state.requirements.functional = ['Login'];
    state.decisions = [{ id: 'dec-1', title: 'JWT Auth', decision: 'JWT', reason: 'X' }];
    state.architecture.components = ['AuthModule'];
    state.tasks = [{ id: 'T-001', title: 'Build Auth' }];
    const g = TraceabilityGraph.buildFromState(state);
    assert.ok(g.getEdgesForNode('dec-1').length >= 1, 'dec-1 should have edges');
    assert.ok(g.getEdgesForNode('comp-1').length >= 1, 'comp-1 should have edges');
    assert.ok(g.getEdgesForNode('T-001').length >= 1, 'T-001 should have edges');
});

test('buildFromState returns empty graph for null state', () => {
    const g = TraceabilityGraph.buildFromState(null);
    assert.strictEqual(g.getAllNodes().length, 0);
});

test('buildFromState returns empty graph for empty state', () => {
    const g = TraceabilityGraph.buildFromState({});
    assert.strictEqual(g.getAllNodes().length, 0);
});

test('toJSON and fromJSON roundtrip', () => {
    const g = new TraceabilityGraph();
    g.addNode(NODE_TYPES.REQUIREMENT, 'r1', 'Req');
    g.addNode(NODE_TYPES.DECISION, 'd1', 'Dec');
    g.addEdge('d1', 'r1', EDGE_TYPES.REALIZES);
    const json = g.toJSON();
    const restored = TraceabilityGraph.fromJSON(json);
    assert.strictEqual(restored.getAllNodes().length, 2);
    assert.ok(restored.getNode('r1'));
    assert.strictEqual(restored.getEdgesForNode('d1').length, 1);
});

test('removeEdge removes specific edge', () => {
    const g = new TraceabilityGraph();
    g.addNode(NODE_TYPES.DECISION, 'd1', 'D1');
    g.addNode(NODE_TYPES.REQUIREMENT, 'r1', 'R1');
    g.addEdge('d1', 'r1', EDGE_TYPES.REALIZES);
    assert.ok(g.removeEdge('d1', 'r1', EDGE_TYPES.REALIZES));
    assert.strictEqual(g.getEdgesForNode('d1').length, 0);
});

test('removeEdge returns false if edge not found', () => {
    const g = new TraceabilityGraph();
    assert.strictEqual(g.removeEdge('x', 'y', EDGE_TYPES.RELATES_TO), false);
});

test('getConnectedNodes returns both directions', () => {
    const g = new TraceabilityGraph();
    g.addNode(NODE_TYPES.DECISION, 'd1', 'D1');
    g.addNode(NODE_TYPES.REQUIREMENT, 'r1', 'R1');
    g.addEdge('d1', 'r1', EDGE_TYPES.REALIZES);
    const connected = g.getConnectedNodes('d1');
    assert.strictEqual(connected.length, 1);
    assert.strictEqual(connected[0].id, 'r1');
});

test('getOutgoingEdges returns empty for leaf node', () => {
    const g = new TraceabilityGraph();
    g.addNode(NODE_TYPES.REQUIREMENT, 'r1', 'R1');
    assert.strictEqual(g.getOutgoingEdges('r1').length, 0);
});

console.log(`\n  Traceability Graph: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
