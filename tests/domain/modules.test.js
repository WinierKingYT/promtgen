import assert from 'assert';
import {
    MODULE_NAMES, MODULE_REGISTRY,
    isModuleActive, getActiveModules, getActiveSubStages,
    getModuleForSubStage, getModuleDataTemplate
} from '../../src/core/modules.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  ✅ ${name}`); passed++; }
    catch (e) { console.error(`  ❌ ${name}\n     ${e.message}`); failed++; }
}

console.log('\n📦 module registry tests');

test('MODULE_NAMES has 6 entries', () => {
    assert.strictEqual(Object.keys(MODULE_NAMES).length, 6);
});

test('MODULE_REGISTRY has universal always active', () => {
    assert.ok(MODULE_REGISTRY[MODULE_NAMES.UNIVERSAL].alwaysActive);
});

test('MODULE_REGISTRY has all 6 modules', () => {
    const names = Object.values(MODULE_NAMES);
    for (const n of names) {
        assert.ok(MODULE_REGISTRY[n], `missing module: ${n}`);
    }
});

test('isModuleActive returns true for universal even without state', () => {
    assert.strictEqual(isModuleActive(null, MODULE_NAMES.UNIVERSAL), true);
});

test('isModuleActive returns false for inactive software module', () => {
    const state = { profile: { activatedModules: [] } };
    assert.strictEqual(isModuleActive(state, MODULE_NAMES.SOFTWARE), false);
});

test('isModuleActive returns true for activated module', () => {
    const state = { profile: { activatedModules: ['game'] } };
    assert.strictEqual(isModuleActive(state, MODULE_NAMES.GAME), true);
});

test('getActiveModules returns universal + activated', () => {
    const state = { profile: { activatedModules: ['software', 'game'] } };
    const active = getActiveModules(state);
    assert.ok(active.includes(MODULE_NAMES.UNIVERSAL));
    assert.ok(active.includes(MODULE_NAMES.SOFTWARE));
    assert.ok(active.includes(MODULE_NAMES.GAME));
});

test('getActiveModules returns just universal for no state', () => {
    assert.deepStrictEqual(getActiveModules(null), [MODULE_NAMES.UNIVERSAL]);
});

test('getActiveSubStages returns sub-stages for matching afterPhase', () => {
    const state = { profile: { activatedModules: ['software'] } };
    const stages = getActiveSubStages(state, 'OBJECTIVES_DEFINED');
    assert.ok(stages.some(s => s.key === 'REQUIREMENTS_DEFINED'));
});

test('getActiveSubStages returns empty for unknown phase', () => {
    const state = { profile: { activatedModules: ['software'] } };
    assert.deepStrictEqual(getActiveSubStages(state, 'NONEXISTENT'), []);
});

test('getModuleForSubStage returns correct module', () => {
    assert.strictEqual(getModuleForSubStage('REQUIREMENTS_DEFINED'), MODULE_NAMES.SOFTWARE);
    assert.strictEqual(getModuleForSubStage('CORE_LOOP_DEFINED'), MODULE_NAMES.GAME);
    assert.strictEqual(getModuleForSubStage('RESEARCH_QUESTION_DEFINED'), MODULE_NAMES.RESEARCH);
    assert.strictEqual(getModuleForSubStage('STAKEHOLDERS_DEFINED'), MODULE_NAMES.BUSINESS);
    assert.strictEqual(getModuleForSubStage('CONTENT_STRATEGY_DEFINED'), MODULE_NAMES.CONTENT);
});

test('getModuleForSubStage returns null for unknown', () => {
    assert.strictEqual(getModuleForSubStage('UNKNOWN'), null);
});

test('getModuleDataTemplate returns software template', () => {
    const tpl = getModuleDataTemplate(MODULE_NAMES.SOFTWARE);
    assert.ok(Array.isArray(tpl.platforms));
    assert.ok(Array.isArray(tpl.technologyOptions));
    assert.ok(tpl.architecture);
});

test('getModuleDataTemplate returns game template', () => {
    const tpl = getModuleDataTemplate(MODULE_NAMES.GAME);
    assert.ok(Array.isArray(tpl.coreLoop));
    assert.ok(Array.isArray(tpl.mechanics));
});

test('getModuleDataTemplate returns research template', () => {
    const tpl = getModuleDataTemplate(MODULE_NAMES.RESEARCH);
    assert.ok(Array.isArray(tpl.researchQuestions));
    assert.ok(tpl.methodology !== undefined);
});

test('getModuleDataTemplate returns business template', () => {
    const tpl = getModuleDataTemplate(MODULE_NAMES.BUSINESS);
    assert.ok(Array.isArray(tpl.kpis));
});

test('getModuleDataTemplate returns content template', () => {
    const tpl = getModuleDataTemplate(MODULE_NAMES.CONTENT);
    assert.ok(Array.isArray(tpl.channels));
});

test('getModuleDataTemplate returns empty object for unknown', () => {
    assert.deepStrictEqual(getModuleDataTemplate('unknown'), {});
});

test('universal module has no subStages', () => {
    assert.deepStrictEqual(MODULE_REGISTRY[MODULE_NAMES.UNIVERSAL].subStages, []);
});

test('software module has 5 subStages', () => {
    assert.strictEqual(MODULE_REGISTRY[MODULE_NAMES.SOFTWARE].subStages.length, 5);
});

test('each module has label and description', () => {
    for (const [name, mod] of Object.entries(MODULE_REGISTRY)) {
        assert.ok(typeof mod.label === 'string' && mod.label.length > 0, `${name} label`);
        assert.ok(typeof mod.description === 'string' && mod.description.length > 0, `${name} desc`);
    }
});

console.log(`\n  Module Registry: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
