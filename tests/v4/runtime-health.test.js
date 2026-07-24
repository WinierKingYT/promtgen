import assert from 'node:assert/strict';
import { buildRuntimeHealthReport } from '../../src/v4/runtime-health.js';

const web = buildRuntimeHealthReport({
    indexedDbAvailable: true,
    providerSettings: { providerId: 'offline', model: 'promtgen-local', baseUrl: '' }
});
assert.equal(web.summary.readyForPlanning, true);
assert.equal(web.checks.find(item => item.id === 'storage').status, 'ok');
assert.equal(web.checks.find(item => item.id === 'provider').status, 'ok');
assert.equal(web.summary.readyForNativeExecution, false);

const desktopWithoutCodex = buildRuntimeHealthReport({
    desktop: true,
    storage: { ok: true, projectCount: 2, backupCount: 4 },
    execution: { gitAvailable: true, gitVersion: 'git version 2.50', codexAvailable: false, codexVersion: '' },
    providerSettings: { providerId: 'offline', model: 'promtgen-local', baseUrl: '' }
});
assert.equal(desktopWithoutCodex.summary.readyForPlanning, true);
assert.equal(desktopWithoutCodex.summary.readyForNativeExecution, false);
assert.equal(desktopWithoutCodex.checks.find(item => item.id === 'codex').status, 'warning');

const desktopWithSelectedCodex = buildRuntimeHealthReport({
    desktop: true,
    storage: { ok: true, projectCount: 1, backupCount: 2 },
    execution: { gitAvailable: true, codexAvailable: true, codexVersion: 'codex-cli 1.2.3', codexSource: 'custom', codexPath: 'C:\\Tools\\codex.exe' },
    providerSettings: { providerId: 'offline', model: 'promtgen-local', baseUrl: '' }
});
const selectedCodexCheck = desktopWithSelectedCodex.checks.find(item => item.id === 'codex');
assert.equal(desktopWithSelectedCodex.summary.readyForNativeExecution, true);
assert.match(selectedCodexCheck.detail, /kullanıcı seçimi/);
assert.match(selectedCodexCheck.detail, /codex\.exe/);

const ollamaReady = buildRuntimeHealthReport({
    indexedDbAvailable: true,
    ollama: { ok: true, latencyMs: 8 },
    providerSettings: { providerId: 'ollama', model: 'llama3.2', baseUrl: 'http://127.0.0.1:11434' }
});
assert.equal(ollamaReady.checks.find(item => item.id === 'ollama').status, 'ok');
assert.equal(ollamaReady.checks.find(item => item.id === 'provider').status, 'ok');

const cloudWithoutCredential = buildRuntimeHealthReport({
    indexedDbAvailable: true,
    providerSettings: { providerId: 'openai', model: 'gpt-4.1-mini', baseUrl: 'https://api.openai.com/v1' }
});
assert.equal(cloudWithoutCredential.checks.find(item => item.id === 'provider').status, 'warning');

console.log('✓ V4 local runtime health report');
