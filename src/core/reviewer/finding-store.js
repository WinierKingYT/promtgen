import { FINDING_STATUS, SEVERITY } from './reviewer-types.js';

export class FindingStore {
    constructor() {
        this._findings = new Map();
        this._counter = 0;
    }

    _evidenceHash(evidence) {
        if (!Array.isArray(evidence) || evidence.length === 0) return '';
        return evidence.map(e => {
            if (typeof e === 'string') return e.slice(0, 80);
            if (e && typeof e === 'object') return JSON.stringify(e).slice(0, 80);
            return '';
        }).sort().join('|');
    }

    _findingKey(finding) {
        const entityKey = (finding.affectedEntities || []).sort().join(',');
        const evHash = this._evidenceHash(finding.evidence);
        return `${finding.ruleId || ''}|${entityKey}|${evHash}`;
    }

    addFinding(finding) {
        // Preserve existing finding by ruleId + affectedEntities + evidence hash
        const key = this._findingKey(finding);
        if (key) {
            const existing = [...this._findings.values()].find(f => this._findingKey(f) === key);
            if (existing) {
                existing.updatedAt = new Date().toISOString();
                existing.projectRevision = finding.projectRevision || existing.projectRevision;
                existing.message = finding.message || existing.message;
                existing.description = finding.description || existing.description;
                existing.affectedEntities = finding.affectedEntities || existing.affectedEntities;
                existing.evidence = finding.evidence || existing.evidence;
                existing.impact = finding.impact || existing.impact;
                existing.recommendedActions = finding.recommendedActions || existing.recommendedActions;
                existing.metadata = { ...existing.metadata, ...(finding.metadata || {}) };
                return existing;
            }
        }
        this._counter++;
        const id = finding.id || `FIND-${String(this._counter).padStart(4, '0')}`;
        const entry = {
            id,
            ruleId: finding.ruleId || '',
            category: finding.category || 'general',
            severity: finding.severity || SEVERITY.MEDIUM,
            title: finding.title || '',
            message: finding.message || '',
            description: finding.description || '',
            affectedEntities: finding.affectedEntities || [],
            evidence: finding.evidence || [],
            impact: finding.impact || [],
            recommendedActions: finding.recommendedActions || [],
            status: finding.status || FINDING_STATUS.OPEN,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            projectRevision: finding.projectRevision || 0,
            moduleId: finding.moduleId || 'universal',
            metadata: finding.metadata || {}
        };
        this._findings.set(id, entry);
        return entry;
    }

    addFindings(findings) {
        return findings.map(f => this.addFinding(f));
    }

    getFinding(id) { return this._findings.get(id) || null; }

    getFindings(filters = {}) {
        let result = [...this._findings.values()];
        if (filters.status) result = result.filter(f => f.status === filters.status);
        if (filters.severity) result = result.filter(f => f.severity === filters.severity);
        if (filters.category) result = result.filter(f => f.category === filters.category);
        if (filters.ruleId) result = result.filter(f => f.ruleId === filters.ruleId);
        if (filters.moduleId) result = result.filter(f => f.moduleId === filters.moduleId);
        if (filters.openOnly) result = result.filter(f => f.status === FINDING_STATUS.OPEN || f.status === FINDING_STATUS.ACKNOWLEDGED);
        if (filters.search) {
            const q = filters.search.toLowerCase();
            result = result.filter(f => f.title.toLowerCase().includes(q) || f.message.toLowerCase().includes(q));
        }
        return result;
    }

    getOpenFindings() { return this.getFindings({ openOnly: true }); }

    getFindingsByEntity(entityId) {
        return [...this._findings.values()].filter(f => f.affectedEntities.includes(entityId));
    }

    changeStatus(findingId, newStatus, reason = '') {
        const finding = this._findings.get(findingId);
        if (!finding) return { success: false, reason: 'Finding bulunamadı' };

        const validTransitions = {
            [FINDING_STATUS.OPEN]: [FINDING_STATUS.ACKNOWLEDGED, FINDING_STATUS.FIX_PROPOSED, FINDING_STATUS.DISMISSED, FINDING_STATUS.FALSE_POSITIVE],
            [FINDING_STATUS.ACKNOWLEDGED]: [FINDING_STATUS.IN_PROGRESS, FINDING_STATUS.DISMISSED, FINDING_STATUS.FALSE_POSITIVE],
            [FINDING_STATUS.FIX_PROPOSED]: [FINDING_STATUS.IN_PROGRESS, FINDING_STATUS.OPEN, FINDING_STATUS.DISMISSED],
            [FINDING_STATUS.IN_PROGRESS]: [FINDING_STATUS.RESOLVED, FINDING_STATUS.OPEN],
            [FINDING_STATUS.RESOLVED]: [FINDING_STATUS.OPEN, FINDING_STATUS.SUPERSEDED],
            [FINDING_STATUS.DISMISSED]: [FINDING_STATUS.OPEN],
            [FINDING_STATUS.FALSE_POSITIVE]: [FINDING_STATUS.OPEN],
            [FINDING_STATUS.SUPERSEDED]: [FINDING_STATUS.OPEN]
        };

        const allowed = validTransitions[finding.status] || [];
        if (!allowed.includes(newStatus)) {
            return { success: false, reason: `'${finding.status}' → '${newStatus}' geçersiz` };
        }

        finding.status = newStatus;
        finding.updatedAt = new Date().toISOString();
        if (reason) finding.statusChangeReason = reason;
        return { success: true, finding };
    }

    acknowledge(findingId) { return this.changeStatus(findingId, FINDING_STATUS.ACKNOWLEDGED); }
    markFalsePositive(findingId, justification = '') { return this.changeStatus(findingId, FINDING_STATUS.FALSE_POSITIVE, justification); }
    markResolved(findingId) { return this.changeStatus(findingId, FINDING_STATUS.RESOLVED); }
    dismiss(findingId, reason = '') { return this.changeStatus(findingId, FINDING_STATUS.DISMISSED, reason); }

    getStats() {
        const findings = [...this._findings.values()];
        const byStatus = {};
        const bySeverity = {};
        for (const f of findings) {
            byStatus[f.status] = (byStatus[f.status] || 0) + 1;
            bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
        }
        return {
            total: findings.length,
            open: findings.filter(f => f.status === FINDING_STATUS.OPEN || f.status === FINDING_STATUS.ACKNOWLEDGED).length,
            resolved: findings.filter(f => f.status === FINDING_STATUS.RESOLVED).length,
            byStatus, bySeverity
        };
    }

    getOpenCountBySeverity() {
        const open = this.getOpenFindings();
        const counts = {};
        for (const f of open) counts[f.severity] = (counts[f.severity] || 0) + 1;
        return counts;
    }

    clear() { this._findings.clear(); this._counter = 0; }

    toJSON() { return { findings: [...this._findings.values()] }; }
    static fromJSON(json) {
        const store = new FindingStore();
        if (json.findings) for (const f of json.findings) store._findings.set(f.id, f);
        return store;
    }
}
