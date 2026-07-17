import { RuleRegistry } from './rule-registry.js';
import { FindingStore } from './finding-store.js';
import { QualityGate } from './quality-gate.js';
import { HealthScore } from './health-score.js';
import { GATES, GATE_CONFIG, SEVERITY, READINESS_LEVELS, REVIEW_CATEGORIES } from './reviewer-types.js';
import { NODE_TYPES } from '../traceability/traceability-types.js';
import { TraceabilityEngine } from '../traceability/traceability-engine.js';

export class ReviewEngine {
    constructor(options = {}) {
        this.rules = options.rules || new RuleRegistry();
        this.findings = options.findings || new FindingStore();
        this.gate = options.gate || new QualityGate();
        this.health = options.health || new HealthScore();
        this.traceability = options.traceability || null;
    }

    setTraceability(traceEngine) {
        this.traceability = traceEngine;
    }

    runReview(context, profile = 'standard') {
        const ctx = this._buildContext(context);
        const previousFindings = this.findings.getFindings();
        this.findings.clear();

        let rulesToRun;
        if (profile === 'quick') {
            rulesToRun = this.rules.getRules(null, SEVERITY.CRITICAL).concat(this.rules.getRules(null, SEVERITY.HIGH));
        } else if (profile === 'deep') {
            rulesToRun = this.rules.getAllRules();
        } else {
            rulesToRun = this.rules.getRules().filter(r => r.severity !== SEVERITY.INFO);
        }

        for (const rule of rulesToRun) {
            if (rule.moduleId && rule.moduleId !== 'universal') {
                const activeModules = ctx.activeModules || [];
                const topLevelName = rule.moduleId.split('.')[0];
                if (!activeModules.includes(rule.moduleId) && !activeModules.includes(topLevelName)) continue;
            }
            const result = this.rules.evaluateRule(rule, ctx);
            if (!result.passed && result.finding) {
                result.finding.reviewRunId = Date.now().toString();
                this.findings.addFinding(result.finding);
            }
        }

        if (this.traceability && (profile !== 'quick')) {
            this._runTraceabilityChecks(ctx);
        }

        const newFindings = this.findings.getFindings();
        const newFindingRuleIds = new Set(newFindings.map(f => f.ruleId));
        for (const existing of previousFindings) {
            if (!newFindingRuleIds.has(existing.ruleId)) {
                this.findings.addFinding({ ...existing });
            }
        }

        const allFindings = this.findings.getFindings();
        const openFindings = this.findings.getOpenFindings();
        const healthResult = this.health.calculate(allFindings, ctx);
        const gates = this.gate.evaluateAll({
            findings: allFindings,
            healthScore: healthResult.overall
        });
        const readiness = QualityGate.determineReadinessLevel(healthResult.overall, openFindings);

        return {
            profile,
            health: healthResult,
            readiness,
            gates,
            findings: {
                total: allFindings.length,
                open: openFindings.length,
                bySeverity: this.findings.getOpenCountBySeverity(),
                items: openFindings
            },
            summary: this._generateSummary(healthResult, openFindings, readiness, gates)
        };
    }

    runQuickReview(context) { return this.runReview(context, 'quick'); }
    runDeepReview(context) { return this.runReview(context, 'deep'); }

    runIncrementalReview(context, changedEntityIds = []) {
        const ctx = this._buildContext(context);
        const relevantRules = this.rules.getAllRules().filter(r => {
            if (r.affectedEntities) {
                const affected = r.affectedEntities(ctx) || [];
                return affected.some(e => changedEntityIds.includes(e));
            }
            return true;
        });

        const findings = [];
        for (const rule of relevantRules) {
            const result = this.rules.evaluateRule(rule, ctx);
            if (!result.passed && result.finding) {
                findings.push(result.finding);
            }
        }

        return { profile: 'incremental', changedEntityIds, newFindings: findings };
    }

    evaluateGate(gateId) {
        const allFindings = this.findings.getFindings();
        const healthResult = this.health.calculate(allFindings, {});
        return this.gate.evaluate(gateId, {
            findings: allFindings,
            healthScore: healthResult.overall
        });
    }

    _runTraceabilityChecks(ctx) {
        const te = this.traceability;
        const report = te.getFullReport();

        if (report.orphans.total > 0) {
            this.findings.addFinding({
                ruleId: 'TRACE-ORPHAN',
                category: REVIEW_CATEGORIES.TRACEABILITY,
                severity: SEVERITY.HIGH,
                title: 'Bağlantısız node bulundu',
                message: `${report.orphans.total} node hiçbir bağlantıya sahip değil`,
                affectedEntities: report.orphans.details.orphans.map(o => o.nodeId),
                evidence: report.orphans.details.orphans.map(o => ({ type: 'orphan', entityId: o.nodeId }))
            });
        }

        if (report.cycles.count > 0) {
            this.findings.addFinding({
                ruleId: 'TRACE-CYCLE',
                category: REVIEW_CATEGORIES.TRACEABILITY,
                severity: SEVERITY.CRITICAL,
                title: 'Bağımlılık döngüsü bulundu',
                message: `${report.cycles.count} bağımlılık döngüsü tespit edildi`,
                evidence: report.cycles.details.map(c => ({ type: 'cycle', cycle: c }))
            });
        }

        const cov = report.coverage;
        if (cov.requirements.taskCoverage < 80) {
            this.findings.addFinding({
                ruleId: 'TRACE-001',
                category: REVIEW_CATEGORIES.TRACEABILITY,
                severity: SEVERITY.HIGH,
                title: 'Gereksinim-görev kapsamı düşük',
                message: `Gereksinimlerin %${cov.requirements.taskCoverage}'i görevlere bağlı (eşik: %80)`
            });
        }
        if (cov.requirements.testCoverage < 60) {
            this.findings.addFinding({
                ruleId: 'TRACE-002',
                category: REVIEW_CATEGORIES.TRACEABILITY,
                severity: SEVERITY.MEDIUM,
                title: 'Gereksinim-test kapsamı düşük',
                message: `Gereksinimlerin %${cov.requirements.testCoverage}'i testlere bağlı (eşik: %60)`
            });
        }
    }

    _buildContext(context) {
        const ctx = { ...context };
        ctx.findings = this.findings.getFindings();
        ctx.decisions = ctx.decisions || ctx.state?.decisions || [];
        ctx.tasks = ctx.tasks || ctx.state?.tasks || [];
        ctx.artifacts = ctx.artifacts || ctx.state?.artifacts || [];
        ctx.prompts = ctx.prompts || [];
        ctx.risks = ctx.risks || ctx.state?.risks || [];
        ctx.entities = ctx.entities || [];
        ctx.activeModules = ctx.activeModules || ['universal'];

        if (ctx.state?.entityStores) {
            for (const [type, entities] of Object.entries(ctx.state.entityStores)) {
                if (Array.isArray(entities)) ctx.entities.push(...entities);
            }
        }

        if (this.traceability) {
            const report = this.traceability.getFullReport();
            ctx.traceCoverage = report.coverage;
        }

        return ctx;
    }

    _generateSummary(health, openFindings, readiness, gates) {
        const blockers = openFindings.filter(f => f.severity === SEVERITY.CRITICAL || f.severity === SEVERITY.HIGH);
        const gateResults = Object.entries(gates).filter(([_, g]) => !g.passed);
        return {
            healthScore: health.overall,
            readiness: readiness.label,
            openFindingCount: openFindings.length,
            blockerCount: blockers.length,
            failedGates: gateResults.map(([id, g]) => ({ gate: id, label: g.gateLabel, failures: g.failures })),
            strongestCategories: Object.entries(health.categories)
                .sort(([, a], [, b]) => b - a).slice(0, 3).map(([k, v]) => ({ key: k, score: v })),
            weakestCategories: Object.entries(health.categories)
                .sort(([, a], [, b]) => a - b).slice(0, 3).map(([k, v]) => ({ key: k, score: v }))
        };
    }

    toMarkdownReport() {
        const allFindings = this.findings.getFindings();
        const openFindings = this.findings.getOpenFindings();
        const bySeverity = this.findings.getOpenCountBySeverity();
        const stats = this.findings.getStats();

        let md = `# Proje Sağlık Raporu\n\n`;
        md += `## Genel Durum\n\n`;
        md += `- **Toplam Bulgu**: ${stats.total}\n`;
        md += `- **Açık Bulgu**: ${stats.open}\n`;
        md += `- **Çözülmüş**: ${stats.resolved}\n\n`;

        md += `### Severity Dağılımı\n\n`;
        for (const [sev, count] of Object.entries(bySeverity)) {
            if (count > 0) md += `- **${sev}**: ${count}\n`;
        }
        md += '\n';

        md += `## Açık Bulgular\n\n`;
        if (openFindings.length === 0) {
            md += 'Açık bulgu bulunmuyor.\n';
        } else {
            for (const f of openFindings) {
                md += `### ${f.severity.toUpperCase()} — ${f.title}\n\n`;
                md += `- **Kategori**: ${f.category}\n`;
                md += `- **Mesaj**: ${f.message || f.description}\n`;
                if (f.affectedEntities?.length > 0) md += `- **Entity**: ${f.affectedEntities.join(', ')}\n`;
                md += '\n';
            }
        }

        return md;
    }
}
