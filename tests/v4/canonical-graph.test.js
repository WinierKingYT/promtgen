import assert from 'node:assert/strict';
import { createProjectStateV4 } from '../../src/v4/project-state-v4.js';
import { normalizeObjective, normalizeRequirement, normalizeTask, normalizeTestCase } from '../../src/v4/canonical-entities.js';
import { analyzeCanonicalImpact, analyzeCanonicalTraceability, buildCanonicalGraph } from '../../src/v4/canonical-graph.js';

const project = createProjectStateV4({ idea: 'İzlenebilir görev planı oluştur' });
project.objectives = [normalizeObjective({ id: 'obj-1', title: 'Hızlı teslim', status: 'accepted' })];
project.requirements = [normalizeRequirement({ id: 'req-1', title: 'Yerel kayıt', statement: 'Plan yerelde saklanmalı', sourceObjectiveIds: ['obj-1'], acceptanceCriteria: ['Çevrimdışı açılır'] })];
project.tasks = [normalizeTask({ id: 'task-1', title: 'Repository ekle', requirementIds: ['req-1'], acceptanceCriteria: ['Kayıt geri yüklenir'] })];
project.testCases = [normalizeTestCase({ id: 'test-1', title: 'Çevrimdışı kayıt testi', requirementIds: ['req-1'] })];

const engine = buildCanonicalGraph(project);
assert.equal(engine.getStats().totalNodes, 4);
assert.equal(engine.getStats().totalEdges, 3);
assert.equal(engine.graph.getOutgoingEdges('req-1').length, 2);
const report = analyzeCanonicalTraceability(project).report;
assert.equal(report.coverage.requirements.taskCoverage, 100);
assert.equal(report.coverage.requirements.testCoverage, 100);
const impact = analyzeCanonicalImpact(project, ['obj-1']);
assert.equal(impact.effects[0].targetEntityId, 'req-1');
assert.equal(impact.effects[0].effect, 'stale');

const unlinked = structuredClone(project);
unlinked.tasks[0].requirementIds = [];
assert.equal(analyzeCanonicalTraceability(unlinked).report.coverage.requirements.taskCoverage, 0);
console.log('✓ V4 canonical graph and impact analysis');
