import assert from 'node:assert/strict';
import { createProjectStateV4, getRequiredSections } from '../../src/v4/project-state-v4.js';
import { normalizeDecision, normalizeRequirement, normalizeRisk, normalizeTask, normalizeTestCase } from '../../src/v4/canonical-entities.js';
import { applyReviewResult, runPlanReview, simulatePlan } from '../../src/v4/review-engine.js';
import { recalculateReadiness } from '../../src/v4/planning-engine.js';

const advancedDepth = { recommended: 'advanced', selected: 'advanced', overridden: false, rationale: 'test', signals: { score: 8, features: 3, integrations: 1, sensitiveData: true, multiPlatform: true, scaleIntent: false, uncertainty: 1 } };
const incomplete = createProjectStateV4({ idea: 'İncelenecek gelişmiş proje', planningDepth: advancedDepth });
const incompleteReview = runPlanReview(incomplete);
assert.ok(incompleteReview.counts.high > 0);
assert.equal(incompleteReview.gates.final, false);
assert.ok(simulatePlan(incomplete).some(run => run.status === 'failed'));
assert.equal(applyReviewResult({ ...incomplete, revision: 2 }, incompleteReview).success, false);

const ready = createProjectStateV4({ idea: 'Hazır gelişmiş proje', planningDepth: advancedDepth });
for (const sectionId of getRequiredSections('advanced')) { ready.sections[sectionId].content = `${sectionId} planı`; ready.sections[sectionId].status = 'draft'; }
ready.sections.deployment.content = 'Aşamalı dağıtım ve rollback ile geri alma uygulanır.';
ready.requirements = [normalizeRequirement({ id: 'req-1', title: 'Yerel plan', statement: 'Yerelde çalışır', acceptanceCriteria: ['Çevrimdışı açılır'], status: 'accepted' })];
ready.tasks = [normalizeTask({ id: 'task-1', title: 'Yerel kaydı uygula', requirementIds: ['req-1'], acceptanceCriteria: ['Kayıt geri açılır'], verificationIds: ['test-1'], status: 'ready' })];
ready.testCases = [normalizeTestCase({ id: 'test-1', title: 'Yerel kayıt testi', requirementIds: ['req-1'], status: 'ready' })];
ready.decisions = [normalizeDecision({ id: 'dec-1', title: 'Yerel veritabanı', decision: 'SQLite', rationale: 'Tek cihaz ve transaction desteği', status: 'accepted' })];
ready.risks = [normalizeRisk({ id: 'risk-1', title: 'Veri kaybı', mitigation: 'Revision yedeği', status: 'open' })];
const readyReview = runPlanReview(ready);
assert.equal(readyReview.gates.final, true);
assert.equal(readyReview.score, 100);
assert.ok(simulatePlan(ready).every(run => run.status !== 'failed'));
const applied = applyReviewResult(ready, readyReview, simulatePlan(ready));
assert.equal(applied.success, true);
assert.equal(applied.project.simulationRuns.length, 4);
const recalculated = recalculateReadiness(applied.project);
assert.equal(recalculated.metadata.lastReview.score, 100);
console.log('✓ V4 deterministic reviewer and plan simulations');
