import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeProviderBaseUrl, validateProviderSettings } from '../../src/v4/provider-url-policy.js';

const indexHtml = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const tauriConfig = JSON.parse(readFileSync(new URL('../../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
const webCsp = indexHtml.match(/Content-Security-Policy" content="([^"]+)/)?.[1] || '';
const desktopCsp = tauriConfig.app.security.csp;

for (const csp of [webCsp, desktopCsp]) {
    assert.ok(csp.includes("default-src 'self'"));
    assert.ok(csp.includes("object-src 'none'"));
    assert.ok(csp.includes('https://api.openai.com'));
    assert.ok(csp.includes('https://generativelanguage.googleapis.com'));
    assert.ok(!csp.includes('connect-src *'));
}
assert.ok(desktopCsp.includes("frame-ancestors 'none'"));
assert.equal(normalizeProviderBaseUrl('openai', 'https://attacker.example'), 'https://api.openai.com/v1');
assert.equal(normalizeProviderBaseUrl('nvidia', 'http://localhost:9999'), 'https://integrate.api.nvidia.com/v1');
assert.equal(normalizeProviderBaseUrl('ollama', 'http://[::1]:11434'), 'http://[::1]:11434');
assert.equal(validateProviderSettings({ providerId: 'ollama', model: 'safe', baseUrl: 'http://localhost:11434/path' }).valid, false);
assert.equal(validateProviderSettings({ providerId: 'ollama', model: 'bad\nmodel', baseUrl: 'http://localhost:11434' }).valid, false);

console.log('✓ V4 CSP and provider security boundaries');
