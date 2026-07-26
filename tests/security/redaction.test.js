import assert from 'node:assert/strict';
import { redactSensitiveData } from '../../src/v4/security/secret-guard.js';

const cases = [
    { input: 'api_key=sk-abc123def456ghi789', expected: 'api_key=[REDACTED_SECRET]' },
    { input: 'password=mySecretPass123!', expected: 'password=[REDACTED_SECRET]' },
    { input: 'access_token=abcdef123456', expected: 'access_token=[REDACTED_SECRET]' },
    { input: 'No secrets here', expected: 'No secrets here' },
    { input: 'api_key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI', expected: 'api_key=[REDACTED_SECRET]' },
    { input: 'secret_key=supersecretvalue', expected: 'secret_key=[REDACTED_SECRET]' },
];

let passed = 0;
for (const { input, expected } of cases) {
    const result = redactSensitiveData(input);
    assert.equal(result.redactedText, expected, `Redaction failed for: ${input}`);
    passed++;
}

assert.equal(redactSensitiveData('plain text').redactedCount, 0, 'No redactions for plain text');
assert.ok(redactSensitiveData('api_key=secret').redactedCount >= 1, 'At least one redaction counted');

console.log(`✓ Security: ${passed} secret redaction cases passed`);
