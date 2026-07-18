import assert from 'assert';
import { getInitialV3State } from '../../src/state/project-state-v3.js';
import {
    getGapDefinitions, detectGaps, scoreGap, rankGaps,
    selectQuestions, processDiscoveryAnswer, assessReadiness,
    buildDiscoveryOptionsPrompt, generateOfflineDiscoveryOptions
} from '../../src/discovery/discovery-engine.js';
import { UNIVERSAL_PHASES } from '../../src/workflow/phases.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  ✅ ${name}`); passed++; }
    catch (e) { console.error(`  ❌ ${name}\n     ${e.message}`); failed++; }
}

console.log('\n🔎 discovery-engine tests');

test('getGapDefinitions returns array of gap definitions', () => {
    const defs = getGapDefinitions();
    assert.ok(Array.isArray(defs));
    assert.ok(defs.length >= 10);
});

test('each gap definition has required fields', () => {
    for (const def of getGapDefinitions()) {
        assert.ok(def.id, `missing id: ${def.id}`);
        assert.ok(def.targetPath, `missing targetPath: ${def.id}`);
        assert.ok(def.category, `missing category: ${def.id}`);
        assert.ok(def.importance, `missing importance: ${def.id}`);
        assert.ok(typeof def.check === 'function', `missing check: ${def.id}`);
    }
});

test('detectGaps returns gaps for empty state', () => {
    const state = getInitialV3State();
    const gaps = detectGaps(state, UNIVERSAL_PHASES.IDEA_CAPTURED);
    assert.ok(gaps.length > 0);
    assert.ok(gaps.some(g => g.id === 'GAP-SUMMARY'));
    assert.ok(gaps.some(g => g.id === 'GAP-PROJECT-NAME'));
});

test('detectGaps returns fewer gaps for populated state', () => {
    const state = getInitialV3State();
    state.identity = { name: 'Test Proje', summary: 'Full project description here', problemStatement: 'Problem description', desiredOutcome: 'Outcome description' };
    state.objectives = [{ id: 'OBJ-001', title: 'Build App' }];
    state.scope = { mustHave: ['Login'], shouldHave: [], couldHave: [], notNow: [], outOfScope: ['Mobile'] };
    const gaps = detectGaps(state, UNIVERSAL_PHASES.OBJECTIVES_DEFINED);
    assert.ok(gaps.length < 10);
});

test('gaps have blocksCurrent flag', () => {
    const state = getInitialV3State();
    const gaps = detectGaps(state, UNIVERSAL_PHASES.SCOPE_DEFINED);
    const scopeGaps = gaps.filter(g => g.targetPath === '/scope/mustHave');
    assert.ok(scopeGaps.length > 0);
    assert.ok(scopeGaps.some(g => g.blocksCurrent));
});

test('scoreGap returns higher score for critical blocking gaps', () => {
    const state = getInitialV3State();
    const gaps = detectGaps(state, UNIVERSAL_PHASES.IDEA_CAPTURED);
    const scores = gaps.map(g => ({ id: g.id, score: scoreGap(g, UNIVERSAL_PHASES.IDEA_CAPTURED) }));
    const criticalScores = scores.filter(s => gaps.find(g => g.id === s.id).importance === 'critical');
    const lowScores = scores.filter(s => gaps.find(g => g.id === s.id).importance === 'medium');
    if (criticalScores.length > 0 && lowScores.length > 0) {
        assert.ok(criticalScores[0].score >= lowScores[0].score);
    }
});

test('rankGaps sorts by score descending', () => {
    const state = getInitialV3State();
    const gaps = detectGaps(state, UNIVERSAL_PHASES.IDEA_CAPTURED);
    const ranked = rankGaps(gaps, UNIVERSAL_PHASES.IDEA_CAPTURED);
    for (let i = 0; i < ranked.length - 1; i++) {
        const s1 = scoreGap(ranked[i], UNIVERSAL_PHASES.IDEA_CAPTURED);
        const s2 = scoreGap(ranked[i + 1], UNIVERSAL_PHASES.IDEA_CAPTURED);
        assert.ok(s1 >= s2, `${ranked[i].id} (${s1}) < ${ranked[i+1].id} (${s2})`);
    }
});

test('selectQuestions returns at most maxQuestions', () => {
    const state = getInitialV3State();
    const gaps = detectGaps(state, UNIVERSAL_PHASES.IDEA_CAPTURED);
    const selected = selectQuestions(gaps, UNIVERSAL_PHASES.IDEA_CAPTURED, 3);
    assert.ok(selected.length <= 3);
    assert.ok(selected.length >= 1);
});

test('selectQuestions prefers different categories', () => {
    const state = getInitialV3State();
    const gaps = detectGaps(state, UNIVERSAL_PHASES.IDEA_CAPTURED);
    const selected = selectQuestions(gaps, UNIVERSAL_PHASES.IDEA_CAPTURED, 5);
    const categories = new Set(selected.map(g => g.category));
    assert.ok(categories.size >= 2);
});

test('processDiscoveryAnswer produces patches for identity fields', () => {
    const state = getInitialV3State();
    const result = processDiscoveryAnswer(state, 'GAP-PROBLEM', 'Mevcut sistem çok yavaş ve kullanıcılar memnun değil.', 5);
    assert.ok(result.patches.length > 0);
    const namePatch = result.patches.find(p => p.path === '/identity/problemStatement');
    assert.ok(namePatch);
    assert.strictEqual(namePatch.value, 'Mevcut sistem çok yavaş ve kullanıcılar memnun değil.');
});

test('processDiscoveryAnswer produces patches for objectives', () => {
    const state = getInitialV3State();
    const result = processDiscoveryAnswer(state, 'GAP-OBJECTIVES', 'Kullanıcı girişi\nÖdeme sistemi\nBildirimler', 5);
    assert.ok(result.patches.length > 0);
    const objPatch = result.patches.find(p => p.path === '/objectives');
    assert.ok(objPatch);
    assert.ok(Array.isArray(objPatch.value));
    assert.ok(objPatch.value.length >= 2);
});

test('processDiscoveryAnswer produces patches for scope mustHave', () => {
    const state = getInitialV3State();
    const result = processDiscoveryAnswer(state, 'GAP-SCOPE-MUST', '- Kullanıcı kaydı\n- Login\n- Profil sayfası', 5);
    assert.ok(result.patches.length > 0);
    const scopePatch = result.patches.find(p => p.path === '/scope/mustHave');
    assert.ok(scopePatch);
    assert.ok(Array.isArray(scopePatch.value));
});

test('processDiscoveryAnswer returns empty for unknown gap', () => {
    const result = processDiscoveryAnswer(null, 'UNKNOWN-GAP', 'answer', 1);
    assert.deepStrictEqual(result, { patches: [], newGaps: [] });
});

test('assessReadiness returns correct counts', () => {
    const state = getInitialV3State();
    const readiness = assessReadiness(state, UNIVERSAL_PHASES.IDEA_CAPTURED);
    assert.ok(readiness.total > 0);
    assert.ok(readiness.openGaps > 0);
    assert.ok(readiness.completionRatio < 1);
    assert.ok(typeof readiness.blocked === 'boolean');
});

test('assessReadiness returns blocked=false for full state', () => {
    const state = getInitialV3State();
    state.identity = { name: 'P', summary: 'Full project description', problemStatement: 'Problem', desiredOutcome: 'Outcome' };
    state.objectives = [{ id: 'OBJ-1', title: 'Build' }];
    state.stakeholders = [{ id: 'STK-1', name: 'User' }];
    state.constraints = [{ id: 'CON-1', description: 'Budget' }];
    state.scope = { mustHave: ['Login'], shouldHave: [], couldHave: [], notNow: [], outOfScope: ['X'] };
    state.deliverables = [{ id: 'DEL-1', name: 'App' }];
    state.tasks = [{ id: 'TASK-1', title: 'Build App' }];
    state.assumptions = [{ id: 'ASM-1', text: 'Users have internet', confidence: 'high', status: 'active' }];
    state.decisions = [{ id: 'DEC-1', title: 'Tech', decision: 'React', reason: 'Fast' }];
    state.risks = [{ id: 'RSK-1', description: 'Delay', impact: 'medium', likelihood: 'low', mitigation: 'Plan' }];
    state.profile = { domains: [{ name: 'web', confidence: 0.9 }], projectModes: [], activatedModules: [], uncertainties: ['Hosting'] };
    const readiness = assessReadiness(state, UNIVERSAL_PHASES.IDEA_CAPTURED);
    assert.strictEqual(readiness.blocked, false);
});

test('processDiscoveryAnswer for domains creates domain array', () => {
    const state = getInitialV3State();
    const result = processDiscoveryAnswer(state, 'GAP-DOMAINS', 'Web Uygulaması, Mobil', 5);
    const patch = result.patches.find(p => p.path === '/profile/domains');
    assert.ok(patch);
    assert.strictEqual(patch.value.length, 2);
    assert.strictEqual(patch.value[0].name, 'Web Uygulaması');
});

test('processDiscoveryAnswer for tasks creates task array', () => {
    const state = getInitialV3State();
    const result = processDiscoveryAnswer(state, 'GAP-TASKS', 'Backend kurulumu\nFrontent geliştirme\nTest yazma', 5);
    const patch = result.patches.find(p => p.path === '/tasks');
    assert.ok(patch);
    assert.strictEqual(patch.value.length, 3);
});

test('processDiscoveryAnswer ignores empty answer', () => {
    const state = getInitialV3State();
    const result = processDiscoveryAnswer(state, 'GAP-PROBLEM', '', 5);
    assert.strictEqual(result.patches.length, 0);
});

test('buildDiscoveryOptionsPrompt contains context fields', () => {
    const prompt = buildDiscoveryOptionsPrompt('Build an AI chat app', 'React', '18.x');
    assert.ok(prompt.includes('Build an AI chat app'));
    assert.ok(prompt.includes('React'));
    assert.ok(prompt.includes('18.x'));
});

test('generateOfflineDiscoveryOptions with game keywords', () => {
    const result = generateOfflineDiscoveryOptions('A simple platformer game', 'Unity');
    assert.strictEqual(result.projectName, 'Oyun Projesi');
    assert.ok(result.domains.some(d => d.name === 'game'));
    assert.ok(result.platforms.includes('cross-platform'));
    assert.ok(result.objectives.length >= 3);
    
    // Check decisions
    const engineDecision = result.decisions.find(d => d.title === 'Oyun Motoru Tercihi');
    assert.ok(engineDecision);
    assert.ok(engineDecision.options.some(o => o.label === 'Unity'));
    assert.ok(engineDecision.options.some(o => o.label === 'Godot'));
});

test('generateOfflineDiscoveryOptions with mobile keywords', () => {
    const result = generateOfflineDiscoveryOptions('Mobile chat app for android and ios', 'Flutter');
    assert.strictEqual(result.projectName, 'Mobil Uygulama');
    assert.ok(result.domains.some(d => d.name === 'mobile'));
    assert.ok(result.platforms.includes('android'));
    
    const platformDecision = result.decisions.find(d => d.title === 'Mobil Geliştirme Platformu');
    assert.ok(platformDecision);
    assert.ok(platformDecision.options.some(o => o.label === 'Flutter (Dart)'));
});

test('generateOfflineDiscoveryOptions defaults to web', () => {
    const result = generateOfflineDiscoveryOptions('Create a dashboard portal', 'React');
    assert.strictEqual(result.projectName, 'Web Uygulaması');
    assert.ok(result.domains.some(d => d.name === 'web'));
    
    const feDecision = result.decisions.find(d => d.title === 'Frontend Kütüphanesi');
    assert.ok(feDecision);
    assert.ok(feDecision.options.some(o => o.label === 'React (Client-Side)'));
});

console.log(`\n  Discovery Engine: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
