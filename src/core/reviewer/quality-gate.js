import {
    GATES, GATE_CONFIG, READINESS_LEVELS, SEVERITY,
    SEVERITY_PENALTY, SEVERITY_ORDER, HEALTH_CATEGORIES, CRITICAL_CAPS
} from './reviewer-types.js';

export class QualityGate {
    constructor(config = null) {
        this.config = config || GATE_CONFIG;
    }

    evaluate(gateId, context) {
        const gate = this.config[gateId];
        if (!gate) return { passed: false, reason: `Bilinmeyen gate: ${gateId}` };

        const findings = context.findings || [];
        const criticalCount = findings.filter(f => f.severity === SEVERITY.CRITICAL && f.status !== 'resolved' && f.status !== 'dismissed' && f.status !== 'false_positive').length;
        const highCount = findings.filter(f => f.severity === SEVERITY.HIGH && f.status !== 'resolved' && f.status !== 'dismissed' && f.status !== 'false_positive').length;
        const healthScore = context.healthScore || 0;

        const failures = [];

        if (criticalCount > gate.maxCritical) {
            failures.push(`Kritik bulgu sınırı aşıldı: ${criticalCount} > ${gate.maxCritical}`);
        }
        if (highCount > gate.maxHigh) {
            failures.push(`Yüksek bulgu sınırı aşıldı: ${highCount} > ${gate.maxHigh}`);
        }
        if (healthScore < gate.minHealth) {
            failures.push(`Sağlık skoru eşiği geçilemedi: ${healthScore} < ${gate.minHealth}`);
        }

        for (const cat of gate.requiredCategories) {
            const catFindings = findings.filter(f => f.category === cat && f.status !== 'resolved' && f.status !== 'dismissed' && f.status !== 'false_positive');
            if (catFindings.length > 0) {
                failures.push(`${cat} kategorisinde çözülmemiş ${catFindings.length} bulgu var`);
            }
        }

        return {
            gateId,
            gateLabel: gate.label,
            passed: failures.length === 0,
            failures,
            metrics: { criticalCount, highCount, healthScore, totalFindings: findings.length }
        };
    }

    evaluateAll(context) {
        const results = {};
        for (const [gateId] of Object.entries(this.config)) {
            results[gateId] = this.evaluate(gateId, context);
        }
        return results;
    }

    static determineReadinessLevel(healthScore, findings) {
        const openCritical = findings.filter(f => f.severity === SEVERITY.CRITICAL && f.status !== 'resolved' && f.status !== 'dismissed').length;
        const openHigh = findings.filter(f => f.severity === SEVERITY.HIGH && f.status !== 'resolved' && f.status !== 'dismissed').length;

        let level = READINESS_LEVELS[0];
        for (const rl of READINESS_LEVELS) {
            if (healthScore >= rl.minHealth) {
                if (rl.requiredCategories.length > 0) {
                    const catIssues = findings.filter(f =>
                        rl.requiredCategories.includes(f.category) &&
                        f.status !== 'resolved' && f.status !== 'dismissed' &&
                        f.status !== 'false_positive'
                    );
                    if (catIssues.length > 0) break;
                }
                level = rl;
            }
        }

        if (openCritical > 0 && level.id !== 'idea_ready') {
            level = READINESS_LEVELS.find(r => r.id === 'discovery_ready') || level;
        }

        return level;
    }
}
