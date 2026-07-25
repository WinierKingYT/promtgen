import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { verifyReleaseReadiness } from '../../src/v4/release/checklist.js';
import { generateDiagnosticReport } from '../../src/v4/release/diagnostics.js';
import { createCanonicalProjectInstance } from '../../src/v4/domain/services/project-creation.js';

describe('Category 12: Production Readiness Verification', () => {
  it('verifyReleaseReadiness returns ready: true for valid Canonical Project', () => {
    const proj = createCanonicalProjectInstance({ ideaText: 'Yayına Hazır Proje' });
    const res = verifyReleaseReadiness(proj);

    assert.ok(res.ready, 'Valid project is ready for release');
    assert.equal(res.blockers.length, 0, 'No blockers');
    assert.ok(res.score >= 75);
  });

  it('generateDiagnosticReport redacts secrets from diagnostic logs', () => {
    const proj = createCanonicalProjectInstance({ ideaText: 'Test Projesi' });
    const rawLogs = [
      'Failed to connect with API key sk-proj-1234567890abcdefABCDEF1234567890',
      'Database connection string: postgres://user:secretpass@localhost/db'
    ];

    const report = generateDiagnosticReport(proj, rawLogs);

    assert.equal(report.appVersion, '4.0.0-rc1');
    assert.equal(report.projectSummary?.revision, 1);
    assert.ok(report.sanitizedLogs[0].includes('[REDACTED_OPENAI_KEY]'));
    assert.ok(report.sanitizedLogs[1].includes('[REDACTED_CONNECTION_STRING]'));
    assert.ok(!report.sanitizedLogs[1].includes('secretpass'), 'Secret removed from diagnostic logs');
  });
});
