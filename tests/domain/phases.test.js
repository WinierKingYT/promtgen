import assert from 'assert';
import { UNIVERSAL_PHASES, UNIVERSAL_PHASE_METADATA, PHASE_NEXT, PHASE_APPROVAL_KEYS } from '../../src/workflow/phases.js';
import { PHASE_CONTRACTS, PHASE_SCHEMA_RULES, checkPhaseCompletion, isPhasePatchAllowed, getPhaseApprovalKey, getPhaseNext, PHASE_REQUIRED_ROOT_PATHS, PHASE_APPROVAL_KEYS as PHASE_CONTRACT_APPROVAL_KEYS } from '../../src/workflow/phase-contracts.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  ✅ ${name}`); passed++; }
    catch (e) { console.error(`  ❌ ${name}\n     ${e.message}`); failed++; }
}

console.log('\n🔷 phase contracts tests');

test('UNIVERSAL_PHASES has 10 phases', () => {
    assert.strictEqual(Object.keys(UNIVERSAL_PHASES).length, 10);
});

test('PHASE_NEXT forms a linear chain ending in null', () => {
    assert.strictEqual(PHASE_NEXT[UNIVERSAL_PHASES.IDEA_CAPTURED], UNIVERSAL_PHASES.PROJECT_PROFILED);
    assert.strictEqual(PHASE_NEXT[UNIVERSAL_PHASES.EXECUTION_PLAN_DRAFTED], UNIVERSAL_PHASES.REVIEW_IN_PROGRESS);
    assert.strictEqual(PHASE_NEXT[UNIVERSAL_PHASES.EXPORTED], null);
});

test('all phases have metadata with label and index', () => {
    for (const phase of Object.values(UNIVERSAL_PHASES)) {
        const meta = UNIVERSAL_PHASE_METADATA[phase];
        assert.ok(meta, `missing metadata for ${phase}`);
        assert.ok(typeof meta.label === 'string');
        assert.ok(typeof meta.index === 'number');
    }
});

test('PHASE_CONTRACTS has all 10 phases', () => {
    assert.strictEqual(Object.keys(PHASE_CONTRACTS).length, 10);
});

test('each contract has role and instructions', () => {
    for (const [phase, contract] of Object.entries(PHASE_CONTRACTS)) {
        assert.ok(typeof contract.role === 'string' && contract.role.length > 0, `${phase} role`);
        assert.ok(typeof contract.instructions === 'string' && contract.instructions.length > 0, `${phase} instructions`);
        assert.ok(typeof contract.completionCheck === 'function', `${phase} completionCheck`);
        assert.ok(Array.isArray(contract.allowedPatchPaths), `${phase} allowedPatchPaths`);
    }
});

test('IDEA_CAPTURED completionCheck requires summary >= 5 chars', () => {
    const result = checkPhaseCompletion({ identity: { summary: 'ab' } }, UNIVERSAL_PHASES.IDEA_CAPTURED);
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason);
});

test('IDEA_CAPTURED passes with valid summary', () => {
    const result = checkPhaseCompletion({ identity: { summary: 'A full project idea description' } }, UNIVERSAL_PHASES.IDEA_CAPTURED);
    assert.strictEqual(result.allowed, true);
});

test('PROJECT_PROFILED requires approval', () => {
    const state = {
        approvals: { profile: null },
        profile: { uncertainties: ['some uncertainty'] }
    };
    const result = checkPhaseCompletion(state, UNIVERSAL_PHASES.PROJECT_PROFILED);
    assert.strictEqual(result.allowed, false);
});

test('PROJECT_PROFILED requires uncertainties', () => {
    const state = {
        approvals: { profile: { status: 'approved', approvedAt: '2024-01-01', notes: '' } },
        profile: { uncertainties: [] }
    };
    const result = checkPhaseCompletion(state, UNIVERSAL_PHASES.PROJECT_PROFILED);
    assert.strictEqual(result.allowed, false);
});

test('PROJECT_PROFILED passes with approval and uncertainties', () => {
    const state = {
        approvals: { profile: { status: 'approved', approvedAt: '2024-01-01', notes: '' } },
        profile: { uncertainties: ['What tech stack?'] },
        objectives: [{ id: 'OBJ-1' }, { id: 'OBJ-2' }, { id: 'OBJ-3' }],
        openQuestions: [{ id: 'Q-1' }, { id: 'Q-2' }]
    };
    const result = checkPhaseCompletion(state, UNIVERSAL_PHASES.PROJECT_PROFILED);
    assert.strictEqual(result.allowed, true);
});

test('DISCOVERY_IN_PROGRESS requires objectives', () => {
    const result = checkPhaseCompletion({ objectives: [] }, UNIVERSAL_PHASES.DISCOVERY_IN_PROGRESS);
    assert.strictEqual(result.allowed, false);
});

test('DISCOVERY_IN_PROGRESS passes with objectives', () => {
    const state = {
        objectives: [{ id: 'OBJ-1', text: 'Build' }],
        stakeholders: [{ id: 'STK-1', name: 'User' }],
        entityStores: {
            requirement: [{ id: 'REQ-1' }, { id: 'REQ-2' }, { id: 'REQ-3' }]
        }
    };
    const result = checkPhaseCompletion(state, UNIVERSAL_PHASES.DISCOVERY_IN_PROGRESS);
    assert.strictEqual(result.allowed, true);
});

test('SCOPE_DEFINED requires mustHave', () => {
    const state = {
        approvals: { scope: { status: 'approved', approvedAt: '2024-01-01', notes: '' } },
        scope: { mustHave: [] }
    };
    const result = checkPhaseCompletion(state, UNIVERSAL_PHASES.SCOPE_DEFINED);
    assert.strictEqual(result.allowed, false);
});

test('SCOPE_DEFINED passes with approval and mustHave', () => {
    const state = {
        approvals: { scope: { status: 'approved', approvedAt: '2024-01-01', notes: '' } },
        scope: { mustHave: ['Login'] }
    };
    const result = checkPhaseCompletion(state, UNIVERSAL_PHASES.SCOPE_DEFINED);
    assert.strictEqual(result.allowed, true);
});

test('EXECUTION_PLAN_DRAFTED requires tasks', () => {
    const state = {
        approvals: { executionPlan: { status: 'approved', approvedAt: '2024-01-01', notes: '' } },
        tasks: []
    };
    const result = checkPhaseCompletion(state, UNIVERSAL_PHASES.EXECUTION_PLAN_DRAFTED);
    assert.strictEqual(result.allowed, false);
});

test('EXPORTED never allows transition', () => {
    const result = checkPhaseCompletion({}, UNIVERSAL_PHASES.EXPORTED);
    assert.strictEqual(result.allowed, false);
});

test('isPhasePatchAllowed allows identity paths in IDEA_CAPTURED', () => {
    assert.ok(isPhasePatchAllowed(UNIVERSAL_PHASES.IDEA_CAPTURED, '/identity/name'));
    assert.ok(isPhasePatchAllowed(UNIVERSAL_PHASES.IDEA_CAPTURED, '/profile/domains'));
});

test('isPhasePatchAllowed blocks scope paths in IDEA_CAPTURED', () => {
    assert.strictEqual(isPhasePatchAllowed(UNIVERSAL_PHASES.IDEA_CAPTURED, '/scope/mustHave'), false);
});

test('PHASE_SCHEMA_RULES has root path definitions', () => {
    assert.ok(PHASE_SCHEMA_RULES['/identity']);
    assert.ok(PHASE_SCHEMA_RULES['/profile']);
    assert.ok(PHASE_SCHEMA_RULES['/scope']);
    assert.ok(PHASE_SCHEMA_RULES['/deliverables']);
});

test('PHASE_REQUIRED_ROOT_PATHS has 6 entries', () => {
    assert.strictEqual(PHASE_REQUIRED_ROOT_PATHS.length, 6);
});

test('getPhaseApprovalKey returns correct keys', () => {
    assert.strictEqual(getPhaseApprovalKey(UNIVERSAL_PHASES.PROJECT_PROFILED), 'profile');
    assert.strictEqual(getPhaseApprovalKey(UNIVERSAL_PHASES.IDEA_CAPTURED), null);
});

test('getPhaseNext returns correct next phase', () => {
    assert.strictEqual(getPhaseNext(UNIVERSAL_PHASES.OBJECTIVES_DEFINED), UNIVERSAL_PHASES.SCOPE_DEFINED);
    assert.strictEqual(getPhaseNext(UNIVERSAL_PHASES.EXPORTED), null);
});

test('checkPhaseCompletion returns error for unknown phase', () => {
    const result = checkPhaseCompletion({}, 'UNKNOWN_PHASE');
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason.includes('Bilinmeyen'));
});

test('PHASE_APPROVAL_KEYS map has keys for phases with approval', () => {
    assert.strictEqual(PHASE_CONTRACT_APPROVAL_KEYS['PROJECT_PROFILED'], 'profile');
    assert.strictEqual(PHASE_CONTRACT_APPROVAL_KEYS['IDEA_CAPTURED'], undefined);
});

console.log(`\n  Phase Contracts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
