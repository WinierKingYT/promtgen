import {
    NODE_TYPES, getAllNodeTypes, EDGE_TYPES, getAllEdgeTypes,
    EDGE_STRENGTH, EDGE_SOURCE
} from './traceability-types.js';

export class GraphStore {
    constructor(nodes = [], edges = []) {
        this._nodes = new Map();
        this._edges = [];
        this._indexByType = new Map();
        this._outgoingIndex = new Map();
        this._incomingIndex = new Map();

        for (const t of getAllNodeTypes()) this._indexByType.set(t, []);
        for (const n of nodes) this._addNodeInternal(n);
        for (const e of edges) this._addEdgeInternal(e);
    }

    _addNodeInternal(node) {
        this._nodes.set(node.id, { ...node });
        const byType = this._indexByType.get(node.type);
        if (byType) byType.push(node.id);
    }

    _addEdgeInternal(edge) {
        this._edges.push({ ...edge });
        if (!this._outgoingIndex.has(edge.sourceId)) this._outgoingIndex.set(edge.sourceId, []);
        this._outgoingIndex.get(edge.sourceId).push(edge);
        if (!this._incomingIndex.has(edge.targetId)) this._incomingIndex.set(edge.targetId, []);
        this._incomingIndex.get(edge.targetId).push(edge);
    }

    addNode(type, id, label, metadata = {}) {
        if (this._nodes.has(id)) throw new Error(`Node '${id}' already exists`);
        if (!getAllNodeTypes().includes(type)) throw new Error(`Invalid node type '${type}'`);
        const node = {
            id, type, label,
            metadata: { ...metadata },
            createdAt: new Date().toISOString(),
            status: metadata.status || 'active',
            projectRevision: metadata.projectRevision || 0
        };
        this._addNodeInternal(node);
        return node;
    }

    getNode(nodeId) { return this._nodes.get(nodeId) || null; }

    hasNode(nodeId) { return this._nodes.has(nodeId); }

    getAllNodes() { return Array.from(this._nodes.values()); }

    getNodeCount() { return this._nodes.size; }

    getNodesByType(type) {
        const ids = this._indexByType.get(type) || [];
        return ids.map(id => this._nodes.get(id)).filter(Boolean);
    }

    getNodesByTypes(types) {
        const results = [];
        for (const t of types) results.push(...this.getNodesByType(t));
        return results;
    }

    getNodeIdsByType(type) { return [...(this._indexByType.get(type) || [])]; }

    removeNode(nodeId) {
        if (!this._nodes.has(nodeId)) return false;
        const node = this._nodes.get(nodeId);
        const byType = this._indexByType.get(node.type);
        if (byType) {
            const idx = byType.indexOf(nodeId);
            if (idx >= 0) byType.splice(idx, 1);
        }
        this._nodes.delete(nodeId);
        this._outgoingIndex.delete(nodeId);
        this._incomingIndex.delete(nodeId);
        this._edges = this._edges.filter(e => {
            if (e.sourceId === nodeId || e.targetId === nodeId) {
                this._removeFromIndex(e);
                return false;
            }
            return true;
        });
        return true;
    }

    _removeFromIndex(edge) {
        const out = this._outgoingIndex.get(edge.sourceId);
        if (out) {
            const idx = out.indexOf(edge);
            if (idx >= 0) out.splice(idx, 1);
        }
        const in_ = this._incomingIndex.get(edge.targetId);
        if (in_) {
            const idx = in_.indexOf(edge);
            if (idx >= 0) in_.splice(idx, 1);
        }
    }

    addEdge(sourceId, targetId, type = EDGE_TYPES.RELATES_TO, metadata = {}) {
        if (!this._nodes.has(sourceId)) throw new Error(`Source node '${sourceId}' not found`);
        if (!this._nodes.has(targetId)) throw new Error(`Target node '${targetId}' not found`);
        if (!getAllEdgeTypes().includes(type)) throw new Error(`Invalid edge type '${type}'`);

        const edge = {
            sourceId, targetId, type,
            strength: metadata.strength || EDGE_STRENGTH.REQUIRED,
            source: metadata.source || EDGE_SOURCE.DETERMINISTIC_RULE,
            confidence: metadata.confidence ?? 1,
            status: metadata.status || 'active',
            createdAtRevision: metadata.createdAtRevision || 0,
            metadata: { ...metadata }
        };
        this._addEdgeInternal(edge);
        return edge;
    }

    removeEdge(sourceId, targetId, type) {
        const before = this._edges.length;
        this._edges = this._edges.filter(e => {
            if (e.sourceId === sourceId && e.targetId === targetId && e.type === type) {
                this._removeFromIndex(e);
                return false;
            }
            return true;
        });
        return this._edges.length < before;
    }

    getEdgeCount() { return this._edges.length; }

    getAllEdges() { return [...this._edges]; }

    getEdgesForNode(nodeId) {
        const out = this._outgoingIndex.get(nodeId) || [];
        const in_ = this._incomingIndex.get(nodeId) || [];
        return [...out, ...in_];
    }

    getOutgoingEdges(nodeId) { return [...(this._outgoingIndex.get(nodeId) || [])]; }

    getIncomingEdges(nodeId) { return [...(this._incomingIndex.get(nodeId) || [])]; }

    getOutgoingNodes(nodeId, edgeType = null) {
        const edges = this.getOutgoingEdges(nodeId);
        const filtered = edgeType ? edges.filter(e => e.type === edgeType) : edges;
        return filtered.map(e => this._nodes.get(e.targetId)).filter(Boolean);
    }

    getIncomingNodes(nodeId, edgeType = null) {
        const edges = this.getIncomingEdges(nodeId);
        const filtered = edgeType ? edges.filter(e => e.type === edgeType) : edges;
        return filtered.map(e => this._nodes.get(e.sourceId)).filter(Boolean);
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

    getForwardTrace(nodeId, maxDepth = 50) {
        const visited = new Set();
        const queue = [{ id: nodeId, depth: 0 }];
        const result = [];
        while (queue.length > 0) {
            const { id, depth } = queue.shift();
            if (visited.has(id) || depth > maxDepth) continue;
            visited.add(id);
            if (id !== nodeId) {
                const node = this._nodes.get(id);
                if (node) result.push(node);
            }
            const outgoing = this.getOutgoingEdges(id);
            for (const e of outgoing) {
                if (!visited.has(e.targetId)) queue.push({ id: e.targetId, depth: depth + 1 });
            }
        }
        return result;
    }

    getBackwardTrace(nodeId, maxDepth = 50) {
        const visited = new Set();
        const queue = [{ id: nodeId, depth: 0 }];
        const result = [];
        while (queue.length > 0) {
            const { id, depth } = queue.shift();
            if (visited.has(id) || depth > maxDepth) continue;
            visited.add(id);
            if (id !== nodeId) {
                const node = this._nodes.get(id);
                if (node) result.push(node);
            }
            const incoming = this.getIncomingEdges(id);
            for (const e of incoming) {
                if (!visited.has(e.sourceId)) queue.push({ id: e.sourceId, depth: depth + 1 });
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

    detectCycles() {
        const visited = new Set();
        const inStack = new Set();
        const cycles = [];

        const visit = (nodeId, path) => {
            if (inStack.has(nodeId)) {
                const cycle = [...path, nodeId];
                const idx = cycle.indexOf(nodeId);
                cycles.push(cycle.slice(idx));
                return;
            }
            if (visited.has(nodeId)) return;
            visited.add(nodeId);
            inStack.add(nodeId);
            const outgoing = this.getOutgoingEdges(nodeId);
            for (const e of outgoing) {
                if (e.type === EDGE_TYPES.DEPENDS_ON || e.type === EDGE_TYPES.BLOCKS) {
                    visit(e.targetId, [...path, nodeId]);
                }
            }
            inStack.delete(nodeId);
        };

        for (const [id] of this._nodes) visit(id, []);
        return cycles;
    }

    getStats() {
        const typeCounts = {};
        for (const [type, ids] of this._indexByType) {
            if (ids.length > 0) typeCounts[type] = ids.length;
        }
        const edgeTypeCounts = {};
        for (const e of this._edges) {
            edgeTypeCounts[e.type] = (edgeTypeCounts[e.type] || 0) + 1;
        }
        return {
            totalNodes: this._nodes.size,
            totalEdges: this._edges.length,
            nodesByType: typeCounts,
            edgesByType: edgeTypeCounts,
            hasCycles: this.detectCycles().length > 0
        };
    }

    findPath(fromId, toId, maxDepth = 10) {
        if (!this._nodes.has(fromId) || !this._nodes.has(toId)) return null;
        const visited = new Set();
        const queue = [{ id: fromId, path: [fromId] }];
        while (queue.length > 0) {
            const { id, path } = queue.shift();
            if (id === toId) return path;
            if (path.length > maxDepth) continue;
            if (visited.has(id)) continue;
            visited.add(id);
            const outgoing = this.getOutgoingEdges(id);
            for (const e of outgoing) {
                if (!visited.has(e.targetId)) {
                    queue.push({ id: e.targetId, path: [...path, e.targetId] });
                }
            }
        }
        return null;
    }

    toJSON() {
        return {
            nodes: this.getAllNodes(),
            edges: this._edges.map(e => ({ ...e }))
        };
    }

    static fromJSON(json) {
        return new GraphStore(json.nodes || [], json.edges || []);
    }

    createSnapshot(projectRevision) {
        return {
            snapshotId: `SNAP-${Date.now()}`,
            projectRevision,
            nodeCount: this._nodes.size,
            edgeCount: this._edges.length,
            createdAt: new Date().toISOString(),
            data: this.toJSON()
        };
    }

    static diff(snapshotA, snapshotB) {
        const nodesA = new Map((snapshotA.data?.nodes || []).map(n => [n.id, n]));
        const nodesB = new Map((snapshotB.data?.nodes || []).map(n => [n.id, n]));
        const edgesA = snapshotA.data?.edges || [];
        const edgesB = snapshotB.data?.edges || [];
        const edgeKey = e => `${e.sourceId}|${e.targetId}|${e.type}`;
        const edgeMapA = new Map(edgesA.map(e => [edgeKey(e), e]));
        const edgeMapB = new Map(edgesB.map(e => [edgeKey(e), e]));

        return {
            addedNodes: [...nodesB.keys()].filter(id => !nodesA.has(id)).map(id => nodesB.get(id)),
            removedNodes: [...nodesA.keys()].filter(id => !nodesB.has(id)).map(id => nodesA.get(id)),
            changedNodes: [...nodesA.keys()].filter(id => nodesB.has(id) && JSON.stringify(nodesA.get(id)) !== JSON.stringify(nodesB.get(id))).map(id => ({ id, before: nodesA.get(id), after: nodesB.get(id) })),
            addedEdges: edgesB.filter(e => !edgeMapA.has(edgeKey(e))),
            removedEdges: edgesA.filter(e => !edgeMapB.has(edgeKey(e))),
            nodeCountDiff: snapshotB.nodeCount - snapshotA.nodeCount,
            edgeCountDiff: snapshotB.edgeCount - snapshotA.edgeCount
        };
    }
}
