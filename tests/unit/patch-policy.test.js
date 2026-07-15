import assert from 'assert';
import { validatePatchProposal, GLOBAL_FORBIDDEN_PATHS } from '../../src/application/patch-policy.js';
import { WORKFLOW_STAGES } from '../../src/workflow/stages.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (e) {
        console.error(`  ❌ ${name}`);
        console.error(`     ${e.message}`);
        failed++;
    }
}

console.log('\n🔒 patch-policy tests');

test('allows valid patch in IDEA_CAPTURED', () => {
    assert.strictEqual(validatePatchProposal(WORKFLOW_STAGES.IDEA_CAPTURED, {
        operation: 'replace', path: '/identity/name', value: 'Project'
    }).valid, true);
});

test('blocks unauthorized path for stage', () => {
    assert.strictEqual(validatePatchProposal(WORKFLOW_STAGES.IDEA_CAPTURED, {
        operation: 'replace', path: '/scope/mustHave', value: ['Auth']
    }).valid, false);
});

test('blocks globally forbidden paths', () => {
    assert.strictEqual(validatePatchProposal(WORKFLOW_STAGES.IDEA_CAPTURED, {
        operation: 'replace', path: '/workflowStage', value: 'READY'
    }).valid, false);
});

test('blocks prototype pollution path', () => {
    assert.strictEqual(validatePatchProposal(WORKFLOW_STAGES.IDEA_CAPTURED, {
        operation: 'replace', path: '/__proto__/polluted', value: 'HACKED'
    }).valid, false);
});

test('blocks constructor path', () => {
    assert.strictEqual(validatePatchProposal(WORKFLOW_STAGES.IDEA_CAPTURED, {
        operation: 'replace', path: '/constructor/prototype', value: 'HACKED'
    }).valid, false);
});

test('blocks required root remove', () => {
    assert.strictEqual(validatePatchProposal(WORKFLOW_STAGES.IDEA_CAPTURED, {
        operation: 'remove', path: '/identity'
    }).valid, false);
});

test('blocks remove on /scope', () => {
    assert.strictEqual(validatePatchProposal(WORKFLOW_STAGES.DISCOVERY_IN_PROGRESS, {
        operation: 'remove', path: '/scope'
    }).valid, false);
});

test('blocks remove on /approvals', () => {
    assert.strictEqual(validatePatchProposal(WORKFLOW_STAGES.MVP_DEFINED, {
        operation: 'remove', path: '/approvals'
    }).valid, false);
});

test('validates value types - rejects number for string field', () => {
    assert.strictEqual(validatePatchProposal(WORKFLOW_STAGES.IDEA_CAPTURED, {
        operation: 'replace', path: '/identity/name', value: 123
    }).valid, false);
});

test('validates value types - rejects string for array field', () => {
    assert.strictEqual(validatePatchProposal(WORKFLOW_STAGES.DISCOVERY_IN_PROGRESS, {
        operation: 'replace', path: '/scope/mustHave', value: 'should-be-array'
    }).valid, false);
});

test('validates PATCH_VALUE_SCHEMAS - rejects too short name', () => {
    assert.strictEqual(validatePatchProposal(WORKFLOW_STAGES.IDEA_CAPTURED, {
        operation: 'replace', path: '/identity/name', value: 'A'
    }).valid, false);
});

test('validates PATCH_VALUE_SCHEMAS - accepts valid name', () => {
    assert.strictEqual(validatePatchProposal(WORKFLOW_STAGES.IDEA_CAPTURED, {
        operation: 'replace', path: '/identity/name', value: 'My App'
    }).valid, true);
});

test('GLOBAL_FORBIDDEN_PATHS includes new paths', () => {
    assert.ok(GLOBAL_FORBIDDEN_PATHS.some(p => p.includes('pendingChangeSet')));
});

test('rejects invalid operation type', () => {
    assert.strictEqual(validatePatchProposal(WORKFLOW_STAGES.IDEA_CAPTURED, {
        operation: 'invalid', path: '/identity/name', value: 'X'
    }).valid, false);
});

test('rejects null patch object', () => {
    assert.strictEqual(validatePatchProposal(WORKFLOW_STAGES.IDEA_CAPTURED, null).valid, false);
});

test('rejects missing path', () => {
    assert.strictEqual(validatePatchProposal(WORKFLOW_STAGES.IDEA_CAPTURED, {
        operation: 'replace', value: 'X'
    }).valid, false);
});

console.log(`\n  Patch Policy: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
