import assert from 'assert';
import { getInitialCanonicalState, applyStatePatch } from '../../src/state/project-state.js';
import { WORKFLOW_STAGES, WORKFLOW_STAGE_METADATA } from '../../src/workflow/stages.js';
import { checkWorkflowTransition } from '../../src/workflow/transitions.js';
import { STAGE_CONTRACTS, STAGE_APPROVAL_KEYS } from '../../src/workflow/stage-contracts.js';
import { isApprovalValid, getArtifactHash, approveArtifact } from '../../src/application/approval-service.js';

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

function setStage(state, stage) {
    return applyStatePatch(state, { operation: 'replace', path: '/workflowStage', value: stage }, true);
}

function populateState(state, data) {
    let s = JSON.parse(JSON.stringify(state));
    for (const [path, value] of Object.entries(data)) {
        s[path] = value;
    }
    return s;
}

test('IDEA_CAPTURED -> PROFILE_DRAFTED succeeds with summary and domains', () => {
    let state = getInitialCanonicalState();
    state.identity.summary = 'Test project for workflow validation';
    state.identity.name = 'Workflow Test';
    state.profile.domains = [{ name: 'web', confidence: 0.9 }];

    const result = checkWorkflowTransition(state, state.workflowStage);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.nextStage, WORKFLOW_STAGES.PROFILE_DRAFTED);
});

test('PROFILE_DRAFTED -> DISCOVERY_IN_PROGRESS requires approval and uncertainties', () => {
    let state = getInitialCanonicalState();
    state = setStage(state, WORKFLOW_STAGES.PROFILE_DRAFTED);
    state.profile.uncertainties = ['Database choice?'];
    state = approveArtifact(state, 'profile');

    const result = checkWorkflowTransition(state, state.workflowStage);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.nextStage, WORKFLOW_STAGES.DISCOVERY_IN_PROGRESS);
});

test('DISCOVERY_IN_PROGRESS -> MVP_DEFINED requires decisions', () => {
    let state = getInitialCanonicalState();
    state = setStage(state, WORKFLOW_STAGES.DISCOVERY_IN_PROGRESS);
    state.decisions = [{ id: 'DEC-001', title: 'Tech Decision', decision: 'React', reason: 'Fast' }];

    const result = checkWorkflowTransition(state, state.workflowStage);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.nextStage, WORKFLOW_STAGES.MVP_DEFINED);
});

test('MVP_DEFINED -> REQUIREMENTS_DRAFTED requires scope and approval', () => {
    let state = getInitialCanonicalState();
    state = setStage(state, WORKFLOW_STAGES.MVP_DEFINED);
    state.scope.mustHave = ['Feature A'];
    state.scope.outOfScope = ['Feature B'];
    state = approveArtifact(state, 'mvpScope');

    const result = checkWorkflowTransition(state, state.workflowStage);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.nextStage, WORKFLOW_STAGES.REQUIREMENTS_DRAFTED);
});

test('REQUIREMENTS_DRAFTED -> TECH_OPTIONS_READY requires requirements and approval', () => {
    let state = getInitialCanonicalState();
    state = setStage(state, WORKFLOW_STAGES.REQUIREMENTS_DRAFTED);
    state.requirements = { functional: ['F1'], nonFunctional: ['NF1'], domainSpecific: [] };
    state = approveArtifact(state, 'requirements');

    const result = checkWorkflowTransition(state, state.workflowStage);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.nextStage, WORKFLOW_STAGES.TECH_OPTIONS_READY);
});

test('TECH_OPTIONS_READY -> TECH_STACK_SELECTED requires tech decision', () => {
    let state = getInitialCanonicalState();
    state = setStage(state, WORKFLOW_STAGES.TECH_OPTIONS_READY);
    state.decisions = [{ id: 'DEC-001', title: 'Teknoloji Stack Seçimi', decision: 'React', reason: 'Fast' }];

    const result = checkWorkflowTransition(state, state.workflowStage);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.nextStage, WORKFLOW_STAGES.TECH_STACK_SELECTED);
});

test('TECH_STACK_SELECTED -> ARCHITECTURE_DRAFTED requires approval', () => {
    let state = getInitialCanonicalState();
    state = setStage(state, WORKFLOW_STAGES.TECH_STACK_SELECTED);
    state = approveArtifact(state, 'technology');

    const result = checkWorkflowTransition(state, state.workflowStage);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.nextStage, WORKFLOW_STAGES.ARCHITECTURE_DRAFTED);
});

test('ARCHITECTURE_DRAFTED -> TASKS_DRAFTED requires architecture and approval', () => {
    let state = getInitialCanonicalState();
    state = setStage(state, WORKFLOW_STAGES.ARCHITECTURE_DRAFTED);
    state.architecture = { components: ['UI'], dataFlows: ['UI->API'], integrations: [], mermaidCode: '' };
    state = approveArtifact(state, 'architecture');

    const result = checkWorkflowTransition(state, state.workflowStage);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.nextStage, WORKFLOW_STAGES.TASKS_DRAFTED);
});

test('TASKS_DRAFTED -> AGENT_PACKAGE_DRAFTED requires tasks and approval', () => {
    let state = getInitialCanonicalState();
    state = setStage(state, WORKFLOW_STAGES.TASKS_DRAFTED);
    state.tasks = [{ id: 'T-001', title: 'Setup', description: 'Init' }];
    state = approveArtifact(state, 'tasks');

    const result = checkWorkflowTransition(state, state.workflowStage);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.nextStage, WORKFLOW_STAGES.AGENT_PACKAGE_DRAFTED);
});

test('AGENT_PACKAGE_DRAFTED -> REVIEW_IN_PROGRESS requires subagents', () => {
    let state = getInitialCanonicalState();
    state = setStage(state, WORKFLOW_STAGES.AGENT_PACKAGE_DRAFTED);
    state.agentPackage.subagents = [{ name: 'auditor', role: 'Auditor', instructions: 'Check' }];

    const result = checkWorkflowTransition(state, state.workflowStage);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.nextStage, WORKFLOW_STAGES.REVIEW_IN_PROGRESS);
});

test('REVIEW_IN_PROGRESS -> READY_FOR_EXPORT always succeeds', () => {
    let state = getInitialCanonicalState();
    state = setStage(state, WORKFLOW_STAGES.REVIEW_IN_PROGRESS);

    const result = checkWorkflowTransition(state, state.workflowStage);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.nextStage, WORKFLOW_STAGES.READY_FOR_EXPORT);
});

test('READY_FOR_EXPORT -> EXPORTED requires finalReview approval', () => {
    let state = getInitialCanonicalState();
    state = setStage(state, WORKFLOW_STAGES.READY_FOR_EXPORT);
    state = approveArtifact(state, 'finalReview');

    const result = checkWorkflowTransition(state, state.workflowStage);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.nextStage, WORKFLOW_STAGES.EXPORTED);
});

test('EXPORTED stage blocks further transition', () => {
    let state = getInitialCanonicalState();
    state = setStage(state, WORKFLOW_STAGES.EXPORTED);

    const result = checkWorkflowTransition(state, WORKFLOW_STAGES.EXPORTED);
    assert.strictEqual(result.allowed, false);
});

test('each stage has a valid index in WORKFLOW_STAGE_METADATA', () => {
    for (const [stage, meta] of Object.entries(WORKFLOW_STAGE_METADATA)) {
        assert.ok(typeof meta.index === 'number');
        assert.ok(meta.index >= 0);
        assert.ok(typeof meta.label === 'string');
    }
});

console.log(`\n  Complete Workflow: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
