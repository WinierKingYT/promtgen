export const NODE_TYPES = {
    REQUIREMENT: 'requirement',
    DECISION: 'decision',
    COMPONENT: 'component',
    TASK: 'task'
};

export const EDGE_TYPES = {
    REALIZES: 'REALIZES',
    IMPLEMENTS: 'IMPLEMENTS',
    DEPENDS_ON: 'DEPENDS_ON',
    RELATES_TO: 'RELATES_TO'
};

const NODE_TYPE_ORDER = [
    NODE_TYPES.REQUIREMENT,
    NODE_TYPES.DECISION,
    NODE_TYPES.COMPONENT,
    NODE_TYPES.TASK
];

export class TraceabilityGraph {
    constructor(nodes = [], edges = []) {
        this._nodes = new Map();
        this._edges = [];
        for (const n of nodes) this._nodes.set(n.id, { ...n });
        for (const e of edges) this._edges.push({ ...e });
    }

    addNode(type, id, label, metadata = {}) {
        if (this._nodes.has(id)) {
            throw new Error(`Node '${id}' already exists`);
        }
        if (!Object.values(NODE_TYPES).includes(type)) {
            throw new Error(`Invalid node type '${type}'`);
        }
        const node = { id, type, label, metadata: { ...metadata }, createdAt: new Date().toISOString() };
        this._nodes.set(id, node);
        return node;
    }

    removeNode(nodeId) {
        if (!this._nodes.has(nodeId)) return false;
        this._nodes.delete(nodeId);
        this._edges = this._edges.filter(e => e.sourceId !== nodeId && e.targetId !== nodeId);
        return true;
    }

    getNode(nodeId) {
        return this._nodes.get(nodeId);
    }

    getNodesByType(type) {
        return Array.from(this._nodes.values()).filter(n => n.type === type);
    }

    getAllNodes() {
        return Array.from(this._nodes.values());
    }

    addEdge(sourceId, targetId, type = EDGE_TYPES.RELATES_TO, metadata = {}) {
        if (!this._nodes.has(sourceId)) {
            throw new Error(`Source node '${sourceId}' not found`);
        }
        if (!this._nodes.has(targetId)) {
            throw new Error(`Target node '${targetId}' not found`);
        }
        if (!Object.values(EDGE_TYPES).includes(type)) {
            throw new Error(`Invalid edge type '${type}'`);
        }
        const edge = { sourceId, targetId, type, metadata: { ...metadata } };
        this._edges.push(edge);
        return edge;
    }

    removeEdge(sourceId, targetId, type) {
        const before = this._edges.length;
        this._edges = this._edges.filter(e =>
            !(e.sourceId === sourceId && e.targetId === targetId && e.type === type)
        );
        return this._edges.length < before;
    }

    getEdgesForNode(nodeId) {
        return this._edges.filter(e => e.sourceId === nodeId || e.targetId === nodeId);
    }

    getOutgoingEdges(nodeId) {
        return this._edges.filter(e => e.sourceId === nodeId);
    }

    getIncomingEdges(nodeId) {
        return this._edges.filter(e => e.targetId === nodeId);
    }

    getConnectedNodes(nodeId, direction = 'both') {
        const edges = this.getEdgesForNode(nodeId);
        const connected = new Set();
        for (const e of edges) {
            if (direction === 'forward' || direction === 'both') {
                if (e.sourceId === nodeId) connected.add(e.targetId);
            }
            if (direction === 'backward' || direction === 'both') {
                if (e.targetId === nodeId) connected.add(e.sourceId);
            }
        }
        return Array.from(connected).map(id => this._nodes.get(id)).filter(Boolean);
    }

    getForwardTrace(nodeId) {
        const visited = new Set();
        const queue = [nodeId];
        const result = [];
        while (queue.length > 0) {
            const current = queue.shift();
            if (visited.has(current)) continue;
            visited.add(current);
            if (current !== nodeId) {
                const node = this._nodes.get(current);
                if (node) result.push(node);
            }
            const outgoing = this.getOutgoingEdges(current);
            for (const e of outgoing) {
                if (!visited.has(e.targetId)) queue.push(e.targetId);
            }
        }
        return result;
    }

    getBackwardTrace(nodeId) {
        const visited = new Set();
        const queue = [nodeId];
        const result = [];
        while (queue.length > 0) {
            const current = queue.shift();
            if (visited.has(current)) continue;
            visited.add(current);
            if (current !== nodeId) {
                const node = this._nodes.get(current);
                if (node) result.push(node);
            }
            const incoming = this.getIncomingEdges(current);
            for (const e of incoming) {
                if (!visited.has(e.sourceId)) queue.push(e.sourceId);
            }
        }
        return result;
    }

    getTraceChain(nodeId) {
        const backward = this.getBackwardTrace(nodeId);
        const forward = this.getForwardTrace(nodeId);
        const combined = new Map();
        for (const n of backward) combined.set(n.id, n);
        for (const n of forward) {
            if (!combined.has(n.id)) combined.set(n.id, n);
        }
        return Array.from(combined.values());
    }

    getImpactAnalysis(nodeIds) {
        const affected = new Map();
        const changed = new Set(nodeIds);
        for (const id of nodeIds) {
            const trace = this.getTraceChain(id);
            for (const n of trace) {
                if (!changed.has(n.id)) {
                    if (!affected.has(n.id)) affected.set(n.id, { node: n, reasons: [] });
                    const sourceNode = this._nodes.get(id);
                    affected.get(n.id).reasons.push(sourceNode ? sourceNode.label : id);
                }
            }
        }
        return Array.from(affected.values());
    }

    getCoverageGaps() {
        const gaps = {
            requirementsWithoutDecisions: [],
            decisionsWithoutComponents: [],
            componentsWithoutTasks: [],
            unlinkedNodes: []
        };

        const allNodes = this.getAllNodes();
        const allIds = new Set(allNodes.map(n => n.id));

        const reqIds = new Set(this.getNodesByType(NODE_TYPES.REQUIREMENT).map(n => n.id));
        const decIds = new Set(this.getNodesByType(NODE_TYPES.DECISION).map(n => n.id));
        const compIds = new Set(this.getNodesByType(NODE_TYPES.COMPONENT).map(n => n.id));
        const taskIds = new Set(this.getNodesByType(NODE_TYPES.TASK).map(n => n.id));

        const edgeMap = new Map();
        for (const e of this._edges) {
            if (!edgeMap.has(e.sourceId)) edgeMap.set(e.sourceId, []);
            edgeMap.get(e.sourceId).push(e);
            if (!edgeMap.has(e.targetId)) edgeMap.set(e.targetId, []);
            edgeMap.get(e.targetId).push(e);
        }

        for (const id of reqIds) {
            const hasRealizingDecision = this._edges.some(
                e => e.targetId === id && e.type === EDGE_TYPES.REALIZES && decIds.has(e.sourceId)
            );
            if (!hasRealizingDecision) {
                const node = this._nodes.get(id);
                gaps.requirementsWithoutDecisions.push(node);
            }
        }

        for (const id of decIds) {
            const hasImplementingComponent = this._edges.some(
                e => e.targetId === id && e.type === EDGE_TYPES.IMPLEMENTS && compIds.has(e.sourceId)
            );
            if (!hasImplementingComponent) {
                const node = this._nodes.get(id);
                gaps.decisionsWithoutComponents.push(node);
            }
        }

        for (const id of compIds) {
            const hasBuildingTask = this._edges.some(
                e => e.targetId === id && e.type === EDGE_TYPES.IMPLEMENTS && taskIds.has(e.sourceId)
            );
            if (!hasBuildingTask) {
                const node = this._nodes.get(id);
                gaps.componentsWithoutTasks.push(node);
            }
        }

        for (const id of allIds) {
            if (!edgeMap.has(id) || edgeMap.get(id).length === 0) {
                const node = this._nodes.get(id);
                gaps.unlinkedNodes.push(node);
            }
        }

        return gaps;
    }

    toJSON() {
        return {
            nodes: this.getAllNodes(),
            edges: this._edges.map(e => ({ ...e }))
        };
    }

    static fromJSON(json) {
        return new TraceabilityGraph(json.nodes || [], json.edges || []);
    }

    static buildFromState(state) {
        const graph = new TraceabilityGraph();

        if (!state) return graph;

        const reqMap = new Map();
        const requirements = [];
        if (state.requirements) {
            const reqTypes = ['functional', 'nonFunctional', 'domainSpecific'];
            for (const rt of reqTypes) {
                const list = state.requirements[rt];
                if (Array.isArray(list)) {
                    for (let i = 0; i < list.length; i++) {
                        const item = list[i];
                        const id = `req-${rt}-${i + 1}`;
                        const label = typeof item === 'string' ? item : (item.title || item.name || `${rt} requirement ${i + 1}`);
                        graph.addNode(NODE_TYPES.REQUIREMENT, id, label, { source: rt, index: i });
                        requirements.push(id);
                        reqMap.set(id, label);
                    }
                }
            }
        }

        const decisions = [];
        if (Array.isArray(state.decisions)) {
            for (let i = 0; i < state.decisions.length; i++) {
                const d = state.decisions[i];
                const id = d.id || `dec-${i + 1}`;
                const label = d.title || d.decision || `Decision ${i + 1}`;
                graph.addNode(NODE_TYPES.DECISION, id, label, { index: i });
                decisions.push(id);
            }
        }

        const components = [];
        if (state.architecture && Array.isArray(state.architecture.components)) {
            for (let i = 0; i < state.architecture.components.length; i++) {
                const comp = state.architecture.components[i];
                const id = `comp-${i + 1}`;
                const label = typeof comp === 'string' ? comp : (comp.name || `Component ${i + 1}`);
                graph.addNode(NODE_TYPES.COMPONENT, id, label, { index: i });
                components.push(id);
            }
        }

        const tasks = [];
        if (Array.isArray(state.tasks)) {
            for (let i = 0; i < state.tasks.length; i++) {
                const t = state.tasks[i];
                const id = t.id || `task-${i + 1}`;
                const label = t.title || `Task ${i + 1}`;
                graph.addNode(NODE_TYPES.TASK, id, label, { index: i });
                tasks.push(id);
            }
        }

        const reqArr = Array.from(reqMap.entries());

        if (decisions.length > 0 && reqArr.length > 0) {
            const decsPerReq = Math.max(1, Math.floor(decisions.length / reqArr.length));
            for (let i = 0; i < decisions.length; i++) {
                const reqIdx = Math.min(Math.floor(i / decsPerReq), reqArr.length - 1);
                graph.addEdge(decisions[i], reqArr[reqIdx][0], EDGE_TYPES.REALIZES, { confidence: 'auto' });
            }
        }

        if (components.length > 0 && decisions.length > 0) {
            const compsPerDec = Math.max(1, Math.floor(components.length / decisions.length));
            for (let i = 0; i < components.length; i++) {
                const decIdx = Math.min(Math.floor(i / compsPerDec), decisions.length - 1);
                graph.addEdge(components[i], decisions[decIdx], EDGE_TYPES.IMPLEMENTS, { confidence: 'auto' });
            }
        }

        if (tasks.length > 0 && components.length > 0) {
            const tasksPerComp = Math.max(1, Math.floor(tasks.length / components.length));
            for (let i = 0; i < tasks.length; i++) {
                const compIdx = Math.min(Math.floor(i / tasksPerComp), components.length - 1);
                graph.addEdge(tasks[i], components[compIdx], EDGE_TYPES.IMPLEMENTS, { confidence: 'auto' });
            }
        }

        return graph;
    }
}
