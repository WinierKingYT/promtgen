import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyStageScopeToPlan,
  projectStageDataToConceptSummary,
  conversionSources,
  stageConversionBlockers,
  stageWorkAvailable,
  usesStageModel
} from '../../../src/v4/application/conversion-v2.js';
import { applyIdeaPlanConversion, previewIdeaPlanConversion } from '../../../src/v4/application/idea-plan-conversion-service.js';
import { createRequirementDraftsFromConcept } from '../../../src/v4/application/requirement-quality-service.js';
import { normalizeConcern, normalizeConcernDecision } from '../../../src/v4/application/concerns.js';
import { answerConcern } from '../../../src/v4/application/stage-commands.js';
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
        firstReleaseTarget: 'Tek cihazda çevrimdışı kayıt',
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

describe('V3 yolu plana ULASIR', () => {
  it('asama verisi gereksinime donusur - pilotun durdurdugu nokta', () => {
    // Pilot bunu yakaladi: kullanici butun V3 yolunu yuruyor, iki onayi da
    // veriyor, sonra plan kapisinda ESKI modelin bambaska bir belge setini
    // isteyen bir duvara carpiyordu. Sonuc sifir gereksinimdi.
    const document = stageProject({
      solution: true,
      concerns: [
        { id: 'c1', title: 'Fatura kaydı', status: 'decided', whyItMatters: 'Temel akış.' },
        { id: 'c2', title: 'Muhasebe entegrasyonu', status: 'irrelevant' }
      ]
    });

    const preview = previewIdeaPlanConversion(document);

    assert.deepEqual(preview.blockers, []);
    assert.equal(preview.canConvert, true);

    const result = applyIdeaPlanConversion(document, {
      baseDocumentRevision: document.documentRevision,
      baseCanonicalRevision: document.canonicalRevision
    });
    if (!result.success) assert.fail(`dönüşüm başarısız: ${result.reason}`);
    assert.ok(result.project.requirements.length > 0, 'gereksinim üretilmedi');
  });

  it('izdusum UYDURMAZ: V3 sormadigi alanlari doldurmaz', () => {
    // targetUser / problemStatement / currentAlternative / desiredOutcome
    // V3'te hiç sorulmuyor. Kararlardan türetmek, kullanıcının hiç kurmadığı
    // cümleleri ona atfetmek olurdu.
    const projected = projectStageDataToConceptSummary(
      stageProject({ concerns: [{ id: 'c1', title: 'Fatura kaydı', status: 'decided' }] })
    );
    const summary = projected.ideaLabSession?.conceptSummary as Record<string, unknown>;

    for (const field of ['targetUser', 'problemStatement', 'currentAlternative', 'desiredOutcome']) {
      assert.ok(!summary[field], `${field} uydurulmuş`);
    }
    assert.ok((summary.confirmedFeatures as string[]).length > 0);
  });

  it('plana "undefined" yazilmaz', () => {
    const document = stageProject({
      solution: true,
      concerns: [{ id: 'c1', title: 'Fatura kaydı', status: 'decided', whyItMatters: 'Temel.' }]
    });

    const result = applyIdeaPlanConversion(document, {
      baseDocumentRevision: document.documentRevision,
      baseCanonicalRevision: document.canonicalRevision
    });
    if (!result.success) assert.fail(result.reason);

    assert.doesNotMatch(result.project.sections.scope.content, /undefined/);
    assert.doesNotMatch(result.project.sections.vision.content, /undefined/);
  });

  it('V3te kapsam disi birakmak ZORUNLU degildir', () => {
    // Eski modelde "en az bir şey kapsam dışı bırak" bir kuraldı. V3'te kapsam
    // dışı bir çıktıdır; hiçbir konuyu elemeden ikisini de karara bağlamak
    // meşru bir sonuçtur. Engel saysaydık kullanıcıyı, plan alabilmek için
    // uydurma bir kapsam dışı madde yazmaya zorlardık.
    const document = stageProject({
      solution: true,
      concerns: [{ id: 'c1', title: 'Fatura kaydı', status: 'decided', whyItMatters: 'Temel.' }]
    });

    assert.deepEqual(previewIdeaPlanConversion(document).blockers, []);
  });

  it('ONAYLANMIS TEK BIR SEY YOKSA plan yine uretilemez', () => {
    // Sınırın tamamen kalkmadığı burada görünür: her konusunu erteleyen bir
    // belge plana geçerse, sıfır gereksinimli bir plan sessizce üretilirdi —
    // pilotun yakaladığı hatanın ta kendisi.
    const document = stageProject({
      solution: true,
      concerns: [{ id: 'c1', title: 'Fatura kaydı', status: 'deferred' }]
    });

    assert.ok(previewIdeaPlanConversion(document).blockers.some(
      blocker => /confirmedFeatures/.test(blocker)
    ), JSON.stringify(previewIdeaPlanConversion(document).blockers));
  });

  it('ESKI belge hala eski kapiyi gecmek zorunda', () => {
    // Aşama modeline girmemiş belgede yorum alanları hâlâ isteniyor; kapı
    // gevşetilmiş değil, yalnız V3 belgesinde yerini iki onaya bırakıyor.
    const blockers = previewIdeaPlanConversion(legacyProject()).blockers;

    assert.ok(blockers.some(blocker => /alanı tamamlanmalı/.test(blocker)), JSON.stringify(blockers));
  });
});

describe('Dışlama cümleleri must gereksinime SIZMAZ (pilot BULGULAR.md)', () => {
  // Kök neden: `projectStageDataToConceptSummary` karara bağlanmış konunun
  // TÜM cevabını, cümle ayrımı yapmadan `confirmedFeatures`'a itiyordu.
  // "SMS yok." gibi olumsuz yan cümleler de böylece bir `must` gereksinimine
  // dönüşüyordu. Bu blok pilotun yakaladığı dört gerçek cevabı birebir kullanır.
  function decidedProject(answer: string): ProjectDocumentV5 {
    const document = legacyProject();
    document.ideaDesign.concerns = [normalizeConcern({ id: 'ic', title: 'Bildirim tercihi', status: 'decided' }, 0)];
    document.ideaDesign.concernDecisions = [
      normalizeConcernDecision({ id: 'cd-0', concernId: 'ic', answer }, 0)
    ];
    document.ideaDesign.approval = { ...APPROVED };
    return document;
  }

  function projectedSummary(answer: string) {
    const projected = projectStageDataToConceptSummary(decidedProject(answer));
    return projected.ideaLabSession?.conceptSummary as Record<string, unknown>;
  }

  it('durum 1: "Hatırlatma e-posta ile; SMS yok." — SMS reddi kapsam disina, e-posta onayi confirmedFeatures\'a gider', () => {
    const summary = projectedSummary('Hatırlatma e-posta ile; SMS yok.');
    const confirmedFeatures = summary.confirmedFeatures as string[];
    const outOfScope = summary.outOfScope as string[];

    assert.ok(confirmedFeatures.some(item => /Hatırlatma e-posta ile/.test(item)), JSON.stringify(confirmedFeatures));
    assert.ok(outOfScope.some(item => /SMS yok/.test(item)), JSON.stringify(outOfScope));
    assert.ok(!confirmedFeatures.some(item => /SMS yok/.test(item)), JSON.stringify(confirmedFeatures));
  });

  it('durum 2: "Ödeme tahsilatı kapsam dışı." — saf dislama, confirmedFeatures\'a hicbir sey eklenmez', () => {
    const summary = projectedSummary('Ödeme tahsilatı kapsam dışı.');
    const confirmedFeatures = summary.confirmedFeatures as string[];
    const outOfScope = summary.outOfScope as string[];

    assert.ok(outOfScope.some(item => /kapsam dışı/.test(item)), JSON.stringify(outOfScope));
    assert.ok(!confirmedFeatures.some(item => /Ödeme tahsilatı kapsam dışı/.test(item)), JSON.stringify(confirmedFeatures));
  });

  it('durum 3: "Sadece fatura kaydı ve hatırlatma; muhasebe entegrasyonu yok." — cıplak "yok." sonu da yakalanir', () => {
    const summary = projectedSummary('Sadece fatura kaydı ve hatırlatma; muhasebe entegrasyonu yok.');
    const confirmedFeatures = summary.confirmedFeatures as string[];
    const outOfScope = summary.outOfScope as string[];

    assert.ok(confirmedFeatures.some(item => /Sadece fatura kaydı ve hatırlatma/.test(item)), JSON.stringify(confirmedFeatures));
    assert.ok(outOfScope.some(item => /muhasebe entegrasyonu yok/.test(item)), JSON.stringify(outOfScope));
    assert.ok(!confirmedFeatures.some(item => /muhasebe entegrasyonu yok/.test(item)), JSON.stringify(confirmedFeatures));
  });

  it('durum 4: "Tek kullanıcı, ekip özelliği yok." — virgulle ayrilmis; dar-kapsamli son-segment istisnasi devreye girer', () => {
    // NOT: Bu, ";"/cümle sonu ile ayrılan durumlardan FARKLI bir biçim —
    // virgülle ayrılmış. Genel virgül bölme BİLEREK uygulanmıyor (virgül
    // meşru liste ayracı da olabilir). Yalnız şu dar/güvenli istisna var:
    // son virgül-sonrası segment TEK BAŞINA olumsuzlama kalıbıyla eşleşiyor
    // VE öndeki segment eşleşmiyorsa, yalnız o zaman ikiye bölünür.
    const summary = projectedSummary('Tek kullanıcı, ekip özelliği yok.');
    const confirmedFeatures = summary.confirmedFeatures as string[];
    const outOfScope = summary.outOfScope as string[];

    assert.ok(confirmedFeatures.some(item => /^Tek kullanıcı$/.test(item)), JSON.stringify(confirmedFeatures));
    assert.ok(outOfScope.some(item => /ekip özelliği yok/.test(item)), JSON.stringify(outOfScope));
  });

  it('durum 5 (regresyon - REGRESSION GUARD): "daha sonra" gecen MESRU bir gereksinim otomatik disa DUSMEZ', () => {
    // Bağımsız incelemenin yakaladığı GERÇEK regresyon: `discovery-answer-
    // service.ts`nin (insan onaylı, danışma amaçlı) OUT_OF_SCOPE_PATTERN'i
    // "daha sonra" gibi bağlama göre anlamı değişen kelimeler içeriyordu.
    // Bu cümlede "daha sonra" kapsam ertelemesi DEĞİL, bir iş akışı
    // sıralaması anlatıyor; otomatik-uygulanan yolda (inceleyen kimse yok)
    // bu kelimeyle eşleşip sessizce outOfScope'a düşmemeli.
    const summary = projectedSummary('Kullanıcılar daha sonra profillerini düzenleyebilir.');
    const confirmedFeatures = summary.confirmedFeatures as string[];
    const outOfScope = summary.outOfScope as string[];

    assert.ok(confirmedFeatures.some(item => /Kullanıcılar daha sonra profillerini düzenleyebilir/.test(item)), JSON.stringify(confirmedFeatures));
    assert.ok(!outOfScope.some(item => /daha sonra/.test(item)), JSON.stringify(outOfScope));
  });

  it('durum 6 (regresyon - REGRESSION GUARD): "olmayacak" gecen bir guvenilirlik gereksinimi otomatik disa DUSMEZ', () => {
    // Aynı regresyon sınıfı, "olmayacak" kelimesiyle: bu bir dışlama değil,
    // "asla olmasın" biçiminde ifade edilmiş bir güvenilirlik gereksinimi.
    const summary = projectedSummary('Sistem hiçbir zaman veri kaybı olmayacak şekilde tasarlanacak.');
    const confirmedFeatures = summary.confirmedFeatures as string[];
    const outOfScope = summary.outOfScope as string[];

    assert.ok(confirmedFeatures.some(item => /veri kaybı olmayacak/.test(item)), JSON.stringify(confirmedFeatures));
    assert.ok(!outOfScope.some(item => /veri kaybı olmayacak/.test(item)), JSON.stringify(outOfScope));
  });

  it('durum 7 (FIX): "Kesinti yok." TEK BASINA bir DEGISMEZ gereksinimdir, kapsam disi degil', () => {
    // Bagimsiz incelemenin yakaladigi hata: cevabin TEK ve BUTUN icerigi
    // ciplak "yok." ile bitince, eski kalip bunu dislama sayip SIFIR
    // gereksinim uretiyordu. "Kesinti yok." bir invariant gereksinimdir
    // ("no downtime"), kapsam disi birakma degil.
    const summary = projectedSummary('Kesinti yok.');
    const confirmedFeatures = summary.confirmedFeatures as string[];
    const outOfScope = summary.outOfScope as string[];

    assert.ok(confirmedFeatures.some(item => /Kesinti yok/.test(item)), JSON.stringify(confirmedFeatures));
    assert.ok(!outOfScope.some(item => /Kesinti yok/.test(item)), JSON.stringify(outOfScope));
  });

  it('durum 8 (FIX): "Mukerrer kayit yok." TEK BASINA bir DEGISMEZ gereksinimdir, kapsam disi degil', () => {
    // Ayni sinif: "no duplicate records" bir gereksinimdir, dislama degil.
    const summary = projectedSummary('Mükerrer kayıt yok.');
    const confirmedFeatures = summary.confirmedFeatures as string[];
    const outOfScope = summary.outOfScope as string[];

    assert.ok(confirmedFeatures.some(item => /Mükerrer kayıt yok/.test(item)), JSON.stringify(confirmedFeatures));
    assert.ok(!outOfScope.some(item => /Mükerrer kayıt yok/.test(item)), JSON.stringify(outOfScope));
  });

  it('uctan uca: hicbir must gereksinimi olumsuz yan cumleyi ifade olarak tasimaz', () => {
    const projected = projectStageDataToConceptSummary(decidedProject('Hatırlatma e-posta ile; SMS yok.'));
    const summary = projected.ideaLabSession?.conceptSummary;
    if (!summary) return assert.fail('conceptSummary yok');
    // Bu blok yalnız kural-tabanli izdusum + gereksinim uretimini test eder;
    // `confirmConceptSummary` (planning-engine.js) kapsam disinda tutulur.
    const withConfirmation = {
      ...projected,
      ideaLabSession: {
        ...projected.ideaLabSession,
        conceptSummary: { ...summary, userConfirmed: true }
      }
    } as ProjectDocumentV5;

    const withRequirements = createRequirementDraftsFromConcept(withConfirmation);
    const mustRequirements = withRequirements.requirements.filter(item => item.priority === 'must');

    assert.ok(mustRequirements.some(item => /Hatırlatma e-posta ile/.test(item.statement)), JSON.stringify(mustRequirements));
    assert.ok(!mustRequirements.some(item => /SMS yok/.test(item.statement)), JSON.stringify(mustRequirements));
  });
});

describe('MIMARI DUZELTME: kullanici sinir cizince kutupluluk cikarimi SIFIRDIR (scopeSplit=confirmed)', () => {
  // Bu blok, asagidaki "BILINEN SINIR - PIN" blokunun belgeledigi mimari
  // cozumun kendisidir: `ConcernDecision.excluded` / `scopeSplit` artik var.
  // Kullanici (ya da bu testte oldugu gibi onun adina kurulan kayit)
  // yapilacak (`answer`) ve yapilmayacak (`excluded`) yarilarini AYRI AYRI
  // verdiginde, sistem ARTIK hicbir anahtar kelime kalibi calistirmiyor -
  // `answer` yalnizca cumlelere bolunup confirmedFeatures'a, `excluded`
  // oldugu gibi outOfScope'a gidiyor. Asagidaki bes durum, PIN blokunun ve
  // "durum 7/8"in yakaladigi tum kaybi kapatir: ayni cumleler, tek fark
  // kullanicinin sinirini nereye yazdigi.
  function decidedProject(answer: string, excluded: string[]): ProjectDocumentV5 {
    const document = legacyProject();
    document.ideaDesign.concerns = [normalizeConcern({ id: 'ic', title: 'Bildirim tercihi', status: 'decided' }, 0)];
    document.ideaDesign.concernDecisions = [
      normalizeConcernDecision({ id: 'cd-0', concernId: 'ic', answer, excluded, scopeSplit: 'confirmed' }, 0)
    ];
    document.ideaDesign.approval = { ...APPROVED };
    return document;
  }

  function projectedSummary(answer: string, excluded: string[]) {
    const projected = projectStageDataToConceptSummary(decidedProject(answer, excluded));
    return projected.ideaLabSession?.conceptSummary as Record<string, unknown>;
  }

  it('"Kesinti yok. Mükerrer kayıt yok." + excluded [] -> IKI must, SIFIR outOfScope', () => {
    // PIN blokundaki en agir kayip biciminin (sifir gereksinim) duzeltilmis
    // hali: kullanici hicbir sey dislamadi, ikisi de degismez gereksinim.
    const summary = projectedSummary('Kesinti yok. Mükerrer kayıt yok.', []);
    const confirmedFeatures = summary.confirmedFeatures as string[];
    const outOfScope = summary.outOfScope as string[];

    assert.equal(confirmedFeatures.length, 2, JSON.stringify(confirmedFeatures));
    assert.ok(confirmedFeatures.some(item => /Kesinti yok/.test(item)), JSON.stringify(confirmedFeatures));
    assert.ok(confirmedFeatures.some(item => /Mükerrer kayıt yok/.test(item)), JSON.stringify(confirmedFeatures));
    assert.equal(outOfScope.length, 0, JSON.stringify(outOfScope));
  });

  it('"Hatırlatma e-posta ile." + excluded ["SMS yok."] -> BIR must, SMS yok. outOfScope\'ta', () => {
    const summary = projectedSummary('Hatırlatma e-posta ile.', ['SMS yok.']);
    const confirmedFeatures = summary.confirmedFeatures as string[];
    const outOfScope = summary.outOfScope as string[];

    assert.equal(confirmedFeatures.length, 1, JSON.stringify(confirmedFeatures));
    assert.ok(confirmedFeatures.some(item => /Hatırlatma e-posta ile/.test(item)), JSON.stringify(confirmedFeatures));
    assert.ok(outOfScope.includes('SMS yok.'), JSON.stringify(outOfScope));
  });

  it('"E-posta var. Push bildirim var." + excluded ["SMS yok."] -> IKI must, BIR dislama, hicbir must SMS icermez', () => {
    const summary = projectedSummary('E-posta var. Push bildirim var.', ['SMS yok.']);
    const confirmedFeatures = summary.confirmedFeatures as string[];
    const outOfScope = summary.outOfScope as string[];

    assert.equal(confirmedFeatures.length, 2, JSON.stringify(confirmedFeatures));
    assert.equal(outOfScope.length, 1, JSON.stringify(outOfScope));
    assert.ok(outOfScope.includes('SMS yok.'), JSON.stringify(outOfScope));
    assert.ok(!confirmedFeatures.some(item => /SMS/.test(item)), JSON.stringify(confirmedFeatures));
  });

  it('PIN durum 1 artik dogru: "SMS yok ama email var." tek cumlesi ayrildiginda dislama must\'a SIZMAZ', () => {
    // PIN'in ilk durumu ("SMS yok ama email var.") olumsuzlamanin cumle
    // ICINDE gomulu oldugu, ";"/cumle-sonuyla ayrilmadigi bir cumleydi;
    // anahtar-kelime yolu butun cumleyi tek parca sayip must'a gonderiyordu.
    // Mimari cozum bu belirsizligi ORTADAN KALDIRIR: kullanici artik ayni
    // cumleyi anahtar kelimeyle boldurmek yerine panelde iki ayri alana
    // yaziyor - onaylanan yari `answer`e ("Email var."), dislanan yari
    // `excluded`e ("SMS yok."). Sonuc: hicbir must "SMS" icermez.
    const summary = projectedSummary('Email var.', ['SMS yok.']);
    const confirmedFeatures = summary.confirmedFeatures as string[];
    const outOfScope = summary.outOfScope as string[];

    assert.ok(confirmedFeatures.some(item => /Email var/.test(item)), JSON.stringify(confirmedFeatures));
    assert.ok(outOfScope.includes('SMS yok.'), JSON.stringify(outOfScope));
    assert.ok(!confirmedFeatures.some(item => /SMS/.test(item)), JSON.stringify(confirmedFeatures));
  });

  it('"E-posta var, Push bildirim var." + excluded ["SMS yok."] -> ORTADAKI dislama artik SIZMAZ', () => {
    // PIN'in ikinci durumu: dislama SON sirada degildi, eski dar istisna
    // hicbir zaman devreye girmezdi. Kullanici siniri kendisi cizince sira
    // artik onemsiz - excluded ayri alanda geldigi icin dogru sekilde
    // outOfScope'a gidiyor ve hicbir must "SMS" icermiyor.
    const summary = projectedSummary('E-posta var, Push bildirim var.', ['SMS yok.']);
    const confirmedFeatures = summary.confirmedFeatures as string[];
    const outOfScope = summary.outOfScope as string[];

    assert.ok(confirmedFeatures.some(item => /E-posta var, Push bildirim var/.test(item)), JSON.stringify(confirmedFeatures));
    assert.ok(outOfScope.includes('SMS yok.'), JSON.stringify(outOfScope));
    assert.ok(!confirmedFeatures.some(item => /SMS/.test(item)), JSON.stringify(confirmedFeatures));
  });
});

describe('BILINEN SINIR - PIN: dislama son sirada/ayrik degilse yakalanmaz (yalniz scopeSplit=legacy-unsplit icin gecerli)', () => {
  // Bu blok artik BUG RAPORU degil - mimari cozum (yukaridaki
  // "MIMARI DUZELTME" blogu) LANDED: `ConcernDecision.excluded` / `scopeSplit`
  // eklendi ve `conversion-v2.ts` bunun uzerinden gate ediyor. Bu blok SU
  // ANDAN itibaren yalniz `scopeSplit: 'legacy-unsplit'` (bolunmemis, eski)
  // kayitlar icin belgelenen davranisi kilitler - yeni kayitlarda kullanici
  // sinir cizdiginde (`scopeSplit: 'confirmed'`) bu sinir hic olusmuyor (bkz.
  // yukaridaki blok). Kok neden hala dilsel, regex ile duzeltilmiyor:
  // `classifyDecidedAnswer` yalnizca `;`/satir sonuyla ayrilmis cumleleri
  // ve tek bir virgullu son-segment ciftini boler. Bu testler eski
  // (bolunmemis) kayitlar icin DEGISTIRILMEMELI - amaclari, birisi eski
  // yolun davranisini kotulestirirse haber vermek.
  function decidedProject(answer: string): ProjectDocumentV5 {
    const document = legacyProject();
    document.ideaDesign.concerns = [normalizeConcern({ id: 'ic', title: 'Bildirim tercihi', status: 'decided' }, 0)];
    document.ideaDesign.concernDecisions = [
      normalizeConcernDecision({ id: 'cd-0', concernId: 'ic', answer, scopeSplit: 'legacy-unsplit' }, 0)
    ];
    document.ideaDesign.approval = { ...APPROVED };
    return document;
  }

  function projectedSummary(answer: string) {
    const projected = projectStageDataToConceptSummary(decidedProject(answer));
    return projected.ideaLabSession?.conceptSummary as Record<string, unknown>;
  }

  it('PIN: "SMS yok ama email var." - olumsuzlama noktali virgul/cumle sonu OLMADAN gomulu, bolunmez', () => {
    const summary = projectedSummary('SMS yok ama email var.');
    const confirmedFeatures = summary.confirmedFeatures as string[];
    const outOfScope = summary.outOfScope as string[];

    // MEVCUT (kusurlu) davranis: butun cumle tek parca sayilip must'a gidiyor.
    assert.ok(confirmedFeatures.some(item => /SMS yok ama email var/.test(item)), JSON.stringify(confirmedFeatures));
    assert.equal(outOfScope.length, 0, JSON.stringify(outOfScope));
  });

  it('PIN: "E-posta var, SMS yok, push bildirim var." - dislama SON sirada degil, yakalanmaz', () => {
    const summary = projectedSummary('E-posta var, SMS yok, push bildirim var.');
    const confirmedFeatures = summary.confirmedFeatures as string[];
    const outOfScope = summary.outOfScope as string[];

    // MEVCUT (kusurlu) davranis: "SMS yok" ortada kaldigi icin dar
    // `trailingCommaExclusion` istisnasi devreye girmiyor, butun cumle
    // must'a giden confirmedFeatures'a tek parca olarak dusuyor.
    assert.ok(confirmedFeatures.some(item => /E-posta var, SMS yok, push bildirim var/.test(item)), JSON.stringify(confirmedFeatures));
    assert.equal(outOfScope.length, 0, JSON.stringify(outOfScope));
  });

  // Bagimsiz CEO incelemesinin bulgusu: `allowBareNegation`, cevabin
  // TAMAMI icin (`splitClauses(answer).length > 1`) tek bir bayrakla
  // hesaplaniyor - cumle BAZLI degil, CEVAP BAZLI. Bu, "durum 7/8" (FIX)
  // testlerinin kapattigi ayni hata sinifinin bir ARTIGI: cevap birden
  // fazla cumleye bolununce, o cumlelerden biri (ya da hepsi) TEK BASINA
  // olsaydi confirmedFeatures'da KALACAK bir degismez olsa bile, sirf
  // yaninda baska bir cumle oldugu icin ciplak "yok." dislama sayiliyor.
  // Cozum DAHA GENIS bir regex DEGIL - dogru sinir cumle degil KARAR
  // SEVIYESI: cevabin hangi yarisinin "yapilacak", hangisinin
  // "yapilmayacak" oldugunu ayirmak icin karar kaydinin cevabi IKI ayri
  // alanda tutmasi ya da AI'nin ayirmasi gerekir (mimari, bkz.
  // `benchmarks/comparison-v2/pilot/BULGULAR.md`, "Anahtar kelime ile
  // ayiklamayacagim"). Bu ucu de DEGISTIRILMEMELI o mimari cozum
  // gerceklesmeden.
  it('PIN: "Kesinti yok. Mükerrer kayıt yok." - COK PARCALI cevabin TUMU degismezse SIFIR gereksinim (en agir bicim)', () => {
    // Bu, durum 7/8 (FIX) ile AYNI iki cumlenin YAN YANA gelmis hali.
    // Tek basina her biri confirmedFeatures'a giderdi (bkz. durum 7/8);
    // burada ikisi de ";"/cumle-sonu ile ayrilan COK PARCALI bir cevabin
    // parcasi oldugu icin `allowBareNegation` cevap seviyesinde true olur
    // ve HER IKISI de dislaniyor. Sonuc: sifir gereksinim - duzeltilen
    // hatayla AYNI toplam-kayip bicimi, farkli tetikleyici.
    const summary = projectedSummary('Kesinti yok. Mükerrer kayıt yok.');
    const confirmedFeatures = summary.confirmedFeatures as string[];
    const outOfScope = summary.outOfScope as string[];

    // MEVCUT (kusurlu) davranis: iki degismez de dislaniyor, must SIFIR.
    assert.equal(confirmedFeatures.length, 0, JSON.stringify(confirmedFeatures));
    assert.ok(outOfScope.some(item => /Kesinti yok/.test(item)), JSON.stringify(outOfScope));
    assert.ok(outOfScope.some(item => /Mükerrer kayıt yok/.test(item)), JSON.stringify(outOfScope));
  });

  it('PIN: "Fatura kaydı olacak. Kesinti yok." - degismez cumle, YANINDA baska cumle oldugu icin dislaniyor', () => {
    // Olumlu cumle dogru sekilde confirmedFeatures'a gidiyor; sorun
    // "Kesinti yok."nun kendisi - TEK BASINA olsa (durum 7) confirmedFeatures'da
    // kalacakken, burada sirf cevap iki cumleye boluyor diye dislaniyor.
    const summary = projectedSummary('Fatura kaydı olacak. Kesinti yok.');
    const confirmedFeatures = summary.confirmedFeatures as string[];
    const outOfScope = summary.outOfScope as string[];

    assert.ok(confirmedFeatures.some(item => /Fatura kaydı olacak/.test(item)), JSON.stringify(confirmedFeatures));
    // MEVCUT (kusurlu) davranis: degismez gereksinim yine de dislaniyor.
    assert.ok(outOfScope.some(item => /Kesinti yok/.test(item)), JSON.stringify(outOfScope));
    assert.ok(!confirmedFeatures.some(item => /Kesinti yok/.test(item)), JSON.stringify(confirmedFeatures));
  });

  it('PIN: "Veri kaybı yok; yedekleme her gece." - degismez ILK sirada olsa da COK PARCALI oldugu icin dislaniyor', () => {
    // Durum 7/8 (FIX) yalnizca TEK parcali cevaplari korur; sira
    // (bastaki/sondaki) fark etmiyor - cevap ";" ile ikiye bolununce
    // `allowBareNegation` yine cevap-seviyesinde true olup bu degismezi
    // yakaliyor.
    const summary = projectedSummary('Veri kaybı yok; yedekleme her gece.');
    const confirmedFeatures = summary.confirmedFeatures as string[];
    const outOfScope = summary.outOfScope as string[];

    assert.ok(confirmedFeatures.some(item => /yedekleme her gece/.test(item)), JSON.stringify(confirmedFeatures));
    // MEVCUT (kusurlu) davranis: degismez gereksinim yine de dislaniyor.
    assert.ok(outOfScope.some(item => /Veri kaybı yok/.test(item)), JSON.stringify(outOfScope));
    assert.ok(!confirmedFeatures.some(item => /Veri kaybı yok/.test(item)), JSON.stringify(confirmedFeatures));
  });
});

describe('REGRESYON KAPISI: gercek UI cagri sekli (excluded YOK) hala eski anahtar-kelime yoluyla korunuyor', () => {
  // Bagimsiz incelemenin bulgusu: `answerConcern`in `excluded` alani hic
  // gonderilmeden cagrilmasi TAM OLARAK `IdeaStagePanel.tsx:221` ve
  // `SolutionStagePanel.tsx:174`in bugun yaptigi cagri sekli. Eger
  // `answerConcern` bu durumda `scopeSplit: 'confirmed'` yazsaydı (ilk
  // duzeltmenin kusuru), kutupluluk cikarimi TAMAMEN kapanir ve "SMS yok."
  // gibi dislamalar dogrudan must gereksinime donusurdu - duzeltilen hatadan
  // DAHA KOTU bir regresyon. Bu test `stage-commands.ts`teki gercek komutu
  // (mock/kisayol degil) cagirip sonucu `projectStageDataToConceptSummary`
  // ve `createRequirementDraftsFromConcept` ile UCTAN UCA dogrular.
  it('answerConcern excluded OLMADAN cagrilinca "SMS yok." hala outOfScope\'a gider, hicbir must\'a SIZMAZ', () => {
    const document = legacyProject();
    document.ideaDesign.concerns = [normalizeConcern({
      id: 'ic', title: 'Bildirim tercihi', status: 'open',
      whyItMatters: 'Kullanıcıya nasıl ulaşılacağını belirler.'
    }, 0)];
    document.ideaDesign.approval = { ...APPROVED };

    // Gercek UI cagri sekli: IdeaStagePanel.tsx/SolutionStagePanel.tsx TAM
    // OLARAK bu alanlari gonderiyor - concernId, chosenOptionId, answer,
    // rationale, revision. `excluded` YOK.
    const answered = answerConcern(document, {
      concernId: 'ic',
      chosenOptionId: null,
      answer: 'Hatırlatma e-posta ile; SMS yok.',
      rationale: 'Kullanıcı tercihi netleşsin.',
      revision: document.canonicalRevision + 1
    });
    if (answered.error) assert.fail(answered.error);

    const decision = answered.project.ideaDesign.concernDecisions[0];
    assert.equal(decision.scopeSplit, 'legacy-unsplit', 'excluded gonderilmedi - bir insan sinir cizmedi');

    const summary = projectStageDataToConceptSummary(answered.project).ideaLabSession?.conceptSummary as Record<string, unknown>;
    const confirmedFeatures = summary.confirmedFeatures as string[];
    const outOfScope = summary.outOfScope as string[];

    assert.ok(outOfScope.some(item => /SMS yok/.test(item)), JSON.stringify(outOfScope));
    assert.ok(!confirmedFeatures.some(item => /SMS yok/.test(item)), JSON.stringify(confirmedFeatures));

    const withRequirements = createRequirementDraftsFromConcept({
      ...answered.project,
      ideaLabSession: {
        ...(answered.project.ideaLabSession || {}),
        conceptSummary: { ...summary, userConfirmed: true }
      }
    } as ProjectDocumentV5);
    const mustRequirements = withRequirements.requirements.filter(item => item.priority === 'must');

    assert.ok(!mustRequirements.some(item => /SMS yok/.test(item.statement)), JSON.stringify(mustRequirements));
  });
});
