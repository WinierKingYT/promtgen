import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  runDiscoveryBenchmark,
  runDiscoveryBenchmarkScenario,
  type DiscoveryBenchmarkScenario
} from '../../src/v4/benchmarks/discovery-benchmark.js';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import {
  analyzeDiscoverySignals,
  createInitialConceptInterpretation
} from '../../src/v4/application/idea-discussion-service.js';

function scenario(overrides: Partial<DiscoveryBenchmarkScenario> = {}): DiscoveryBenchmarkScenario {
  return {
    version: 1,
    id: 'test-adversarial',
    title: 'Test adversarial fikir',
    category: 'adversarial',
    rawIdea: 'Kişisel görev uygulaması olsun ama ekip paylaşımı da zorunlu.',
    simulatedClarification: 'İlk sürüm yalnız bireysel görev takibi.',
    expectedConcerns: ['target-user', 'scope-conflict'],
    reference: {
      summary: 'Bireysel görev takip uygulaması.',
      targetUser: 'Günlük işlerini yöneten bireysel geliştirici',
      targetUserTerms: ['geliştirici'],
      problemStatement: 'Kişisel görevler dağınık notlarda kayboluyor.',
      currentAlternative: 'Metin dosyaları',
      desiredOutcome: 'Sıradaki görevin görünür olması',
      confirmedFeatures: ['Görev oluşturma', 'Görev tamamlama'],
      outOfScope: ['Ekip paylaşımı'],
      mvpTarget: 'Tek kullanıcılı görev takip akışı'
    },
    thresholds: {
      minimumConcernRecall: 1,
      maximumInterpretationConfidence: 70
    },
    ...overrides
  };
}

describe('Guided discovery benchmark', () => {
  it('ham fikirde çelişkiyi yakalar ve sistem yorumunu otomatik onaylamaz', () => {
    const project = analyzeIdea(scenario().rawIdea);
    const signals = analyzeDiscoverySignals(project);
    const interpretation = createInitialConceptInterpretation(project);

    assert.ok(signals.concerns.some(item => item.id === 'scope-conflict'));
    assert.ok(interpretation.openQuestions.some(question => /çelişen|kapsam dışında/i.test(question)));
    assert.equal(interpretation.userConfirmed, false);
    assert.equal(interpretation.technicalApproaches.length, 0);
  });

  it('kullanıcı düzeltmesini canonical kapsama açık onayla taşır', () => {
    const result = runDiscoveryBenchmarkScenario(scenario());

    assert.equal(result.passed, true, result.failures.join('\n'));
    assert.equal(result.metrics.concernRecall, 1);
    assert.equal(result.metrics.autoConfirmed, false);
    assert.equal(result.metrics.agreementReadyAfterUserCorrection, true);
    assert.equal(result.metrics.canonicalScopeCoverage, 1);
    assert.equal(result.metrics.outOfScopeCoverage, 1);
  });

  it('temiz canonical alanları ham fikir başlangıcına enjekte eden senaryoyu reddeder', () => {
    const invalid = scenario({ expectedConcerns: [], reference: { ...scenario().reference, confirmedFeatures: [] } });
    assert.throws(() => runDiscoveryBenchmark([invalid]), /benchmark referansı/);
  });

  it('mutlak vaat, hassas veri ve çoklu platform risklerini ayrı sorulara dönüştürür', () => {
    const project = analyzeIdea('Web mobil masaüstü sağlık uygulaması yüzde 100 hatasız olsun ve hasta konum verisini toplasın.');
    const ids = analyzeDiscoverySignals(project).concerns.map(item => item.id);

    assert.ok(ids.includes('feasibility'));
    assert.ok(ids.includes('sensitive-data'));
    assert.ok(ids.includes('multi-platform'));
  });
});
