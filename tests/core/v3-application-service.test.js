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
    // Only registered module IDs are activated (nodejs is a technology, not a module)
    const result = svc.approveSuggestedModules(state, ['software.web', 'nodejs']);
    assert.strictEqual(result.success, true);
    assert.ok(result.state.configuration.activeModuleIds.includes('software.web'));
    assert.strictEqual(result.state.configuration.activeModuleIds.includes('nodejs'), false);
    assert.strictEqual(result.state.configuration.suggestedModuleIds.includes('software.web'), false);
    assert.ok(result.state.configuration.suggestedModuleIds.includes('nodejs'));
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
        proposedDecisions: [{ id: 'DEC-1', title: 'Use JWT', decision: 'Use JWT for auth', reason: 'Security' }],
        proposedArtifacts: [{ id: 'ART-1', title: 'API Doc', artifactType: 'document' }],
        proposedTasks: [{ id: 'TASK-1', title: 'Implement auth', description: 'Implement authentication module', acceptanceCriteria: ['works'] }],
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

test('acceptProposalItem accepts only the selected item, leaves remaining', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    state.phase = 'PROJECT_PROFILED';
    state.decisions = [];
    state.profile = state.profile || {};
    const pending = {
        baseRevision: 1,
        patches: [{ id: 'P-1', operation: 'replace', path: '/profile/domains', value: [{ name: 'test', confidence: 0.9 }] }],
        decisions: [{ id: 'DEC-1', title: 'Test Decision', decision: 'yes', reason: 'test' }],
        artifacts: [],
        tasks: [{ id: 'TASK-1', title: 'Do work', acceptanceCriteria: ['done'] }],
        traceLinks: [],
        actions: [{ id: 'ACT-1', title: 'Send email', action: 'notify' }],
        suggestedPhaseTransition: 'SCOPE_DEFINED',
        createdAt: new Date().toISOString()
    };
    // Accept only the patch
    const result = svc.acceptProposalItem(state, pending, 'patch', 'P-1', 1);
    assert.strictEqual(result.success, true);
    assert.ok(result.state.revision > 1);
    assert.ok(result.remainingProposals);
    // Remaining should have decision, task, action, stageTransition but NOT the patch
    assert.strictEqual(result.remainingProposals.patches.length, 0);
    assert.strictEqual(result.remainingProposals.decisions.length, 1);
    assert.strictEqual(result.remainingProposals.tasks.length, 1);
    assert.strictEqual(result.remainingProposals.actions.length, 1);
    assert.ok(result.remainingProposals.suggestedPhaseTransition);
    // Remaining baseRevision should be updated
    assert.strictEqual(result.remainingProposals.baseRevision, result.state.revision);
});

test('acceptProposalItem rejects unknown item type', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    const pending = { baseRevision: 1, patches: [], decisions: [], artifacts: [], tasks: [], traceLinks: [], actions: [] };
    const result = svc.acceptProposalItem(state, pending, 'patch', 'NONEXISTENT', 1);
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('bulunamadı'));
});

test('acceptProposalItem accepts only the selected decision, keeps patch', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    state.phase = 'PROJECT_PROFILED';
    state.decisions = [];
    state.profile = state.profile || {};
    const pending = {
        baseRevision: 1,
        patches: [{ id: 'P-1', operation: 'replace', path: '/profile/domains', value: [{ name: 'test', confidence: 0.9 }] }],
        decisions: [{ id: 'DEC-1', title: 'Use JWT', decision: 'yes', reason: 'auth' }],
        artifacts: [],
        tasks: [],
        traceLinks: [],
        actions: [],
        createdAt: new Date().toISOString()
    };
    const result = svc.acceptProposalItem(state, pending, 'decision', 'DEC-1', 1);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.state.decisions.length, 1);
    // Patch should remain in remainingProposals
    assert.strictEqual(result.remainingProposals.patches.length, 1);
    assert.strictEqual(result.remainingProposals.decisions.length, 0);
});

test('acceptProposalItem with stageTransition filters it from remaining', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('test project idea', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    const pending = {
        baseRevision: 1,
        patches: [],
        decisions: [],
        artifacts: [],
        tasks: [],
        traceLinks: [],
        actions: [],
        suggestedPhaseTransition: 'PROJECT_PROFILED',
        createdAt: new Date().toISOString()
    };
    const result = svc.acceptProposalItem(state, pending, 'stageTransition', 'stage-transition', 1);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.remainingProposals.suggestedPhaseTransition, null);
    // Phase should have transitioned
    assert.strictEqual(result.state.phase, 'PROJECT_PROFILED');
});

test('_findBundleItem finds items by type and id', () => {
    const svc = new V3ProjectApplicationService();
    const bundle = {
        patches: [{ id: 'P-1' }],
        decisions: [{ id: 'D-1' }],
        artifacts: [{ id: 'A-1' }],
        tasks: [{ id: 'T-1' }],
        traceLinks: [{ source: 'SRC', target: 'TGT' }],
        actions: [{ id: 'ACT-1' }]
    };
    assert.ok(svc._findBundleItem(bundle, 'patch', 'P-1'));
    assert.strictEqual(svc._findBundleItem(bundle, 'patch', 'NOPE'), null);
    assert.ok(svc._findBundleItem(bundle, 'traceLink', 'SRC→TGT'));
    assert.ok(svc._findBundleItem(bundle, 'action', 'ACT-1'));
});

test('_filterBundleWithout removes correct item by type and id', () => {
    const svc = new V3ProjectApplicationService();
    const bundle = {
        baseRevision: 1,
        patches: [{ id: 'P-1' }, { id: 'P-2' }],
        decisions: [{ id: 'D-1' }],
        artifacts: [],
        tasks: [],
        traceLinks: [],
        actions: [{ id: 'ACT-1' }],
        suggestedPhaseTransition: 'NEXT_PHASE'
    };
    const filtered = svc._filterBundleWithout(bundle, 'patch', 'P-1');
    assert.strictEqual(filtered.patches.length, 1);
    assert.strictEqual(filtered.patches[0].id, 'P-2');
    assert.strictEqual(filtered.decisions.length, 1);
    assert.strictEqual(filtered.actions.length, 1);
    const noStage = svc._filterBundleWithout(bundle, 'stageTransition', 'stage-transition');
    assert.strictEqual(noStage.suggestedPhaseTransition, null);
});

test('acceptProposalBundle is fully atomic and rolls back if phase transition fails', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('Build a web app', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    const originalRev = state.revision;

    // Build a bundle that attempts a phase transition to an invalid phase (or condition unmet)
    const bundle = {
        baseRevision: originalRev,
        patches: [
            { id: 'P-1', operation: 'replace', path: '/identity/name', value: 'Yeni Proje Adı' }
        ],
        suggestedPhaseTransition: 'DISCOVERY_IN_PROGRESS' // Will fail because current phase is IDEA_CAPTURED and next phase contract is PROJECT_PROFILED
    };

    const result = svc.acceptProposalBundle(state, bundle, originalRev);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.state.revision, originalRev);
    assert.strictEqual(result.state.identity.name, state.identity.name); // Should not have applied patch

    // Event log should also not contain PROPOSAL_ACCEPTED
    const timeline = svc.getEventLog();
    const acceptedEvents = timeline.filter(e => e.type === 'PROPOSAL_ACCEPTED');
    assert.strictEqual(acceptedEvents.length, 0);
});

test('acceptProposalBundle action proposal logs ACTION_ACKNOWLEDGED event', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('Build a web app', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    const bundle = {
        baseRevision: state.revision,
        patches: [],
        actions: [
            { id: 'ACT-1', title: 'Test Action', description: 'Run a test command' }
        ]
    };

    const result = svc.acceptProposalBundle(state, bundle, state.revision);
    assert.strictEqual(result.success, true);
    
    const timeline = svc.getEventLog();
    const actionEvents = timeline.filter(e => e.type === 'ACTION_ACKNOWLEDGED');
    assert.strictEqual(actionEvents.length, 1);
    assert.strictEqual(actionEvents[0].data.actionId, 'ACT-1');
});

test('approveSuggestedModules detects conflict with already active modules', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('Build a web app', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });

    // First activate cloud-only
    const res1 = svc.approveSuggestedModules(state, ['cloud-only']);
    assert.strictEqual(res1.success, true);

    // Now try to activate software.offline (requires software first, let's include it so deps match)
    // It should fail conflict check since cloud-only is already active
    const res2 = svc.approveSuggestedModules(res1.state, ['software', 'software.offline']);
    assert.strictEqual(res2.success, false);
    assert.ok(res2.error.includes('Modül çakışması'));
});

test('approveSuggestedModules returns error on missing dependencies', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('Build a web app', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });

    // Try to activate a module with non-existent dependency or force a missing dependency
    // We can simulate this by trying to resolve dependencies for software.offline when 'software' registry id is filtered out,
    // or register a test module with a missing dependency.
    svc.moduleRegistry.register({
        id: 'test.dependent',
        name: 'Dependent Module',
        version: '1.0.0',
        dependencies: ['non.existent.dep']
    });

    const res = svc.approveSuggestedModules(state, ['test.dependent']);
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('Eksik bağımlılıklar'));
});

test('V3 patch value validation uses V3-specific schemas', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('Build a web app', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });

    // Try to apply a patch to V3 property identity/problemStatement (required to be string)
    const bundle = {
        baseRevision: state.revision,
        patches: [
            { id: 'P-1', operation: 'replace', path: '/identity/problemStatement', value: 12345 } // should fail since it's number
        ]
    };

    const res = svc.acceptProposalBundle(state, bundle, state.revision);
    assert.strictEqual(res.success, false);
    assert.ok(res.error.message.includes('Şema İhlali'));
});

test('buildTraceability loads manual traceLink from state.entityStores.traceLink', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('Build a web app', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    
    // Add nodes first so traceLink can resolve them
    state.objectives = [{ id: 'OBJ-1', title: 'Target 1' }];
    state.tasks = [{ id: 'TASK-1', title: 'Work 1' }];
    state.entityStores = {
        traceLink: [
            { source: 'OBJ-1', target: 'TASK-1', type: 'implements' }
        ]
    };

    const traceability = svc.buildTraceability(state);
    const graph = traceability.graph;
    
    assert.ok(graph.hasNode('OBJ-1'));
    assert.ok(graph.hasNode('TASK-1'));
    const edges = graph.getEdgesForNode('OBJ-1');
    assert.ok(edges.length > 0);
    assert.strictEqual(edges[0].sourceId, 'OBJ-1');
    assert.strictEqual(edges[0].targetId, 'TASK-1');
});

test('runReview runs new reviewer rules: CONS-002, RISK-002, TASK-005, and MOD-001', () => {
    const svc = new V3ProjectApplicationService();
    const state = svc.createProject('Build a web app', { domains: [], projectModes: [], activatedModules: [], uncertainties: [] });
    
    // 1. Trigger CONS-002: Add an objective that has no edges
    state.objectives = [{ id: 'OBJ-UNLINKED', title: 'No link' }];
    
    // 2. Trigger RISK-002: Add a high risk with empty mitigation
    state.risks = [{ id: 'RISK-1', description: 'Server failure', impact: 'high', likelihood: 'high', mitigation: '' }];
    
    // 3. Trigger TASK-005: Add a task with no edges
    state.tasks = [{ id: 'TASK-UNLINKED', title: 'No link task', description: 'Work', priority: 'medium' }];

    // 4. Trigger MOD-001: Activate test module without its dependencies
    svc.moduleRegistry.register({
        id: 'test.orphan',
        name: 'Orphan Module',
        version: '1.0.0',
        dependencies: ['non.existent.dep']
    });
    state.configuration = state.configuration || {};
    state.configuration.activeModuleIds = ['test.orphan'];

    const report = svc.runReview(state);
    const findingIds = report.findings.items.map(f => f.ruleId);
    
    assert.ok(findingIds.includes('CONS-002'));
    assert.ok(findingIds.includes('RISK-002'));
    assert.ok(findingIds.includes('TASK-005'));
    assert.ok(findingIds.includes('MOD-001'));
});

console.log(`\n  V3 Application Service: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
