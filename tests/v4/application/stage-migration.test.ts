import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyLegacyDecision,
  framingFromLegacy,
  migrateToStageModel
} from '../../../src/v4/application/stage-migration.js';
import { normalizeProjectDocument } from '../../../src/v4/canonical-entities.js';
import { createProjectDocument } from '../../../src/v4/project-document.js';
import type { Decision, ProjectDocumentV5 } from '../../../src/v4/contracts.js';

function decision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: 'd1', title: 'Karar', decision: 'Karar', rationale: '', alternatives: [], consequences: [],
    status: 'accepted', sourceSuggestionId: '', affectedSectionIds: [], ...overrides
  };
}

/** V3 öncesi bir belge: aşama alanları hiç yok. */
function legacyProject(overrides: Partial<ProjectDocumentV5> = {}): ProjectDocumentV5 {
  const document = createProjectDocument({ idea: 'Unity ile at sistemi yapmak istiyorum' }) as ProjectDocumentV5;
  return { ...document, ...overrides };
}

describe('Eski kararların sınıflandırılması', () => {
  it('yalniz fikir bolumlerine dokunan karar FIKIR karari olur', () => {
    assert.equal(classifyLegacyDecision(decision({ affectedSectionIds: ['scope', 'objectives'] })), 'idea');
  });

  it('yalniz teknik bolumlere dokunan karar TEKNIK karar olur', () => {
    assert.equal(classifyLegacyDecision(decision({ affectedSectionIds: ['architecture', 'security'] })), 'technical');
  });

  it('karisik karar SINIFLANDIRILMAZ', () => {
    // İkisinin arasında kalan bir kararı bir tarafa itmek, kullanıcının
    // vermediği bir kararı ona atfetmek olur.
    assert.equal(
      classifyLegacyDecision(decision({ affectedSectionIds: ['scope', 'architecture'] })),
      'legacy-unclassified'
    );
  });

  it('bolum bildirmeyen karar SINIFLANDIRILMAZ', () => {
    assert.equal(classifyLegacyDecision(decision({ affectedSectionIds: [] })), 'legacy-unclassified');
  });

  it('bilinmeyen bolum adi tahminle idealestirilmez', () => {
    assert.equal(classifyLegacyDecision(decision({ affectedSectionIds: ['bilinmeyen'] })), 'legacy-unclassified');
  });

  it('zaten siniflandirilmis karar TAHMINLE EZILMEZ', () => {
    // Göç, mevcut bilgiyi kural tabanıyla değiştirmez.
    const already = decision({ stage: 'technical', affectedSectionIds: ['scope'] });

    assert.equal(classifyLegacyDecision(already), 'technical');
  });
});

describe('Çerçevelemenin türetilmesi', () => {
  it('alan fikir metninden cikarilir', () => {
    assert.equal(framingFromLegacy(legacyProject()).domain, 'game');
  });

  it('cikarilamayan alan BOS kalir, "genel" yazilmaz', () => {
    // `general`, sınıflandırıcının "bilmiyorum"u; onu etiket gibi yazmak
    // yapılmamış bir tespiti yapılmış göstermek olurdu.
    const document = legacyProject();
    document.identity.originalIdea = 'Bir şeyler yapmak istiyorum';

    assert.equal(framingFromLegacy(document).domain, '');
  });

  it('tur her zaman "unknown" kalir - hic sorulmadi', () => {
    assert.equal(framingFromLegacy(legacyProject()).kind, 'unknown');
  });

  it('kaynak her zaman "inferred" - goc onay uretmez', () => {
    // `confirmed` yazsaydık koç ilk soruyu atlar ve kullanıcı hiç sorulmayan
    // bir soruya "cevap vermiş" sayılırdı.
    assert.equal(framingFromLegacy(legacyProject()).source, 'inferred');
  });

  it('kullanicinin ONAYLADIGI cerceveleme ezilmez', () => {
    const document = legacyProject();
    document.ideaDesign.framing = { kind: 'feature', domain: 'commerce', environment: 'web', source: 'confirmed' };

    assert.deepEqual(framingFromLegacy(document), document.ideaDesign.framing);
  });
});

describe('Belgenin göçü', () => {
  it('kararlar asamalara yerlesir ve rapor edilir', () => {
    const document = legacyProject();
    document.decisions = [
      decision({ id: 'd-fikir', affectedSectionIds: ['scope'] }),
      decision({ id: 'd-teknik', affectedSectionIds: ['architecture'] }),
      decision({ id: 'd-belirsiz', affectedSectionIds: [] })
    ];

    const { project, report } = migrateToStageModel(document);

    assert.deepEqual(report.idea, ['d-fikir']);
    assert.deepEqual(report.technical, ['d-teknik']);
    assert.deepEqual(report.unclassified, ['d-belirsiz']);
    assert.equal(project.decisions[2].stage, 'legacy-unclassified');
  });

  it('siniflandirilamayanlar KULLANICIYA soylenir', () => {
    // Görünmez kalırlarsa kullanıcı onların var olduğunu hiç öğrenemez.
    const document = legacyProject();
    document.decisions = [decision({ id: 'd', affectedSectionIds: [] })];

    const { report } = migrateToStageModel(document);

    assert.ok(report.notes.some(note => /belirlenemedi/.test(note)));
  });

  it('eski teknik yaklasimlar not olarak tasinir, karar sayilmaz', () => {
    const document = legacyProject();
    document.ideaLabSession = {
      ...(document.ideaLabSession || {}),
      conceptSummary: { technicalApproaches: ['ScriptableObject kullan', 'Animator kullan'] }
    } as never;

    const { project, report } = migrateToStageModel(document);

    assert.deepEqual(project.solutionDesign.legacyApproaches, ['ScriptableObject kullan', 'Animator kullan']);
    // Not: taşındı ama canonical karar sayısı artmadı.
    assert.deepEqual(report.technical, []);
  });

  it('tekrar eden eski yaklasim iki kez tasinmaz', () => {
    const document = legacyProject();
    document.ideaLabSession = {
      ...(document.ideaLabSession || {}),
      conceptSummary: { technicalApproaches: ['Animator', 'Animator'] }
    } as never;

    assert.deepEqual(migrateToStageModel(document).project.solutionDesign.legacyApproaches, ['Animator']);
  });

  it('goc girdiyi DEGISTIRMEZ', () => {
    const document = legacyProject();
    document.decisions = [decision({ id: 'd', affectedSectionIds: ['scope'] })];
    const before = JSON.stringify(document);

    migrateToStageModel(document);

    assert.equal(JSON.stringify(document), before);
  });

  it('revizyon gecmisi kaybedilmez', () => {
    const document = legacyProject();
    const before = JSON.stringify(document.revisions);

    const { project } = migrateToStageModel(document);

    assert.equal(JSON.stringify(project.revisions), before);
  });

  it('goc iki kez calisirsa sonuc degismez', () => {
    const document = legacyProject();
    document.decisions = [decision({ id: 'd', affectedSectionIds: ['architecture'] })];

    const once = migrateToStageModel(document).project;
    const twice = migrateToStageModel(once).project;

    assert.deepEqual(twice, once);
  });
});

describe('Normalleştirme ile birlikte', () => {
  it('V3 alanlari hic olmayan belge yuklenince cokmez ve gocebilir', () => {
    // Diskteki gerçek eski belge: `ideaDesign` anahtarı hiç yok.
    const raw = legacyProject();
    delete (raw as Partial<ProjectDocumentV5>).ideaDesign;
    delete (raw as Partial<ProjectDocumentV5>).solutionDesign;

    const normalized = normalizeProjectDocument(raw) as ProjectDocumentV5;
    const { project, report } = migrateToStageModel(normalized);

    assert.equal(project.ideaDesign.framing.source, 'inferred');
    assert.deepEqual(project.solutionDesign.legacyApproaches, []);
    assert.deepEqual(report.notes, []);
  });
});
