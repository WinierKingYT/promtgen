import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { invalidationImpact } from '../../../src/v4/application/invalidation-graph.js';
import { normalizeConcern, normalizeConcernDecision } from '../../../src/v4/application/concerns.js';
import { createProjectDocument } from '../../../src/v4/project-document.js';
import { normalizeProjectDocument } from '../../../src/v4/canonical-entities.js';
import type { Decision, ProjectDocumentV5 } from '../../../src/v4/contracts.js';

function decision(overrides: Partial<Decision>): Decision {
  return {
    id: 'd', title: 'Karar', decision: 'Karar', rationale: '', alternatives: [], consequences: [],
    status: 'accepted', sourceSuggestionId: '', affectedSectionIds: [], ...overrides
  };
}

/**
 * Tam zincir:
 *   ic-stamina (konu) → dec-stamina (fikir kararı)
 *     → dec-runtime (teknik karar, kanıtı dec-stamina)
 *       → req-1 (traceLink)
 *         → task-1 → test-1
 */
function chainProject(): ProjectDocumentV5 {
  const document = createProjectDocument({ idea: 'Unity’de at sistemi' }) as ProjectDocumentV5;

  document.ideaDesign.concerns = [normalizeConcern({ id: 'ic-stamina', title: 'Stamina', status: 'decided' })];
  document.ideaDesign.concernDecisions = [normalizeConcernDecision({
    id: 'cd-stamina', concernId: 'ic-stamina', answer: 'Sürekli tüketim', decisionId: 'dec-stamina'
  })];

  document.decisions = [
    decision({ id: 'dec-stamina', stage: 'idea', title: 'Stamina sürekli tükenir' }),
    decision({
      id: 'dec-runtime',
      stage: 'technical',
      title: 'Runtime state bileşeni',
      evidence: { ideaDecisionIds: ['dec-stamina'], ideaConcernIds: [] }
    })
  ];

  document.requirements = [{
    id: 'req-1', title: 'Stamina azalır', statement: 'At koşarken stamina azalır.',
    kind: 'functional', priority: 'must', acceptanceCriteria: ['Koşarken stamina düşer'],
    sourceObjectiveIds: [], sourceSuggestionIds: [], status: 'accepted'
  }];
  document.traceLinks = [
    { id: 'tl-1', fromType: 'decision', fromId: 'dec-runtime', toType: 'requirement', toId: 'req-1', relation: 'drives' }
  ];
  document.tasks = [{
    id: 'task-1', title: 'Stamina bileşeni', description: '', status: 'ready', priority: 'must',
    effort: 'medium', dependencies: [], requirementIds: ['req-1'], acceptanceCriteria: [],
    verificationIds: ['test-1'], contract: document.tasks[0]?.contract as never
  }];
  document.testCases = [{
    id: 'test-1', title: 'Stamina düşer', kind: 'unit', preconditions: [], steps: [],
    expectedResult: 'Stamina düşer', requirementIds: ['req-1'], status: 'ready'
  }];

  return document;
}

describe('Geçersizleştirme grafiği', () => {
  it('fikir karari degisince tum zincir bulunur', () => {
    // "Atın sürekli stamina tüketmesini kaldırmak istiyorum" dendiğinde
    // sistem neyin bayatladığını bilmeli.
    const impact = invalidationImpact(chainProject(), 'dec-stamina');

    assert.deepEqual(impact.concernIds, ['ic-stamina']);
    assert.deepEqual(impact.technicalDecisionIds, ['dec-runtime']);
    assert.deepEqual(impact.requirementIds, ['req-1']);
    assert.deepEqual(impact.taskIds, ['task-1']);
    assert.deepEqual(impact.testCaseIds, ['test-1']);
  });

  it('kendini geçersizleştiren karar listeye girmez', () => {
    // Gerçek durum: teknik karar bir teknik konuyu çözüyor VE gerekçesinde o
    // konuyu gösteriyor. Kendini dışlamasak, kullanıcı değiştirdiği kararı
    // "gözden geçirilmeli" listesinde görürdü — kendi kendini işaret eden bir
    // uyarı.
    const document = chainProject();
    document.solutionDesign.concerns = [normalizeConcern({ id: 'tc-runtime', title: 'Runtime', status: 'decided' })];
    document.solutionDesign.concernDecisions = [normalizeConcernDecision({
      id: 'cd-r', concernId: 'tc-runtime', answer: 'MonoBehaviour', decisionId: 'dec-runtime'
    })];
    document.decisions[1] = decision({
      id: 'dec-runtime', stage: 'technical',
      evidence: { ideaDecisionIds: [], ideaConcernIds: ['tc-runtime'] }
    });

    const impact = invalidationImpact(document, 'dec-runtime');

    assert.deepEqual(impact.concernIds, ['tc-runtime']);
    assert.deepEqual(impact.technicalDecisionIds, []);
  });

  it('fikir KONUSU uzerinden dayanan teknik karar da bulunur', () => {
    const document = chainProject();
    document.decisions[1] = decision({
      id: 'dec-runtime', stage: 'technical',
      evidence: { ideaDecisionIds: [], ideaConcernIds: ['ic-stamina'] }
    });

    assert.deepEqual(invalidationImpact(document, 'dec-stamina').technicalDecisionIds, ['dec-runtime']);
  });

  it('ilgisiz karar zincire girmez', () => {
    const document = chainProject();
    document.decisions.push(decision({
      id: 'dec-ilgisiz', stage: 'technical',
      evidence: { ideaDecisionIds: ['dec-baska'], ideaConcernIds: [] }
    }));

    assert.deepEqual(invalidationImpact(document, 'dec-stamina').technicalDecisionIds, ['dec-runtime']);
  });

  it('kaniti olmayan teknik karar tahminle zincire eklenmez', () => {
    // Benzerlik tahmini kullanılsaydı "5 görev geçersiz" cümlesi güvenilmez
    // olurdu; kullanıcı ona bakarak karar veriyor.
    const document = chainProject();
    document.decisions.push(decision({ id: 'dec-kanitsiz', stage: 'technical', title: 'Stamina bileşeni' }));

    assert.deepEqual(invalidationImpact(document, 'dec-stamina').technicalDecisionIds, ['dec-runtime']);
  });

  it('gorevin dogruladigi test, gereksinime bagli olmasa bile bulunur', () => {
    const document = chainProject();
    document.testCases[0].requirementIds = [];

    assert.deepEqual(invalidationImpact(document, 'dec-stamina').testCaseIds, ['test-1']);
  });

  it('bos kimlik bos etki dondurur, cokmez', () => {
    assert.deepEqual(invalidationImpact(chainProject(), '').lines, []);
  });

  it('hicbir ize sahip olmayan karar sessiz kalir', () => {
    assert.deepEqual(invalidationImpact(chainProject(), 'dec-hic').lines, []);
  });
});

describe('Etki cümleleri', () => {
  it('sayilar cumlelerle bildirilir - yuzde yok', () => {
    const lines = invalidationImpact(chainProject(), 'dec-stamina').lines;

    assert.deepEqual(lines, [
      '1 teknik karar gözden geçirilmeli.',
      '1 gereksinim bayatlamış olabilir.',
      '1 görev geçersiz.',
      '1 test yeniden ele alınmalı.'
    ]);
  });

  it('sifir olan kategori icin cumle uretilmez', () => {
    const document = chainProject();
    document.tasks = [];
    document.testCases = [];

    const lines = invalidationImpact(document, 'dec-stamina').lines;

    assert.ok(!lines.some(line => /görev|test/.test(line)));
  });

  it('fiiller kesinlik derecesine gore farklidir', () => {
    const lines = invalidationImpact(chainProject(), 'dec-stamina').lines;

    // Teknik kararın kendisi hâlâ doğru olabilir; görevin öncülü kalmadı.
    assert.match(lines[0], /gözden geçirilmeli/);
    assert.match(lines[2], /geçersiz/);
  });
});

describe('Kanıt kalıcılıktan sağ çıkar', () => {
  it('normallestirme evidence alanini DUSURMEZ', () => {
    // Bu düşerse geçersizleştirme grafiği tamamen kör olur: kenarların hepsi
    // `evidence` üzerinden kuruluyor. Bellekte kurulan belgeyle test etmek bu
    // boşluğu göremezdi — kayıt/yükleme yolundan geçmek gerekiyor.
    const stored = normalizeProjectDocument(chainProject()) as ProjectDocumentV5;

    const technical = stored.decisions.find(item => item.id === 'dec-runtime');
    assert.deepEqual(technical?.evidence?.ideaDecisionIds, ['dec-stamina']);
    assert.deepEqual(invalidationImpact(stored, 'dec-stamina').technicalDecisionIds, ['dec-runtime']);
  });

  it('normallestirme rejectedAlternatives alanini DUSURMEZ', () => {
    // Bu düşerse karar bir ADR olmaktan çıkar: neyin neden seçilmediği kaybolur.
    const document = chainProject();
    document.decisions[1] = {
      ...document.decisions[1],
      rejectedAlternatives: [{ candidateId: 'c1', title: 'Bulut kayıt', reason: 'Çevrimdışı oynanışı bozar.' }]
    };

    const stored = normalizeProjectDocument(document) as ProjectDocumentV5;

    assert.deepEqual(stored.decisions.find(item => item.id === 'dec-runtime')?.rejectedAlternatives, [
      { candidateId: 'c1', title: 'Bulut kayıt', reason: 'Çevrimdışı oynanışı bozar.' }
    ]);
  });

  it('kaniti olmayan ESKI karar bos kanit uydurmaz', () => {
    const document = chainProject();
    delete document.decisions[1].evidence;

    const stored = normalizeProjectDocument(document) as ProjectDocumentV5;

    assert.equal('evidence' in stored.decisions.find(item => item.id === 'dec-runtime')!, false);
  });
});
