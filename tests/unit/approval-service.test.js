import assert from 'assert';
import { getInitialCanonicalState } from '../../src/state/project-state.js';
import { 
    approveArtifact, rejectArtifact, invalidateApproval, 
    isApprovalValid, getApprovalStatus, isApprovalCurrent,
    getArtifactHash, computeHash,
    invalidateApprovalsForPath, getDownstreamInvalidations
} from '../../src/application/approval-service.js';
import { applyStatePatch } from '../../src/state/project-state.js';

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

console.log('\n✅ approval-service tests');

test('approveArtifact sets approval with hash', () => {
    let state = getInitialCanonicalState();
    state = approveArtifact(state, 'profile');
    assert.strictEqual(state.approvals.profile.status, 'approved');
    assert.ok(state.approvals.profile.artifactHash);
    assert.ok(state.approvals.profile.approvedAt);
});

test('isApprovalValid returns true for valid approval', () => {
    let state = getInitialCanonicalState();
    state = approveArtifact(state, 'profile');
    assert.strictEqual(isApprovalValid(state, 'profile'), true);
});

test('isApprovalValid returns false when state changes after approval', () => {
    let state = getInitialCanonicalState();
    state = approveArtifact(state, 'profile');
    state = applyStatePatch(state, { operation: 'add', path: '/profile/capabilities/-', value: 'new-cap' }, true);
    assert.strictEqual(isApprovalValid(state, 'profile'), false);
});

test('isApprovalValid returns false for non-existent approval', () => {
    const state = getInitialCanonicalState();
    assert.strictEqual(isApprovalValid(state, 'profile'), false);
});

test('rejectArtifact sets status to rejected', () => {
    let state = getInitialCanonicalState();
    state = approveArtifact(state, 'profile');
    state = rejectArtifact(state, 'profile', 'Not needed');
    assert.strictEqual(state.approvals.profile.status, 'rejected');
});

test('invalidateApproval sets approval to null', () => {
    let state = getInitialCanonicalState();
    state = approveArtifact(state, 'profile');
    state = invalidateApproval(state, 'profile');
    assert.strictEqual(state.approvals.profile, null);
});

test('getApprovalStatus returns none for missing approval', () => {
    const state = getInitialCanonicalState();
    const status = getApprovalStatus(state, 'profile');
    assert.strictEqual(status.status, 'none');
});

test('getApprovalStatus returns approved status', () => {
    let state = getInitialCanonicalState();
    state = approveArtifact(state, 'mvpScope');
    const status = getApprovalStatus(state, 'mvpScope');
    assert.strictEqual(status.status, 'approved');
});

test('isApprovalCurrent returns true for matching hash', () => {
    let state = getInitialCanonicalState();
    state = approveArtifact(state, 'profile');
    assert.strictEqual(isApprovalCurrent(state, 'profile'), true);
});

test('isApprovalCurrent returns false after modification', () => {
    let state = getInitialCanonicalState();
    state = approveArtifact(state, 'profile');
    state = applyStatePatch(state, { operation: 'replace', path: '/profile/domains', value: [{ name: 'new', confidence: 0.8 }] }, true);
    assert.strictEqual(isApprovalCurrent(state, 'profile'), false);
});

test('invalidateApprovalsForPath invalidates downstream dependencies', () => {
    let state = getInitialCanonicalState();
    state = approveArtifact(state, 'profile');
    state = approveArtifact(state, 'architecture');

    state = invalidateApprovalsForPath(state, '/profile/domains');
    assert.strictEqual(state.approvals.profile, null);
    assert.strictEqual(state.approvals.architecture, null);
});

test('getDownstreamInvalidations returns downstream keys', () => {
    let state = getInitialCanonicalState();
    state = approveArtifact(state, 'scope');
    state = approveArtifact(state, 'architecture');

    const invalidated = getDownstreamInvalidations(state, '/scope/mustHave');
    assert.ok(invalidated.includes('architecture'));
});

test('computeHash produces deterministic output', () => {
    const h1 = computeHash({ a: 1, b: 2 });
    const h2 = computeHash({ a: 1, b: 2 });
    assert.strictEqual(h1, h2);
});

test('computeHash changes on different input', () => {
    const h1 = computeHash({ a: 1 });
    const h2 = computeHash({ a: 2 });
    assert.notStrictEqual(h1, h2);
});

test('getArtifactHash returns consistent hashes for same state', () => {
    const state = getInitialCanonicalState();
    const h1 = getArtifactHash(state, '/profile');
    const h2 = getArtifactHash(state, '/profile');
    assert.strictEqual(h1, h2);
});

test('approveArtifact with notes stores them', () => {
    let state = getInitialCanonicalState();
    state = approveArtifact(state, 'tasks', 'All tasks approved by PM');
    assert.strictEqual(state.approvals.tasks.notes, 'All tasks approved by PM');
});

test('approveArtifact for unknown key returns state unchanged', () => {
    let state = getInitialCanonicalState();
    const before = JSON.stringify(state);
    state = approveArtifact(state, 'nonexistent');
    assert.strictEqual(JSON.stringify(state), before);
});

console.log(`\n  Approval Service: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
