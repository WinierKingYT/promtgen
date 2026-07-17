import { GraphStore } from './graph-store.js';
import { CoverageCalculator } from './coverage-calculator.js';
import { OrphanDetector } from './orphan-detector.js';
import { ImpactEngine } from './impact-engine.js';
import {
    NODE_TYPES, EDGE_TYPES, getDefaultImpactRules, getDefaultMinTraceabilityRules
} from './traceability-types.js';

export class TraceabilityEngine {
    constructor(graph = null) {
        this.graph = graph || new GraphStore();
        this.coverage = new CoverageCalculator(this.graph);
        this.orphanDetector = new OrphanDetector(this.graph);
        this.impact = new ImpactEngine(this.graph);
        this.minRules = getDefaultMinTraceabilityRules();
    }

    addNode(type, id, label, metadata = {}) { return this.graph.addNode(type, id, label, metadata); }
    getNode(nodeId) { return this.graph.getNode(nodeId); }
    removeNode(nodeId) { return this.graph.removeNode(nodeId); }
    getAllNodes() { return this.graph.getAllNodes(); }
    getNodesByType(type) { return this.graph.getNodesByType(type); }

    addEdge(sourceId, targetId, type, metadata = {}) { return this.graph.addEdge(sourceId, targetId, type, metadata); }
    removeEdge(sourceId, targetId, type) { return this.graph.removeEdge(sourceId, targetId, type); }

    getCoverage() { return this.coverage.allCoverage(); }
    findOrphans() { return this.orphanDetector.findAll(this.minRules); }
    analyzeImpact(changedEntityIds, options = {}) { return this.impact.analyzeChange(changedEntityIds, options); }
    detectCycles() { return this.graph.detectCycles(); }
    getStats() { return this.graph.getStats(); }

    getFullReport() {
        const coverage = this.getCoverage();
        const orphans = this.findOrphans();
        const cycles = this.detectCycles();
        const stats = this.getStats();

        const findings = [];
        if (orphans.total > 0) findings.push({ type: 'orphan', count: orphans.total, severity: 'high', message: `${orphans.total} bağlantısız node bulundu.` });
        if (cycles.length > 0) findings.push({ type: 'cycle', count: cycles.length, severity: 'critical', message: `${cycles.length} bağımlılık döngüsü bulundu.` });
        if (coverage.requirements.taskCoverage < 80) findings.push({ type: 'low_task_coverage', severity: 'high', message: `Gereksinimlerin sadece %${coverage.requirements.taskCoverage}'i görevlere bağlı.` });
        if (coverage.requirements.testCoverage < 60) findings.push({ type: 'low_test_coverage', severity: 'medium', message: `Gereksinimlerin sadece %${coverage.requirements.testCoverage}'i testlere bağlı.` });

        return {
            stats,
            coverage,
            orphans: { total: orphans.total, details: orphans },
            cycles: { count: cycles.length, details: cycles },
            findings,
            health: this._calculateHealth(stats, coverage, orphans, cycles)
        };
    }

    _calculateHealth(stats, coverage, orphans, cycles) {
        let score = 100;
        if (stats.totalNodes === 0) return { score: 0, level: 'empty', message: 'Graph boş.' };

        if (orphans.total > 0) score -= orphans.total * 3;
        if (cycles.length > 0) score -= cycles.length * 15;
        if (coverage.requirements.taskCoverage < 100) score -= (100 - coverage.requirements.taskCoverage) * 0.3;
        if (coverage.requirements.testCoverage < 100) score -= (100 - coverage.requirements.testCoverage) * 0.2;
        if (coverage.decisions.coverage < 100) score -= (100 - coverage.decisions.coverage) * 0.3;

        score = Math.max(0, Math.min(100, Math.round(score)));
        let level;
        if (score >= 85) level = 'healthy';
        else if (score >= 60) level = 'acceptable';
        else if (score >= 35) level = 'needs_attention';
        else level = 'critical';

        return { score, level, message: `Graph sağlığı: ${score}/100 (${level})` };
    }

    createSnapshot(projectRevision) { return this.graph.createSnapshot(projectRevision); }
    static diffSnapshots(a, b) { return GraphStore.diff(a, b); }
    toJSON() { return this.graph.toJSON(); }
    static fromJSON(json) { return new TraceabilityEngine(GraphStore.fromJSON(json)); }

    buildGraphFromState(state) {
        const g = new GraphStore();
        if (!state) return new TraceabilityEngine(g);

        if (state.objectives && Array.isArray(state.objectives)) {
            state.objectives.forEach((obj, i) => {
                const id = obj.id || `OBJ-${String(i + 1).padStart(3, '0')}`;
                g.addNode(NODE_TYPES.OBJECTIVE, id, obj.title || obj.name || `Objective ${i + 1}`, { index: i, ...obj });
            });
        }

        if (state.requirements) {
            const processReqs = (reqs, prefix) => {
                if (!Array.isArray(reqs)) return;
                reqs.forEach((r, i) => {
                    const id = r.id || `REQ-${prefix}-${String(i + 1).padStart(3, '0')}`;
                    g.addNode(NODE_TYPES.REQUIREMENT, id, r.title || r.text || r.name || `${prefix} req ${i + 1}`, { index: i, category: prefix, ...r });
                });
            };
            if (Array.isArray(state.requirements)) processReqs(state.requirements, 'gen');
            else {
                processReqs(state.requirements.functional, 'func');
                processReqs(state.requirements.nonFunctional, 'nf');
                processReqs(state.requirements.domainSpecific, 'dom');
            }
        }

        if (Array.isArray(state.decisions)) {
            state.decisions.forEach((d, i) => {
                const id = d.id || `DEC-${String(i + 1).padStart(3, '0')}`;
                g.addNode(NODE_TYPES.DECISION, id, d.title || d.name || `Decision ${i + 1}`, { index: i, rationale: d.rationale || d.reason || '', ...d });
            });
        }

        if (state.risks && Array.isArray(state.risks)) {
            state.risks.forEach((r, i) => {
                const id = r.id || `RISK-${String(i + 1).padStart(3, '0')}`;
                g.addNode(NODE_TYPES.RISK, id, r.title || r.description || `Risk ${i + 1}`, { index: i, ...r });
            });
        }

        if (state.architecture) {
            const comps = Array.isArray(state.architecture) ? state.architecture : (state.architecture.components || []);
            comps.forEach((c, i) => {
                const id = c.id || `ARC-${String(i + 1).padStart(3, '0')}`;
                g.addNode(NODE_TYPES.ARCHITECTURE_COMPONENT, id, c.name || c.title || `Component ${i + 1}`, { index: i, ...c });
            });
        }

        if (Array.isArray(state.tasks)) {
            state.tasks.forEach((t, i) => {
                const id = t.id || `TASK-${String(i + 1).padStart(3, '0')}`;
                g.addNode(NODE_TYPES.TASK, id, t.title || `Task ${i + 1}`, { index: i, hasAcceptanceCriteria: !!(t.acceptanceCriteria?.length), ...t });
            });
        }

        if (state.entityStores) {
            if (Array.isArray(state.entityStores.requirement)) {
                state.entityStores.requirement.forEach(r => {
                    g.addNode(NODE_TYPES.REQUIREMENT, r.id, r.title || r.text || r.name || r.id, { ...r });
                });
            }
            if (Array.isArray(state.entityStores.test)) {
                state.entityStores.test.forEach(t => {
                    g.addNode(NODE_TYPES.TEST, t.id, t.title || t.name || t.id, { ...t });
                });
            }
        }

        if (state.moduleData?.software?.architecture?.components) {
            state.moduleData.software.architecture.components.forEach((c, i) => {
                const id = c.id || `ARC-${String(i + 1).padStart(3, '0')}`;
                g.addNode(NODE_TYPES.ARCHITECTURE_COMPONENT, id, c.name || c.title || `Component ${i + 1}`, { index: i, ...c });
            });
        }

        if (Array.isArray(state.artifacts)) {
            state.artifacts.forEach((a, i) => {
                const id = a.id || `ART-${String(i + 1).padStart(3, '0')}`;
                g.addNode(NODE_TYPES.ARTIFACT, id, a.title || a.name || a.label || `Artifact ${i + 1}`, { index: i, ...a });
            });
        }

        if (Array.isArray(state.deliverables)) {
            state.deliverables.forEach((d, i) => {
                const id = d.id || `DEL-${String(i + 1).padStart(3, '0')}`;
                g.addNode(NODE_TYPES.DELIVERABLE, id, d.title || d.name || `Deliverable ${i + 1}`, { index: i, ...d });
            });
        }

        const decs = g.getNodesByType(NODE_TYPES.DECISION);
        const reqs = g.getNodesByType(NODE_TYPES.REQUIREMENT);
        const comps = g.getNodesByType(NODE_TYPES.ARCHITECTURE_COMPONENT);
        const tasks = g.getNodesByType(NODE_TYPES.TASK);
        const artifacts = g.getNodesByType(NODE_TYPES.ARTIFACT);
        const objs = g.getNodesByType(NODE_TYPES.OBJECTIVE);

        for (const obj of objs) {
            for (const req of reqs.slice(0, 2)) {
                try { g.addEdge(obj.id, req.id, EDGE_TYPES.REFINES, { source: 'auto', confidence: 0.6 }); } catch {}
            }
        }

        for (const dec of decs) {
            for (const req of reqs) {
                if (dec.metadata?.sourceRequirementIds?.includes(req.id)) {
                    try { g.addEdge(dec.id, req.id, EDGE_TYPES.SUPPORTS, { source: 'auto' }); } catch {}
                }
            }
        }

        for (const comp of comps) {
            for (const dec of decs.slice(0, Math.max(1, Math.floor(decs.length / Math.max(1, comps.length))))) {
                try { g.addEdge(comp.id, dec.id, EDGE_TYPES.CONSTRAINED_BY, { source: 'auto', confidence: 0.5 }); } catch {}
            }
        }

        for (const task of tasks) {
            for (const comp of comps.slice(0, Math.max(1, Math.floor(comps.length / Math.max(1, tasks.length))))) {
                try { g.addEdge(task.id, comp.id, EDGE_TYPES.IMPLEMENTS, { source: 'auto', confidence: 0.5 }); } catch {}
            }
        }

        for (const art of artifacts) {
            for (const dec of decs.slice(0, Math.max(1, Math.floor(decs.length / Math.max(1, artifacts.length))))) {
                try { g.addEdge(art.id, dec.id, EDGE_TYPES.DOCUMENTS, { source: 'auto', confidence: 0.5 }); } catch {}
            }
        }

        return new TraceabilityEngine(g);
    }
}
