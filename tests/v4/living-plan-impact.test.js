import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProjectStateV4 } from '../../src/v4/project-state-v4.js';
import { generateImpactAnalysis } from '../../src/v4/ai-discovery.js';
import { applyImpactAnalysis, applyExtensionModules, resolveImpactContradiction } from '../../src/v4/planning-engine.js';
import { runPlanReview } from '../../src/v4/review-engine.js';

test('Yaşayan Plan: Etki analizi, çelişki tespiti ve Supersede aksiyonu', async () => {
    const project = createProjectStateV4({ idea: 'S&box at sistemi' });
    project.decisions.push({
        id: 'dec-1',
        title: 'Yük Taşıma',
        decision: 'Yük taşıma ilk sürümde kapsam dışı bırakılmıştır.',
        status: 'accepted',
        sourceSuggestionId: '',
        affectedSectionIds: ['scope']
    });

    const userRequest = 'Atların artık yük taşımasını ve heybe takmasını istiyorum.';
    const result = await generateImpactAnalysis(project, userRequest, { settings: { providerId: 'offline' } });

    assert.equal(result.project.impactAnalyses.length, 1);
    assert.ok(result.impact.contradictions.length > 0);
    assert.ok(result.impact.contradictionDetails.length > 0);
    assert.equal(result.impact.contradictionDetails[0].decisionId, 'dec-1');

    // Action: Supersede old decision
    const updatedProject = resolveImpactContradiction(result.project, result.impact.id, 'dec-1', 'supersede');

    const oldDec = updatedProject.decisions.find(d => d.id === 'dec-1');
    assert.equal(oldDec.status, 'superseded');

    const newDec = updatedProject.decisions.find(d => d.title.includes('Revize Karar'));
    assert.ok(newDec);
    assert.equal(newDec.status, 'accepted');
    assert.ok(updatedProject.revision > project.revision);
});

test('Oyun Motoru / S&box Domain İnceleme Kuralı (GAME-NET-001)', () => {
    const project = createProjectStateV4({ idea: 'S&box multiplayer at sistemi oyunu' });
    const report = runPlanReview(project);

    // GAME-NET-001 finding should trigger when network decision is missing in game domain
    assert.ok(report.findings.some(f => f.ruleId === 'GAME-NET-001'));
});

test('İsteğe Bağlı Genişletme Paketleri revizyon olarak eklenmesi', () => {
    const project = createProjectStateV4({ idea: 'S&box at sistemi' });
    const initialRev = project.revision;

    const updated = applyExtensionModules(project, ['Mounted Combat', 'Racing System']);

    assert.ok(updated.revision > initialRev);
    assert.ok(updated.tasks.some(t => t.title.includes('[Modül] Mounted Combat')));
    assert.ok(updated.tasks.some(t => t.title.includes('[Modül] Racing System')));
});
