import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createInitialConceptInterpretation } from '../../src/v4/application/idea-discussion-service.js';
import { generateConceptSummaryProject } from '../../src/v4/application/deterministic-idea-planning.js';
import { projectStageDataToConceptSummary } from '../../src/v4/application/conversion-v2.js';
import { normalizeConcern, normalizeConcernDecision } from '../../src/v4/application/concerns.js';
import { calculateReadiness } from '../../src/v4/application/readiness-service.js';
import { createProjectDocument } from '../../src/v4/project-document.js';
import type { ProjectDocumentV5 } from '../../src/v4/contracts.js';

function project(idea: string): ProjectDocumentV5 {
  return createProjectDocument({ idea }) as ProjectDocumentV5;
}

/**
 * ÖLÇÜLMÜŞ KUSURUN REGRESYON KİLİDİ.
 *
 * Canlı ölçümde kullanıcı "unityde bir at sistemi yapmak istiyorum multiplayer
 * olucak" dedi; sistem "Bulut senkronizasyonu ve çok kullanıcılı işbirliği"ni
 * KAPSAM DIŞI ilan etti. Bu, uydurmanın en tehlikeli biçimidir: uydurulmuş bir
 * kart görünür, sessizce dışlanmış bir gereksinim görünmez.
 *
 * Kural: sistem kullanıcı adına kapsam kararı VERMEZ. Boş bir "yapılmayacaklar"
 * listesi dürüsttür; uydurulmuş olan değil.
 */
describe('konsept yorumu kullanıcı adına kapsam kararı uydurmaz', () => {
  it('yeni projede outOfScope BOŞ doğar', () => {
    assert.deepEqual(createInitialConceptInterpretation(project('Saha envanter uygulaması')).outOfScope, []);
  });

  it('yeni projede confirmedFeatures BOŞ doğar', () => {
    // "Temel oynanış döngüsü" kullanıcının onayladığı bir özellik değil, alanın
    // genel şablonuydu. Alan adı `confirmedFeatures` -- kim onayladı? Kimse.
    assert.deepEqual(createInitialConceptInterpretation(project('Saha envanter uygulaması')).confirmedFeatures, []);
  });

  it('"multiplayer" diyen fikirde çok kullanıcılı çalışma kapsam dışına YAZILMAZ', () => {
    const summary = createInitialConceptInterpretation(
      project('unityde bir at sistemi yapmak istiyorum multiplayer olucak')
    );
    const excluded = summary.outOfScope.join(' | ').toLocaleLowerCase('tr-TR');

    assert.equal(
      /çok kullanıcılı|çok oyunculu|multiplayer|senkron/.test(excluded),
      false,
      `Kullanıcının açıkça istediği şey kapsam dışına yazıldı: ${JSON.stringify(summary.outOfScope)}`
    );
  });

  it('alanlar şekil olarak DURUR - yalnız içerik boşalır', () => {
    const summary = createInitialConceptInterpretation(project('Bir web paneli'));

    assert.ok(Array.isArray(summary.outOfScope));
    assert.ok(Array.isArray(summary.confirmedFeatures));
    assert.equal(summary.userConfirmed, false);
    // Uydurma OLMAYAN alanlar etkilenmez.
    assert.ok(summary.firstReleaseTarget.length > 0);
    assert.ok(summary.openQuestions.length > 0);
    assert.ok(summary.knownRisks.length > 0);
  });

  it('deterministik konsept üretimi de alan şablonundan kapsam dışı uydurmaz', () => {
    // `deterministic-idea-planning.ts` boş `initial.outOfScope` gördüğünde
    // `profile.outOfScope`a düşüyordu; bu, aynı uydurmanın bir katman aşağıda
    // devam etmesi demekti.
    const generated = generateConceptSummaryProject(project('Unityde çok oyunculu at sistemi'), 'approach-modular');
    const summary = generated.ideaLabSession?.conceptSummary;
    if (!summary) return assert.fail('conceptSummary yok');

    assert.deepEqual(summary.outOfScope, []);
  });

  it('deterministik konsept üretimi ŞABLON ÖZELLİKLERİNİ onaylanmış saymaz', () => {
    // `generatedFeatures` alan şablonundan (`CONCEPT_PROFILES[...].features`)
    // iki özellik alıp `confirmedFeatures`a yazıyordu. Kullanıcı bunları hiç
    // görmedi, hiç onaylamadı; alan adı ise "onaylandı" diyordu.
    const generated = generateConceptSummaryProject(project('Unityde çok oyunculu at sistemi'), 'approach-modular');
    const summary = generated.ideaLabSession?.conceptSummary;
    if (!summary) return assert.fail('conceptSummary yok');

    const confirmed = summary.confirmedFeatures.join(' | ');
    assert.equal(
      /Oyuncu kontrolü ve temel mekanikler|Sahne ve oyun döngüsü/.test(confirmed),
      false,
      `Alan şablonu onaylanmış özellik diye yazıldı: ${JSON.stringify(summary.confirmedFeatures)}`
    );
  });

  it('KULLANICININ SEÇTİĞİ yaklaşım korunur: o bir şablon değil, bir seçimdir', () => {
    const generated = generateConceptSummaryProject(project('Unityde çok oyunculu at sistemi'), 'approach-modular');
    const summary = generated.ideaLabSession?.conceptSummary;
    if (!summary) return assert.fail('conceptSummary yok');

    assert.equal(
      summary.confirmedFeatures.filter(feature => feature.startsWith('Temel mimari:')).length,
      1,
      `Seçilen yaklaşım satırı kaybolmamalı: ${JSON.stringify(summary.confirmedFeatures)}`
    );
  });
});

describe('kullanıcının GERÇEK kapsam kararı etkilenmez', () => {
  it('scopeSplit=confirmed kaydından gelen dışlama hâlâ outOfScope\'a taşınır', () => {
    const document = project('Bildirim gönderen saha uygulaması');
    document.ideaDesign.concerns = [normalizeConcern({ id: 'ic', title: 'Bildirim tercihi', status: 'decided' }, 0)];
    document.ideaDesign.concernDecisions = [
      normalizeConcernDecision(
        { id: 'cd-0', concernId: 'ic', answer: 'E-posta ile bildirim.', excluded: ['SMS yok.'], scopeSplit: 'confirmed' },
        0
      )
    ];
    document.ideaLabSession = {
      ...(document.ideaLabSession || { status: 'active', approaches: [], ideaNotes: [], candidateDecisions: [], candidateRisks: [] }),
      conceptSummary: createInitialConceptInterpretation(document)
    };

    const summary = projectStageDataToConceptSummary(document).ideaLabSession?.conceptSummary;
    if (!summary) return assert.fail('conceptSummary yok');

    // Kullanıcının kararı taşınır...
    assert.deepEqual(summary.outOfScope, ['SMS yok.']);
    // ...ve yanına hiçbir şablon dolgusu eklenmez.
    assert.ok(summary.confirmedFeatures.some(item => /E-posta ile bildirim/.test(item)), JSON.stringify(summary.confirmedFeatures));
  });

  it('hiç kapsam kararı yokken izdüşüm boş listeyle sorunsuz çalışır', () => {
    const document = project('Kapsam kararı verilmemiş proje');
    document.ideaDesign.concerns = [normalizeConcern({ id: 'ic', title: 'Sahiplik', status: 'decided' }, 0)];
    document.ideaDesign.concernDecisions = [
      normalizeConcernDecision({ id: 'cd-0', concernId: 'ic', answer: '', excluded: [], scopeSplit: 'confirmed' }, 0)
    ];
    document.ideaLabSession = {
      ...(document.ideaLabSession || { status: 'active', approaches: [], ideaNotes: [], candidateDecisions: [], candidateRisks: [] }),
      conceptSummary: createInitialConceptInterpretation(document)
    };

    const summary = projectStageDataToConceptSummary(document).ideaLabSession?.conceptSummary;
    if (!summary) return assert.fail('conceptSummary yok');

    assert.deepEqual(summary.outOfScope, []);
    assert.deepEqual(summary.confirmedFeatures, []);
  });
});

describe('boşaltma hazırlık kapılarını ZAYIFLATMAZ', () => {
  function gate(document: ProjectDocumentV5, id: string) {
    const found = calculateReadiness(document).readiness.checks.find(check => check.id === id);
    if (!found) return assert.fail(`${id} kapısı bulunamadı`);
    return found;
  }

  it('userConfirmed=false iken scope-in ve scope-out kapıları HÂLÂ geçmez', () => {
    const document = project('Unityde çok oyunculu at sistemi');
    document.ideaLabSession = {
      ...(document.ideaLabSession || { status: 'active', approaches: [], ideaNotes: [], candidateDecisions: [], candidateRisks: [] }),
      conceptSummary: createInitialConceptInterpretation(document)
    };

    assert.equal(gate(document, 'complete.scope-in').status, 'blocked');
    assert.equal(gate(document, 'complete.scope-out').status, 'blocked');
    assert.equal(gate(document, 'complete.scope-in').blocking, true);
    assert.equal(gate(document, 'complete.scope-out').blocking, true);
  });

  it('sabit dolgu kapıları zaten geçiremiyordu: onay verilse bile boş liste geçmez', () => {
    const document = project('Unityde çok oyunculu at sistemi');
    document.ideaLabSession = {
      ...(document.ideaLabSession || { status: 'active', approaches: [], ideaNotes: [], candidateDecisions: [], candidateRisks: [] }),
      conceptSummary: { ...createInitialConceptInterpretation(document), userConfirmed: true }
    };

    assert.equal(gate(document, 'complete.scope-in').status, 'blocked');
    assert.equal(gate(document, 'complete.scope-out').status, 'blocked');
  });

  it('kullanıcı gerçekten doldurup onayladığında kapılar geçer', () => {
    const document = project('Unityde çok oyunculu at sistemi');
    document.ideaLabSession = {
      ...(document.ideaLabSession || { status: 'active', approaches: [], ideaNotes: [], candidateDecisions: [], candidateRisks: [] }),
      conceptSummary: {
        ...createInitialConceptInterpretation(document),
        confirmedFeatures: ['At binme ve inme'],
        outOfScope: ['At yarışı modu'],
        userConfirmed: true
      }
    };

    assert.equal(gate(document, 'complete.scope-in').status, 'passed');
    assert.equal(gate(document, 'complete.scope-out').status, 'passed');
  });
});
