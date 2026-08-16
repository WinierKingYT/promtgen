import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  importAnonymousStudySessions,
  summarizeAnonymousStudySessions
} from '../../src/v4/benchmarks/study-import.js';
import type { AnonymousUserSession } from '../../src/v4/benchmarks/comparison-benchmark.js';

const session = (id: string, overrides: Partial<AnonymousUserSession> = {}): AnonymousUserSession => ({
  schemaVersion: 2,
  anonymousSessionId: id,
  capabilityId: 'canonical-planning',
  consent: true,
  completed: true,
  firstExportReached: true,
  mvpAcceptedWithMinorEdits: true,
  manualEditCount: 2,
  setupDurationSeconds: 900,
  planningDurationSeconds: 600,
  endToEndDurationSeconds: 1500,
  wouldUsePlan: true,
  satisfaction: 4,
  ...overrides
});

describe('anonymous study import', () => {
  it('merges valid sessions and computes a local report', () => {
    const imported = importAnonymousStudySessions(
      [session('session-1')],
      [session('session-2', { completed: false, satisfaction: 2 })]
    );
    const summary = summarizeAnonymousStudySessions(imported.sessions);
    assert.equal(imported.importedCount, 1);
    assert.equal(summary.validParticipants, 2);
    assert.equal(summary.completionRate, 0.5);
    assert.equal(summary.averageSatisfaction, 3);
  });

  it('rejects duplicate IDs across restarts/import batches', () => {
    assert.throws(
      () => importAnonymousStudySessions([session('same')], [session('same')]),
      /yineleniyor/
    );
  });

  it('rejects unknown PII fields and PII-like values', () => {
    assert.throws(
      () => importAnonymousStudySessions([], [{ ...session('session-3'), email: 'user@example.com' }]),
      /kişisel veri|izin verilmeyen alan/
    );
    assert.throws(
      () => importAnonymousStudySessions([], [session('user@example.com')]),
      /kişisel veri/
    );
  });
});
