import { HEALTH_CATEGORIES, CRITICAL_CAPS, SEVERITY_ORDER, SEVERITY_WEIGHT, SEVERITY } from './reviewer-types.js';

export class HealthScore {
    constructor(categories = null, criticalCaps = null) {
        this.categories = categories || HEALTH_CATEGORIES;
        this.criticalCaps = criticalCaps || CRITICAL_CAPS;
    }

    calculate(findings, contextMetrics = {}) {
        const openFindings = findings.filter(f =>
            f.status !== 'resolved' && f.status !== 'dismissed' && f.status !== 'false_positive' && f.status !== 'superseded'
        );

        const categoryScores = {};
        for (const cat of this.categories) {
            const catFindings = openFindings.filter(f => f.category === cat.key);
            const penalty = this._calculateCategoryPenalty(catFindings);
            categoryScores[cat.key] = Math.max(0, 100 - penalty);
        }

        let totalScore = 0;
        for (const cat of this.categories) {
            totalScore += (categoryScores[cat.key] || 100) * cat.weight;
        }
        totalScore = Math.round(totalScore * 100) / 100;

        for (const cap of this.criticalCaps) {
            const conditionMet = this._checkCriticalCap(cap.condition, openFindings);
            if (conditionMet && totalScore > cap.maxScore) {
                totalScore = cap.maxScore;
                break;
            }
        }

        totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));

        return {
            overall: totalScore,
            categories: categoryScores,
            breakdown: this.categories.map(c => ({
                key: c.key,
                label: c.label,
                weight: c.weight,
                score: categoryScores[c.key] || 100,
                weighted: Math.round(((categoryScores[c.key] || 100) * c.weight) * 100) / 100
            })),
            findingCounts: {
                total: openFindings.length,
                bySeverity: this._countBySeverity(openFindings)
            }
        };
    }

    _calculateCategoryPenalty(findings) {
        let penalty = 0;
        for (const f of findings) {
            penalty += (SEVERITY_WEIGHT[f.severity] || 0) * 5;
        }
        if (findings.length > 0) {
            penalty += Math.log2(findings.length + 1) * 5;
        }
        return Math.min(100, Math.round(penalty));
    }

    _countBySeverity(findings) {
        const counts = {};
        for (const s of SEVERITY_ORDER) counts[s] = 0;
        for (const f of findings) counts[f.severity] = (counts[f.severity] || 0) + 1;
        return counts;
    }

    _checkCriticalCap(condition, findings) {
        const relevant = findings.filter(f => f.category === condition.category);
        if (condition.minSeverity) {
            const minIdx = SEVERITY_ORDER.indexOf(condition.minSeverity);
            return relevant.some(f => SEVERITY_ORDER.indexOf(f.severity) >= minIdx);
        }
        return relevant.length > 0;
    }
}
