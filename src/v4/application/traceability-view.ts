import type {
  Decision,
  ProjectDocumentV5,
  Requirement,
  Risk,
  Task,
  TestCase,
  TraceLink
} from '../contracts.js';

export type TraceabilityNodeType = 'decision' | 'requirement' | 'task' | 'test' | 'risk';

export interface TraceabilityViewNode {
  id: string;
  type: TraceabilityNodeType;
  label: string;
  status: string;
  affectedSectionIds: string[];
  impacted: boolean;
  lastChangedRevision: number;
  lastChangeReason: string;
}

export interface TraceabilityViewEdge {
  id: string;
  fromId: string;
  toId: string;
  relation: string;
  source: 'trace_link' | 'canonical_reference';
}

export interface TraceabilityView {
  revision: number;
  availableRevisions: Array<{ number: number; label: string }>;
  nodes: TraceabilityViewNode[];
  edges: TraceabilityViewEdge[];
  invalidLinkIds: string[];
}

type TraceabilityDocument = Omit<ProjectDocumentV5, 'revisions'> & { revisions?: ProjectDocumentV5['revisions'] };
type SupportedEntity = Decision | Requirement | Task | TestCase | Risk;

const COLLECTIONS: Record<TraceabilityNodeType, keyof Pick<ProjectDocumentV5, 'decisions' | 'requirements' | 'tasks' | 'testCases' | 'risks'>> = {
  decision: 'decisions',
  requirement: 'requirements',
  task: 'tasks',
  test: 'testCases',
  risk: 'risks'
};

const SECTION_BY_TYPE: Record<TraceabilityNodeType, string[]> = {
  decision: ['decisions'],
  requirement: ['requirements'],
  task: ['tasks'],
  test: ['test'],
  risk: ['risk']
};

function labelOf(entity: SupportedEntity) {
  return entity.title;
}

function statusOf(entity: SupportedEntity) {
  return entity.status;
}

function sectionsOf(entity: SupportedEntity, type: TraceabilityNodeType) {
  if (type === 'decision' && 'affectedSectionIds' in entity) return entity.affectedSectionIds;
  return SECTION_BY_TYPE[type];
}

function entityAt(document: TraceabilityDocument, type: TraceabilityNodeType, id: string): SupportedEntity | undefined {
  const collection = COLLECTIONS[type];
  return (document[collection] as SupportedEntity[]).find(entity => entity.id === id);
}

function serializedEntity(document: TraceabilityDocument, type: TraceabilityNodeType, id: string) {
  const entity = entityAt(document, type, id);
  return entity ? JSON.stringify(entity) : '';
}

function revisionHistory(project: ProjectDocumentV5, selected: TraceabilityDocument, selectedRevision: number) {
  const saved = project.revisions
    .filter(revision => revision.number <= selectedRevision)
    .map(revision => ({ number: revision.number, summary: revision.summary, document: revision.snapshot as TraceabilityDocument }));
  if (!saved.some(entry => entry.number === selectedRevision)) {
    saved.push({
      number: selectedRevision,
      summary: selectedRevision === project.canonicalRevision ? 'Güncel canonical plan' : `r${selectedRevision}`,
      document: selected
    });
  }
  return saved.sort((left, right) => left.number - right.number);
}

function lastChange(project: ProjectDocumentV5, selected: TraceabilityDocument, selectedRevision: number, type: TraceabilityNodeType, id: string) {
  const history = revisionHistory(project, selected, selectedRevision);
  let previous = '';
  let result = { revision: selectedRevision, reason: 'Canonical plan kaydı' };
  for (const entry of history) {
    const current = serializedEntity(entry.document, type, id);
    if (current && current !== previous) result = { revision: entry.number, reason: entry.summary };
    previous = current;
  }
  return result;
}

function resolveDocument(project: ProjectDocumentV5, revisionNumber?: number) {
  if (!revisionNumber || revisionNumber === project.canonicalRevision) {
    return { document: project as TraceabilityDocument, revision: project.canonicalRevision };
  }
  const revision = project.revisions.find(candidate => candidate.number === revisionNumber);
  return revision
    ? { document: revision.snapshot as TraceabilityDocument, revision: revision.number }
    : { document: project as TraceabilityDocument, revision: project.canonicalRevision };
}

function implicitLinks(document: TraceabilityDocument): TraceabilityViewEdge[] {
  return [
    ...document.tasks.flatMap(task => task.requirementIds.map(requirementId => ({
      id: `reference:${requirementId}:${task.id}:implements`,
      fromId: requirementId,
      toId: task.id,
      relation: 'implements',
      source: 'canonical_reference' as const
    }))),
    ...document.testCases.flatMap(testCase => testCase.requirementIds.map(requirementId => ({
      id: `reference:${requirementId}:${testCase.id}:validated_by`,
      fromId: requirementId,
      toId: testCase.id,
      relation: 'validated_by',
      source: 'canonical_reference' as const
    })))
  ];
}

function explicitLink(link: TraceLink): TraceabilityViewEdge {
  return {
    id: link.id,
    fromId: link.fromId,
    toId: link.toId,
    relation: link.relation,
    source: 'trace_link'
  };
}

export function buildTraceabilityView(project: ProjectDocumentV5, revisionNumber?: number): TraceabilityView {
  const { document, revision } = resolveDocument(project, revisionNumber);
  const impactedIds = new Set(
    revision === project.canonicalRevision
      ? (document.impactAnalyses || []).flatMap(impact => [
          ...impact.changedEntityIds,
          ...impact.entityEffects.flatMap(effect => [effect.sourceEntityId, effect.targetEntityId])
        ])
      : []
  );
  const nodes = (Object.entries(COLLECTIONS) as Array<[TraceabilityNodeType, typeof COLLECTIONS[TraceabilityNodeType]]>)
    .flatMap(([type, collection]) => (document[collection] as SupportedEntity[]).map(entity => {
      const change = lastChange(project, document, revision, type, entity.id);
      return {
        id: entity.id,
        type,
        label: labelOf(entity),
        status: statusOf(entity),
        affectedSectionIds: sectionsOf(entity, type),
        impacted: impactedIds.has(entity.id),
        lastChangedRevision: change.revision,
        lastChangeReason: change.reason
      };
    }));
  const nodeIds = new Set(nodes.map(node => node.id));
  const candidates = [...document.traceLinks.map(explicitLink), ...implicitLinks(document)];
  const invalidLinkIds = candidates.filter(edge => !nodeIds.has(edge.fromId) || !nodeIds.has(edge.toId)).map(edge => edge.id);
  const seen = new Set<string>();
  const edges = candidates.filter(edge => {
    if (!nodeIds.has(edge.fromId) || !nodeIds.has(edge.toId)) return false;
    const key = `${edge.fromId}|${edge.toId}|${edge.relation}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const availableRevisions = [
    ...project.revisions.map(item => ({ number: item.number, label: `r${item.number} · ${item.summary}` })),
    { number: project.canonicalRevision, label: `r${project.canonicalRevision} · Güncel plan` }
  ].filter((item, index, all) => all.findIndex(candidate => candidate.number === item.number) === index)
    .sort((left, right) => right.number - left.number);

  return { revision, availableRevisions, nodes, edges, invalidLinkIds };
}
