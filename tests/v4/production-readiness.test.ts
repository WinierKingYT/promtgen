import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { verifyProjectReadiness } from '../../src/v4/release/checklist.js';
import { generateDiagnosticReport } from '../../src/v4/release/diagnostics.js';
import { createCanonicalProjectInstance } from '../../src/v4/domain/services/project-creation.js';

describe('Category 12: Production Readiness Verification', () => {
  it('verifyProjectReadiness validates a canonical plan without claiming application release readiness', () => {
    const proj = createCanonicalProjectInstance({ ideaText: 'Yayına Hazır Proje' });
    const res = verifyProjectReadiness(proj);

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

    assert.equal(report.appVersion, 'development');
    assert.equal(report.commitSha, 'development');
    assert.equal(report.projectSummary?.documentRevision, 1);
    assert.equal(report.projectSummary?.canonicalRevision, 1);
    assert.ok(report.sanitizedLogs[0].includes('[REDACTED_OPENAI_KEY]'));
    assert.ok(report.sanitizedLogs[1].includes('[REDACTED_CONNECTION_STRING]'));
    assert.ok(!report.sanitizedLogs[1].includes('secretpass'), 'Secret removed from diagnostic logs');
  });
});
