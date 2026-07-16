import { NODE_TYPES, getAllEdgeTypes } from './traceability-types.js';

export class OrphanDetector {
    constructor(graph, rules = null) {
        this.graph = graph;
        this.rules = rules;
    }

    findOrphans() {
        const allNodes = this.graph.getAllNodes();
        const orphans = [];
        for (const node of allNodes) {
            const edges = this.graph.getEdgesForNode(node.id);
            if (edges.length === 0) {
                orphans.push({
                    nodeId: node.id,
                    nodeType: node.type,
                    label: node.label,
                    issueType: 'orphan_no_connections',
                    severity: node.type === NODE_TYPES.REQUIREMENT || node.type === NODE_TYPES.DECISION || node.type === NODE_TYPES.TASK ? 'high' : 'medium',
                    explanation: `'${node.label}' hiçbir bağlantıya sahip değil.`
                });
            }
        }
        return orphans;
    }

    findMissingIncoming(minRules = null) {
        const rules = minRules || [];
        const findings = [];
        for (const rule of rules) {
            const nodes = this.graph.getNodesByType(rule.nodeType);
            for (const node of nodes) {
                const incoming = this.graph.getIncomingEdges(node.id);
                if (incoming.length < rule.minIncoming) {
                    const matchingTypes = rule.incomingTypes || getAllEdgeTypes();
                    const hasMatching = incoming.some(e => matchingTypes.includes(e.type));
                    if (!hasMatching) {
                        findings.push({
                            nodeId: node.id,
                            nodeType: rule.nodeType,
                            label: node.label,
                            issueType: 'missing_required_incoming',
                            severity: rule.severity || 'medium',
                            expectedMinIncoming: rule.minIncoming,
                            expectedTypes: rule.incomingTypes || 'any',
                            explanation: `'${node.label}' için gerekli gelen bağlantı bulunamadı.`
                        });
                    }
                }
            }
        }
        return findings;
    }

    findMissingOutgoing(minRules = null) {
        const rules = minRules || [];
        const findings = [];
        for (const rule of rules) {
            const nodes = this.graph.getNodesByType(rule.nodeType);
            for (const node of nodes) {
                const outgoing = this.graph.getOutgoingEdges(node.id);
                if (outgoing.length < rule.minOutgoing) {
                    findings.push({
                        nodeId: node.id,
                        nodeType: rule.nodeType,
                        label: node.label,
                        issueType: 'missing_required_outgoing',
                        severity: rule.severity || 'medium',
                        expectedMinOutgoing: rule.minOutgoing,
                        explanation: `'${node.label}' için gerekli giden bağlantı bulunamadı.`
                    });
                }
            }
        }
        return findings;
    }

    findAll(minRules = null) {
        const orphans = this.findOrphans();
        const missingIncoming = this.findMissingIncoming(minRules);
        const missingOutgoing = this.findMissingOutgoing(minRules);
        return { orphans, missingIncoming, missingOutgoing, total: orphans.length + missingIncoming.length + missingOutgoing.length };
    }
}
