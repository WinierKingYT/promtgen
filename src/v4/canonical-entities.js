import { emptyPlanAlignment, evaluatePlanAlignment } from './domain/idea-plan-alignment.ts';

const CANONICAL_MODEL_VERSION = 1;

function text(value, fallback = '') {
    return typeof value === 'string' ? value.trim() : fallback;
}

function list(value) {
    return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}

function entityId(prefix, value, index) {
    if (value?.id && typeof value.id === 'string') return value.id;
    return `${prefix}-${index + 1}`;
}

export function normalizeObjective(value = {}, index = 0) {
    const source = typeof value === 'string' ? { title: value } : value;
    return {
        id: entityId('obj', source, index),
        title: text(source.title || source.description || source.text, `Hedef ${index + 1}`),
        description: text(source.description || source.text),
        metric: text(source.metric),
        target: text(source.target),
        priority: ['must', 'should', 'could'].includes(source.priority) ? source.priority : 'should',
        status: ['draft', 'accepted', 'achieved'].includes(source.status) ? source.status : 'draft',
        sourceSuggestionIds: list(source.sourceSuggestionIds)
    };
}

export function normalizeRequirement(value = {}, index = 0) {
    const source = typeof value === 'string' ? { statement: value } : value;
    return {
        id: entityId('req', source, index),
        title: text(source.title || source.statement || source.description, `Gereksinim ${index + 1}`),
        statement: text(source.statement || source.description || source.text || source.title),
        kind: ['functional', 'quality', 'constraint'].includes(source.kind) ? source.kind : 'functional',
        priority: ['must', 'should', 'could'].includes(source.priority) ? source.priority : 'should',
        acceptanceCriteria: list(source.acceptanceCriteria),
        sourceObjectiveIds: list(source.sourceObjectiveIds),
        sourceSuggestionIds: list(source.sourceSuggestionIds),
        status: ['draft', 'accepted', 'implemented', 'verified'].includes(source.status) ? source.status : 'draft'
    };
}

export function normalizeDecision(value = {}, index = 0) {
    const source = typeof value === 'string' ? { decision: value } : value;
    return {
        id: entityId('dec', source, index),
        title: text(source.title || source.decision, `Karar ${index + 1}`),
        decision: text(source.decision || source.description || source.title),
        rationale: text(source.rationale || source.reason),
        alternatives: list(source.alternatives),
        consequences: list(source.consequences),
        status: ['proposed', 'accepted', 'superseded'].includes(source.status) ? source.status : 'accepted',
        sourceSuggestionId: text(source.sourceSuggestionId),
        affectedSectionIds: list(source.affectedSectionIds || source.affectedSections)
    };
}

export function normalizeAssumption(value = {}, index = 0) {
    const source = typeof value === 'string' ? { statement: value } : value;
    return {
        id: entityId('asm', source, index),
        statement: text(source.statement || source.description || source.text),
        confidence: ['low', 'medium', 'high'].includes(source.confidence) ? source.confidence : 'medium',
        validationPlan: text(source.validationPlan),
        status: ['open', 'validated', 'invalidated'].includes(source.status) ? source.status : 'open'
    };
}

export function normalizeRisk(value = {}, index = 0) {
    const source = typeof value === 'string' ? { title: value } : value;
    return {
        id: entityId('risk', source, index),
        title: text(source.title || source.description, `Risk ${index + 1}`),
        description: text(source.description || source.title),
        probability: ['low', 'medium', 'high'].includes(source.probability) ? source.probability : 'medium',
        impact: ['low', 'medium', 'high'].includes(source.impact) ? source.impact : 'medium',
        mitigation: text(source.mitigation),
        owner: text(source.owner),
        status: ['open', 'mitigated', 'accepted'].includes(source.status) ? source.status : 'open',
        sourceSuggestionId: text(source.sourceSuggestionId)
    };
}

export function normalizeTask(value = {}, index = 0) {
    const source = typeof value === 'string' ? { title: value } : value;
    return {
        id: entityId('task', source, index),
        title: text(source.title || source.description, `Görev ${index + 1}`),
        description: text(source.description),
        status: ['backlog', 'ready', 'in_progress', 'blocked', 'done'].includes(source.status) ? source.status : 'backlog',
        priority: ['must', 'should', 'could'].includes(source.priority) ? source.priority : 'should',
        effort: ['low', 'medium', 'high'].includes(source.effort) ? source.effort : 'medium',
        dependencies: list(source.dependencies),
        requirementIds: list(source.requirementIds),
        acceptanceCriteria: list(source.acceptanceCriteria),
        verificationIds: list(source.verificationIds)
    };
}

export function normalizeTestCase(value = {}, index = 0) {
    const source = typeof value === 'string' ? { title: value } : value;
    return {
        id: entityId('test', source, index),
        title: text(source.title || source.description, `Test ${index + 1}`),
        kind: ['unit', 'integration', 'e2e', 'security', 'acceptance'].includes(source.kind) ? source.kind : 'acceptance',
        preconditions: list(source.preconditions),
        steps: list(source.steps),
        expectedResult: text(source.expectedResult),
        requirementIds: list(source.requirementIds),
        status: ['draft', 'ready', 'passed', 'failed'].includes(source.status) ? source.status : 'draft'
    };
}

export function normalizeMilestone(value = {}, index = 0) {
    const source = typeof value === 'string' ? { title: value } : value;
    return {
        id: entityId('milestone', source, index),
        title: text(source.title, `Kilometre taşı ${index + 1}`),
        outcome: text(source.outcome || source.description),
        taskIds: list(source.taskIds),
        targetDate: text(source.targetDate),
        status: ['planned', 'active', 'complete'].includes(source.status) ? source.status : 'planned'
    };
}

export function normalizeTraceLink(value = {}, index = 0) {
    const source = typeof value === 'object' && value ? value : {};
    return {
        id: entityId('trace', source, index),
        fromType: text(source.fromType), fromId: text(source.fromId),
        toType: text(source.toType), toId: text(source.toId),
        relation: text(source.relation, 'supports')
    };
}

export function normalizeAgentPrompt(value = {}, index = 0) {
    const source = typeof value === 'object' && value ? value : {};
    return {
        id: entityId('prompt', source, index),
        role: ['planner', 'implementer', 'reviewer', 'verifier'].includes(source.role) ? source.role : 'implementer',
        title: text(source.title, `Ajan promptu ${index + 1}`),
        instructions: text(source.instructions),
        taskIds: list(source.taskIds),
        dependsOnPromptIds: list(source.dependsOnPromptIds),
        expectedOutputs: list(source.expectedOutputs),
        status: ['draft', 'ready', 'used', 'verified'].includes(source.status) ? source.status : 'draft'
    };
}

export function normalizeResearchQuestion(value = {}, index = 0) {
    const source = typeof value === 'string' ? { question: value } : value;
    return {
        id: entityId('research-question', source, index),
        question: text(source.question || source.title),
        rationale: text(source.rationale),
        priority: ['low', 'medium', 'high'].includes(source.priority) ? source.priority : 'medium',
        status: ['proposed', 'active', 'answered', 'dismissed'].includes(source.status) ? source.status : 'proposed',
        affectedSectionIds: list(source.affectedSectionIds)
    };
}

export function normalizeResearchSource(value = {}, index = 0) {
    const source = typeof value === 'object' && value ? value : {};
    return {
        id: entityId('source', source, index),
        title: text(source.title, `Kaynak ${index + 1}`),
        url: text(source.url),
        publisher: text(source.publisher),
        sourceType: ['primary', 'secondary', 'unknown'].includes(source.sourceType) ? source.sourceType : 'unknown',
        accessedAt: text(source.accessedAt),
        status: ['candidate', 'approved', 'rejected'].includes(source.status) ? source.status : 'candidate',
        questionIds: list(source.questionIds)
    };
}

export function normalizeEvidence(value = {}, index = 0) {
    const source = typeof value === 'object' && value ? value : {};
    return {
        id: entityId('evidence', source, index),
        claim: text(source.claim),
        summary: text(source.summary),
        sourceId: text(source.sourceId),
        questionId: text(source.questionId),
        confidence: ['low', 'medium', 'high'].includes(source.confidence) ? source.confidence : 'medium',
        affectedSectionIds: list(source.affectedSectionIds),
        status: ['proposed', 'accepted', 'superseded'].includes(source.status) ? source.status : 'proposed'
    };
}

export function normalizeReviewFinding(value = {}, index = 0) {
    const source = typeof value === 'object' && value ? value : {};
    return {
        id: entityId('finding', source, index),
        ruleId: text(source.ruleId, 'REVIEW-UNKNOWN'),
        category: text(source.category, 'quality'),
        severity: ['info', 'low', 'medium', 'high', 'critical'].includes(source.severity) ? source.severity : 'medium',
        title: text(source.title, `Bulgu ${index + 1}`),
        description: text(source.description),
        recommendation: text(source.recommendation),
        entityIds: list(source.entityIds),
        sectionIds: list(source.sectionIds),
        status: ['open', 'resolved', 'accepted_risk', 'false_positive'].includes(source.status) ? source.status : 'open'
    };
}

export function normalizeSimulationRun(value = {}, index = 0) {
    const source = typeof value === 'object' && value ? value : {};
    return {
        id: entityId('simulation', source, index),
        scenario: text(source.scenario, 'delivery'),
        title: text(source.title, `Simülasyon ${index + 1}`),
        status: ['passed', 'warning', 'failed'].includes(source.status) ? source.status : 'warning',
        summary: text(source.summary),
        checks: Array.isArray(source.checks) ? source.checks.map(check => ({ id: text(check.id), label: text(check.label), passed: Boolean(check.passed), detail: text(check.detail) })) : [],
        createdAt: text(source.createdAt),
        projectRevision: Number(source.projectRevision || 0)
    };
}

export function normalizeExecutionSession(value = {}, index = 0) {
    const source = typeof value === 'object' && value ? value : {};
    return {
        id: entityId('execution', source, index),
        adapterId: ['codex', 'generic'].includes(source.adapterId) ? source.adapterId : 'generic',
        sourceRevision: Number(source.sourceRevision || 0),
        status: ['proposed', 'prepared', 'running', 'completed', 'failed', 'cancelled', 'external'].includes(source.status) ? source.status : 'proposed',
        worktreeLabel: text(source.worktreeLabel),
        steps: Array.isArray(source.steps) ? source.steps.map(step => ({
            role: ['planner', 'implementer', 'reviewer', 'verifier'].includes(step.role) ? step.role : 'planner',
            risk: ['low', 'medium', 'high'].includes(step.risk) ? step.risk : 'medium',
            status: ['pending', 'running', 'completed', 'failed', 'cancelled'].includes(step.status) ? step.status : 'pending',
            exitCode: Number.isInteger(step.exitCode) ? step.exitCode : null,
            outputSummary: text(step.outputSummary).slice(0, 2000),
            startedAt: text(step.startedAt), completedAt: text(step.completedAt)
        })) : [],
        createdAt: text(source.createdAt), updatedAt: text(source.updatedAt)
    };
}

export function normalizeImpactAnalysis(value = {}, index = 0) {
    const source = typeof value === 'object' && value ? value : {};
    const effects = Array.isArray(source.entityEffects) ? source.entityEffects.map(effect => ({
        sourceEntityId: text(effect.sourceEntityId),
        sourceType: text(effect.sourceType),
        targetEntityId: text(effect.targetEntityId),
        targetType: text(effect.targetType),
        targetLabel: text(effect.targetLabel || effect.targetEntityId),
        effect: ['invalidate', 'stale', 'regenerate', 'review', 'no_action'].includes(effect.effect) ? effect.effect : 'review',
        severity: ['low', 'medium', 'high', 'critical'].includes(effect.severity) ? effect.severity : 'medium',
        depth: Math.max(0, Number(effect.depth || 0))
    })) : [];
    const contradictions = list(source.contradictions);
    const details = Array.isArray(source.contradictionDetails) ? source.contradictionDetails.map(detail => ({
        decisionId: text(detail.decisionId),
        decisionTitle: text(detail.decisionTitle),
        decisionText: text(detail.decisionText),
        resolution: ['supersede', 'keep'].includes(detail.resolution) ? detail.resolution : null
    })) : [];
    return {
        id: entityId('impact', source, index),
        baseCanonicalRevision: Math.max(1, Number(source.baseCanonicalRevision || source.baseRevision || 1)),
        sourceScenarioId: text(source.sourceScenarioId) || undefined,
        sourceKind: ['user_request', 'idea_alignment'].includes(source.sourceKind) ? source.sourceKind : 'user_request',
        sourceIdeaRevisionId: text(source.sourceIdeaRevisionId) || undefined,
        currentIdeaRevisionId: text(source.currentIdeaRevisionId) || undefined,
        userRequest: text(source.userRequest),
        summary: text(source.summary),
        affectedSections: list(source.affectedSections),
        changedEntityIds: list(source.changedEntityIds),
        entityEffects: effects,
        effectSummary: {
            total: Number(source.effectSummary?.total ?? effects.length),
            byEffect: source.effectSummary?.byEffect && typeof source.effectSummary.byEffect === 'object' ? { ...source.effectSummary.byEffect } : {},
            bySeverity: source.effectSummary?.bySeverity && typeof source.effectSummary.bySeverity === 'object' ? { ...source.effectSummary.bySeverity } : {}
        },
        newTasks: list(source.newTasks),
        architectureImpact: text(source.architectureImpact),
        newRisks: list(source.newRisks),
        contradictions,
        contradictionDetails: details,
        preview: {
            nextCanonicalRevision: Math.max(2, Number(source.preview?.nextCanonicalRevision || source.preview?.nextRevision || Number(source.baseCanonicalRevision || source.baseRevision || 1) + 1)),
            requirementCount: Math.max(0, Number(source.preview?.requirementCount ?? 1)),
            taskCount: Math.max(0, Number(source.preview?.taskCount ?? list(source.newTasks).length)),
            testCount: Math.max(0, Number(source.preview?.testCount ?? 1)),
            riskCount: Math.max(0, Number(source.preview?.riskCount ?? list(source.newRisks).length)),
            traceLinkCount: Math.max(0, Number(source.preview?.traceLinkCount ?? 2))
        },
        status: ['proposed', 'accepted', 'rejected', 'stale'].includes(source.status) ? source.status : 'proposed',
        createdAt: text(source.createdAt),
        resolvedAt: text(source.resolvedAt) || null
    };
}

export function normalizePlanningScenario(value = {}, index = 0) {
    const source = typeof value === 'object' && value ? value : {};
    const createdAt = text(source.createdAt, new Date().toISOString());
    const decisions = Array.isArray(source.decisions) ? source.decisions.map((decision, decisionIndex) => ({
        id: text(decision?.id, entityId('scenario-decision', decision || {}, decisionIndex)),
        title: text(decision?.title, `Alternatif karar ${decisionIndex + 1}`),
        decision: text(decision?.decision),
        rationale: text(decision?.rationale),
        affectedSectionIds: list(decision?.affectedSectionIds),
        dependencies: list(decision?.dependencies)
    })).filter(decision => decision.decision) : [];
    const affectedSectionIds = [...new Set(decisions.flatMap(decision => decision.affectedSectionIds))];
    const dependencies = [...new Set(decisions.flatMap(decision => decision.dependencies))];
    return {
        id: entityId('scenario', source, index),
        name: text(source.name, `Plan senaryosu ${index + 1}`),
        description: text(source.description),
        baseCanonicalRevision: Math.max(1, Number(source.baseCanonicalRevision || source.baseRevision || 1)),
        decisions,
        comparison: {
            effortScore: Math.min(5, Math.max(1, Number(source.comparison?.effortScore || 1))),
            riskScore: Math.min(5, Math.max(1, Number(source.comparison?.riskScore || 1))),
            readinessDelta: Math.min(25, Math.max(-25, Number(source.comparison?.readinessDelta || 0))),
            affectedSectionIds: list(source.comparison?.affectedSectionIds).length ? list(source.comparison.affectedSectionIds) : affectedSectionIds,
            dependencies: list(source.comparison?.dependencies).length ? list(source.comparison.dependencies) : dependencies
        },
        status: ['draft', 'selected', 'discarded', 'merged'].includes(source.status) ? source.status : 'draft',
        createdAt,
        updatedAt: text(source.updatedAt, createdAt),
        mergedAt: text(source.mergedAt) || null,
        impactAnalysisId: text(source.impactAnalysisId) || null
    };
}

export function normalizeSectionPatchProposal(value = {}, index = 0) {
    const source = typeof value === 'object' && value ? value : {};
    const createdAt = text(source.createdAt, new Date().toISOString());
    return {
        id: entityId('section-patch', source, index),
        impactAnalysisId: text(source.impactAnalysisId),
        baseCanonicalRevision: Math.max(1, Number(source.baseCanonicalRevision || source.baseRevision || 1)),
        sectionId: text(source.sectionId),
        originalContent: text(source.originalContent),
        proposedContent: text(source.proposedContent),
        editedContent: text(source.editedContent),
        rationale: text(source.rationale),
        warnings: list(source.warnings),
        status: ['pending', 'accepted', 'edited', 'deferred', 'rejected', 'stale'].includes(source.status) ? source.status : 'pending',
        provenance: {
            runId: text(source.provenance?.runId, `legacy-section-patch-${index + 1}`),
            mode: ['cloud-ai', 'local-ai', 'rule-engine', 'fallback'].includes(source.provenance?.mode) ? source.provenance.mode : 'rule-engine',
            providerId: text(source.provenance?.providerId) || null,
            model: text(source.provenance?.model) || null,
            promptVersion: text(source.provenance?.promptVersion, '1.0.0'),
            requestedAt: text(source.provenance?.requestedAt, createdAt),
            completedAt: text(source.provenance?.completedAt, createdAt),
            latencyMs: Math.max(0, Number(source.provenance?.latencyMs || 0)),
            retryCount: Math.max(0, Number(source.provenance?.retryCount || 0)),
            fallbackReason: text(source.provenance?.fallbackReason) || null,
            schemaId: text(source.provenance?.schemaId, 'section-regeneration-v1'),
            schemaVersion: Math.max(1, Number(source.provenance?.schemaVersion || 1)),
            inputHash: text(source.provenance?.inputHash, 'not-sent-to-provider')
        },
        createdAt,
        resolvedAt: text(source.resolvedAt) || null
    };
}

export function normalizeProjectDocument(project) {
    if (!project || typeof project !== 'object') return project;
    const next = structuredClone(project);
    const sourceSchemaRevision = Math.max(1, Number(next.schemaRevision || 1));
    next.schemaVersion = 5;
    next.schemaRevision = 4;
    next.documentRevision = Math.max(1, Number(next.documentRevision || next.revision || 1));
    next.canonicalRevision = Math.max(1, Math.min(next.documentRevision, Number(next.canonicalRevision || next.revision || 1)));
    delete next.revision;
    const previousReadiness = next.readiness || {};
    next.readiness = {
        version: 2,
        status: ['blocked', 'needs_review', 'ready'].includes(previousReadiness.status)
            ? previousReadiness.status
            : (previousReadiness.blockers?.length ? 'blocked' : previousReadiness.warnings?.length ? 'needs_review' : 'ready'),
        score: Math.max(0, Math.min(100, Number(previousReadiness.score || 0))),
        dimensions: {
            completeness: Number(previousReadiness.dimensions?.completeness || 0),
            consistency: Number(previousReadiness.dimensions?.consistency ?? 100),
            traceability: Number(previousReadiness.dimensions?.traceability || 0),
            riskCoverage: Number(previousReadiness.dimensions?.riskCoverage || 0),
            implementationReadiness: Number(previousReadiness.dimensions?.implementationReadiness || 0)
        },
        dimensionWeights: { completeness: 20, consistency: 20, traceability: 25, riskCoverage: 15, implementationReadiness: 20 },
        dimensionLabels: { completeness: 'Tamlık', consistency: 'Tutarlılık', traceability: 'İzlenebilirlik', riskCoverage: 'Risk kapsamı', implementationReadiness: 'Uygulamaya hazırlık' },
        checks: Array.isArray(previousReadiness.checks) ? previousReadiness.checks : [],
        blockers: list(previousReadiness.blockers),
        warnings: list(previousReadiness.warnings),
        calculatedAtRevision: Math.max(1, Number(previousReadiness.calculatedAtRevision || next.canonicalRevision))
    };
    next.objectives = (next.objectives || []).map(normalizeObjective);
    next.requirements = (next.requirements || []).map(normalizeRequirement);
    next.decisions = (next.decisions || []).map(normalizeDecision);
    next.assumptions = (next.assumptions || []).map(normalizeAssumption);
    next.risks = (next.risks || []).map(normalizeRisk);
    next.tasks = (next.tasks || []).map(normalizeTask);
    next.testCases = (next.testCases || []).map(normalizeTestCase);
    next.milestones = (next.milestones || []).map(normalizeMilestone);
    next.traceLinks = (next.traceLinks || []).map(normalizeTraceLink);
    next.agentPrompts = (next.agentPrompts || []).map(normalizeAgentPrompt);
    next.researchQuestions = (next.researchQuestions || []).map(normalizeResearchQuestion);
    next.sources = (next.sources || []).map(normalizeResearchSource);
    next.evidence = (next.evidence || []).map(normalizeEvidence);
    next.reviewFindings = (next.reviewFindings || []).map(normalizeReviewFinding);
    next.simulationRuns = (next.simulationRuns || []).map(normalizeSimulationRun);
    next.impactAnalyses = (next.impactAnalyses || []).map(normalizeImpactAnalysis);
    next.planningScenarios = (next.planningScenarios || []).map(normalizePlanningScenario);
    next.sectionPatchProposals = (next.sectionPatchProposals || []).map(normalizeSectionPatchProposal);
    next.ideaDocumentRevisions = Array.isArray(next.ideaDocumentRevisions) ? next.ideaDocumentRevisions.map((revision, index) => ({
        id: text(revision?.id, `idea-revision-${index + 1}`),
        number: Math.max(1, Number(revision?.number || index + 1)),
        documentRevision: Math.max(1, Number(revision?.documentRevision || next.documentRevision)),
        canonicalRevision: Math.max(1, Number(revision?.canonicalRevision || next.canonicalRevision)),
        createdAt: text(revision?.createdAt, next.lifecycle?.updatedAt || next.lifecycle?.createdAt),
        summary: text(revision?.summary, `Fikir belgesi sürüm ${index + 1}`),
        source: ['initial', 'edit', 'discovery', 'restore'].includes(revision?.source) ? revision.source : 'edit',
        status: ['draft', 'converted', 'superseded'].includes(revision?.status) ? revision.status : 'superseded',
        convertedCanonicalRevision: Number.isInteger(revision?.convertedCanonicalRevision) ? revision.convertedCanonicalRevision : null,
        restoredFromRevision: Number.isInteger(revision?.restoredFromRevision) ? revision.restoredFromRevision : null,
        snapshot: {
            summary: text(revision?.snapshot?.summary),
            targetUser: text(revision?.snapshot?.targetUser),
            problemStatement: text(revision?.snapshot?.problemStatement),
            currentAlternative: text(revision?.snapshot?.currentAlternative),
            desiredOutcome: text(revision?.snapshot?.desiredOutcome),
            confirmedFeatures: list(revision?.snapshot?.confirmedFeatures),
            outOfScope: list(revision?.snapshot?.outOfScope),
            technicalApproaches: list(revision?.snapshot?.technicalApproaches),
            openQuestions: list(revision?.snapshot?.openQuestions),
            knownRisks: list(revision?.snapshot?.knownRisks),
            mvpTarget: text(revision?.snapshot?.mvpTarget)
        }
    })) : [];
    const convertedIdeaRevision = [...next.ideaDocumentRevisions].reverse()
        .find(revision => revision.status === 'converted' && revision.convertedCanonicalRevision !== null);
    next.sourceIdeaRevisionId = text(next.sourceIdeaRevisionId) || convertedIdeaRevision?.id || null;
    next.sourceIdeaRevisionNumber = Number.isInteger(next.sourceIdeaRevisionNumber)
        ? next.sourceIdeaRevisionNumber
        : convertedIdeaRevision?.number || null;
    next.planAlignment = next.sourceIdeaRevisionId
        ? evaluatePlanAlignment(next)
        : {
            ...emptyPlanAlignment(text(next.planAlignment?.reason) || undefined),
            currentIdeaRevisionId: next.ideaDocumentRevisions.at(-1)?.id || null,
            currentIdeaRevisionNumber: next.ideaDocumentRevisions.at(-1)?.number || null
        };
    next.modules = {
        active: Array.isArray(next.modules?.active) ? next.modules.active.map(item => ({ id: text(item.id), version: text(item.version), enabledAtRevision: Number(item.enabledAtRevision || 0), config: item.config && typeof item.config === 'object' ? item.config : {} })).filter(item => item.id) : [],
        dismissed: list(next.modules?.dismissed),
        localManifests: Array.isArray(next.modules?.localManifests) ? next.modules.localManifests : []
    };
    next.executionSessions = (next.executionSessions || []).map(normalizeExecutionSession);
    next.exports = Array.isArray(next.exports) ? next.exports.map(item => {
        const normalized = {
            ...item,
            canonicalRevision: Math.max(1, Number(item.canonicalRevision || item.revision || next.canonicalRevision))
        };
        delete normalized.revision;
        return normalized;
    }) : [];
    next.commandLog = Array.isArray(next.commandLog) ? next.commandLog.map(item => ({
        commandId: text(item.commandId),
        commandType: text(item.commandType, 'LegacyCommand'),
        expectedDocumentRevision: Math.max(0, Number(item.expectedDocumentRevision ?? item.expectedRevision ?? 0)),
        committedDocumentRevision: Math.max(1, Number(item.committedDocumentRevision ?? item.committedRevision ?? next.documentRevision)),
        expectedCanonicalRevision: Math.max(0, Number(item.expectedCanonicalRevision ?? item.expectedRevision ?? 0)),
        committedCanonicalRevision: Math.max(1, Number(item.committedCanonicalRevision ?? item.committedRevision ?? next.canonicalRevision)),
        createdAt: text(item.createdAt)
    })).filter(item => item.commandId) : [];
    next.revisions = Array.isArray(next.revisions) ? next.revisions.map(revision => {
        const snapshot = revision.snapshot && typeof revision.snapshot === 'object' ? structuredClone(revision.snapshot) : {};
        snapshot.schemaVersion = 5;
        snapshot.schemaRevision = 4;
        snapshot.documentRevision = Math.max(1, Number(snapshot.documentRevision || snapshot.revision || revision.number || 1));
        snapshot.canonicalRevision = Math.max(1, Number(snapshot.canonicalRevision || snapshot.revision || revision.number || 1));
        delete snapshot.revision;
        snapshot.planningScenarios = Array.isArray(snapshot.planningScenarios) ? snapshot.planningScenarios : [];
        snapshot.sectionPatchProposals = Array.isArray(snapshot.sectionPatchProposals) ? snapshot.sectionPatchProposals : [];
        snapshot.ideaDocumentRevisions = Array.isArray(snapshot.ideaDocumentRevisions) ? snapshot.ideaDocumentRevisions : [];
        snapshot.sourceIdeaRevisionId = snapshot.sourceIdeaRevisionId || null;
        snapshot.sourceIdeaRevisionNumber = Number.isInteger(snapshot.sourceIdeaRevisionNumber) ? snapshot.sourceIdeaRevisionNumber : null;
        snapshot.planAlignment = snapshot.planAlignment || emptyPlanAlignment();
        return { ...revision, number: Math.max(1, Number(revision.number || snapshot.canonicalRevision)), snapshot };
    }) : [];
    next.ideaDiscussion = {
        mode: ['explore', 'challenge', 'compare', 'clarify'].includes(next.ideaDiscussion?.mode) ? next.ideaDiscussion.mode : 'explore',
        records: Array.isArray(next.ideaDiscussion?.records) ? next.ideaDiscussion.records.filter(item => item && item.id && item.text).map(item => ({
            id: text(item.id),
            kind: ['decision', 'hypothesis', 'risk', 'question'].includes(item.kind) ? item.kind : 'hypothesis',
            text: text(item.text),
            originalText: text(item.originalText || item.text),
            note: text(item.note),
            answer: text(item.answer),
            rationale: text(item.rationale),
            validationPlan: text(item.validationPlan),
            history: Array.isArray(item.history) ? item.history.map(entry => ({
                editedAt: text(entry.editedAt),
                text: text(entry.text),
                note: text(entry.note),
                answer: text(entry.answer),
                rationale: text(entry.rationale),
                validationPlan: text(entry.validationPlan)
            })) : [],
            status: ['pending', 'accepted', 'deferred', 'rejected'].includes(item.status) ? item.status : 'pending',
            sourceBundleId: text(item.sourceBundleId),
            sourceMessageId: text(item.sourceMessageId),
            createdAt: text(item.createdAt),
            ...(item.resolvedAt ? { resolvedAt: text(item.resolvedAt) } : {})
        })) : [],
        updatedAt: text(next.ideaDiscussion?.updatedAt)
    };
    if (next.ideaLabSession?.conceptSummary) {
        const source = next.ideaLabSession.conceptSummary;
        const needsReconfirmation = sourceSchemaRevision < 3;
        next.ideaLabSession.conceptSummary = {
            ...source,
            summary: text(source.summary, next.identity?.summary || next.identity?.originalIdea),
            targetUser: text(source.targetUser, 'Birincil kullanıcı migration sonrası doğrulanmalı.'),
            problemStatement: text(source.problemStatement, next.identity?.originalIdea || 'Problem tanımı migration sonrası doğrulanmalı.'),
            currentAlternative: text(source.currentAlternative, 'Mevcut çözüm migration sonrası doğrulanmalı.'),
            desiredOutcome: text(source.desiredOutcome, next.identity?.desiredOutcome || 'Beklenen sonuç migration sonrası doğrulanmalı.'),
            interpretationConfidence: Math.max(0, Math.min(100, Math.round(Number(source.interpretationConfidence ?? 40)))),
            confidenceRationale: list(source.confidenceRationale).length
                ? list(source.confidenceRationale)
                : ['Eski proje kaydında yorum güveni bulunmadığı için düşük başlangıç değeri kullanıldı.'],
            confirmedFeatures: list(source.confirmedFeatures),
            outOfScope: list(source.outOfScope),
            technicalApproaches: list(source.technicalApproaches),
            openQuestions: [
                ...list(source.openQuestions),
                ...(needsReconfirmation ? ['Yeni hedef kullanıcı ve problem alanları migration sonrası doğrulanmalı.'] : [])
            ],
            knownRisks: list(source.knownRisks),
            mvpTarget: text(source.mvpTarget),
            userConfirmed: needsReconfirmation ? false : Boolean(source.userConfirmed),
            ...(needsReconfirmation ? { confirmedAt: undefined } : {})
        };
    }
    next.metadata = { ...(next.metadata || {}), canonicalModelVersion: CANONICAL_MODEL_VERSION };
    return next;
}

export { CANONICAL_MODEL_VERSION };
