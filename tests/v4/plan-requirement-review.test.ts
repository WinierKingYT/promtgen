import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createProjectDocument } from '../../src/v4/project-document.js';
import { createInitialConceptInterpretation } from '../../src/v4/application/idea-discussion-service.js';
import {
  applyIdeaPlanConversion,
  previewIdeaPlanConversion
} from '../../src/v4/application/idea-plan-conversion-service.js';
import { acceptRequirementDraft } from '../../src/v4/application/requirement-quality-service.js';
import { selectPlanRequirementReview } from '../../src/v4/application/plan-requirement-review.js';
import { compileTaskPlan } from '../../src/v4/task-compiler.js';
import type { ProjectDocumentV5 } from '../../src/v4/contracts.js';

/**
 * Plan aşamasının "Gereksinimler" bölümü, taslak gereksinimleri kart olarak
 * gösteren yüzeyin OKUMA tarafıdır. Kabul/düzenleme/reddetme kararlarını
 * `requirement-quality-service` verir; burada yalnız o kararların ekranda
 * nasıl sıralandığı ve neyin açık olduğu ölçülür.
 */
function convertedProject(): ProjectDocumentV5 {
  const project = createProjectDocument({
    idea: 'Şehir içinde bisiklet kullananlara güvenli rota öneren bir mobil uygulama.'
  });
  project.ideaLabSession = {
    status: 'concept_ready',
    approaches: [],
    ideaNotes: [],
    candidateDecisions: [],
    candidateRisks: [],
    conceptSummary: {
      ...createInitialConceptInterpretation(project),
      summary: 'Bisikletlilere güvenli rota öneren yerel öncelikli mobil uygulama.',
      targetUser: 'Şehir içinde bisiklet kullanan birey',
      problemStatement: 'Güvenli rota bilgisi dağınık ve güncel değil.',
      currentAlternative: 'Genel harita uygulamaları ve forum tavsiyeleri.',
      desiredOutcome: 'Kullanıcı güvenli bir rota seçip takip edebilir.',
      firstReleaseTarget: 'Güvenli rota önerisini tek ekranda sunmak.',
      confirmedFeatures: ['Rota geçmişini yalnız cihazda tut', 'Güvenli rota önerisi göster'],
      outOfScope: ['Bulut senkronizasyonu'],
      knownRisks: ['Veri kalitesi'],
      openQuestions: [],
      userConfirmed: false
    }
  };
  const preview = previewIdeaPlanConversion(project);
  const converted = applyIdeaPlanConversion(project, preview);
  assert.equal(converted.success, true);
  return converted.project;
}

describe('Plan gereksinim inceleme yüzeyi', () => {
  it('donusum sonrasi her taslagi karar bekleyen bir kart olarak listeler', () => {
    const project = convertedProject();
    const review = selectPlanRequirementReview(project);

    assert.equal(review.cards.length, project.requirements.length);
    assert.ok(review.cards.length > 0, 'dönüşüm taslak üretmiş olmalı');
    assert.ok(review.cards.every(card => card.status === 'draft'));
    assert.ok(review.cards.every(card => card.decidable && card.editable));
    assert.deepEqual(
      review.cards.map(card => card.title),
      project.requirements.map(item => item.title)
    );
    assert.equal(review.draftCount, project.requirements.length);
    assert.equal(review.acceptedCount, 0);
    assert.equal(review.acceptedMustCount, 0);
    assert.equal(review.taskCompilationOpen, false);
    assert.equal(review.sectionSatisfied, false);
  });

  it('kart ifadesini, onceligini ve kabul kriterlerini oldugu gibi tasir', () => {
    const project = convertedProject();
    const [card] = selectPlanRequirementReview(project).cards;
    const [requirement] = project.requirements;

    assert.equal(card.id, requirement.id);
    assert.equal(card.statement, requirement.statement);
    assert.equal(card.priority, requirement.priority);
    assert.equal(card.kind, requirement.kind);
    assert.deepEqual(card.acceptanceCriteria, requirement.acceptanceCriteria);
    assert.equal(card.priorityLabel, 'Olmazsa olmaz');
    assert.equal(card.statusLabel, 'Karar bekliyor');
  });

  it('kabul edilen gereksinim gorev uretimini VE bolumu acar', () => {
    const project = convertedProject();
    const target = project.requirements.find(item => item.priority === 'must');
    assert.ok(target);
    const accepted = acceptRequirementDraft(project, target.id);
    const review = selectPlanRequirementReview(accepted);

    assert.equal(review.acceptedCount, 1);
    assert.equal(review.acceptedMustCount, 1);
    assert.equal(review.taskCompilationOpen, true);
    // TUZAK: serbest metin kutusu BOŞ olduğu hâlde bölüm "boş gerekli bölüm"
    // değildir; `acceptRequirementDraft` ifadeyi `sections.requirements.items`
    // içine yazar ve readiness-service o listeyi de sayar.
    assert.equal(accepted.sections.requirements.content, '');
    assert.equal(review.sectionSatisfied, true);
    assert.ok(compileTaskPlan(accepted).tasks.length > 0);
  });

  it('kabul edilen kart karar dugmelerini KAPATIR ve karar bekleyenler one gecer', () => {
    const project = convertedProject();
    const first = project.requirements[0];
    const accepted = acceptRequirementDraft(project, first.id);
    const review = selectPlanRequirementReview(accepted);

    // Karar bekleyen kartlar önce gelir: kullanıcının işi olan kart listenin
    // başındadır, bitmiş olanlar altta birikir.
    assert.deepEqual(review.cards.map(card => card.status), ['draft', 'accepted']);
    const acceptedCard = review.cards.find(card => card.id === first.id);
    assert.ok(acceptedCard);
    assert.equal(acceptedCard.decidable, false);
    assert.equal(acceptedCard.editable, false);
    assert.equal(acceptedCard.statusLabel, 'Kabul edildi');
  });

  it('hic gereksinim yokken bos liste ve yol gosteren bir ipucu dondurur', () => {
    const project = createProjectDocument({ idea: 'Küçük bir not uygulaması yapmak istiyorum.' });
    const review = selectPlanRequirementReview(project);

    assert.deepEqual(review.cards, []);
    assert.equal(review.draftCount, 0);
    assert.equal(review.taskCompilationOpen, false);
    assert.equal(review.sectionSatisfied, false);
    assert.ok(review.hint.length > 0);
  });
});
