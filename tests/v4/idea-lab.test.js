import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProjectStateV4 } from '../../src/v4/project-state-v4.js';
import { generateIdeaLabBundle, generateConceptSummary } from '../../src/v4/ai-discovery.js';
import { confirmConceptSummary, runConceptSimulation } from '../../src/v4/planning-engine.js';

test('Fikir Laboratuvarı: Metrik matrisi ve preset cevap çipleri', async () => {
    const project = createProjectStateV4({ idea: 'S&box oyun motorunda bir at sistemi yapmak istiyorum' });
    const result = await generateIdeaLabBundle(project, { settings: { providerId: 'offline' } });

    assert.equal(result.project.lifecycle.activePhase, 'IDEA_LAB');
    assert.equal(result.approaches.length, 3);
    
    // Check metric ratings matrix presence
    const app = result.approaches[0];
    assert.ok(app.metrics);
    assert.ok(app.metrics.effortScore >= 1 && app.metrics.effortScore <= 5);
    assert.ok(app.metrics.networkLoad >= 1 && app.metrics.networkLoad <= 5);
    assert.ok(app.presetAnswers && app.presetAnswers.length > 0);
});

test('Konsept A/B Simülasyonu ve Onayı', async () => {
    const project = createProjectStateV4({ idea: 'S&box at sistemi' });
    const ideaLab = await generateIdeaLabBundle(project, { settings: { providerId: 'offline' } });
    
    // Run simulation prediction
    const sim = runConceptSimulation(ideaLab.project, ideaLab.approaches[1].id);
    assert.ok(sim.taskEstimate > 0);
    assert.ok(sim.completenessScore > 50);

    // Generate Concept Summary
    const conceptProject = await generateConceptSummary(ideaLab.project, {
        selectedApproachId: ideaLab.approaches[1].id,
        settings: { providerId: 'offline' }
    });
    conceptProject.ideaLabSession.conceptSummary.simulationResult = sim;

    assert.equal(conceptProject.lifecycle.activePhase, 'CONCEPT_CONFIRMATION');
    assert.ok(conceptProject.ideaLabSession.conceptSummary.simulationResult);

    // User approves concept summary -> canonical plan starts
    const confirmedProject = confirmConceptSummary(conceptProject);

    assert.equal(confirmedProject.ideaLabSession.conceptSummary.userConfirmed, true);
    assert.equal(confirmedProject.lifecycle.activePhase, 'SHAPING');
    assert.ok(confirmedProject.revision > 1);
});
