import assert from 'assert';
import { V3ProjectApplicationService } from '../../src/core/v3-application-service.js';
import { UNIVERSAL_PHASES } from '../../src/workflow/phases.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  ✅ ${name}`); passed++; }
    catch (e) { console.error(`  ❌ ${name}\n     ${e.message}`); failed++; }
}

console.log('\n🚀 v3-application-service tests');

test('createProject returns valid V3 state', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('Build a web app', {
        domains: [{ name: 'software.web', confidence: 0.8 }],
        projectModes: [], activatedModules: [], uncertainties: []
    });
    assert.strictEqual(state.schemaVersion, 3);
    assert.ok(state.identity.summary.includes('web app'));
    assert.ok(state.lifecycle.createdAt);
    assert.strictEqual(state.revision, 1);
});

test('createProject sets correct initial phase', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    assert.strictEqual(state.phase, UNIVERSAL_PHASES.IDEA_CAPTURED);
});

test('applyPatches returns success for empty patches', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    const result = svc.applyPatches(state, [], 1);
    assert.strictEqual(result.success, true);
});

test('applyPatches applies patch and bumps revision', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    const result = svc.applyPatches(state, [
        { operation: 'replace', path: '/identity/name', value: 'Updated Proje' }
    ], 1);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.state.identity.name, 'Updated Proje');
});

test('applyPatches detects stale revision', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    const result = svc.applyPatches(state, [
        { operation: 'replace', path: '/identity/name', value: 'x' }
    ], 99);
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
});

test('approvePhase approves correct key', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    const phaseState = { ...state, phase: 'SCOPE_DEFINED', scope: { mustHave: ['auth'], shouldHave: [], couldHave: [], notNow: [], outOfScope: [] } };
    const result = svc.approvePhase(phaseState, 'SCOPE_DEFINED');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.state.approvals.scope.status, 'approved');
});

test('approvePhase returns success false for unknown phase', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    const result = svc.approvePhase(state, 'UNKNOWN_PHASE');
    assert.strictEqual(result.success, false);
});

test('buildTraceability creates graph from state', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test web app', { domains: [{ name: 'software.web', confidence: 0.8 }], projectModes: [], activatedModules: [], uncertainties: [] });
    state.objectives = [{ id: 'OBJ-001', title: 'Auth module' }];
    state.decisions = [{ id: 'DEC-001', title: 'Use JWT' }];
    state.tasks = [{ id: 'TASK-001', title: 'Implement auth', sourceEntityIds: ['OBJ-001'] }];
    const engine = svc.buildTraceability(state);
    assert.ok(engine);
    const stats = engine.getStats();
    assert.ok(stats.totalNodes >= 3);
});

test('buildTraceability does not create fake slice-based edges', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    state.objectives = [{ id: 'OBJ-001', title: 'Goal' }];
    state.tasks = [{ id: 'TASK-001', title: 'Task 1' }, { id: 'TASK-002', title: 'Task 2' }];
    const engine = svc.buildTraceability(state);
    const edges = engine.graph.getAllEdges();
    assert.strictEqual(edges.length, 0);
});

test('runReview returns report structure', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test app', { domains: [{ name: 'software.web', confidence: 0.8 }], projectModes: [], activatedModules: [], uncertainties: [] });
    state.objectives = [{ id: 'OBJ-001', title: 'Main objective' }];
    const report = svc.runReview(state, 'quick');
    assert.ok(report.health);
    assert.ok(report.readiness);
    assert.ok(report.gates);
    assert.ok(report.findings);
});

test('runReview with deep profile generates more findings', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    const quick = svc.runReview(state, 'quick');
    const deep = svc.runReview(state, 'deep');
    assert.ok(deep.findings.total >= quick.findings.total);
});

test('saveSnapshot stores and restores state', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    const snap = svc.saveSnapshot(state, 'Initial');
    assert.ok(snap.id);
    assert.strictEqual(snap.revision, 1);
    const restored = svc.snapshots.restore(snap.id);
    assert.strictEqual(restored.identity.summary, 'test');
});

test('getEventLog returns logged events', () => {
    const svc = new V3ProjectApplicationService();
    svc.createProject('test', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    const events = svc.getEventLog();
    assert.ok(events.length > 0);
    assert.strictEqual(events[0].type, 'state_created');
});

test('exportStateSafe returns redacted output', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    const safe = svc.exportStateSafe(state);
    assert.ok(safe.exportedAt);
    assert.strictEqual(safe.sensitivityLevel, 'public');
    assert.ok(safe.redactionRules);
});

test('checkAndApplyPhaseTransition transitions when conditions met', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('A web app with authentication and user management system', {
        domains: [{ name: 'software.web', confidence: 0.9 }],
        projectModes: [], activatedModules: [], uncertainties: [{ question: 'tech?', status: 'open' }]
    });
    const result = svc.checkAndApplyPhaseTransition(state);
    if (result.success) {
        assert.ok(result.transitioned);
        assert.notStrictEqual(result.nextPhase, result.currentPhase);
    }
});

test('buildTraceability includes artifacts from root array', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    state.artifacts = [{ id: 'ART-001', title: 'Doc' }];
    const engine = svc.buildTraceability(state);
    const nodes = engine.getNodesByType('artifact');
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].id, 'ART-001');
});

test('createProject transfers profile domains to suggestedModuleIds', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('Build a web app', {
        domains: [{ id: 'software.web', name: 'software.web', confidence: 0.8 }],
        techStack: [{ id: 'nodejs', name: 'Node.js' }],
        projectModes: [], activatedModules: [], uncertainties: []
    });
    assert.ok(state.configuration.suggestedModuleIds.includes('software.web'));
    assert.ok(state.configuration.suggestedModuleIds.includes('nodejs'));
    assert.ok(state.configuration.activeModuleIds.includes('universal'));
    assert.strictEqual(state.configuration.activeModuleIds.includes('software.web'), false);
    assert.strictEqual(state.configuration.activeModuleIds.includes('nodejs'), false);
});

test('approveSuggestedModules moves IDs from suggested to active', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('Build a web app', {
        domains: [{ id: 'software.web', name: 'software.web', confidence: 0.8 }],
        techStack: [{ id: 'nodejs', name: 'Node.js' }],
        projectModes: [], activatedModules: [], uncertainties: []
    });
    const result = svc.approveSuggestedModules(state, ['software.web', 'nodejs']);
    assert.strictEqual(result.success, true);
    assert.ok(result.state.configuration.activeModuleIds.includes('software.web'));
    assert.ok(result.state.configuration.activeModuleIds.includes('nodejs'));
    assert.strictEqual(result.state.configuration.suggestedModuleIds.includes('software.web'), false);
    assert.strictEqual(result.state.configuration.suggestedModuleIds.includes('nodejs'), false);
});

test('approveSuggestedModules with empty list returns error', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    const result = svc.approveSuggestedModules(state, []);
    assert.strictEqual(result.success, false);
});

test('processTurn with null aiResponse returns empty proposals', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    const result = svc.processTurn({ state, aiResponse: null, expectedRevision: 1 });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.pendingProposals.patches.length, 0);
    assert.strictEqual(result.state.revision, 1);
});

test('processTurn does NOT modify state (proposal-only)', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    const originalName = state.identity.name;
    const v3Response = {
        conversationResponse: { text: 'test', actions: [] },
        proposedPatches: [{ id: 'P-1', operation: 'replace', path: '/identity/name', value: 'DEĞİŞTİ' }],
        proposedDecisions: []
    };
    const result = svc.processTurn({ state, aiResponse: v3Response, expectedRevision: 1 });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.state.identity.name, originalName);
    assert.strictEqual(result.pendingProposals.patches.length, 1);
});

test('processTurn with legacy format normalizes correctly', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    const legacyResponse = {
        chatResponse: 'Merhaba! Projeniz hazır.',
        projectFiles: {
            proposedPatches: [{ id: 'PATCH-1', operation: 'replace', path: '/identity/name', value: 'Updated' }],
            suggestedNextStage: 'SCOPE_DEFINED'
        }
    };
    const result = svc.processTurn({ state, aiResponse: legacyResponse, expectedRevision: 1 });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.normalized.conversationResponse.text, 'Merhaba! Projeniz hazır.');
    assert.strictEqual(result.pendingProposals.patches.length, 1);
    assert.strictEqual(result.state.revision, 1);
});

test('processTurn with native V3 format', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    const v3Response = {
        conversationResponse: { text: 'V3 yanıtı', actions: [] },
        proposedPatches: [{ id: 'P-1', operation: 'replace', path: '/identity/name', value: 'V3 Updated' }],
        proposedDecisions: [{ id: 'DEC-1', title: 'Use JWT', rationale: 'Security' }],
        proposedArtifacts: [{ id: 'ART-1', title: 'API Doc', artifactType: 'document' }],
        proposedTasks: [{ id: 'TASK-1', title: 'Implement auth', acceptanceCriteria: ['works'] }],
        proposedTraceLinks: [{ source: 'REQ-1', target: 'TASK-1' }],
        suggestedPhaseTransition: 'SCOPE_DEFINED'
    };
    const result = svc.processTurn({ state, aiResponse: v3Response, expectedRevision: 1 });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.normalized.conversationResponse.text, 'V3 yanıtı');
    assert.strictEqual(result.pendingProposals.decisions.length, 1);
    assert.strictEqual(result.pendingProposals.artifacts.length, 1);
    assert.strictEqual(result.pendingProposals.tasks.length, 1);
    assert.strictEqual(result.pendingProposals.traceLinks.length, 1);
    assert.strictEqual(result.state.revision, 1);
});

test('processTurn handles missing response gracefully', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    const result = svc.processTurn({ state, aiResponse: null, expectedRevision: 1 });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.pendingProposals.patches.length, 0);
});

test('acceptProposalBundle applies patches and traceLinks in one transaction', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    state.phase = 'PROJECT_PROFILED';
    state.decisions = [];
    state.profile = state.profile || {};
    const pending = {
        baseRevision: 1,
        patches: [{ operation: 'replace', path: '/profile/domains', value: [{ name: 'test', confidence: 0.9 }] }],
        decisions: [{ id: 'DEC-1', title: 'Test Decision', decision: 'yes', reason: 'test' }],
        artifacts: [],
        tasks: [],
        traceLinks: [],
        actions: []
    };
    const result = svc.acceptProposalBundle(state, pending, 1);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.state.profile.domains.length, 1);
    assert.ok(result.state.revision > 1);
});

test('rejectProposals returns success with counts', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    const pending = {
        patches: [{ operation: 'add', path: '/test', value: 1 }],
        decisions: [{ id: 'D1' }],
        artifacts: [],
        tasks: [{ id: 'T1' }]
    };
    const result = svc.rejectProposals(state, pending);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.rejected.patches, 1);
    assert.strictEqual(result.rejected.decisions, 1);
    assert.strictEqual(result.rejected.tasks, 1);
});

console.log(`\n  V3 Application Service: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
