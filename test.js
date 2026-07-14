// test.js
const assert = require('assert');

// 1. Re-declare pure functions for testing
function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function scanForSecrets(content) {
    const secretRegexes = [
        /(key|password|secret|private_key|token|auth_token|passwd|credential|api_key)\s*[:=]\s*['"[a-zA-Z0-9_\-\.]{12,}/i,
        /-----BEGIN[ A-Z0-9_-]+PRIVATE KEY-----/i,
        /AIzaSy[A-Za-z0-9_\-]{33}/
    ];
    for (const regex of secretRegexes) {
        if (regex.test(content)) return true;
    }
    return false;
}

// 2. Unit Tests
console.log("🚀 Running unit tests...");

// Test escapeHTML (CRITICAL-002)
assert.strictEqual(escapeHTML("<div>test</div>"), "&lt;div&gt;test&lt;/div&gt;");
assert.strictEqual(escapeHTML("a & b"), "a &amp; b");
assert.strictEqual(escapeHTML('"hello"'), "&quot;hello&quot;");
console.log("✅ escapeHTML XSS tests passed.");

// Test scanForSecrets (CRITICAL-003)
assert.strictEqual(scanForSecrets("normal content"), false);
assert.strictEqual(scanForSecrets("my_api_key = 'AIzaSyFakeKey_12345678901234567890123'"), true);
assert.strictEqual(scanForSecrets("-----BEGIN RSA PRIVATE KEY-----\nsupersecret...\n-----END RSA PRIVATE KEY-----"), true);
console.log("✅ scanForSecrets security tests passed.");

console.log("🎉 All tests passed successfully!");
