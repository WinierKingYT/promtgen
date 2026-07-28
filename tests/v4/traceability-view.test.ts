import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeDecision,
  normalizeRequirement,
  normalizeRisk,
  normalizeTask,
  normalizeTestCase,
  normalizeTraceLink
} from '../../src/v4/canonical-entities.js';
import { buildTraceabilityView } from '../../src/v4/application/traceability-view.js';
import { createProjectDocument } from '../../src/v4/project-document.js';

function connectedProject() {
  const project = createProjectDocument({ idea: 'S&box at sistemi' });
  project.decisions.push(normalizeDecision({ id: 'decision-1', title: 'Sunucu otoritesi', decision: 'Sunucu otoriteli hareket', status: 'accepted', affectedSectionIds: ['architecture'] }));
  project.requirements.push(normalizeRequirement({ id: 'requirement-1', title: 'At hareketi', statement: 'At girdiyi işlemeli', acceptanceCriteria: ['At hareket eder'], status: 'accepted' }));
  project.tasks.push(normalizeTask({ id: 'task-1', title: 'At hareketini uygula', requirementIds: ['requirement-1'], acceptanceCriteria: ['At hareket eder'], verificationIds: ['test-1'] }));
  project.testCases.push(normalizeTestCase({ id: 'test-1', title: 'At hareket testi', requirementIds: ['requirement-1'], status: 'ready' }));
  project.risks.push(normalizeRisk({ id: 'risk-1', title: 'Gecikme', status: 'open' }));
  project.traceLinks.push(
    normalizeTraceLink({ id: 'trace-1', fromType: 'decision', fromId: 'decision-1', toType: 'requirement', toId: 'requirement-1', relation: 'drives' }),
    normalizeTraceLink({ id: 'trace-2', fromType: 'requirement', fromId: 'requirement-1', toType: 'task', toId: 'task-1', relation: 'implements' }),
    normalizeTraceLink({ id: 'trace-3', fromType: 'requirement', fromId: 'requirement-1', toType: 'test', toId: 'test-1', relation: 'validated_by' })
  );
  return project;
}

describe('canonical traceability view', () => {
  it('derives one graph without duplicating canonical reference edges', () => {
    const view = buildTraceabilityView(connectedProject());
    assert.equal(view.nodes.length, 5);
    assert.equal(view.edges.filter(edge => edge.fromId === 'requirement-1' && edge.toId === 'task-1').length, 1);
    assert.equal(view.edges.filter(edge => edge.fromId === 'requirement-1' && edge.toId === 'test-1').length, 1);
    const ids = new Set(view.nodes.map(node => node.id));
    assert.ok(view.edges.every(edge => ids.has(edge.fromId) && ids.has(edge.toId)));
    assert.deepEqual(view.invalidLinkIds, []);
  });

  it('reports invalid endpoints instead of rendering invented graph edges', () => {
    const project = connectedProject();
    project.traceLinks.push(normalizeTraceLink({ id: 'trace-invalid', fromType: 'decision', fromId: 'missing', toType: 'risk', toId: 'risk-1', relation: 'mitigates' }));
    const view = buildTraceabilityView(project);
    assert.deepEqual(view.invalidLinkIds, ['trace-invalid']);
    assert.ok(!view.edges.some(edge => edge.id === 'trace-invalid'));
  });

  it('resolves saved revision snapshots and deterministic change reasons', () => {
    const project = connectedProject();
    const firstSnapshot = structuredClone(project);
    firstSnapshot.revisions = [];
    project.revisions.push({
      id: 'revision-1',
      number: 1,
      createdAt: project.lifecycle.createdAt,
      summary: 'İlk bağlı plan',
      acceptedSuggestionIds: [],
      affectedSections: ['architecture'],
      snapshot: firstSnapshot
    });
    project.documentRevision = 2;
    project.canonicalRevision = 2;
    project.decisions[0].decision = 'Tahmin destekli sunucu otoritesi';
    const current = buildTraceabilityView(project);
    const previous = buildTraceabilityView(project, 1);
    assert.equal(current.nodes.find(node => node.id === 'decision-1')?.lastChangedRevision, 2);
    assert.equal(previous.revision, 1);
    assert.equal(previous.nodes.find(node => node.id === 'decision-1')?.lastChangeReason, 'İlk bağlı plan');
  });
});
