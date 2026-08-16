import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildComparisonReport,
  evaluateBlindSubmission,
  validateAnonymousUserSessions,
  type AnonymousUserSession,
  type BlindComparisonSubmission
} from '../../src/v4/benchmarks/comparison-benchmark.js';
import { COMPARISON_EVIDENCE } from '../../src/v4/product/generated-comparison-evidence.js';

function submission(blindId: string, quality: 'weak' | 'strong'): BlindComparisonSubmission {
  return {
    schemaVersion: 2,
    blindId,
    scenarioId: 'notes',
    inScope: ['Not oluşturma'],
    outOfScope: ['Takım sohbeti'],
    requirements: [{ id: 'req-1', title: 'Not oluştur', priority: 'must', acceptanceCriteria: ['Not kaydedilir.'] }],
    tasks: [{
      id: 'task-1',
      title: 'Not oluşturmayı uygula',
      description: quality === 'weak' ? 'Not oluştur ve takım sohbeti ekle.' : 'Not oluşturma akışını yerel kayıtla uygula.',
      requirementIds: ['req-1'],
      acceptanceCriteria: quality === 'strong' ? ['Not yeniden açıldığında görünür.'] : [],
      verificationIds: quality === 'strong' ? ['test-1'] : []
    }],
    tests: quality === 'strong' ? [{ id: 'test-1', requirementIds: ['req-1'] }] : [],
    decisionStatements: ['Local-first depolama kullanılacak.'],
    setupDurationSeconds: quality === 'strong' ? 900 : 0,
    planningDurationSeconds: quality === 'strong' ? 300 : 180,
    endToEndDurationSeconds: quality === 'strong' ? 1200 : 180,
    manualEditCount: quality === 'strong' ? 1 : 5,
    agentFirstPassCompleted: quality === 'strong'
  };
}

const userSession: AnonymousUserSession = {
  schemaVersion: 2,
  anonymousSessionId: 'anon-001',
  capabilityId: 'canonical-planning',
  consent: true,
  completed: true,
  firstExportReached: true,
  mvpAcceptedWithMinorEdits: true,
  manualEditCount: 1,
  setupDurationSeconds: 900,
  planningDurationSeconds: 600,
  endToEndDurationSeconds: 1500,
  satisfaction: 5,
  wouldUsePlan: true
};

describe('Blind comparison benchmark and anonymous user evidence', () => {
  it('evaluates artifacts without receiving their method identity', () => {
    const weak = evaluateBlindSubmission(submission('blind-a', 'weak'));
    const strong = evaluateBlindSubmission(submission('blind-b', 'strong'));
    assert.ok(strong.score > weak.score);
    assert.equal(strong.metrics.scopeContainment, 1);
    assert.equal(strong.metrics.requirementTestCoverage, 1);
    assert.throws(
      () => evaluateBlindSubmission({ ...submission('leaked', 'strong'), method: 'promtgen' } as BlindComparisonSubmission),
      /yöntem bilgisini içeremez/
    );
  });

  it('opens publication only after balanced blind samples, superiority and user evidence exist', () => {
    const report = buildComparisonReport({
      studyId: 'test-study',
      submissions: [
        submission('baseline', 'weak'),
        submission('master', 'weak'),
        submission('promtgen', 'strong')
      ],
      mapping: [
        { blindId: 'baseline', method: 'baseline-chat' },
        { blindId: 'master', method: 'master-prompt' },
        { blindId: 'promtgen', method: 'promtgen' }
      ],
      userSessions: [userSession],
      policy: {
        minimumScenariosPerMethod: 1,
        minimumUserParticipants: 1,
        minimumPromtgenScopeImprovement: 0.3,
        minimumPromtgenAcceptanceImprovement: 0.4
      },
      generatedAt: '2026-07-28T00:00:00.000Z'
    });
    assert.equal(report.publicationGate.eligible, true);
    assert.equal(report.userEvidence.firstExportRate, 1);
    assert.ok((report.byMethod.promtgen?.averageScore || 0) > (report.byMethod['baseline-chat']?.averageScore || 0));
  });

  it('rejects PII-shaped extra fields and keeps the real evidence gate blocked while inputs are empty', () => {
    assert.throws(
      () => validateAnonymousUserSessions([{ ...userSession, email: 'not-allowed@example.com' } as AnonymousUserSession]),
      /izin verilmeyen alan/
    );
    assert.equal(COMPARISON_EVIDENCE.publicationEligible, false);
    assert.equal(COMPARISON_EVIDENCE.userParticipantsByCapability['canonical-planning'] || 0, 0);
  });
});
