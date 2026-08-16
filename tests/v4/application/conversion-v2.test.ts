import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyStageScopeToPlan,
  conversionSources,
  stageConversionBlockers,
  stageWorkAvailable,
  usesStageModel
} from '../../../src/v4/application/conversion-v2.js';
import { applyIdeaPlanConversion, previewIdeaPlanConversion } from '../../../src/v4/application/idea-plan-conversion-service.js';
import { normalizeConcern, normalizeConcernDecision } from '../../../src/v4/application/concerns.js';
import { createProjectDocument } from '../../../src/v4/project-document.js';
import type { Concern, Decision, ProjectDocumentV5 } from '../../../src/v4/contracts.js';

const APPROVED = {
  status: 'approved' as const,
  approvedAtRevision: 3,
  approvedAt: '2026-08-16T00:00:00.000Z',
  reopenedReason: null
};

function legacyProject(): ProjectDocumentV5 {
  // V3 öncesi belge: hiç concern yok, iki onay da `draft`.
  return createProjectDocument({ idea: 'Saha envanter uygulaması' }) as ProjectDocumentV5;
}

function stageProject(options: { idea?: boolean; solution?: boolean; concerns?: Partial<Concern>[] } = {}): ProjectDocumentV5 {
  const document = legacyProject();
  document.ideaDesign.concerns = (options.concerns ?? [{ id: 'ic', title: 'Sahiplik', status: 'decided' }])
    .map((item, index) => normalizeConcern(item, index));
  document.ideaDesign.concernDecisions = document.ideaDesign.concerns
    .filter(concern => concern.status === 'decided')
    .map((concern, index) => normalizeConcernDecision({ id: `cd-${index}`, concernId: concern.id, answer: 'Cevap' }, index));
  if (options.idea !== false) document.ideaDesign.approval = { ...APPROVED };
  if (options.solution) document.solutionDesign.approval = { ...APPROVED };
  return document;
}

describe('Aşama modeline girmiş mi', () => {
  it('bos V3 alanlariyla dogan belge henuz asama modelinde degildir', () => {
    assert.equal(usesStageModel(legacyProject()), false);
  });

  it('konu KESFEDILMIS olmasi yetmez - sistem onerdi, kullanici girmedi', () => {
    // Bunu ölçüt saysaydık, kullanıcı tek bir keşif turu çalıştırdığı anda
    // ürünün akışı altından değişir ve planı iki yeni onayın ardında bulurdu.
    const document = legacyProject();
    document.ideaDesign.concerns = [normalizeConcern({ id: 'ic', title: 'Sahiplik', status: 'open' })];

    assert.equal(usesStageModel(document), false);
    assert.deepEqual(stageConversionBlockers(document), []);
  });

  it('konu karara baglanmissa asama modelindedir', () => {
    assert.equal(usesStageModel(stageProject({ idea: false })), true);
  });

  it('ERTELEMEK de bir eylemdir', () => {
    const document = legacyProject();
    document.ideaDesign.concerns = [normalizeConcern({ id: 'ic', title: 'Zırh', status: 'deferred' })];

    assert.equal(usesStageModel(document), true);
  });

  it('onay sureci baslamissa da asama modelindedir', () => {
    const document = legacyProject();
    document.ideaDesign.approval = { ...APPROVED, status: 'review' };

    assert.equal(usesStageModel(document), true);
  });
});

describe('Conversion V2 kapısı', () => {
  it('ESKI belge kapiya takilmaz - goc cezaya cevrilmez', () => {
    // Kapıyı eski belgelere uygulasaydık, çalışan her mevcut proje bir anda
    // dönüştürülemez hâle gelirdi.
    assert.deepEqual(stageConversionBlockers(legacyProject()), []);
  });

  it('fikir onaylanmadan plan uretilemez', () => {
    const blockers = stageConversionBlockers(stageProject({ idea: false }));

    assert.equal(blockers.length, 1);
    assert.match(blockers[0], /Fikir tasarımı onaylanmadan/);
  });

  it('fikir tarafinda engel varsa ONCE o bildirilir', () => {
    // Sırası gelmemiş bir işi göstermek kullanıcıyı yanlış yere gönderir.
    // Kullanıcı bir konuyu karara bağlayarak yola girmiş, ama başka bir
    // kritik konu hâlâ açık.
    const blockers = stageConversionBlockers(stageProject({
      idea: false,
      concerns: [
        { id: 'ic-verilmis', title: 'Sahiplik', status: 'decided' },
        { id: 'ic-acik', title: 'Kayıt', importance: 'critical', status: 'open' }
      ]
    }));

    assert.match(blockers[0], /Fikir tasarımında 1 engel/);
  });

  it('teknik onay alinmadan plan uretilemez', () => {
    const blockers = stageConversionBlockers(stageProject());

    assert.equal(blockers.length, 1);
    assert.match(blockers[0], /Teknik çözüm tasarımı onaylanmadan/);
  });

  it('iki kapi da gecilince engel kalmaz', () => {
    assert.deepEqual(stageConversionBlockers(stageProject({ solution: true })), []);
  });

  it('kapi gercek donusum onizlemesinde gorunur', () => {
    // Modül tek başına doğru olup akışa bağlanmamış olabilirdi.
    const preview = previewIdeaPlanConversion(stageProject({ idea: false }));

    assert.equal(preview.canConvert, false);
    assert.ok(preview.blockers.some(blocker => /Fikir tasarımı onaylanmadan/.test(blocker)));
  });
});

describe('Dönüşüm kaynakları', () => {
  function decision(overrides: Partial<Decision>): Decision {
    return {
      id: 'd', title: 'K', decision: 'K', rationale: '', alternatives: [], consequences: [],
      status: 'accepted', sourceSuggestionId: '', affectedSectionIds: [], ...overrides
    };
  }

  it('fikir ve teknik kararlar ayri ayri toplanir', () => {
    const document = stageProject({ solution: true });
    document.decisions = [
      decision({ id: 'd-idea', stage: 'idea' }),
      decision({ id: 'd-tech', stage: 'technical' }),
      decision({ id: 'd-eski', stage: 'legacy-unclassified' })
    ];

    const sources = conversionSources(document);

    assert.deepEqual(sources.ideaDecisionIds, ['d-idea']);
    assert.deepEqual(sources.technicalDecisionIds, ['d-tech']);
  });

  it('kabul edilmemis karar plana tasinmaz', () => {
    const document = stageProject({ solution: true });
    document.decisions = [decision({ id: 'd-idea', stage: 'idea', status: 'proposed' })];

    assert.deepEqual(conversionSources(document).ideaDecisionIds, []);
  });

  it('"bu projeye ait degil" denen konu KAPSAM DISI olarak tasinir', () => {
    // Kapsam disiplini bir çıktıdır: elenen şey de değerli bir sonuçtur.
    const document = stageProject({ concerns: [{ id: 'ic', title: 'Genetik', status: 'irrelevant' }] });

    assert.deepEqual(conversionSources(document).outOfScope, ['Genetik']);
  });

  it('ertelenen konu kaybolmaz', () => {
    const document = stageProject({ concerns: [{ id: 'ic', title: 'Yetiştirme', status: 'deferred' }] });

    assert.deepEqual(conversionSources(document).deferred, ['Yetiştirme']);
  });

  it('teknik taraftaki ertelenenler de sayilir', () => {
    const document = stageProject({ solution: true });
    document.solutionDesign.concerns = [normalizeConcern({ id: 'tc', title: 'Önbellek', status: 'deferred' })];

    assert.deepEqual(conversionSources(document).deferred, ['Önbellek']);
  });

  it('iki asamanin acik sorulari birlikte doner', () => {
    const document = stageProject({ solution: true });
    document.ideaDesign.openQuestions = ['Kaç kullanıcı?'];
    document.solutionDesign.openQuestions = ['Hangi cihaz?'];

    assert.deepEqual(conversionSources(document).openQuestions, ['Kaç kullanıcı?', 'Hangi cihaz?']);
  });
});

describe('Panel ne zaman görünür', () => {
  it('cevaplanacak konu varken gorunur - kullanici o yola BOYLE girer', () => {
    // Girmiş olmasını beklemek, kapıyı ardından kilitlemek olurdu.
    const document = legacyProject();
    document.ideaDesign.concerns = [normalizeConcern({ id: 'ic', title: 'Sahiplik', status: 'open' })];

    assert.equal(usesStageModel(document), false);
    assert.equal(stageWorkAvailable(document), true);
  });

  it('hic konu yokken gorunmez - bos form neyi cevapladigini anlatmaz', () => {
    assert.equal(stageWorkAvailable(legacyProject()), false);
  });

  it('teknik konu da paneli acar', () => {
    const document = legacyProject();
    document.solutionDesign.concerns = [normalizeConcern({ id: 'tc', title: 'Depolama', status: 'open' })];

    assert.equal(stageWorkAvailable(document), true);
  });
});

describe('Kapsam kararları plana ulaşır', () => {
  it('kapsam disi ve ertelenen AYRI yazilir', () => {
    // "Sonra" geri dönülebilir bir karardır, "ait değil" değil. İkisini aynı
    // listeye koymak, kullanıcının verdiği iki farklı kararı tek karara
    // indirgerdi.
    const document = stageProject({
      solution: true,
      concerns: [
        { id: 'a', title: 'Genetik', status: 'irrelevant' },
        { id: 'b', title: 'Yetiştirme', status: 'deferred' }
      ]
    });

    const content = applyStageScopeToPlan(document).sections.scope.content;

    assert.ok(content.includes(['Kapsam dışı bırakılanlar:', '- Genetik'].join('\n')), content);
    assert.ok(content.includes(['Sonraya bırakılanlar:', '- Yetiştirme'].join('\n')), content);
  });

  it('mevcut kapsam metni KORUNUR', () => {
    const document = stageProject({ concerns: [{ id: 'a', title: 'Genetik', status: 'irrelevant' }] });
    document.sections.scope.content = 'MVP hedefi: ilk sürüm';

    assert.match(applyStageScopeToPlan(document).sections.scope.content, /^MVP hedefi: ilk sürüm/);
  });

  it('donusum tekrarlanirsa icerik COGALMAZ', () => {
    const document = stageProject({ concerns: [{ id: 'a', title: 'Genetik', status: 'irrelevant' }] });

    const once = applyStageScopeToPlan(document);
    const twice = applyStageScopeToPlan(once);

    assert.equal(twice.sections.scope.content, once.sections.scope.content);
  });

  it('kapsam karari yoksa plan DEGISMEZ', () => {
    const document = stageProject();

    assert.equal(applyStageScopeToPlan(document), document);
  });

  it('gercek donusum ciktisinda gorunur', () => {
    // Modül tek başına doğru olup akışa bağlanmamış olabilirdi.
    const document = stageProject({
      solution: true,
      concerns: [
        { id: 'a', title: 'Sahiplik', status: 'decided' },
        { id: 'b', title: 'Genetik', status: 'irrelevant' }
      ]
    });
    // Eski akışın kendi kapısı da doldurulur: bu test dönüşümün TAMAMINDAN
    // geçmeli, yoksa modülün akışa bağlı olduğunu kanıtlamaz.
    document.ideaLabSession = {
      ...(document.ideaLabSession || {}),
      conceptSummary: {
        summary: 'Saha ekibi için çevrimdışı envanter aracı.',
        targetUser: 'Sahada çalışan teknisyen',
        problemStatement: 'İnternetsiz ortamda envanter güncellenemiyor.',
        currentAlternative: 'Kâğıt form',
        desiredOutcome: 'Çevrimdışı kayıt ve sonradan senkronizasyon',
        mvpTarget: 'Tek cihazda çevrimdışı kayıt',
        confirmedFeatures: ['Çevrimdışı kayıt'],
        outOfScope: ['Çok kullanıcılı düzenleme'],
        technicalApproaches: [],
        openQuestions: [],
        knownRisks: [],
        interpretationConfidence: 80,
        confidenceRationale: [],
        userConfirmed: false
      }
    } as never;

    const result = applyIdeaPlanConversion(document, {
      baseDocumentRevision: document.documentRevision,
      baseCanonicalRevision: document.canonicalRevision
    });

    if (!result.success) {
      assert.fail(`dönüşüm başarısız: ${result.reason}`);
    }
    assert.match(result.project.sections.scope.content, /Genetik/);
  });
});
