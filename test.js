import assert from 'assert';
import { escapeHTML } from './src/security/safe-renderer.js';
import { validateFileMetadata } from './src/security/file-policy.js';
import { scanForSecrets } from './src/security/secret-detector.js';
import { getInitialCanonicalState, applyStatePatch, validateCanonicalState, validateProjectData, syncAIResponseToCanonicalState } from './src/state/project-state.js';
import { WORKFLOW_STAGES } from './src/workflow/stages.js';
import { checkWorkflowTransition } from './src/workflow/transitions.js';
import { profileProjectFromText, buildProfilePromptBlock } from './src/planning/project-profiler.js';
import { buildPlanningPrompt, buildDebugPrompt } from './src/prompts/planning-prompt.js';

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

// ============================================================
// 1. XSS Safe Renderer
// ============================================================
console.log('\n🔐 safe-renderer tests');
test('escapeHTML escapes script tag', () => {
    assert.strictEqual(escapeHTML('hello <script>'), 'hello &lt;script&gt;');
});
test('escapeHTML escapes quotes', () => {
    assert.strictEqual(escapeHTML('"hello"'), '&quot;hello&quot;');
});
test('escapeHTML escapes ampersand', () => {
    assert.strictEqual(escapeHTML('a & b'), 'a &amp; b');
});
test('escapeHTML handles null/undefined safely', () => {
    assert.strictEqual(escapeHTML(null), '');
    assert.strictEqual(escapeHTML(undefined), '');
});
test('escapeHTML protects attribute injection attempt', () => {
    const unsafe = 'x" onclick="alert(1)';
    const safe = escapeHTML(unsafe);
    assert.ok(!safe.includes('"'), 'Should not contain raw double-quote');
});

// ============================================================
// 2. File Policy
// ============================================================
console.log('\n📁 file-policy tests');
test('rejects disallowed extension (png)', () => {
    assert.strictEqual(validateFileMetadata('image.png', 100).valid, false);
});
test('accepts allowed extension (js)', () => {
    assert.strictEqual(validateFileMetadata('code.js', 100).valid, true);
});
test('rejects oversized file (>1MB)', () => {
    assert.strictEqual(validateFileMetadata('code.js', 2 * 1024 * 1024).valid, false);
});
test('accepts exactly 1MB file', () => {
    assert.strictEqual(validateFileMetadata('code.js', 1024 * 1024).valid, true);
});

// ============================================================
// 3. Secret Detector
// ============================================================
console.log('\n🔑 secret-detector tests');
test('returns false for normal content', () => {
    assert.strictEqual(scanForSecrets('my normal content here'), false);
});
test('detects API key pattern', () => {
    assert.strictEqual(scanForSecrets("API_KEY = 'AIzaSyFakeKey_1234567890123'"), true);
});
test('detects PRIVATE KEY header', () => {
    assert.strictEqual(scanForSecrets('-----BEGIN RSA PRIVATE KEY-----'), true);
});
test('detects AIzaSy prefix key', () => {
    assert.strictEqual(scanForSecrets('token: AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ012'), true);
});

// ============================================================
// 4. Canonical Project State & JSON Patch
// ============================================================
console.log('\n📦 project-state tests');

const state = getInitialCanonicalState();

test('initial state passes validation', () => {
    assert.strictEqual(validateCanonicalState(state), true);
});
test('initial state has workflowStage = IDEA_CAPTURED', () => {
    assert.strictEqual(state.workflowStage, WORKFLOW_STAGES.IDEA_CAPTURED);
});
test('initial state revision is 1', () => {
    assert.strictEqual(state.revision, 1);
});

const state2 = applyStatePatch(state, {
    operation: 'add',
    path: '/profile/capabilities/-',
    value: 'local-db-access'
});
test('applyStatePatch add increments revision', () => {
    assert.strictEqual(state2.revision, 2);
});
test('applyStatePatch add appends to array', () => {
    assert.ok(state2.profile.capabilities.includes('local-db-access'));
});

const state3 = applyStatePatch(state2, {
    operation: 'replace',
    path: '/identity/name',
    value: 'Yeni Proje'
});
test('applyStatePatch replace updates value', () => {
    assert.strictEqual(state3.identity.name, 'Yeni Proje');
});
test('applyStatePatch replace increments revision again', () => {
    assert.strictEqual(state3.revision, 3);
});

// ============================================================
// 5. Prototype Pollution Prevention
// ============================================================
console.log('\n🛡️ prototype-pollution tests');

test('blocks __proto__ path', () => {
    const original = getInitialCanonicalState();
    const result = applyStatePatch(original, {
        operation: 'add',
        path: '/__proto__/polluted',
        value: 'HACKED'
    });
    assert.strictEqual(result, original, 'Should return original state unchanged');
    assert.strictEqual(({}).polluted, undefined, 'Prototype should not be polluted');
});
test('blocks constructor path', () => {
    const original = getInitialCanonicalState();
    applyStatePatch(original, {
        operation: 'replace',
        path: '/constructor/name',
        value: 'pwned'
    });
    assert.notStrictEqual(Object.name, 'pwned');
});

// ============================================================
// 6. Strict Schema Validation
// ============================================================
console.log('\n✅ validateCanonicalState strict tests');

test('rejects state without workflowStage', () => {
    const bad = getInitialCanonicalState();
    delete bad.workflowStage;
    assert.strictEqual(validateCanonicalState(bad), false);
});
test('rejects revision <= 0', () => {
    const bad = getInitialCanonicalState();
    bad.revision = 0;
    assert.strictEqual(validateCanonicalState(bad), false);
});
test('rejects invalid confidence value', () => {
    const bad = getInitialCanonicalState();
    bad.profile.domains.push({ name: 'game', confidence: 1.5 });
    assert.strictEqual(validateCanonicalState(bad), false);
});
test('rejects confidence < 0', () => {
    const bad = getInitialCanonicalState();
    bad.profile.domains.push({ name: 'web', confidence: -0.1 });
    assert.strictEqual(validateCanonicalState(bad), false);
});
test('accepts valid confidence = 1.0', () => {
    const s = getInitialCanonicalState();
    s.profile.domains.push({ name: 'ai', confidence: 1.0 });
    assert.strictEqual(validateCanonicalState(s), true);
});
test('rejects duplicate IDs across decisions/assumptions', () => {
    const bad = getInitialCanonicalState();
    bad.decisions.push({ id: 'ID-001', title: 'A', decision: '', reason: '' });
    bad.assumptions.push({ id: 'ID-001', text: 'B', confidence: 'medium', status: 'active' });
    assert.strictEqual(validateCanonicalState(bad), false);
});

// ============================================================
// 7. Workflow Transitions - Fail Closed
// ============================================================
console.log('\n🔄 workflow-transitions tests');

test('unknown stage returns allowed=false (fail-closed)', () => {
    const st = getInitialCanonicalState();
    const res = checkWorkflowTransition(st, 'NONEXISTENT_STAGE');
    assert.strictEqual(res.allowed, false);
});
test('undefined stage returns allowed=false', () => {
    const st = getInitialCanonicalState();
    const res = checkWorkflowTransition(st, undefined);
    assert.strictEqual(res.allowed, false);
});
test('IDEA_CAPTURED fails without identity.summary', () => {
    const st = getInitialCanonicalState();
    const res = checkWorkflowTransition(st, WORKFLOW_STAGES.IDEA_CAPTURED);
    assert.strictEqual(res.allowed, false);
});
test('IDEA_CAPTURED succeeds with summary and domains', () => {
    const st = getInitialCanonicalState();
    st.identity.summary = 'Bu bir test projesidir.';
    st.profile.domains = [{ name: 'game', confidence: 0.9 }];
    const res = checkWorkflowTransition(st, WORKFLOW_STAGES.IDEA_CAPTURED);
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.nextStage, WORKFLOW_STAGES.PROFILE_DRAFTED);
});
test('TASKS_DRAFTED -> AGENT_PACKAGE_DRAFTED (new pipeline)', () => {
    const st = getInitialCanonicalState();
    st.tasks = [{ id: 'T-001', title: 'task', description: 'desc' }];
    const res = checkWorkflowTransition(st, WORKFLOW_STAGES.TASKS_DRAFTED);
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.nextStage, WORKFLOW_STAGES.AGENT_PACKAGE_DRAFTED);
});
test('READY_FOR_EXPORT -> EXPORTED', () => {
    const st = getInitialCanonicalState();
    const res = checkWorkflowTransition(st, WORKFLOW_STAGES.READY_FOR_EXPORT);
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.nextStage, WORKFLOW_STAGES.EXPORTED);
});

// ============================================================
// 8. Project Profiler
// ============================================================
console.log('\n🧪 project-profiler tests');

test('detects game domain', () => {
    const p = profileProjectFromText('Bir oyun yapmak istiyorum unity ile');
    assert.ok(p.domains.some(d => d.name === 'game'));
});
test('detects web domain explicitly', () => {
    const p = profileProjectFromText('React ile bir web sitesi yapmak istiyorum');
    assert.ok(p.domains.some(d => d.name === 'web'));
});
test('returns unknown domain (NOT web) when no domain matches', () => {
    const p = profileProjectFromText('baskılı tişört sipariş etmek istiyorum');
    const hasUnknown = p.domains.some(d => d.name === 'unknown');
    const hasWeb = p.domains.some(d => d.name === 'web');
    assert.ok(hasUnknown, 'Should have unknown domain');
    assert.ok(!hasWeb, 'Should NOT have web domain by default');
});
test('unknown domain has low confidence (0.20)', () => {
    const p = profileProjectFromText('baskılı tişört sipariş etmek istiyorum');
    const unknown = p.domains.find(d => d.name === 'unknown');
    assert.strictEqual(unknown?.confidence, 0.20);
});
test('unknown domain adds uncertainty message', () => {
    const p = profileProjectFromText('baskılı tişört sipariş etmek istiyorum');
    assert.ok(p.uncertainties.length > 0, 'Should have uncertainty for unknown domain');
});
test('buildProfilePromptBlock includes domains line', () => {
    const p = profileProjectFromText('mobil oyun geliştirmeyi düşünüyorum');
    const block = buildProfilePromptBlock(p);
    assert.ok(block.includes('Domains:'));
    assert.ok(block.includes('confidence'));
});
test('buildProfilePromptBlock includes platforms', () => {
    const p = profileProjectFromText('android uygulama');
    const block = buildProfilePromptBlock(p);
    assert.ok(block.includes('Platforms:'));
});
test('game domain + cross-platform with no specific platform keyword', () => {
    const p = profileProjectFromText('unity hyper-casual oyun');
    assert.ok(p.platforms.includes('cross-platform'));
});


// ============================================================
// 9. Prompt Builder Module
// ============================================================
console.log('\n📝 planning-prompt module tests');

test('buildPlanningPrompt includes techStack', () => {
    const prompt = buildPlanningPrompt({
        techStack: 'React (Vite)',
        techVersion: '18.x',
        activeFocuses: ['ui', 'security'],
        profile: null,
        stepDepth: 5,
        historyText: 'Kullanıcı: Merhaba'
    });
    assert.ok(prompt.includes('React (Vite)'), 'Should include techStack');
    assert.ok(prompt.includes('18.x'), 'Should include techVersion');
});
test('buildPlanningPrompt includes focusesText', () => {
    const prompt = buildPlanningPrompt({
        techStack: 'x',
        techVersion: 'y',
        activeFocuses: ['performance', 'scale'],
        profile: null,
        stepDepth: 3,
        historyText: ''
    });
    assert.ok(prompt.includes('PERFORMANCE'), 'Should include PERFORMANCE focus');
    assert.ok(prompt.includes('SCALE'), 'Should include SCALE focus');
});
test('buildPlanningPrompt includes profile block when profile given', () => {
    const profile = { domains: [{ name: 'ai', confidence: 0.9 }], platforms: ['browser'], capabilities: [], uncertainties: [] };
    const prompt = buildPlanningPrompt({
        techStack: 'x', techVersion: 'y', activeFocuses: [], profile, stepDepth: 3, historyText: ''
    });
    assert.ok(prompt.includes('ai'), 'Should include domain name from profile');
});
test('buildPlanningPrompt includes stepDepth count', () => {
    const prompt = buildPlanningPrompt({
        techStack: 'x', techVersion: 'y', activeFocuses: [], profile: null, stepDepth: 7, historyText: ''
    });
    assert.ok(prompt.includes('7'), 'Should include stepDepth number');
});
test('buildDebugPrompt includes error log', () => {
    const prompt = buildDebugPrompt({
        projectContext: 'React finans app',
        errorLog: 'TypeError: cannot read properties of undefined',
        errorCode: ''
    });
    assert.ok(prompt.includes('TypeError: cannot read properties of undefined'), 'Should contain error log');
});
test('buildDebugPrompt includes project context', () => {
    const prompt = buildDebugPrompt({
        projectContext: 'Unity oyun projesi',
        errorLog: 'NullReferenceException',
        errorCode: ''
    });
    assert.ok(prompt.includes('Unity oyun projesi'), 'Should contain project context');
});

// ============================================================
// 10. V2 Sprint Hardening & Canonical State Sync
// ============================================================
console.log('\n🔒 canonical state hardening tests');

test('validateCanonicalState rejects missing agentPackage', () => {
    const st = getInitialCanonicalState();
    delete st.agentPackage;
    assert.strictEqual(validateCanonicalState(st), false);
});

test('validateCanonicalState rejects invalid agentPackage structure', () => {
    const st = getInitialCanonicalState();
    st.agentPackage.rules = "invalid"; // should be object
    assert.strictEqual(validateCanonicalState(st), false);
});

test('validateCanonicalState accepts valid agentPackage structure', () => {
    const st = getInitialCanonicalState();
    assert.strictEqual(validateCanonicalState(st), true);
});

test('AGENT_PACKAGE_DRAFTED -> REVIEW_IN_PROGRESS fails if subagents empty', () => {
    const st = getInitialCanonicalState();
    st.agentPackage.subagents = [];
    const res = checkWorkflowTransition(st, WORKFLOW_STAGES.AGENT_PACKAGE_DRAFTED);
    assert.strictEqual(res.allowed, false);
});

test('AGENT_PACKAGE_DRAFTED -> REVIEW_IN_PROGRESS succeeds if subagents populated', () => {
    const st = getInitialCanonicalState();
    st.agentPackage.subagents = [{ key: 'auditor', role: 'Auditor' }];
    const res = checkWorkflowTransition(st, WORKFLOW_STAGES.AGENT_PACKAGE_DRAFTED);
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.nextStage, WORKFLOW_STAGES.REVIEW_IN_PROGRESS);
});

test('Sync simulation: AI cannot bypass workflowStage directly (fails closed/unchanged)', () => {
    let currentProjectState = getInitialCanonicalState();
    
    // Simulate AI returning workflowStage
    const projectFiles = {
        workflowStage: "READY_FOR_EXPORT", // AI tries to skip stages
        suggestedNextStage: "READY_FOR_EXPORT",
        identity: { name: "Test AI Name" }
    };
    
    // Mock the sync function logic (without direct stage write)
    const patch = (path, value) => {
        currentProjectState = applyStatePatch(currentProjectState, {
            operation: 'replace',
            path,
            value
        });
    };
    
    if (projectFiles.identity && projectFiles.identity.name) {
        patch('/identity/name', projectFiles.identity.name);
    }
    
    // Check that workflowStage remains IDEA_CAPTURED
    assert.strictEqual(currentProjectState.workflowStage, WORKFLOW_STAGES.IDEA_CAPTURED);
    // suggestedNextStage is only saved as advisory
    if (projectFiles.suggestedNextStage) {
        currentProjectState._suggestedNextStage = projectFiles.suggestedNextStage;
    }
    assert.strictEqual(currentProjectState._suggestedNextStage, "READY_FOR_EXPORT");
});

test('Sync simulation: applyStatePatch correctly increments revision', () => {
    let currentProjectState = getInitialCanonicalState();
    const startRev = currentProjectState.revision;
    
    currentProjectState = applyStatePatch(currentProjectState, {
        operation: 'replace',
        path: '/identity/name',
        value: 'New Name'
    });
    
    assert.strictEqual(currentProjectState.revision, startRev + 1);
});

test('End-to-End Integration: Raw AI response -> validate -> sync -> canonical state -> transition checks', () => {
    // 1. Raw AI Response Simulation (containing identity, scope, requirements, architecture, suggestedNextStage, prompts, decisions, assumptions)
    const rawAIResponse = {
        chatResponse: "Proje planını oluşturdum.",
        suggestedNextStage: "MVP_DEFINED", // Advisory only
        prompts: [
            { title: "Giriş Kurulumu", description: "İlk adım promptu", content: "..." }
        ],
        docs: {
            brief: "# Proje",
            requirements: "# Gereksinimler"
        },
        identity: {
            name: "Akıllı Finans",
            summary: "Bütçe takip uygulaması",
            problem: "Finansal plansızlık",
            desiredOutcome: "Bütçe kontrolü"
        },
        scope: {
            mustHave: ["Yerel veri kaydı", "Bütçe grafiği"],
            shouldHave: ["Kategori bazlı filtre"],
            outOfScope: ["Bulut senkronizasyonu"]
        },
        requirements: {
            functional: ["Gelir ekleme", "Harcama ekleme"],
            nonFunctional: ["Hızlı yüklenme"]
        },
        architecture: {
            components: ["Görünüm Katmanı (React)", "Yerel Veritabanı"],
            dataFlows: ["UI -> DB"]
        },
        decisions: [
            { id: "DEC-001", title: "React Kullanımı", decision: "Kullanılsın", reason: "Hızlı" }
        ],
        assumptions: [
            { id: "ASM-001", text: "Kullanıcı tarayıcıda çalıştıracak", confidence: "high", status: "active" }
        ]
    };

    // 2. Run validateProjectData
    const validatedData = validateProjectData(rawAIResponse);
    assert.strictEqual(validatedData.identity.name, "Akıllı Finans");
    assert.strictEqual(validatedData.scope.mustHave[0], "Yerel veri kaydı");
    assert.strictEqual(validatedData.requirements.functional[0], "Gelir ekleme");
    assert.strictEqual(validatedData.architecture.components[0], "Görünüm Katmanı (React)");
    assert.strictEqual(validatedData.suggestedNextStage, "MVP_DEFINED");

    // 3. Run syncAIResponseToCanonicalState
    let canonicalState = getInitialCanonicalState();
    
    // Set up initial state profile so transitions can proceed past profile drafted stage
    canonicalState = applyStatePatch(canonicalState, {
        operation: 'replace',
        path: '/profile/domains',
        value: [{ name: 'web', confidence: 0.9 }]
    });
    canonicalState = applyStatePatch(canonicalState, {
        operation: 'replace',
        path: '/profile/uncertainties',
        value: ['Veriler nasıl depolanacak?']
    });

    // Check starting stage is IDEA_CAPTURED
    assert.strictEqual(canonicalState.workflowStage, WORKFLOW_STAGES.IDEA_CAPTURED);

    // Run sync
    canonicalState = syncAIResponseToCanonicalState(canonicalState, validatedData);

    // Verify properties successfully synced to canonical state
    assert.strictEqual(canonicalState.identity.name, "Akıllı Finans");
    assert.strictEqual(canonicalState.scope.mustHave[0], "Yerel veri kaydı");
    assert.strictEqual(canonicalState.requirements.functional[0], "Gelir ekleme");
    assert.strictEqual(canonicalState.architecture.components[0], "Görünüm Katmanı (React)");
    assert.strictEqual(canonicalState.workflowSuggestion.stage, "MVP_DEFINED");
    // Ensure sync did NOT bypass workflowStage directly
    assert.strictEqual(canonicalState.workflowStage, WORKFLOW_STAGES.IDEA_CAPTURED);

    // 4. Run transition checks step-by-step to prove the data successfully unlocks progress!
    
    // Transition 1: IDEA_CAPTURED -> PROFILE_DRAFTED
    let transitionResult = checkWorkflowTransition(canonicalState, canonicalState.workflowStage);
    assert.strictEqual(transitionResult.allowed, true);
    assert.strictEqual(transitionResult.nextStage, WORKFLOW_STAGES.PROFILE_DRAFTED);
    canonicalState = applyStatePatch(canonicalState, { operation: 'replace', path: '/workflowStage', value: transitionResult.nextStage });

    // Transition 2: PROFILE_DRAFTED -> DISCOVERY_IN_PROGRESS
    transitionResult = checkWorkflowTransition(canonicalState, canonicalState.workflowStage);
    assert.strictEqual(transitionResult.allowed, true);
    assert.strictEqual(transitionResult.nextStage, WORKFLOW_STAGES.DISCOVERY_IN_PROGRESS);
    canonicalState = applyStatePatch(canonicalState, { operation: 'replace', path: '/workflowStage', value: transitionResult.nextStage });

    // Transition 3: DISCOVERY_IN_PROGRESS -> MVP_DEFINED
    transitionResult = checkWorkflowTransition(canonicalState, canonicalState.workflowStage);
    assert.strictEqual(transitionResult.allowed, true);
    assert.strictEqual(transitionResult.nextStage, WORKFLOW_STAGES.MVP_DEFINED);
    canonicalState = applyStatePatch(canonicalState, { operation: 'replace', path: '/workflowStage', value: transitionResult.nextStage });

    // Transition 4: MVP_DEFINED -> REQUIREMENTS_DRAFTED (Requires scope.mustHave and scope.outOfScope)
    transitionResult = checkWorkflowTransition(canonicalState, canonicalState.workflowStage);
    assert.strictEqual(transitionResult.allowed, true, `Transition from MVP_DEFINED failed: ${transitionResult.reason}`);
    assert.strictEqual(transitionResult.nextStage, WORKFLOW_STAGES.REQUIREMENTS_DRAFTED);
    canonicalState = applyStatePatch(canonicalState, { operation: 'replace', path: '/workflowStage', value: transitionResult.nextStage });

    // Verify workflowStage was successfully progressed using checkWorkflowTransition and state patches
    assert.strictEqual(canonicalState.workflowStage, WORKFLOW_STAGES.REQUIREMENTS_DRAFTED);
    assert.ok(canonicalState.revision > 5, `Revision count should have incremented on each transition and sync patch. Current revision: ${canonicalState.revision}`);
});

// ============================================================
// Summary
// ============================================================
console.log(`\n${'='.repeat(50)}`);
if (failed === 0) {
    console.log(`🎉 All ${passed} tests passed!`);
} else {
    console.log(`⚠️  ${passed} passed, ${failed} FAILED`);
    process.exit(1);
}
