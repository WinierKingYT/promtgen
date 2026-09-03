import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  V1_EVALUATION_CRITERIA,
  buildComparisonReport,
  evaluateBlindSubmission,
  validateAnonymousUserSessions,
  validateHumanEvaluations,
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

/** Üretimdeki `rounded` ile aynı yuvarlama; test elle yuvarlanmış sayı yazmaz. */
const rounded = (value: number) => Math.round(value * 1000) / 1000;

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
    const weak = evaluateBlindSubmission(submission('blind-a', 'weak'), V1_EVALUATION_CRITERIA);
    const strong = evaluateBlindSubmission(submission('blind-b', 'strong'), V1_EVALUATION_CRITERIA);
    assert.ok(strong.score > weak.score);
    assert.equal(strong.metrics.scopeContainment, 1);
    assert.equal(strong.metrics.requirementTestCoverage, 1);
    assert.throws(
      () => evaluateBlindSubmission({ ...submission('leaked', 'strong'), method: 'promtgen' } as BlindComparisonSubmission, V1_EVALUATION_CRITERIA),
      /yöntem bilgisini içeremez/
    );
  });

  /**
   * ÖLÇÜLEN KUSUR. `scopeContainment` boş `outOfScope` listesinde 1 dönüyordu:
   * hiç kapsam kararı vermemiş bir gönderim, kararını verip hiç sızdırmayanla
   * toplam skorun %25'inde AYNI puanı alıyordu. Boş küme üzerinde vakum
   * doğruluk bir ölçüm değildir.
   */
  it('hiç kapsam kararı olmayan gönderim kapsam puanı KAZANMAZ', () => {
    const disciplined = evaluateBlindSubmission(submission('blind-disiplinli', 'strong'), V1_EVALUATION_CRITERIA);
    const undecided = evaluateBlindSubmission(
      { ...submission('blind-kararsiz', 'strong'), outOfScope: [] },
      V1_EVALUATION_CRITERIA
    );

    assert.equal(disciplined.metrics.scopeContainment, 1, 'kararını verip sızdırmayan tam puan almalı');
    assert.equal(undecided.metrics.scopeContainment, 0, 'hiç karar vermeyen kapsam puanı kazanmamalı');
    assert.ok(
      undecided.score < disciplined.score,
      `karar vermeyen gönderim aynı puanı almamalı: ${undecided.score} vs ${disciplined.score}`
    );
    assert.ok(
      undecided.findings.some(finding => /Hiç kapsam dışı kararı kaydedilmemiş/.test(finding)),
      `sıfırın sebebi bulgularda okunabilir olmalı: ${JSON.stringify(undecided.findings)}`
    );
    // Sızdırma ile hiç karar vermeme AYRI kusurlardır; ikisi karışmamalı.
    assert.equal(
      undecided.findings.some(finding => /Kapsam dışı görevler/.test(finding)),
      false
    );
  });

  it('kısmi sızdırma ORANLA cezalandırılır: eşik değil, ölçüdür', () => {
    const partial = evaluateBlindSubmission(
      {
        ...submission('blind-kismi', 'strong'),
        outOfScope: ['Takım sohbeti', 'Mobil uygulama', 'Çevrimdışı mod'],
        tasks: [{
          id: 'task-1',
          title: 'Not oluşturmayı uygula',
          description: 'Not oluşturma akışını takım sohbeti ile birlikte uygula.',
          requirementIds: ['req-1'],
          acceptanceCriteria: ['Not yeniden açıldığında görünür.'],
          verificationIds: ['test-1']
        }]
      },
      V1_EVALUATION_CRITERIA
    );

    assert.equal(partial.metrics.scopeContainment, rounded(2 / 3));
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
      criteria: V1_EVALUATION_CRITERIA,
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

  // Ret nedenleri ayrı ayrı adlandırılır. Daha önce dört farklı neden tek bir
  // "geçersiz veya yineleniyor" mesajını paylaşıyordu; kolaylaştırıcı dosyayı
  // taşıması mı, veriyi atması mı, yoksa hiçbir şey yapmaması mı gerektiğini
  // mesajdan çıkaramıyordu. Bu testler mesajın nedeni adlandırmasını kilitler.
  it('her ret nedeni kendi mesajını ve oturum kimliğini söyler', () => {
    assert.throws(
      () => validateAnonymousUserSessions([{ ...userSession, schemaVersion: 1 } as unknown as AnonymousUserSession]),
      /anon-001.*şema sürümü 2 olmalı, gelen 1/s
    );
    assert.throws(
      () => validateAnonymousUserSessions([{ ...userSession, consent: false }]),
      /anon-001.*açık onay \(consent\)/s
    );
    assert.throws(
      () => validateAnonymousUserSessions([{ ...userSession, anonymousSessionId: '' }]),
      /anonymousSessionId zorunludur/
    );
    assert.throws(
      () => validateAnonymousUserSessions([userSession, { ...userSession }]),
      /anon-001.*zaten içe aktarılmış, kayıt yineleniyor/s
    );
  });

  it('geçersiz metrik, hangi alan ve hangi değer olduğunu söyler', () => {
    assert.throws(
      () => validateAnonymousUserSessions([{ ...userSession, manualEditCount: -1 }]),
      /anon-001.*manualEditCount.*gelen -1/s
    );
    assert.throws(
      () => validateAnonymousUserSessions([{ ...userSession, planningDurationSeconds: -5 }]),
      /anon-001.*planningDurationSeconds.*gelen -5/s
    );
    assert.throws(
      () => validateAnonymousUserSessions([{ ...userSession, wouldUsePlan: 'evet' } as unknown as AnonymousUserSession]),
      /anon-001.*wouldUsePlan boolean olmalı, gelen tür string/s
    );
    assert.throws(
      () => validateAnonymousUserSessions([{ ...userSession, satisfaction: 6 }]),
      /anon-001.*satisfaction 1-5 aralığında.*gelen 6/s
    );
  });
});

describe('Kör değerlendirme doğrulaması', () => {
  const criteria = ['scopeClarity', 'agentReadiness'];
  const full = { blindId: 'b1', evaluatorId: 'e1', scores: { scopeClarity: 4, agentReadiness: 3 } } as never;

  it('tam degerlendirme kabul edilir', () => {
    assert.equal(validateHumanEvaluations([full], criteria).length, 1);
  });

  it('EKSIK olcut reddedilir', () => {
    // Daha önce eksik ölçüt sessizce `null` olup ortalamadan düşüyordu; bu,
    // kötü giden bir ölçütü kaybetmenin en kolay yoluydu.
    const partial = { blindId: 'b1', evaluatorId: 'e1', scores: { scopeClarity: 4 } } as never;

    assert.throws(() => validateHumanEvaluations([partial], criteria), /eksik ölçüt/i);
  });

  it('calismada TANIMSIZ olcut reddedilir', () => {
    // Yazılmayan bir ölçüte verilen puan hiçbir yere gitmezdi; değerlendirenin
    // emeği sessizce çöpe giderdi.
    const extra = {
      blindId: 'b1', evaluatorId: 'e1',
      scores: { scopeClarity: 4, agentReadiness: 3, uydurmaOlcut: 5 }
    } as never;

    assert.throws(() => validateHumanEvaluations([extra], criteria), /tanımsız ölçüt/i);
  });

  it('aralik disi puan reddedilir', () => {
    const bad = { blindId: 'b1', evaluatorId: 'e1', scores: { scopeClarity: 9, agentReadiness: 3 } } as never;

    assert.throws(() => validateHumanEvaluations([bad], criteria), /1-5/);
  });

  it('kimliksiz degerlendirme reddedilir', () => {
    const anonymous = { blindId: '', evaluatorId: 'e1', scores: { scopeClarity: 4, agentReadiness: 3 } } as never;

    assert.throws(() => validateHumanEvaluations([anonymous], criteria), /kimlik/i);
  });
});
