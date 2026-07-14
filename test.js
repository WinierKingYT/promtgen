import assert from 'assert';
import { escapeHTML } from './src/security/safe-renderer.js';
import { validateFileMetadata } from './src/security/file-policy.js';
import { scanForSecrets } from './src/security/secret-detector.js';
import { getInitialCanonicalState, applyStatePatch, validateCanonicalState } from './src/state/project-state.js';
import { checkWorkflowTransition } from './src/workflow/transitions.js';
import { profileProjectFromText } from './src/planning/project-profiler.js';

console.log("🚀 Running V2 Modular Engine Unit Tests...");

// 1. Test XSS Safe Renderer
assert.strictEqual(escapeHTML("hello <script>"), "hello &lt;script&gt;");
console.log("✅ safe-renderer tests passed.");

// 2. Test File Policy
assert.strictEqual(validateFileMetadata("image.png", 100).valid, false);
assert.strictEqual(validateFileMetadata("code.js", 100).valid, true);
assert.strictEqual(validateFileMetadata("code.js", 2 * 1024 * 1024).valid, false);
console.log("✅ file-policy tests passed.");

// 3. Test Secret Detector
assert.strictEqual(scanForSecrets("my secret password"), false);
assert.strictEqual(scanForSecrets("API_KEY = 'AIzaSyFakeKey_1234567890123'"), true);
console.log("✅ secret-detector tests passed.");

// 4. Test Canonical Project State & Patches
const state = getInitialCanonicalState();
assert.strictEqual(validateCanonicalState(state), true);
assert.strictEqual(state.revision, 1);

// Apply a patch
const patch1 = {
    operation: "add",
    path: "/profile/capabilities/-",
    value: "local-db-access"
};
const state2 = applyStatePatch(state, patch1);
assert.strictEqual(state2.revision, 2);
assert.strictEqual(state2.profile.capabilities.includes("local-db-access"), true);

// Test replace patch
const patch2 = {
    operation: "replace",
    path: "/identity/name",
    value: "Yeni Proje"
};
const state3 = applyStatePatch(state2, patch2);
assert.strictEqual(state3.identity.name, "Yeni Proje");
console.log("✅ project-state & JSON Patch tests passed.");

// 5. Test Workflow Transition Rules
// Current is IDEA_CAPTURED
const transition1 = checkWorkflowTransition(state3, 'IDEA_CAPTURED');
assert.strictEqual(transition1.allowed, false); // needs summary/problem + domains/uncertainties

// Let's modify state to satisfy conditions
state3.identity.summary = "Bu bir test oyun projesidir.";
state3.profile.domains = [{ name: "game", confidence: 0.9 }];
const transition2 = checkWorkflowTransition(state3, 'IDEA_CAPTURED');
assert.strictEqual(transition2.allowed, true);
assert.strictEqual(transition2.nextStage, 'PROFILE_DRAFTED');
console.log("✅ workflow-engine transitions tests passed.");

// 6. Test Project Profiler
const profile = profileProjectFromText("Bir hyper-casual mobil oyun yapmak istiyorum.");
assert.strictEqual(profile.domains.some(d => d.name === 'game'), true);
assert.strictEqual(profile.platforms.includes('cross-platform'), true);
console.log("✅ project-profiler tests passed.");

console.log("🎉 All V2 Modular Engine Unit Tests Passed Successfully!");
