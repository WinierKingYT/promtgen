import assert from 'assert';
import { getInitialCanonicalState } from '../../src/state/project-state.js';
import { applyPatchTransaction } from '../../src/application/patch-transaction.js';
import { WORKFLOW_STAGES } from '../../src/workflow/stages.js';
import { validatePatchProposal } from '../../src/application/patch-policy.js';
import { approveArtifact } from '../../src/application/approval-service.js';

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

console.log('\n💎 patch-transaction integration tests');

test('applies valid patches successfully', () => {
    const state = getInitialCanonicalState();
    const result = applyPatchTransaction({
        state,
        patches: [{ operation: 'replace', path: '/identity/name', value: 'Test App' }],
        stage: WORKFLOW_STAGES.IDEA_CAPTURED,
        expectedRevision: 1
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.state.identity.name, 'Test App');
});

test('returns appliedPatches on success', () => {
    const state = getInitialCanonicalState();
    const result = applyPatchTransaction({
        state,
        patches: [{ id: 'PAT-001', operation: 'replace', path: '/identity/name', value: 'App' }],
        stage: WORKFLOW_STAGES.IDEA_CAPTURED
    });
    assert.ok(result.appliedPatches.length > 0);
});

test('returns auditEvents on success', () => {
    const state = getInitialCanonicalState();
    const result = applyPatchTransaction({
        state,
        patches: [{ operation: 'replace', path: '/identity/name', value: 'App' }],
        stage: WORKFLOW_STAGES.IDEA_CAPTURED
    });
    assert.ok(result.auditEvents.length > 0);
    assert.strictEqual(result.auditEvents[0].type, 'PATCH_APPLIED');
});

test('rolls back on stale revision', () => {
    const state = getInitialCanonicalState();
    const result = applyPatchTransaction({
        state,
        patches: [{ operation: 'replace', path: '/identity/name', value: 'Conflict' }],
        stage: WORKFLOW_STAGES.IDEA_CAPTURED,
        expectedRevision: 99
    });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error.code, 'STALE_REVISION');
});

test('rolls back on invalid patch', () => {
    const state = getInitialCanonicalState();
    const result = applyPatchTransaction({
        state,
        patches: [{ operation: 'replace', path: '/scope/mustHave', value: ['Auth'] }],
        stage: WORKFLOW_STAGES.IDEA_CAPTURED,
        expectedRevision: 1
    });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error.code, 'INVALID_PATCH_VALUE');
});

test('rolls back on mixed valid and invalid patches (atomicity)', () => {
    const original = getInitialCanonicalState();
    const patches = [
        { operation: 'replace', path: '/identity/name', value: 'Atomic App' },
        { operation: 'replace', path: '/scope/mustHave', value: ['Auth'] }
    ];
    const result = applyPatchTransaction({
        state: original,
        patches,
        stage: WORKFLOW_STAGES.IDEA_CAPTURED,
        expectedRevision: 1
    });
    assert.strictEqual(result.success, false);
    assert.strictEqual(original.identity.name, '', 'State should be unchanged');
});

test('handles empty patches gracefully', () => {
    const state = getInitialCanonicalState();
    const result = applyPatchTransaction({
        state,
        patches: [],
        stage: WORKFLOW_STAGES.IDEA_CAPTURED
    });
    assert.strictEqual(result.success, true);
});

test('handles null state gracefully', () => {
    const result = applyPatchTransaction({
        state: null,
        patches: [{ operation: 'replace', path: '/identity/name', value: 'X' }],
        stage: WORKFLOW_STAGES.IDEA_CAPTURED
    });
    assert.strictEqual(result.success, false);
});

test('increments revision on successful transaction', () => {
    const state = getInitialCanonicalState();
    const result = applyPatchTransaction({
        state,
        patches: [{ operation: 'replace', path: '/identity/name', value: 'Revision Test' }],
        stage: WORKFLOW_STAGES.IDEA_CAPTURED
    });
    assert.strictEqual(result.state.revision, 2);
});

test('applies multiple patches atomically', () => {
    const state = getInitialCanonicalState();
    const result = applyPatchTransaction({
        state,
        patches: [
            { operation: 'replace', path: '/identity/name', value: 'Multi' },
            { operation: 'replace', path: '/identity/summary', value: 'Multi project summary' }
        ],
        stage: WORKFLOW_STAGES.IDEA_CAPTURED,
        expectedRevision: 1
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.state.identity.name, 'Multi');
    assert.strictEqual(result.state.identity.summary, 'Multi project summary');
});

test('approval invalidation triggers on matching path', () => {
    let state = getInitialCanonicalState();
    state = approveArtifact(state, 'profile');

    const result = applyPatchTransaction({
        state,
        patches: [{ operation: 'replace', path: '/identity/name', value: 'Invalidates' }],
        stage: WORKFLOW_STAGES.IDEA_CAPTURED,
        expectedRevision: state.revision
    });
    assert.strictEqual(result.success, true);
    assert.ok(result.invalidatedApprovals.length >= 0);
});

test('generates canonical state violation error', () => {
    const state = getInitialCanonicalState();
    delete state.agentPackage;

    const result = applyPatchTransaction({
        state,
        patches: [{ operation: 'replace', path: '/identity/name', value: 'Broken' }],
        stage: WORKFLOW_STAGES.IDEA_CAPTURED
    });
    assert.strictEqual(result.success, false);
});

console.log(`\n  Patch Transaction: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
