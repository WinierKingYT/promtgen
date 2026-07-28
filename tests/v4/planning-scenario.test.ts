import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateImpactAnalysis } from '../../src/v4/ai-discovery.js';
import { applyChangeImpact } from '../../src/v4/application/change-impact-service.js';
import {
  createPlanningScenario,
  linkScenarioImpact,
  selectPlanningScenario
} from '../../src/v4/application/planning-scenario-service.js';
import { tryMigrateOrPassthrough } from '../../src/v4/migrations.js';
import { createProjectDocument, validateProjectDocument } from '../../src/v4/project-document.js';
import { createExportBundle } from '../../src/v4/exporter.js';

function scenarioInput() {
  return {
    name: 'Sunucu otoriteli at hareketi',
    description: 'Hile riskini azaltan alternatif',
    decisions: [{
      title: 'Hareket otoritesi',
      decision: 'At hareketi sunucu otoriteli ve istemci tahminli olmalı.',
      rationale: 'Çok oyunculu tutarlılığı korumak',
      affectedSectionIds: ['architecture', 'requirements'],
      dependencies: ['network layer']
    }]
  };
}

describe('planning scenarios', () => {
  it('keeps scenario creation outside canonical entities and exports', async () => {
    const project = createProjectDocument({ idea: 'S&box at sistemi' });
    const exportBefore = await createExportBundle(project);
    const before = {
      decisions: structuredClone(project.decisions),
      requirements: structuredClone(project.requirements),
      exports: structuredClone(project.exports),
      canonicalRevision: project.canonicalRevision
    };
    const created = createPlanningScenario(project, scenarioInput());
    assert.equal(created.project.planningScenarios.length, 1);
    assert.deepEqual(created.project.decisions, before.decisions);
    assert.deepEqual(created.project.requirements, before.requirements);
    assert.deepEqual(created.project.exports, before.exports);
    assert.equal(created.project.canonicalRevision, before.canonicalRevision);
    const exportAfter = await createExportBundle(created.project);
    assert.equal(exportAfter.canonicalHash, exportBefore.canonicalHash);
    assert.deepEqual(exportAfter.documents, exportBefore.documents);
    assert.ok(created.scenario.comparison.effortScore >= 1);
  });

  it('blocks stale scenario selection', () => {
    const project = createPlanningScenario(createProjectDocument({ idea: 'Yerel planlama' }), scenarioInput()).project;
    project.documentRevision += 1;
    project.canonicalRevision += 1;
    const result = selectPlanningScenario(project, project.planningScenarios[0].id);
    assert.equal(result.success, false);
    assert.match(result.reason, /yeniden oluşturulmalı/);
  });

  it('routes a selected scenario through impact approval before marking it merged', async () => {
    const created = createPlanningScenario(createProjectDocument({ idea: 'S&box çok oyunculu at sistemi' }), scenarioInput());
    const selected = selectPlanningScenario(created.project, created.scenario.id);
    assert.equal(selected.success, true);
    if (!selected.success) return;
    const proposed = await generateImpactAnalysis(selected.project, selected.request);
    const linked = linkScenarioImpact(proposed.project, created.scenario.id, proposed.impact.id);
    assert.equal(linked.planningScenarios[0].status, 'selected');
    assert.equal(linked.decisions.length, 0, 'Etki onaylanmadan canonical karar üretilmemeli');
    const applied = applyChangeImpact(linked, proposed.impact.id);
    assert.equal(applied.success, true);
    assert.equal(applied.project.planningScenarios[0].status, 'merged');
    assert.equal(applied.project.planningScenarios[0].impactAnalysisId, proposed.impact.id);
    assert.deepEqual(validateProjectDocument(applied.project), { valid: true, errors: [] });
  });

  it('normalizes older schema revision records with an empty scenario collection', () => {
    const legacy = createProjectDocument({ idea: 'Eski plan' });
    delete (legacy as Partial<typeof legacy>).planningScenarios;
    const migrated = tryMigrateOrPassthrough(legacy);
    assert.equal(migrated.error, null);
    assert.deepEqual(migrated.project.planningScenarios, []);
  });
});
