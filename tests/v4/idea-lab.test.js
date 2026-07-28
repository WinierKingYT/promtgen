import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProjectDocument } from '../../src/v4/project-document.js';
import { generateIdeaLabBundle, generateConceptSummary } from '../../src/v4/ai-discovery.js';
import { confirmConceptSummary, runConceptSimulation } from '../../src/v4/planning-engine.js';
import { createInitialConceptInterpretation } from '../../src/v4/application/idea-discussion-service.js';

test('Fikir Laboratuvarı: Metrik matrisi ve preset cevap çipleri', async () => {
    const project = createProjectDocument({ idea: 'S&box oyun motorunda bir at sistemi yapmak istiyorum' });
    project.ideaLabSession.conceptSummary = createInitialConceptInterpretation(project);
    const result = await generateIdeaLabBundle(project, { settings: { providerId: 'offline' } });

    assert.equal(result.project.lifecycle.activePhase, 'IDEA_LAB');
    assert.equal(result.approaches.length, 3);
    assert.equal(result.project.ideaLabSession.conceptSummary.summary, project.ideaLabSession.conceptSummary.summary);
    
    // Check metric ratings matrix presence
    const app = result.approaches[0];
    assert.ok(app.metrics);
    assert.ok(app.metrics.effortScore >= 1 && app.metrics.effortScore <= 5);
    assert.ok(app.metrics.networkLoad >= 1 && app.metrics.networkLoad <= 5);
    assert.ok(app.presetAnswers && app.presetAnswers.length > 0);
});

test('Konsept A/B Simülasyonu ve Onayı', async () => {
    const project = createProjectDocument({ idea: 'S&box at sistemi' });
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
    conceptProject.ideaLabSession.conceptSummary.openQuestions = [];

    assert.equal(conceptProject.lifecycle.activePhase, 'CONCEPT_CONFIRMATION');
    assert.ok(conceptProject.ideaLabSession.conceptSummary.simulationResult);
    assert.ok(conceptProject.ideaLabSession.conceptSummary.targetUser);

    // User approves concept summary -> canonical plan starts
    const confirmedProject = confirmConceptSummary(conceptProject);

    assert.equal(confirmedProject.ideaLabSession.conceptSummary.userConfirmed, true);
    assert.equal(confirmedProject.lifecycle.activePhase, 'SHAPING');
    assert.ok(confirmedProject.canonicalRevision > 1);
});
