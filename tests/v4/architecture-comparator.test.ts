import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import { validateProjectDocument } from '../../src/v4/project-document.js';
import { generateConceptSummaryProject } from '../../src/v4/application/deterministic-idea-planning.js';
import { getCapability, evaluateStableEligibility } from '../../src/v4/capability-registry.js';

/**
 * Üretim entegrasyon testi: gerçek planlama motorundan çıkan canonical belge
 * üzerinde mimari karşılaştırma şablonunun davranışı doğrulanır. Amaç saf
 * fonksiyonu değil, canonical belgeyle birleşmiş hâlini ölçmek.
 */
describe('Architecture comparator production integration', () => {
  const idea = 'Küçük ekipler için web tabanlı görev takip ve raporlama uygulaması yapmak istiyorum';

  it('canonical belgeye bağlanır ve şema doğrulamasından geçer', () => {
    const project = analyzeIdea(idea);
    const withConcept = generateConceptSummaryProject(project, 'approach-modular');

    const validation = validateProjectDocument(withConcept);
    assert.equal(validation.valid, true, validation.errors.join(' '));
    assert.equal(withConcept.ideaLabSession?.selectedApproachId, 'approach-modular');
    assert.equal(withConcept.lifecycle.activePhase, 'CONCEPT_CONFIRMATION');
  });

  it('canonical revision ilerletmez; şablon tek başına planı değiştiremez', () => {
    const project = analyzeIdea(idea);
    const before = project.canonicalRevision;
    const withConcept = generateConceptSummaryProject(project, 'approach-advanced');

    assert.equal(withConcept.canonicalRevision, before, 'şablon canonical revision ilerletmemeli');
    assert.equal(withConcept.ideaLabSession?.conceptSummary?.userConfirmed, false);
    // Girdi belgesi mutate edilmemeli.
    assert.equal(project.ideaLabSession?.selectedApproachId, undefined);
  });

  it('seçilen yaklaşım konsept özetine ve risklere taşınır', () => {
    const project = analyzeIdea(idea);
    const withConcept = generateConceptSummaryProject(project, 'approach-advanced');
    const summary = withConcept.ideaLabSession?.conceptSummary;

    assert.ok(summary, 'konsept özeti üretilmeli');
    assert.equal(summary.technicalApproaches.length, 1);
    assert.ok(summary.confirmedFeatures.some(feature => feature.startsWith('Temel mimari:')));
    assert.ok(summary.knownRisks.length > 0, 'seçilen yaklaşımın riskleri taşınmalı');
    assert.ok(summary.openQuestions.length > 0, 'açık soru üretilmeli');
  });

  it('kayıt defterindeki olgunluk ve sınır beyanı gerçek davranışla tutarlıdır', () => {
    const capability = getCapability('architecture-comparator-template');
    assert.ok(capability, 'yetenek kayıtlı olmalı');
    assert.equal(capability.implementationMode, 'static-template');
    assert.ok(
      capability.limitations.some(limitation => /otomatik/i.test(limitation) && /hesaplan/i.test(limitation)),
      'metriklerin hesaplanmadığı beyan edilmeli'
    );

    // Beyan doğruysa terfi kapısı yalnız kullanıcı kanıtında bloklu kalmalı.
    const eligibility = evaluateStableEligibility(capability);
    assert.equal(eligibility.metrics.integrationTests > 0, true, 'üretim entegrasyon kanıtı bulunmalı');
    assert.equal(eligibility.metrics.scenarioCount >= 5, true, 'en az 5 benchmark senaryosu bulunmalı');
  });
});
