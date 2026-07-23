import { GraphStore } from '../core/traceability/graph-store.js';
import { TraceabilityEngine } from '../core/traceability/traceability-engine.js';
import { EDGE_TYPES, NODE_TYPES } from '../core/traceability/traceability-types.js';
import { normalizeProjectStateV4 } from './canonical-entities.js';

const ENTITY_TYPES = [
    ['objectives', NODE_TYPES.OBJECTIVE, item => item.title],
    ['requirements', NODE_TYPES.REQUIREMENT, item => item.title],
    ['decisions', NODE_TYPES.DECISION, item => item.title],
    ['assumptions', NODE_TYPES.ASSUMPTION, item => item.statement],
    ['risks', NODE_TYPES.RISK, item => item.title],
    ['tasks', NODE_TYPES.TASK, item => item.title],
    ['testCases', NODE_TYPES.TEST, item => item.title],
    ['milestones', NODE_TYPES.MILESTONE, item => item.title],
    ['researchQuestions', NODE_TYPES.RESEARCH_QUESTION, item => item.question],
    ['sources', NODE_TYPES.SOURCE, item => item.title],
    ['evidence', NODE_TYPES.EVIDENCE, item => item.claim],
    ['reviewFindings', NODE_TYPES.REVIEW_FINDING, item => item.title]
];

function addEdge(graph, sourceId, targetId, type, metadata = {}) {
    if (!sourceId || !targetId || !graph.hasNode(sourceId) || !graph.hasNode(targetId)) return;
    const duplicate = graph.getOutgoingEdges(sourceId).some(edge => edge.targetId === targetId && edge.type === type);
    if (!duplicate) graph.addEdge(sourceId, targetId, type, metadata);
}

function relationType(relation) {
    return Object.values(EDGE_TYPES).includes(relation) ? relation : EDGE_TYPES.RELATES_TO;
}

export function buildCanonicalGraph(project) {
    const source = normalizeProjectStateV4(project);
    const graph = new GraphStore();
    for (const [collection, type, label] of ENTITY_TYPES) {
        for (const entity of source[collection]) graph.addNode(type, entity.id, label(entity) || entity.id, { ...entity, projectRevision: source.revision });
    }
    for (const requirement of source.requirements) {
        for (const objectiveId of requirement.sourceObjectiveIds) addEdge(graph, objectiveId, requirement.id, EDGE_TYPES.REFINES);
    }
    for (const task of source.tasks) {
        for (const requirementId of task.requirementIds) addEdge(graph, requirementId, task.id, EDGE_TYPES.IMPLEMENTS);
        for (const dependencyId of task.dependencies) addEdge(graph, task.id, dependencyId, EDGE_TYPES.DEPENDS_ON);
        for (const testId of task.verificationIds) addEdge(graph, task.id, testId, EDGE_TYPES.VALIDATED_BY);
    }
    for (const testCase of source.testCases) {
        for (const requirementId of testCase.requirementIds) addEdge(graph, requirementId, testCase.id, EDGE_TYPES.VALIDATED_BY);
    }
    for (const milestone of source.milestones) {
        for (const taskId of milestone.taskIds) addEdge(graph, milestone.id, taskId, EDGE_TYPES.BELONGS_TO);
    }
    for (const evidence of source.evidence) {
        addEdge(graph, evidence.questionId, evidence.id, EDGE_TYPES.DERIVED_FROM);
        addEdge(graph, evidence.sourceId, evidence.id, EDGE_TYPES.SUPPORTS);
    }
    for (const link of source.traceLinks) addEdge(graph, link.fromId, link.toId, relationType(link.relation), { source: 'user', traceLinkId: link.id });
    return new TraceabilityEngine(graph);
}

export function analyzeCanonicalTraceability(project) {
    const engine = buildCanonicalGraph(project);
    return { engine, report: engine.getFullReport() };
}

export function analyzeCanonicalImpact(project, changedEntityIds) {
    return buildCanonicalGraph(project).analyzeImpact(changedEntityIds);
}
