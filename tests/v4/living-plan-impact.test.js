import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProjectDocument, validateProjectDocument } from '../../src/v4/project-document.js';
import { generateImpactAnalysis } from '../../src/v4/ai-discovery.js';
import { normalizeRequirement, normalizeTask, normalizeTestCase, normalizeTraceLink } from '../../src/v4/canonical-entities.js';
import { applyExtensionModules } from '../../src/v4/planning-engine.js';
import { applyChangeImpact, rejectChangeImpact, resolveImpactContradiction } from '../../src/v4/application/change-impact-service.ts';
import { runPlanReview } from '../../src/v4/review-engine.js';

test('Yaşayan Plan: trace graph etki önizlemesi ve atomik supersede uygulaması', async () => {
    const project = createProjectDocument({ idea: 'S&box at sistemi' });
    project.decisions.push({
        id: 'dec-1',
        title: 'Yük Taşıma',
        decision: 'Yük taşıma ilk sürümde kapsam dışı bırakılmıştır.',
        rationale: 'MVP süresini korumak',
        alternatives: [],
        consequences: [],
        status: 'accepted',
        sourceSuggestionId: '',
        affectedSectionIds: ['scope']
    });
    project.requirements.push(normalizeRequirement({
        id: 'req-1',
        title: 'At hareket sistemi',
        statement: 'At hareket sistemi oyuncu girdisini işlemeli.',
        acceptanceCriteria: ['At girdiye yanıt verir.'],
        status: 'accepted'
    }));
    project.tasks.push(normalizeTask({
        id: 'task-1',
        title: 'At hareketini uygula',
        requirementIds: ['req-1'],
        acceptanceCriteria: ['At girdiye yanıt verir.'],
        verificationIds: ['test-1']
    }));
    project.testCases.push(normalizeTestCase({
        id: 'test-1',
        title: 'At hareket kabul testi',
        requirementIds: ['req-1']
    }));
    project.traceLinks.push(
        normalizeTraceLink({ id: 'trace-1', fromType: 'decision', fromId: 'dec-1', toType: 'requirement', toId: 'req-1', relation: 'drives' }),
        normalizeTraceLink({ id: 'trace-2', fromType: 'requirement', fromId: 'req-1', toType: 'task', toId: 'task-1', relation: 'implements' }),
        normalizeTraceLink({ id: 'trace-3', fromType: 'requirement', fromId: 'req-1', toType: 'test', toId: 'test-1', relation: 'validated_by' })
    );

    const userRequest = 'Atların artık yük taşımasını ve heybe takmasını istiyorum.';
    const result = await generateImpactAnalysis(project, userRequest, { settings: { providerId: 'offline' } });

    assert.equal(result.project.impactAnalyses.length, 1);
    assert.equal(result.impact.baseRevision, project.revision);
    assert.ok(result.impact.changedEntityIds.includes('dec-1'));
    assert.ok(result.impact.entityEffects.some(effect => effect.targetEntityId === 'req-1'));
    assert.ok(result.impact.entityEffects.some(effect => effect.targetEntityId === 'task-1'));
    assert.ok(result.impact.entityEffects.some(effect => effect.targetEntityId === 'test-1'));
    assert.ok(result.impact.contradictions.length > 0);
    assert.ok(result.impact.contradictionDetails.length > 0);
    assert.equal(result.impact.contradictionDetails[0].decisionId, 'dec-1');

    const blocked = applyChangeImpact(result.project, result.impact.id);
    assert.equal(blocked.success, false);
    assert.equal(blocked.project.revision, project.revision);
    assert.match(blocked.reason, /çelişkisi çözüm bekliyor/);

    const resolved = resolveImpactContradiction(result.project, result.impact.id, 'dec-1', 'supersede');
    assert.equal(resolved.revision, project.revision, 'Önizleme kararı canonical revision artırmamalı');
    const applied = applyChangeImpact(resolved, result.impact.id);
    assert.equal(applied.success, true);
    assert.equal(applied.project.revision, project.revision + 1);

    const oldDec = applied.project.decisions.find(d => d.id === 'dec-1');
    assert.equal(oldDec.status, 'superseded');

    const newDec = applied.project.decisions.find(d => d.title.includes('Revize karar'));
    assert.ok(newDec);
    assert.equal(newDec.status, 'accepted');
    const newRequirement = applied.project.requirements.find(requirement => requirement.statement === userRequest);
    assert.ok(newRequirement);
    const newTask = applied.project.tasks.find(task => task.requirementIds.includes(newRequirement.id));
    const newTest = applied.project.testCases.find(testCase => testCase.requirementIds.includes(newRequirement.id));
    assert.ok(newTask);
    assert.ok(newTest);
    assert.ok(applied.project.traceLinks.some(link => link.fromId === newRequirement.id && link.toId === newTask.id));
    assert.ok(applied.project.traceLinks.some(link => link.fromId === newRequirement.id && link.toId === newTest.id));
    assert.equal(applied.project.impactAnalyses[0].status, 'accepted');
    assert.ok(applied.project.revisions.some(revision => revision.number === applied.project.revision));
    assert.deepEqual(validateProjectDocument(applied.project), { valid: true, errors: [] });
});

test('Yaşayan Plan: stale etki analizi uygulanmaz ve reddedilen kayıt geçmişte kalır', async () => {
    const project = createProjectDocument({ idea: 'Yerel planlama uygulamasını geliştir' });
    const proposed = await generateImpactAnalysis(project, 'Dışa aktarma akışına PDF desteği ekle');
    const changed = structuredClone(proposed.project);
    changed.revision += 1;
    const stale = applyChangeImpact(changed, proposed.impact.id);
    assert.equal(stale.success, false);
    assert.equal(stale.project.impactAnalyses[0].status, 'stale');
    assert.match(stale.reason, /yenilenmeli/);

    const rejected = rejectChangeImpact(proposed.project, proposed.impact.id);
    assert.equal(rejected.impactAnalyses[0].status, 'rejected');
    assert.ok(rejected.impactAnalyses[0].resolvedAt);
    assert.equal(rejected.revision, project.revision);
});

test('Oyun Motoru / S&box Domain İnceleme Kuralı (GAME-NET-001)', () => {
    const project = createProjectDocument({ idea: 'S&box multiplayer at sistemi oyunu' });
    const report = runPlanReview(project);

    // GAME-NET-001 finding should trigger when network decision is missing in game domain
    assert.ok(report.findings.some(f => f.ruleId === 'GAME-NET-001'));
});

test('İsteğe Bağlı Genişletme Paketleri revizyon olarak eklenmesi', () => {
    const project = createProjectDocument({ idea: 'S&box at sistemi' });
    const initialRev = project.revision;

    const updated = applyExtensionModules(project, ['Mounted Combat', 'Racing System']);

    assert.ok(updated.revision > initialRev);
    assert.ok(updated.tasks.some(t => t.title.includes('[Modül] Mounted Combat')));
    assert.ok(updated.tasks.some(t => t.title.includes('[Modül] Racing System')));
});
