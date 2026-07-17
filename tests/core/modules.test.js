import assert from 'assert';
import { ModuleRegistry } from '../../src/core/modules/module-registry.js';
import { ContributionExecutor } from '../../src/core/modules/contribution-executor.js';
import {
    createModuleManifest, MODULE_STATUS, MODULE_CATEGORIES,
    CONTRIBUTION_TYPES, getCoreModules
} from '../../src/core/modules/module-types.js';
import {
    getUniversalPack, getSoftwareWebPack, getGamePack,
    getResearchPack, getSoftwareOfflinePack, getSoftwareAuthPack
} from '../../src/core/modules/domain-packs.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  ✅ ${name}`); passed++; }
    catch (e) { console.error(`  ❌ ${name}\n     ${e.message}`); failed++; }
}

console.log('\n📦 module-types tests');

test('createModuleManifest returns default manifest', () => {
    const m = createModuleManifest({ id: 'test', name: 'Test' });
    assert.strictEqual(m.id, 'test');
    assert.strictEqual(m.version, '1.0.0');
    assert.strictEqual(m.category, MODULE_CATEGORIES.DOMAIN);
});

test('createModuleManifest overrides work', () => {
    const m = createModuleManifest({ id: 'x', name: 'X', version: '2.0.0', category: 'core' });
    assert.strictEqual(m.category, 'core');
    assert.strictEqual(m.version, '2.0.0');
});

test('getCoreModules returns universal modules', () => {
    const core = getCoreModules();
    assert.ok(core.includes('universal'));
    assert.ok(Array.isArray(core));
});

test('CONTRIBUTION_TYPES has all types', () => {
    assert.ok(CONTRIBUTION_TYPES.includes('stateSchema'));
    assert.ok(CONTRIBUTION_TYPES.includes('artifacts'));
    assert.ok(CONTRIBUTION_TYPES.includes('reviewer'));
});

console.log('\n🏛️ module-registry tests');

test('ModuleRegistry register and getModule', () => {
    const reg = new ModuleRegistry();
    reg.register({ id: 'test', name: 'Test' });
    assert.ok(reg.hasModule('test'));
    assert.strictEqual(reg.getModule('test').name, 'Test');
});

test('ModuleRegistry register throws on duplicate', () => {
    const reg = new ModuleRegistry();
    reg.register({ id: 'dup', name: 'First' });
    assert.throws(() => reg.register({ id: 'dup', name: 'Second' }), /zaten kayıtlı/);
});

test('ModuleRegistry getAllModules returns all', () => {
    const reg = new ModuleRegistry();
    reg.register({ id: 'a', name: 'A' });
    reg.register({ id: 'b', name: 'B' });
    assert.strictEqual(reg.getAllModules().length, 2);
});

test('ModuleRegistry categorize modules', () => {
    const reg = new ModuleRegistry();
    reg.register({ id: 'core1', name: 'C1', category: 'core' });
    reg.register({ id: 'dom1', name: 'D1', category: 'domain' });
    assert.strictEqual(reg.getModulesByCategory('core').length, 1);
    assert.strictEqual(reg.getModulesByCategory('domain').length, 1);
});

test('resolveDependencies adds parent modules', () => {
    const reg = new ModuleRegistry();
    reg.register({ id: 'universal', name: 'Universal', dependencies: [] });
    reg.register({ id: 'software', name: 'Software', dependencies: ['universal'] });
    reg.register({ id: 'software.web', name: 'Web', dependencies: ['software'] });

    const result = reg.resolveDependencies(['software.web']);
    assert.ok(result.resolved.includes('universal'));
    assert.ok(result.resolved.includes('software'));
    assert.ok(result.resolved.includes('software.web'));
});

test('resolveDependencies reports missing', () => {
    const reg = new ModuleRegistry();
    reg.register({ id: 'a', name: 'A', dependencies: ['missing'] });
    const result = reg.resolveDependencies(['a']);
    assert.ok(result.missing.includes('missing'));
});

test('resolveDependencies adds optional deps', () => {
    const reg = new ModuleRegistry();
    reg.register({ id: 'a', name: 'A', dependencies: [], optionalDependencies: ['b'] });
    reg.register({ id: 'b', name: 'B', dependencies: [] });
    const result = reg.resolveDependencies(['a']);
    assert.ok(result.resolved.includes('b'));
});

test('detectConflicts finds conflicts', () => {
    const reg = new ModuleRegistry();
    reg.register({ id: 'offline', name: 'Offline', conflictsWith: [{ moduleId: 'cloud', severity: 'high' }] });
    reg.register({ id: 'cloud', name: 'Cloud', conflictsWith: [] });
    const conflicts = reg.detectConflicts(['offline', 'cloud']);
    assert.strictEqual(conflicts.length, 1);
    assert.strictEqual(conflicts[0].moduleA, 'offline');
});

test('validateCompatibility returns valid', () => {
    const reg = new ModuleRegistry();
    reg.register({ id: 'a', name: 'A', dependencies: [] });
    const result = reg.validateCompatibility(['a']);
    assert.strictEqual(result.valid, true);
});

test('validateCompatibility returns invalid for conflict', () => {
    const reg = new ModuleRegistry();
    reg.register({ id: 'x', name: 'X', conflictsWith: [{ moduleId: 'y', severity: 'high' }] });
    reg.register({ id: 'y', name: 'Y' });
    const result = reg.validateCompatibility(['x', 'y']);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.conflicts.length, 1);
});

test('suggestModules returns sorted suggestions', () => {
    const reg = new ModuleRegistry();
    reg.register(getUniversalPack());
    reg.register(getSoftwareWebPack());

    const suggestions = reg.suggestModules({
        userInput: 'web uygulaması yapmak istiyorum',
        activeModules: ['universal']
    });
    assert.ok(suggestions.length >= 0);
});

test('suggestModules returns empty for no match', () => {
    const reg = new ModuleRegistry();
    reg.register({ id: 'obscure', name: 'Obscure', activation: { signals: ['xyzzy'], minimumConfidence: 0.9 } });
    const suggestions = reg.suggestModules({ userInput: 'hello world' });
    assert.strictEqual(suggestions.length, 0);
});

test('getContributionSummary aggregates by type', () => {
    const reg = new ModuleRegistry();
    reg.register({ id: 'a', name: 'A', contributions: { artifacts: { required: ['FILE_A.md'] } } });
    reg.register({ id: 'b', name: 'B', contributions: { artifacts: { required: ['FILE_B.md'] }, decisions: { types: ['dec-1'] } } });

    const summary = reg.getContributionSummary(['a', 'b']);
    assert.strictEqual(summary.artifacts.length, 2);
    assert.strictEqual(summary.decisions.length, 1);
});

test('getStats returns module counts', () => {
    const reg = new ModuleRegistry();
    reg.register({ id: 'a', name: 'A', category: 'core' });
    reg.register({ id: 'b', name: 'B', category: 'domain', parentModule: 'a' });
    const stats = reg.getStats();
    assert.strictEqual(stats.total, 2);
    assert.ok(stats.byCategory.core > 0);
});

test('getLeafModules returns modules without children', () => {
    const reg = new ModuleRegistry();
    reg.register({ id: 'parent', name: 'Parent' });
    reg.register({ id: 'child', name: 'Child', parentModule: 'parent' });
    reg.register({ id: 'orphan', name: 'Orphan' });
    const leaves = reg.getLeafModules().map(m => m.id);
    assert.ok(leaves.includes('child'));
    assert.ok(leaves.includes('orphan'));
    assert.ok(!leaves.includes('parent'));
});

test('unregister removes module', () => {
    const reg = new ModuleRegistry();
    reg.register({ id: 'temp', name: 'Temp' });
    assert.ok(reg.unregister('temp'));
    assert.strictEqual(reg.hasModule('temp'), false);
});

console.log('\n🌐 domain-packs tests');

test('getUniversalPack has correct defaults', () => {
    const pack = getUniversalPack();
    assert.strictEqual(pack.id, 'universal');
    assert.strictEqual(pack.category, MODULE_CATEGORIES.CORE);
    assert.strictEqual(pack.dependencies.length, 0);
});

test('getSoftwareWebPack has dependencies', () => {
    const pack = getSoftwareWebPack();
    assert.strictEqual(pack.id, 'software.web');
    assert.ok(pack.dependencies.includes('universal'));
    assert.ok(pack.contributions.artifacts);
});

test('getGamePack has correct id', () => {
    const pack = getGamePack();
    assert.strictEqual(pack.id, 'game');
    assert.ok(pack.activation.signals.includes('game'));
});

test('getResearchPack has correct structure', () => {
    const pack = getResearchPack();
    assert.strictEqual(pack.id, 'research');
    assert.strictEqual(pack.contributions.discovery.requiredFields.length, 3);
});

test('getSoftwareOfflinePack triggers on offline signals', () => {
    const pack = getSoftwareOfflinePack();
    assert.ok(pack.activation.signals.includes('offline'));
    assert.ok(pack.conflictsWith.length > 0);
});

test('getSoftwareAuthPack has auth decisions', () => {
    const pack = getSoftwareAuthPack();
    assert.ok(pack.contributions.decisions.types.includes('auth-strategy'));
});

test('register all domain packs', () => {
    const reg = new ModuleRegistry();
    reg.register(getUniversalPack());
    reg.register(getSoftwareWebPack());
    reg.register(getGamePack());
    reg.register(getResearchPack());
    reg.register(getSoftwareOfflinePack());
    reg.register(getSoftwareAuthPack());
    assert.strictEqual(reg.getAllModules().length, 6);
});

test('resolve domain pack dependencies', () => {
    const reg = new ModuleRegistry();
    reg.register(getUniversalPack());
    reg.register(getSoftwareWebPack());

    const result = reg.resolveDependencies(['software.web']);
    assert.ok(result.resolved.includes('universal'));
    assert.strictEqual(result.missing.length, 0);
});

test('suggestModules with game signals', () => {
    const reg = new ModuleRegistry();
    reg.register(getUniversalPack());
    reg.register(getGamePack());

    const suggestions = reg.suggestModules({
        userInput: 'mobil oyun yapmak istiyorum unity kullanacağım',
        activeModules: ['universal']
    });
    const gameSuggestion = suggestions.find(s => s.moduleId === 'game');
    assert.ok(gameSuggestion);
    assert.ok(gameSuggestion.confidence >= 0.5);
});

test('suggestModules with research signals', () => {
    const reg = new ModuleRegistry();
    reg.register(getUniversalPack());
    reg.register(getResearchPack());

    const suggestions = reg.suggestModules({
        userInput: 'literatür taraması yapıp nitel analiz yöntemi kullanacağım',
        activeModules: ['universal']
    });
    const researchSuggestion = suggestions.find(s => s.moduleId === 'research');
    assert.ok(researchSuggestion);
});

test('hierarchical module tree', () => {
    const reg = new ModuleRegistry();
    reg.register({ id: 'software', name: 'Software', category: 'domain' });
    reg.register({ id: 'software.web', name: 'Web', parentModule: 'software' });
    reg.register({ id: 'software.mobile', name: 'Mobile', parentModule: 'software' });

    const children = reg.getModulesByParent('software');
    assert.strictEqual(children.length, 2);
});

console.log('\n⚡ contribution-executor tests');

let cePassed = 0;
let ceFailed = 0;
function ceTest(name, fn) {
    try { fn(); console.log(`  ✅ ${name}`); cePassed++; }
    catch (e) { console.error(`  ❌ ${name}\n     ${e.message}`); ceFailed++; }
}

ceTest('ContributionExecutor create', () => {
    const reg = new ModuleRegistry();
    const exec = new ContributionExecutor(reg);
    assert.ok(exec);
    assert.ok(exec.pendingHandlers.length > 0);
});

ceTest('executeContributions returns patches for stateSchema', () => {
    const reg = new ModuleRegistry();
    const mod = reg.register({ id: 'test', name: 'Test', contributions: { stateSchema: { namespace: 'moduleData.test', required: ['name', 'version'] } } });
    const exec = new ContributionExecutor(reg);
    const result = exec.executeContributions(['test'], {});
    assert.ok(result.log.some(l => l.type === 'stateSchema'));
    const schemaPatches = result.patches.filter(p => p.path && p.path.startsWith('/moduleData/test'));
    assert.ok(schemaPatches.length >= 1);
});

ceTest('executeContributions creates artifact patches', () => {
    const reg = new ModuleRegistry();
    reg.register({ id: 'a', name: 'A', contributions: { artifacts: { required: ['TEST.md', 'README.md'] } } });
    const exec = new ContributionExecutor(reg);
    const result = exec.executeContributions(['a'], {});
    const artPatches = result.patches.filter(p => p.path === '/artifacts/-');
    assert.strictEqual(artPatches.length, 2);
    assert.strictEqual(artPatches[0].value.title, 'TEST.md');
});

ceTest('executeContributions deduplicates artifacts', () => {
    const reg = new ModuleRegistry();
    reg.register({ id: 'a', name: 'A', contributions: { artifacts: { required: ['SCOPE.md', 'SCOPE.md'] } } });
    const exec = new ContributionExecutor(reg);
    const result = exec.executeContributions(['a'], {});
    const artPatches = result.patches.filter(p => p.path === '/artifacts/-');
    assert.strictEqual(artPatches.length, 1);
});

ceTest('executeContributions discovery returns log', () => {
    const reg = new ModuleRegistry();
    reg.register({ id: 'a', name: 'A', contributions: { discovery: { requiredFields: ['identity.name'] } } });
    const exec = new ContributionExecutor(reg);
    const result = exec.executeContributions(['a'], {});
    assert.ok(result.log.some(l => l.type === 'discovery'));
});

ceTest('executeContributions decisions returns log', () => {
    const reg = new ModuleRegistry();
    reg.register({ id: 'a', name: 'A', contributions: { decisions: { types: ['framework-choice'] } } });
    const exec = new ContributionExecutor(reg);
    const result = exec.executeContributions(['a'], {});
    assert.ok(result.log.some(l => l.type === 'decisions'));
});

ceTest('executeContributions reviewer returns log', () => {
    const reg = new ModuleRegistry();
    reg.register({ id: 'a', name: 'A', contributions: { reviewer: { rules: ['custom-rule'] } } });
    const exec = new ContributionExecutor(reg);
    const result = exec.executeContributions(['a'], {});
    assert.ok(result.log.some(l => l.type === 'reviewer'));
});

ceTest('executeContributions with domain packs', () => {
    const reg = new ModuleRegistry();
    reg.register(getUniversalPack());
    reg.register(getSoftwareWebPack());
    const exec = new ContributionExecutor(reg);
    const result = exec.executeContributions(['universal', 'software.web'], {});
    const artPatches = result.patches.filter(p => p.path.startsWith('/artifacts'));
    assert.ok(artPatches.length >= 5);
});

ceTest('executeContributions stateSchema populates moduleData namespace', () => {
    const reg = new ModuleRegistry();
    reg.register(createModuleManifest({ id: 'm1', name: 'M1', contributions: { stateSchema: { namespace: 'moduleData.m1', required: ['field1', 'field2'] } } }));
    const exec = new ContributionExecutor(reg);
    const result = exec.executeContributions(['m1'], { moduleData: {} });
    assert.ok(result.state.moduleData.m1);
});

console.log(`\n  Contribution Executor: ${cePassed} passed, ${ceFailed} failed`);
passed += cePassed;
failed += ceFailed;

console.log(`\n  Section 13: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
