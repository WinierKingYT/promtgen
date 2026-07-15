import assert from 'assert';
import { STAGE_CONTRACTS, STAGE_APPROVAL_KEYS, PATCH_VALUE_SCHEMAS, ARTIFACT_DEPENDENCIES, REQUIRED_ROOT_PATHS, validateValueBySchema, isPatchPathAllowed } from '../../src/workflow/stage-contracts.js';
import { WORKFLOW_STAGES } from '../../src/workflow/stages.js';
import { getInitialCanonicalState } from '../../src/state/project-state.js';

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

console.log('\n📋 stage-contracts tests');

test('STAGE_CONTRACTS contains all workflow stages', () => {
    const stages = Object.values(WORKFLOW_STAGES);
    for (const stage of stages) {
        assert.ok(STAGE_CONTRACTS[stage], `Missing contract for ${stage}`);
    }
});

test('Each contract has role, instructions, completionCheck, nextStage', () => {
    for (const [stage, contract] of Object.entries(STAGE_CONTRACTS)) {
        assert.ok(typeof contract.role === 'string', `${stage}: missing role`);
        assert.ok(typeof contract.instructions === 'string', `${stage}: missing instructions`);
        assert.ok(typeof contract.completionCheck === 'function', `${stage}: missing completionCheck`);
        if (contract.nextStage !== null) {
            assert.ok(typeof contract.nextStage === 'string', `${stage}: invalid nextStage`);
        }
    }
});

test('EXPORTED stage has nextStage = null', () => {
    assert.strictEqual(STAGE_CONTRACTS[WORKFLOW_STAGES.EXPORTED].nextStage, null);
});

test('STAGE_APPROVAL_KEYS is auto-derived from STAGE_CONTRACTS', () => {
    assert.ok(STAGE_APPROVAL_KEYS['PROFILE_DRAFTED'] === 'profile');
    assert.ok(STAGE_APPROVAL_KEYS['MVP_DEFINED'] === 'mvpScope');
    assert.ok(STAGE_APPROVAL_KEYS['READY_FOR_EXPORT'] === 'finalReview');
    assert.ok(STAGE_APPROVAL_KEYS['EXPORTED'] === undefined);
});

test('PATCH_VALUE_SCHEMAS contains detailed schemas', () => {
    assert.ok(PATCH_VALUE_SCHEMAS['/identity/name']);
    assert.ok(PATCH_VALUE_SCHEMAS['/scope/mustHave']);
    assert.ok(PATCH_VALUE_SCHEMAS['/architecture/components']);
    assert.ok(PATCH_VALUE_SCHEMAS['/tasks']);
});

test('validateValueBySchema validates string minLength', () => {
    const result = validateValueBySchema('/identity/name', 'A');
    assert.strictEqual(result.valid, false);
});

test('validateValueBySchema validates string maxLength', () => {
    const longStr = 'A'.repeat(121);
    const result = validateValueBySchema('/identity/name', longStr);
    assert.strictEqual(result.valid, false);
});

test('validateValueBySchema accepts valid string', () => {
    const result = validateValueBySchema('/identity/name', 'My Project');
    assert.strictEqual(result.valid, true);
});

test('validateValueBySchema validates scope.mustHave minItems', () => {
    const result = validateValueBySchema('/scope/mustHave', []);
    assert.strictEqual(result.valid, false);
});

test('validateValueBySchema validates scope.outOfScope minItems', () => {
    const result = validateValueBySchema('/scope/outOfScope', []);
    assert.strictEqual(result.valid, false);
});

test('validateValueBySchema validates architecture.components minItems', () => {
    const result = validateValueBySchema('/architecture/components', []);
    assert.strictEqual(result.valid, false);
});

test('validateValueBySchema validates tasks minItems', () => {
    const result = validateValueBySchema('/tasks', []);
    assert.strictEqual(result.valid, false);
});

test('validateValueBySchema validates task[] structure', () => {
    const result = validateValueBySchema('/tasks', [{ id: 'T-001', title: 'Task 1' }]);
    assert.strictEqual(result.valid, true);
});

test('validateValueBySchema rejects task without id', () => {
    const result = validateValueBySchema('/tasks', [{ title: 'No ID' }]);
    assert.strictEqual(result.valid, false);
});

test('validateValueBySchema validates string[] itemMaxLength', () => {
    const longItem = 'A'.repeat(301);
    const result = validateValueBySchema('/scope/mustHave', [longItem]);
    assert.strictEqual(result.valid, false);
});

test('ARTIFACT_DEPENDENCIES maps all approval keys', () => {
    assert.ok(ARTIFACT_DEPENDENCIES.profile);
    assert.ok(ARTIFACT_DEPENDENCIES.mvpScope);
    assert.ok(ARTIFACT_DEPENDENCIES.requirements);
    assert.ok(ARTIFACT_DEPENDENCIES.technology);
    assert.ok(ARTIFACT_DEPENDENCIES.architecture);
    assert.ok(ARTIFACT_DEPENDENCIES.tasks);
});

test('ARTIFACT_DEPENDENCIES profile change cascades to all downstream', () => {
    const deps = ARTIFACT_DEPENDENCIES.profile;
    assert.ok(deps.includes('mvpScope'));
    assert.ok(deps.includes('architecture'));
    assert.ok(deps.includes('tasks'));
    assert.ok(deps.includes('finalReview'));
});

test('ARTIFACT_DEPENDENCIES tasks only cascades to finalReview', () => {
    const deps = ARTIFACT_DEPENDENCIES.tasks;
    assert.strictEqual(deps.length, 1);
    assert.ok(deps.includes('finalReview'));
});

test('REQUIRED_ROOT_PATHS contains all critical paths', () => {
    assert.ok(REQUIRED_ROOT_PATHS.includes('/identity'));
    assert.ok(REQUIRED_ROOT_PATHS.includes('/profile'));
    assert.ok(REQUIRED_ROOT_PATHS.includes('/scope'));
    assert.ok(REQUIRED_ROOT_PATHS.includes('/architecture'));
    assert.ok(REQUIRED_ROOT_PATHS.includes('/agentPackage'));
    assert.ok(REQUIRED_ROOT_PATHS.includes('/approvals'));
});

test('isPatchPathAllowed returns true for valid stage paths', () => {
    assert.ok(isPatchPathAllowed(WORKFLOW_STAGES.IDEA_CAPTURED, '/identity/name'));
    assert.ok(isPatchPathAllowed(WORKFLOW_STAGES.DISCOVERY_IN_PROGRESS, '/scope/mustHave'));
});

test('isPatchPathAllowed returns false for invalid stage paths', () => {
    assert.ok(!isPatchPathAllowed(WORKFLOW_STAGES.IDEA_CAPTURED, '/scope/mustHave'));
    assert.ok(!isPatchPathAllowed(WORKFLOW_STAGES.EXPORTED, '/identity/name'));
});

test('validateValueBySchema handles unknown path gracefully', () => {
    const result = validateValueBySchema('/nonexistent/path', 'any');
    assert.strictEqual(result.valid, true);
});

test('validateValueBySchema rejects wrong type for string[]', () => {
    const result = validateValueBySchema('/scope/mustHave', 'not-an-array');
    assert.strictEqual(result.valid, false);
});

console.log(`\n  Stage Contracts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
