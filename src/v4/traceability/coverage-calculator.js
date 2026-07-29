import { NODE_TYPES, EDGE_TYPES } from './traceability-types.js';

export class CoverageCalculator {
    constructor(graph) {
        this.graph = graph;
    }

    requirementCoverage() {
        const reqs = this.graph.getNodesByType(NODE_TYPES.REQUIREMENT);
        const total = reqs.length;
        if (total === 0) return { total: 0, withTasks: 0, withTests: 0, withArtifacts: 0, taskCoverage: 0, testCoverage: 0, artifactCoverage: 0 };
        let withTasks = 0, withTests = 0, withArtifacts = 0;

        for (const req of reqs) {
            const outgoing = this.graph.getOutgoingEdges(req.id);
            if (outgoing.some(e => e.type === EDGE_TYPES.IMPLEMENTS && this.graph.getNode(e.targetId)?.type === NODE_TYPES.TASK)) withTasks++;
            if (outgoing.some(e => e.type === EDGE_TYPES.VALIDATED_BY && this.graph.getNode(e.targetId)?.type === NODE_TYPES.TEST)) withTests++;
            if (outgoing.some(e => e.type === EDGE_TYPES.DOCUMENTS && this.graph.getNode(e.targetId)?.type === NODE_TYPES.ARTIFACT)) withArtifacts++;
        }

        return {
            total, withTasks, withTests, withArtifacts,
            taskCoverage: Math.round((withTasks / total) * 10000) / 100,
            testCoverage: Math.round((withTests / total) * 10000) / 100,
            artifactCoverage: Math.round((withArtifacts / total) * 10000) / 100
        };
    }

    objectiveCoverage() {
        const objs = this.graph.getNodesByType(NODE_TYPES.OBJECTIVE);
        const total = objs.length;
        if (total === 0) return { total: 0, withRequirements: 0, withDeliverables: 0, coverage: 0 };
        let withReqs = 0, withDels = 0;
        for (const obj of objs) {
            const outgoing = this.graph.getOutgoingEdges(obj.id);
            if (outgoing.some(e => e.type === EDGE_TYPES.REFINES && this.graph.getNode(e.targetId)?.type === NODE_TYPES.REQUIREMENT)) withReqs++;
            if (outgoing.some(e => this.graph.getNode(e.targetId)?.type === NODE_TYPES.DELIVERABLE)) withDels++;
        }
        return {
            total, withRequirements: withReqs, withDeliverables: withDels,
            coverage: Math.round(((withReqs + withDels) / (total * 2)) * 10000) / 100
        };
    }

    decisionCoverage() {
        const decs = this.graph.getNodesByType(NODE_TYPES.DECISION);
        const total = decs.length;
        if (total === 0) return { total: 0, withRationale: 0, withRequirements: 0, coverage: 0 };
        let withRationale = 0, withReqs = 0;
        for (const dec of decs) {
            if (dec.metadata?.rationale || dec.label?.length > 10) withRationale++;
            const incoming = this.graph.getIncomingEdges(dec.id);
            if (incoming.some(e => this.graph.getNode(e.sourceId)?.type === NODE_TYPES.REQUIREMENT)) withReqs++;
        }
        return {
            total, withRationale, withRequirements: withReqs,
            coverage: Math.round(((withRationale + withReqs) / (total * 2)) * 10000) / 100
        };
    }

    taskCoverage() {
        const tasks = this.graph.getNodesByType(NODE_TYPES.TASK);
        const total = tasks.length;
        if (total === 0) return { total: 0, withAcceptanceCriteria: 0, withSourceRequirements: 0, coverage: 0 };
        let withCriteria = 0, withSources = 0;
        for (const t of tasks) {
            if (t.metadata?.acceptanceCriteria || t.metadata?.hasAcceptanceCriteria) withCriteria++;
            const incoming = this.graph.getIncomingEdges(t.id);
            if (incoming.some(e => this.graph.getNode(e.sourceId)?.type === NODE_TYPES.REQUIREMENT)) withSources++;
        }
        return {
            total, withAcceptanceCriteria: withCriteria, withSourceRequirements: withSources,
            coverage: Math.round(((withCriteria + withSources) / (total * 2)) * 10000) / 100
        };
    }

    deliverableCoverage() {
        const dels = this.graph.getNodesByType(NODE_TYPES.DELIVERABLE);
        const total = dels.length;
        if (total === 0) return { total: 0, withTasks: 0, withArtifacts: 0, coverage: 0 };
        let withTasks = 0, withArtifacts = 0;
        for (const d of dels) {
            const outgoing = this.graph.getOutgoingEdges(d.id);
            if (outgoing.some(e => this.graph.getNode(e.targetId)?.type === NODE_TYPES.TASK)) withTasks++;
            if (outgoing.some(e => this.graph.getNode(e.targetId)?.type === NODE_TYPES.ARTIFACT)) withArtifacts++;
        }
        return {
            total, withTasks, withArtifacts,
            coverage: Math.round(((withTasks + withArtifacts) / (total * 2)) * 10000) / 100
        };
    }

    allCoverage() {
        return {
            requirements: this.requirementCoverage(),
            objectives: this.objectiveCoverage(),
            decisions: this.decisionCoverage(),
            tasks: this.taskCoverage(),
            deliverables: this.deliverableCoverage()
        };
    }
}
