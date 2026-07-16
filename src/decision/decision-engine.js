import { ENTITY_PREFIXES } from '../core/entity-store.js';

const DECISION_CATEGORIES = [
    'technical', 'architectural', 'product', 'process',
    'business', 'security', 'design', 'research', 'other'
];

const DECISION_STATUS = [
    'detected', 'exploring', 'options_ready', 'proposed',
    'approved', 'superseded', 'rejected', 'provisional', 'expired'
];

const REVERSIBILITY = ['easy', 'medium', 'hard', 'irreversible'];

let _decCounter = 0;

function nextDecisionId() {
    _decCounter++;
    return `${ENTITY_PREFIXES.decision}-${String(_decCounter).padStart(3, '0')}`;
}

export function resetDecisionCounter() { _decCounter = 0; }

export function createDecision(decisionData, revision) {
    return {
        id: decisionData.id || nextDecisionId(),
        uid: `uid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        entityType: 'decision',
        category: DECISION_CATEGORIES.includes(decisionData.category) ? decisionData.category : 'technical',
        title: decisionData.title || '',
        problemStatement: decisionData.problemStatement || '',
        decisionDrivers: decisionData.decisionDrivers || [],
        constraints: decisionData.constraints || [],
        options: (decisionData.options || []).map((opt, i) => ({
            id: opt.id || `opt-${i + 1}`,
            label: opt.label || `Seçenek ${i + 1}`,
            description: opt.description || '',
            pros: opt.pros || [],
            cons: opt.cons || [],
            risks: opt.risks || [],
            mitigations: opt.mitigations || [],
            effort: opt.effort || 'medium',
            cost: opt.cost || 'medium',
            reversibility: REVERSIBILITY.includes(opt.reversibility) ? opt.reversibility : 'medium',
            criteriaScores: opt.criteriaScores || {},
            evidence: opt.evidence || [],
            confidence: typeof opt.confidence === 'number' ? opt.confidence : 0.5
        })),
        selectedOptionId: decisionData.selectedOptionId || null,
        rationale: decisionData.rationale || '',
        consequences: decisionData.consequences || [],
        affectedEntityIds: decisionData.affectedEntityIds || [],
        reversibility: REVERSIBILITY.includes(decisionData.reversibility) ? decisionData.reversibility : 'medium',
        status: DECISION_STATUS.includes(decisionData.status) ? decisionData.status : 'detected',
        sourceRequirementIds: decisionData.sourceRequirementIds || [],
        approvedAtRevision: decisionData.approvedAtRevision || null,
        supersededBy: decisionData.supersededBy || null,
        version: 1,
        createdAtRevision: revision,
        updatedAtRevision: revision,
        tags: decisionData.tags || [],
        sourceModule: decisionData.sourceModule || 'universal',
        source: decisionData.source || { type: 'manual', sourceId: null, evidenceType: 'direct_fact' },
        sensitivity: decisionData.sensitivity || 'internal',
        statusHistory: decisionData.statusHistory || [
            { status: 'detected', atRevision: revision, timestamp: new Date().toISOString() }
        ]
    };
}

export function evaluateOptions(decision, criteriaWeights = {}) {
    const defaultWeights = {
        confidence: 0.25, reversibility: 0.20, effort: 0.15,
        cost: 0.15, riskLevel: 0.25
    };
    const weights = { ...defaultWeights, ...criteriaWeights };

    return decision.options.map(opt => {
        const confidenceScore = opt.confidence * 100;
        const reversibilityScore = {
            easy: 90, medium: 60, hard: 30, irreversible: 0
        }[opt.reversibility] || 50;
        const effortScore = { low: 80, medium: 50, high: 30, very_high: 10 }[opt.effort] || 50;
        const costScore = { low: 80, medium: 50, high: 30, very_high: 10 }[opt.cost] || 50;
        const riskCount = opt.risks.length;
        const riskScore = Math.max(0, 100 - (riskCount * 20));

        const total =
            confidenceScore * weights.confidence +
            reversibilityScore * weights.reversibility +
            effortScore * weights.effort +
            costScore * weights.cost +
            riskScore * weights.riskLevel;

        return {
            optionId: opt.id,
            label: opt.label,
            scores: {
                confidence: confidenceScore,
                reversibility: reversibilityScore,
                effort: effortScore,
                cost: costScore,
                risk: riskScore
            },
            total: Math.round(total * 100) / 100,
            recommended: false
        };
    }).map((result, _, arr) => {
        const maxTotal = Math.max(...arr.map(r => r.total));
        result.recommended = result.total === maxTotal;
        return result;
    });
}

export function changeDecisionStatus(decision, newStatus, revision, reason = '') {
    const validTransitions = {
        detected: ['exploring', 'rejected', 'expired'],
        exploring: ['options_ready', 'detected', 'rejected'],
        options_ready: ['proposed', 'exploring', 'rejected'],
        proposed: ['approved', 'rejected', 'provisional', 'expired', 'exploring'],
        approved: ['superseded', 'rejected'],
        superseded: ['detected'],
        rejected: ['detected', 'exploring'],
        provisional: ['approved', 'rejected', 'expired'],
        expired: ['detected']
    };

    const allowed = validTransitions[decision.status] || [];
    if (!allowed.includes(newStatus)) {
        return {
            success: false,
            reason: `'${decision.status}' → '${newStatus}' geçersiz. İzin verilenler: ${allowed.join(', ')}`
        };
    }

    const updated = { ...decision };
    updated.status = newStatus;
    updated.updatedAtRevision = revision;

    if (newStatus === 'approved') {
        updated.approvedAtRevision = revision;
    }
    if (newStatus === 'superseded' && reason) {
        updated.supersededBy = reason;
    }

    if (!updated.statusHistory) updated.statusHistory = [];
    updated.statusHistory.push({
        status: newStatus,
        atRevision: revision,
        timestamp: new Date().toISOString(),
        reason
    });

    return { success: true, decision: updated };
}

export function calculateDecisionImpact(state, decisionId) {
    const decision = state.decisions?.find(d => d.id === decisionId);
    if (!decision) return { found: false, directImpacts: [], indirectImpacts: [] };

    const direct = [];
    const indirect = [];

    if (decision.affectedEntityIds) {
        for (const eid of decision.affectedEntityIds) {
            direct.push({ entityId: eid, impact: 'direct', action: 'review' });
        }
    }

    if (Array.isArray(state.tasks)) {
        for (const task of state.tasks) {
            if (task.sourceEntityIds?.includes(decisionId)) {
                direct.push({ entityId: task.id, impact: 'direct', action: 'mark_stale' });
            }
        }
    }

    if (Array.isArray(state.assumptions)) {
        for (const asm of state.assumptions) {
            if (asm.id === decisionId || decision.sourceRequirementIds?.includes(asm.id)) {
                indirect.push({ entityId: asm.id, impact: 'indirect', action: 'review' });
            }
        }
    }

    if (state.approvals) {
        for (const [key, val] of Object.entries(state.approvals)) {
            if (val && val.status === 'approved') {
                indirect.push({ entityId: key, impact: 'indirect', action: 'invalidate_approval' });
            }
        }
    }

    return { found: true, decision: decision.id, title: decision.title, directImpacts: direct, indirectImpacts: indirect };
}
