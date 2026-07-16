import { getDefaultImpactRules } from './traceability-types.js';

export class ImpactEngine {
    constructor(graph, rules = null) {
        this.graph = graph;
        this.rules = rules || getDefaultImpactRules();
    }

    analyzeChange(changedEntityIds, options = {}) {
        const maxDepth = options.maxDepth || 10;
        const effects = [];
        const visited = new Set();
        const queue = [];

        for (const id of changedEntityIds) {
            const node = this.graph.getNode(id);
            if (node) {
                visited.add(id);
                queue.push({ entityId: id, depth: 0, reason: 'direct_change' });
            }
        }

        while (queue.length > 0) {
            const { entityId, depth, reason } = queue.shift();
            if (depth >= maxDepth) continue;
            const outgoing = this.graph.getOutgoingEdges(entityId);
            const incoming = this.graph.getIncomingEdges(entityId);
            const allEdges = [...outgoing, ...incoming];

            for (const edge of allEdges) {
                const targetId = edge.targetId === entityId ? edge.sourceId : edge.targetId;
                if (visited.has(targetId)) continue;

                const sourceNode = this.graph.getNode(entityId);
                const targetNode = this.graph.getNode(targetId);
                if (!sourceNode || !targetNode) continue;

                const rule = this._matchRule(sourceNode.type, edge.type, targetNode.type);
                if (!rule) continue;

                const effect = {
                    sourceEntityId: entityId,
                    sourceType: sourceNode.type,
                    sourceLabel: sourceNode.label,
                    targetEntityId: targetId,
                    targetType: targetNode.type,
                    targetLabel: targetNode.label,
                    edgeType: edge.type,
                    effect: rule.effect,
                    severity: rule.severity,
                    depth,
                    reason
                };
                effects.push(effect);
                visited.add(targetId);

                if (rule.propagate && depth + 1 < maxDepth) {
                    queue.push({ entityId: targetId, depth: depth + 1, reason: `propagated_from_${entityId}` });
                }
            }
        }

        return {
            directChanges: changedEntityIds.map(id => ({ entityId: id, node: this.graph.getNode(id) })),
            effects,
            summary: this._summarize(effects)
        };
    }

    _matchRule(sourceType, edgeType, targetType) {
        for (const rule of this.rules) {
            if (rule.sourceType === sourceType && rule.edgeType === edgeType && rule.targetType === targetType) return rule;
            if (rule.sourceType === sourceType && rule.edgeType === edgeType && !rule.targetType) return rule;
            if (rule.sourceType === sourceType && !rule.edgeType && !rule.targetType) return rule;
        }
        return null;
    }

    _summarize(effects) {
        const byEffect = {};
        const bySeverity = {};
        for (const e of effects) {
            byEffect[e.effect] = (byEffect[e.effect] || 0) + 1;
            bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
        }
        return { total: effects.length, byEffect, bySeverity };
    }

    findInvalidatedApprovals(changedEntityIds) {
        const approvals = this.graph.getNodesByType('approval');
        const affected = [];
        for (const app of approvals) {
            const incoming = this.graph.getIncomingEdges(app.id);
            for (const edge of incoming) {
                if (changedEntityIds.includes(edge.sourceId)) {
                    affected.push({
                        approvalId: app.id,
                        approvalLabel: app.label,
                        invalidatedBy: edge.sourceId,
                        reason: `Değişiklik onayı geçersiz kıldı`
                    });
                    break;
                }
            }
        }
        return affected;
    }

    registerRules(newRules) {
        this.rules.push(...newRules);
    }
}
