import assert from 'assert';
import { getInitialV3State } from '../../src/state/project-state-v3.js';
import {
    getArtifactTypes, registerTemplate, getTemplate, listTemplates,
    generateArtifact, createArtifactVersion, buildArtifactContextFromState,
    resolveAllArtifactTemplates, resetArtifactCounter
} from '../../src/artifact/artifact-engine.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  ✅ ${name}`); passed++; }
    catch (e) { console.error(`  ❌ ${name}\n     ${e.message}`); failed++; }
}

console.log('\n📄 artifact-engine tests');

test('getArtifactTypes returns list of types', () => {
    const types = getArtifactTypes();
    assert.ok(Array.isArray(types));
    assert.ok(types.includes('architecture'));
    assert.ok(types.includes('decision'));
});

test('registerTemplate adds to registry', () => {
    const r = registerTemplate('custom', {
        label: 'Custom', variables: ['x'], template: '{{x}}'
    });
    assert.strictEqual(r.success, true);
    const t = getTemplate('custom');
    assert.strictEqual(t.label, 'Custom');
});

test('getTemplate returns null for unknown type', () => {
    assert.strictEqual(getTemplate('nonexistent'), null);
});

test('listTemplates returns array of template metadata', () => {
    const list = listTemplates();
    assert.ok(list.length >= 14);
    assert.ok(list.some(t => t.type === 'architecture'));
    assert.ok(list.every(t => t.type && t.label));
});

test('generateArtifact returns artifact with content', () => {
    resetArtifactCounter();
    const r = generateArtifact('architecture', {
        projectName: 'TestApp',
        components: [{ name: 'Auth', description: 'Auth module' }],
        relationships: [{ from: 'Auth', to: 'DB', label: 'reads' }],
        domains: ['identity']
    });
    assert.strictEqual(r.success, true);
    assert.ok(r.artifact.id);
    assert.ok(r.artifact.id.startsWith('ART-'));
    assert.strictEqual(r.artifact.type, 'architecture');
    assert.ok(r.artifact.content.includes('TestApp'));
});

test('generateArtifact returns error for unknown type', () => {
    const r = generateArtifact('void', {});
    assert.strictEqual(r.success, false);
});

test('generateArtifact resolves all variable types', () => {
    const r = generateArtifact('decision', {
        projectName: 'X',
        decisionTitle: 'Stack',
        problemStatement: 'Which?',
        options: [{ label: 'React', description: 'UI lib' }],
        selectedOption: 'React'
    });
    assert.strictEqual(r.success, true);
    assert.ok(r.artifact.content.includes('X'));
    assert.ok(r.artifact.content.includes('Stack'));
});

test('createArtifactVersion increments version', () => {
    resetArtifactCounter();
    const r = generateArtifact('architecture', { projectName: 'P' });
    assert.strictEqual(r.success, true);
    const v2 = createArtifactVersion(r.artifact, 'Updated content', 2, 'Fixed layout');
    assert.strictEqual(v2.version, 2);
    assert.strictEqual(v2.content, 'Updated content');
    assert.strictEqual(v2.history.length, 1);
});

test('buildArtifactContextFromState extracts project name', () => {
    const state = getInitialV3State();
    state.identity = { name: 'MyProject' };
    const ctx = buildArtifactContextFromState(state);
    assert.strictEqual(ctx.projectName, 'MyProject');
});

test('buildArtifactContextFromState extracts decisions and risks', () => {
    const state = getInitialV3State();
    state.identity = { name: 'P' };
    state.decisions = [{ id: 'DEC-001', title: 'Pick', status: 'approved', selectedOptionId: 'opt-1' }];
    state.risks = [{ title: 'Risk1', probability: 'high', impact: 'high', mitigation: 'Monitor' }];
    const ctx = buildArtifactContextFromState(state);
    assert.strictEqual(ctx.decisions.length, 1);
    assert.strictEqual(ctx.risks.length, 1);
    assert.strictEqual(ctx.risks[0].description, 'Risk1');
});

test('resolveAllArtifactTemplates returns all types', () => {
    const all = resolveAllArtifactTemplates();
    assert.ok(Array.isArray(all));
    assert.ok(all.length >= 14);
});

console.log(`\n  Artifact Engine: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
