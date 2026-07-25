import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { redactSensitiveData } from '../../src/v4/security/secret-guard.js';
import { wrapUntrustedContext } from '../../src/v4/security/untrusted-content.js';

describe('Category 9: AI Evaluation & Golden Corpus Suite', () => {
  it('Evaluates golden corpus benchmarks for secret redaction and prompt injection', () => {
    const corpusPath = path.resolve(process.cwd(), 'tests/fixtures/ai-evals/golden-corpus.json');
    const corpusData = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));

    assert.ok(Array.isArray(corpusData), 'Corpus is an array');

    for (const item of corpusData) {
      if (item.containsSecrets) {
        const res = redactSensitiveData(item.inputIdea);
        assert.ok(res.redactedText.includes(item.expectedRedactedPattern), `Secret redacted for ${item.id}`);
      }

      if (item.expectedDeflectedToken) {
        const wrapped = wrapUntrustedContext(item.inputIdea);
        assert.ok(wrapped.safeText.includes(item.expectedDeflectedToken), `Injection deflected for ${item.id}`);
      }
    }
  });
});
