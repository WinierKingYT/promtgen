import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeAssumption,
  normalizeMilestone,
  normalizeResearchQuestion,
  normalizeResearchSource,
  normalizeEvidence,
  normalizeReviewFinding,
  normalizeSimulationRun,
  normalizeExecutionSession,
  normalizeSectionPatchProposal,
  normalizeImpactAnalysis,
  normalizePlanningScenario,
  normalizeImplementationEvidencePackage,
  normalizeProjectDocument,
  normalizeDecision
} from '../../src/v4/canonical-entities.js';

describe('normalizeAssumption normalleştirme', () => {
  it('string kisayolu statement alanina yerlesir', () => {
    const normalized = normalizeAssumption('Kullanicilar mobil kullanacak');

    assert.equal(normalized.statement, 'Kullanicilar mobil kullanacak');
  });

  it('undefined ile cagrildiginda guvenli varsayilanlar doner', () => {
    const normalized = normalizeAssumption(undefined, 2);

    assert.equal(normalized.id, 'asm-3');
    assert.equal(normalized.statement, '');
    assert.equal(normalized.confidence, 'medium');
    assert.equal(normalized.validationPlan, '');
    assert.equal(normalized.status, 'open');
  });

  it('bos obje ile cagrildiginda guvenli varsayilanlar doner', () => {
    const normalized = normalizeAssumption({}, 0);

    assert.equal(normalized.id, 'asm-1');
    assert.equal(normalized.statement, '');
    assert.equal(normalized.confidence, 'medium');
    assert.equal(normalized.validationPlan, '');
    assert.equal(normalized.status, 'open');
  });

  it('tam doldurulmus deger degerleri korur', () => {
    const normalized = normalizeAssumption({
      id: 'asm-custom',
      statement: 'Odeme entegrasyonu 3. parti API ile yapilacak',
      confidence: 'high',
      validationPlan: 'Sandbox testi ile dogrulanacak',
      status: 'validated'
    }, 5);

    assert.equal(normalized.id, 'asm-custom');
    assert.equal(normalized.statement, 'Odeme entegrasyonu 3. parti API ile yapilacak');
    assert.equal(normalized.confidence, 'high');
    assert.equal(normalized.validationPlan, 'Sandbox testi ile dogrulanacak');
    assert.equal(normalized.status, 'validated');
  });

  it('gecersiz confidence degeri medium a duser', () => {
    const normalized = normalizeAssumption({ confidence: 'cok-yuksek' });

    assert.equal(normalized.confidence, 'medium');
  });

  it('gecersiz status degeri open a duser', () => {
    const normalized = normalizeAssumption({ status: 'bilinmeyen' });

    assert.equal(normalized.status, 'open');
  });

  it('statement icin description ve text alanlarina yedeklenir', () => {
    assert.equal(normalizeAssumption({ description: 'Aciklamadan gelen' }).statement, 'Aciklamadan gelen');
    assert.equal(normalizeAssumption({ text: 'Metinden gelen' }).statement, 'Metinden gelen');
  });

  it('index parametresi yalniz id yoksa varsayilan id uretiminde kullanilir', () => {
    assert.equal(normalizeAssumption({}, 0).id, 'asm-1');
    assert.equal(normalizeAssumption({}, 9).id, 'asm-10');
  });

  it('value icinde string id varsa index yerine o kullanilir', () => {
    const normalized = normalizeAssumption({ id: 'sabit-id' }, 7);

    assert.equal(normalized.id, 'sabit-id');
  });
});

describe('normalizeMilestone normalleştirme', () => {
  it('string kisayolu title alanina yerlesir, outcome bos kalir', () => {
    const normalized = normalizeMilestone('Beta lansmani');

    assert.equal(normalized.title, 'Beta lansmani');
    assert.equal(normalized.outcome, '');
  });

  it('undefined ile cagrildiginda guvenli varsayilanlar doner', () => {
    const normalized = normalizeMilestone(undefined, 1);

    assert.equal(normalized.id, 'milestone-2');
    assert.equal(normalized.title, 'Kilometre taşı 2');
    assert.equal(normalized.outcome, '');
    assert.deepEqual(normalized.taskIds, []);
    assert.equal(normalized.targetDate, '');
    assert.equal(normalized.status, 'planned');
  });

  it('bos obje ile cagrildiginda guvenli varsayilanlar doner', () => {
    const normalized = normalizeMilestone({}, 0);

    assert.equal(normalized.id, 'milestone-1');
    assert.equal(normalized.title, 'Kilometre taşı 1');
    assert.equal(normalized.status, 'planned');
  });

  it('tam doldurulmus deger degerleri korur', () => {
    const normalized = normalizeMilestone({
      id: 'ms-1',
      title: 'MVP teslimi',
      outcome: 'Ilk musteri onayi',
      taskIds: ['task-1', 'task-2'],
      targetDate: '2026-09-01',
      status: 'active'
    }, 4);

    assert.equal(normalized.id, 'ms-1');
    assert.equal(normalized.title, 'MVP teslimi');
    assert.equal(normalized.outcome, 'Ilk musteri onayi');
    assert.deepEqual(normalized.taskIds, ['task-1', 'task-2']);
    assert.equal(normalized.targetDate, '2026-09-01');
    assert.equal(normalized.status, 'active');
  });

  it('title icin de description alanina yedeklenir - normalizeObjective/Risk ile TUTARLI (KASTEN DUZELTILDI)', () => {
    // KASITLI DUZELTME (eskiden kusurdu): title yalniz source.title'dan
    // geliyordu, description'a hic düşmüyordu - ayni fonksiyonun kendi
    // `outcome` alani description'a yedeklenirken bile. Kardes normalizer'lar
    // normalizeObjective ve normalizeRisk, title icin `title || description`
    // orüntüsünü kullaniyor; normalizeMilestone bu tutarlilik disindaydi.
    // Sonuc: yalniz description ile gonderilen bir kilometre tasi, outcome'u
    // dolu ama title'i BOS kalirdi. Bu artik normalizeRisk ile AYNI sekle
    // (`title || description`) getirildi.
    const normalized = normalizeMilestone({ description: 'Aciklamadan gelen' }, 0);

    assert.equal(normalized.outcome, 'Aciklamadan gelen');
    assert.equal(normalized.title, 'Aciklamadan gelen');
  });

  it('title bos string ise de description alanina yedeklenir (normalizeRisk ile ayni oncelik)', () => {
    // `text(value, fallback)` yalniz value STRING DEGILSE fallback kullanir;
    // bos string ('') zaten bir string oldugu icin normalde fallback'e
    // düşmez. Ama buradaki yedekleme `text()`in kendi ic mantigindan ONCE,
    // ham degerler uzerinde `||` ile yapiliyor (normalizeRisk'teki
    // `source.title || source.description` ile birebir ayni oncelik):
    // bos string falsy oldugu icin description'a duser.
    const normalized = normalizeMilestone({ title: '', description: 'Aciklamadan gelen' }, 0);

    assert.equal(normalized.title, 'Aciklamadan gelen');
  });

  it('title doluysa description yok sayilir (title oncelikli)', () => {
    const normalized = normalizeMilestone({ title: 'Gercek baslik', description: 'Aciklamadan gelen' }, 0);

    assert.equal(normalized.title, 'Gercek baslik');
  });

  it('gecersiz status degeri planned a duser', () => {
    const normalized = normalizeMilestone({ status: 'bilinmeyen' });

    assert.equal(normalized.status, 'planned');
  });

  it('taskIds icindeki bos/falsy elemanlar filtrelenir ve stringe cevrilir', () => {
    const normalized = normalizeMilestone({ taskIds: ['t1', '', null, 0, 't2'] });

    assert.deepEqual(normalized.taskIds, ['t1', 't2']);
  });
});

describe('normalizeResearchQuestion normalleştirme', () => {
  it('string kisayolu question alanina yerlesir', () => {
    const normalized = normalizeResearchQuestion('Rakip fiyatlandirmasi nedir?');

    assert.equal(normalized.question, 'Rakip fiyatlandirmasi nedir?');
  });

  it('undefined ile cagrildiginda guvenli varsayilanlar doner - baslik yok, id prefixi research-question', () => {
    // Diger normalizerlerden farkli: question icin "Soru N" gibi bir varsayilan
    // BASLIK yok; text() fallback'i olmadan bos string doner.
    const normalized = normalizeResearchQuestion(undefined, 3);

    assert.equal(normalized.id, 'research-question-4');
    assert.equal(normalized.question, '');
    assert.equal(normalized.rationale, '');
    assert.equal(normalized.priority, 'medium');
    assert.equal(normalized.status, 'proposed');
    assert.deepEqual(normalized.affectedSectionIds, []);
  });

  it('bos obje ile cagrildiginda guvenli varsayilanlar doner', () => {
    const normalized = normalizeResearchQuestion({}, 0);

    assert.equal(normalized.id, 'research-question-1');
    assert.equal(normalized.question, '');
    assert.equal(normalized.priority, 'medium');
    assert.equal(normalized.status, 'proposed');
  });

  it('tam doldurulmus deger degerleri korur', () => {
    const normalized = normalizeResearchQuestion({
      id: 'rq-1',
      question: 'Hangi pazarlar hedeflenmeli?',
      rationale: 'Pazar secimi kaynagi belirler',
      priority: 'high',
      status: 'answered',
      affectedSectionIds: ['sec-1']
    }, 2);

    assert.equal(normalized.id, 'rq-1');
    assert.equal(normalized.question, 'Hangi pazarlar hedeflenmeli?');
    assert.equal(normalized.rationale, 'Pazar secimi kaynagi belirler');
    assert.equal(normalized.priority, 'high');
    assert.equal(normalized.status, 'answered');
    assert.deepEqual(normalized.affectedSectionIds, ['sec-1']);
  });

  it('question icin title alanina yedeklenir', () => {
    const normalized = normalizeResearchQuestion({ title: 'Basliktan gelen soru' });

    assert.equal(normalized.question, 'Basliktan gelen soru');
  });

  it('gecersiz priority degeri medium a duser', () => {
    assert.equal(normalizeResearchQuestion({ priority: 'kritik' }).priority, 'medium');
  });

  it('gecersiz status degeri proposed a duser', () => {
    assert.equal(normalizeResearchQuestion({ status: 'bilinmeyen' }).status, 'proposed');
  });
});

describe('normalizeResearchSource normalleştirme', () => {
  it('string girdisi kisayol DEGIL - object olarak kabul edilmedigi icin bos kaynak doner', () => {
    // Diger cogu normalizerdan farkli: kaynak kod `typeof value === 'object' && value`
    // kontrolu kullanir, `typeof value === 'string'` kisayolu YOK. Bir string
    // gecilirse source = {} olur ve title'in "Kaynak N" varsayilanina duser.
    const normalized = normalizeResearchSource('https://example.com', 0);

    assert.equal(normalized.title, 'Kaynak 1');
    assert.equal(normalized.url, '');
  });

  it('undefined ile cagrildiginda guvenli varsayilanlar doner', () => {
    const normalized = normalizeResearchSource(undefined, 1);

    assert.equal(normalized.id, 'source-2');
    assert.equal(normalized.title, 'Kaynak 2');
    assert.equal(normalized.url, '');
    assert.equal(normalized.publisher, '');
    assert.equal(normalized.sourceType, 'unknown');
    assert.equal(normalized.accessedAt, '');
    assert.equal(normalized.status, 'candidate');
    assert.deepEqual(normalized.questionIds, []);
  });

  it('bos obje ile cagrildiginda guvenli varsayilanlar doner', () => {
    const normalized = normalizeResearchSource({}, 0);

    assert.equal(normalized.id, 'source-1');
    assert.equal(normalized.title, 'Kaynak 1');
    assert.equal(normalized.sourceType, 'unknown');
    assert.equal(normalized.status, 'candidate');
  });

  it('tam doldurulmus deger degerleri korur', () => {
    const normalized = normalizeResearchSource({
      id: 'src-1',
      title: 'Sektor raporu',
      url: 'https://example.com/rapor',
      publisher: 'Ornek Yayinevi',
      sourceType: 'primary',
      accessedAt: '2026-08-01',
      status: 'approved',
      questionIds: ['rq-1']
    }, 3);

    assert.equal(normalized.id, 'src-1');
    assert.equal(normalized.title, 'Sektor raporu');
    assert.equal(normalized.url, 'https://example.com/rapor');
    assert.equal(normalized.publisher, 'Ornek Yayinevi');
    assert.equal(normalized.sourceType, 'primary');
    assert.equal(normalized.accessedAt, '2026-08-01');
    assert.equal(normalized.status, 'approved');
    assert.deepEqual(normalized.questionIds, ['rq-1']);
  });

  it('gecersiz sourceType degeri unknown a duser', () => {
    assert.equal(normalizeResearchSource({ sourceType: 'gazete' }).sourceType, 'unknown');
  });

  it('gecersiz status degeri candidate a duser', () => {
    assert.equal(normalizeResearchSource({ status: 'bilinmeyen' }).status, 'candidate');
  });

  it('index yalniz varsayilan title ve id icin kullanilir', () => {
    assert.equal(normalizeResearchSource({}, 6).title, 'Kaynak 7');
    assert.equal(normalizeResearchSource({}, 6).id, 'source-7');
  });
});

describe('normalizeEvidence normalleştirme', () => {
  it('string girdisi kisayol DEGIL - object olarak kabul edilmedigi icin bos kanit doner', () => {
    // normalizeResearchSource ile ayni orunti: string kisayolu yok.
    const normalized = normalizeEvidence('Kanit metni', 0);

    assert.equal(normalized.claim, '');
    assert.equal(normalized.summary, '');
  });

  it('undefined ile cagrildiginda guvenli varsayilanlar doner', () => {
    const normalized = normalizeEvidence(undefined, 4);

    assert.equal(normalized.id, 'evidence-5');
    assert.equal(normalized.claim, '');
    assert.equal(normalized.summary, '');
    assert.equal(normalized.sourceId, '');
    assert.equal(normalized.questionId, '');
    assert.equal(normalized.confidence, 'medium');
    assert.deepEqual(normalized.affectedSectionIds, []);
    assert.equal(normalized.status, 'proposed');
  });

  it('bos obje ile cagrildiginda guvenli varsayilanlar doner', () => {
    const normalized = normalizeEvidence({}, 0);

    assert.equal(normalized.id, 'evidence-1');
    assert.equal(normalized.confidence, 'medium');
    assert.equal(normalized.status, 'proposed');
  });

  it('tam doldurulmus deger degerleri korur', () => {
    const normalized = normalizeEvidence({
      id: 'ev-1',
      claim: 'Kullanicilarin %80i mobil kullaniyor',
      summary: 'Anket sonucu',
      sourceId: 'src-1',
      questionId: 'rq-1',
      confidence: 'high',
      affectedSectionIds: ['sec-1'],
      status: 'accepted'
    }, 2);

    assert.equal(normalized.id, 'ev-1');
    assert.equal(normalized.claim, 'Kullanicilarin %80i mobil kullaniyor');
    assert.equal(normalized.summary, 'Anket sonucu');
    assert.equal(normalized.sourceId, 'src-1');
    assert.equal(normalized.questionId, 'rq-1');
    assert.equal(normalized.confidence, 'high');
    assert.deepEqual(normalized.affectedSectionIds, ['sec-1']);
    assert.equal(normalized.status, 'accepted');
  });

  it('gecersiz confidence degeri medium a duser', () => {
    assert.equal(normalizeEvidence({ confidence: 'cok-yuksek' }).confidence, 'medium');
  });

  it('gecersiz status degeri proposed a duser', () => {
    assert.equal(normalizeEvidence({ status: 'bilinmeyen' }).status, 'proposed');
  });
});

describe('normalizeReviewFinding normalleştirme', () => {
  it('string girdisi kisayol DEGIL - object olarak kabul edilmedigi icin varsayilanlara duser', () => {
    const normalized = normalizeReviewFinding('Kritik bir bulgu', 0);

    assert.equal(normalized.title, 'Bulgu 1');
    assert.equal(normalized.description, '');
  });

  it('undefined ile cagrildiginda guvenli varsayilanlar doner', () => {
    const normalized = normalizeReviewFinding(undefined, 2);

    assert.equal(normalized.id, 'finding-3');
    assert.equal(normalized.ruleId, 'REVIEW-UNKNOWN');
    assert.equal(normalized.category, 'quality');
    assert.equal(normalized.severity, 'medium');
    assert.equal(normalized.title, 'Bulgu 3');
    assert.equal(normalized.description, '');
    assert.equal(normalized.recommendation, '');
    assert.deepEqual(normalized.entityIds, []);
    assert.deepEqual(normalized.sectionIds, []);
    assert.equal(normalized.status, 'open');
  });

  it('bos obje ile cagrildiginda guvenli varsayilanlar doner', () => {
    const normalized = normalizeReviewFinding({}, 0);

    assert.equal(normalized.id, 'finding-1');
    assert.equal(normalized.ruleId, 'REVIEW-UNKNOWN');
    assert.equal(normalized.category, 'quality');
    assert.equal(normalized.severity, 'medium');
    assert.equal(normalized.status, 'open');
  });

  it('tam doldurulmus deger degerleri korur', () => {
    const normalized = normalizeReviewFinding({
      id: 'find-1',
      ruleId: 'REVIEW-001',
      category: 'security',
      severity: 'critical',
      title: 'SQL injection riski',
      description: 'Girdi dogrulanmiyor',
      recommendation: 'Parametreli sorgu kullan',
      entityIds: ['req-1'],
      sectionIds: ['sec-2'],
      status: 'resolved'
    }, 5);

    assert.equal(normalized.id, 'find-1');
    assert.equal(normalized.ruleId, 'REVIEW-001');
    assert.equal(normalized.category, 'security');
    assert.equal(normalized.severity, 'critical');
    assert.equal(normalized.title, 'SQL injection riski');
    assert.equal(normalized.description, 'Girdi dogrulanmiyor');
    assert.equal(normalized.recommendation, 'Parametreli sorgu kullan');
    assert.deepEqual(normalized.entityIds, ['req-1']);
    assert.deepEqual(normalized.sectionIds, ['sec-2']);
    assert.equal(normalized.status, 'resolved');
  });

  it('gecersiz severity degeri medium a duser', () => {
    assert.equal(normalizeReviewFinding({ severity: 'asiri-kritik' }).severity, 'medium');
  });

  it('gecersiz status degeri open a duser', () => {
    assert.equal(normalizeReviewFinding({ status: 'bilinmeyen' }).status, 'open');
  });

  it('ruleId ve category bos string ise varsayilana DUSMEZ - text() bos stringi gecerli sayar', () => {
    // text(value, fallback) yalniz value bir string DEGILSE fallback kullanir.
    // Bos string '' zaten bir string oldugu icin trim edilip oldugu gibi kalir;
    // 'REVIEW-UNKNOWN'/'quality' varsayilanlarina duşmez. Ilk beklentim yanlisti.
    const normalized = normalizeReviewFinding({ ruleId: '', category: '' });

    assert.equal(normalized.ruleId, '');
    assert.equal(normalized.category, '');
  });
});

describe('normalizeSimulationRun normalleştirme', () => {
  it('string girdisi kisayol DEGIL - object olarak kabul edilmedigi icin varsayilanlara duser', () => {
    const normalized = normalizeSimulationRun('Teslimat senaryosu', 0);

    assert.equal(normalized.title, 'Simülasyon 1');
    assert.equal(normalized.scenario, 'delivery');
  });

  it('undefined ile cagrildiginda guvenli varsayilanlar doner', () => {
    const normalized = normalizeSimulationRun(undefined, 1);

    assert.equal(normalized.id, 'simulation-2');
    assert.equal(normalized.scenario, 'delivery');
    assert.equal(normalized.title, 'Simülasyon 2');
    assert.equal(normalized.status, 'warning');
    assert.equal(normalized.summary, '');
    assert.deepEqual(normalized.checks, []);
    assert.equal(normalized.createdAt, '');
    assert.equal(normalized.projectRevision, 0);
  });

  it('bos obje ile cagrildiginda guvenli varsayilanlar doner', () => {
    const normalized = normalizeSimulationRun({}, 0);

    assert.equal(normalized.id, 'simulation-1');
    assert.equal(normalized.scenario, 'delivery');
    assert.equal(normalized.status, 'warning');
    assert.equal(normalized.projectRevision, 0);
  });

  it('tam doldurulmus deger degerleri korur, checks elemanlari donusturulur', () => {
    const normalized = normalizeSimulationRun({
      id: 'sim-1',
      scenario: 'regression',
      title: 'Regresyon kosusu',
      status: 'passed',
      summary: 'Tum testler gecti',
      checks: [{ id: 'chk-1', label: 'Derleme', passed: true, detail: 'ok' }],
      createdAt: '2026-08-01T00:00:00.000Z',
      projectRevision: 7
    }, 2);

    assert.equal(normalized.id, 'sim-1');
    assert.equal(normalized.scenario, 'regression');
    assert.equal(normalized.title, 'Regresyon kosusu');
    assert.equal(normalized.status, 'passed');
    assert.equal(normalized.summary, 'Tum testler gecti');
    assert.deepEqual(normalized.checks, [{ id: 'chk-1', label: 'Derleme', passed: true, detail: 'ok' }]);
    assert.equal(normalized.createdAt, '2026-08-01T00:00:00.000Z');
    assert.equal(normalized.projectRevision, 7);
  });

  it('checks icindeki passed alani Boolean() ile zorlanir', () => {
    const normalized = normalizeSimulationRun({ checks: [{ passed: 'evet' }, { passed: 0 }] });

    assert.equal(normalized.checks[0].passed, true);
    assert.equal(normalized.checks[1].passed, false);
  });

  it('gecersiz status degeri warning a duser', () => {
    assert.equal(normalizeSimulationRun({ status: 'bilinmeyen' }).status, 'warning');
  });

  it('projectRevision sonlu bir sayiya cevrilemeyen degerlerde KASTEN 0a duser - NaN asla donmez', () => {
    // KASITLI DUZELTME (eskiden kusurdu): eski kod `Number(source.projectRevision || 0)`
    // kullaniyordu. `||` yalniz falsy degerlerde devreye girer; 'abc' gibi
    // truthy ama sayisal olmayan bir string || 0 korumasini atlar ve
    // `Number('abc')` sessizce NaN doner. NaN hicbir yerde hata firlatmadan
    // asagi akisa yayilirdi - NaN icin her karsilastirma false doner, bu da
    // bozuk/AI uretimi bir degerin sessizce yanlis davranisa yol acmasi
    // demekti. Bu test artik DUZELTILMIS davranisi sabitliyor: sonlu bir
    // sayiya cevrilemeyen HERHANGI bir deger 0'a duser, NaN asla donmez.
    assert.equal(normalizeSimulationRun({ projectRevision: 'abc' }).projectRevision, 0);
    assert.ok(!Number.isNaN(normalizeSimulationRun({ projectRevision: 'abc' }).projectRevision));
    assert.equal(normalizeSimulationRun({ projectRevision: NaN }).projectRevision, 0);
    assert.equal(normalizeSimulationRun({ projectRevision: Infinity }).projectRevision, 0);
    assert.equal(normalizeSimulationRun({ projectRevision: -Infinity }).projectRevision, 0);
    assert.equal(normalizeSimulationRun({ projectRevision: null }).projectRevision, 0);
    assert.equal(normalizeSimulationRun({ projectRevision: undefined }).projectRevision, 0);
    assert.equal(normalizeSimulationRun({ projectRevision: {} }).projectRevision, 0);
    assert.equal(normalizeSimulationRun({ projectRevision: [] }).projectRevision, 0);
    assert.equal(normalizeSimulationRun({ projectRevision: [7] }).projectRevision, 0);
    assert.equal(normalizeSimulationRun({ projectRevision: true }).projectRevision, 0);
    assert.equal(normalizeSimulationRun({ projectRevision: false }).projectRevision, 0);
  });

  it('projectRevision sayisal string ise KASTEN sayiya cevrilir - bu davranis bilerek korundu', () => {
    // '7' gibi sayisal bir string zarasiz ve anlamli sekilde 7'ye cevrilebilir;
    // NaN korumasi eklenirken bu yararli davranis KASTEN bozulmadi. Baslangic/
    // bitis bosluklari `Number()` tarafindan zaten yok sayilir.
    assert.equal(normalizeSimulationRun({ projectRevision: '7' }).projectRevision, 7);
    assert.equal(normalizeSimulationRun({ projectRevision: '  12  ' }).projectRevision, 12);
  });
});

describe('normalizeExecutionSession normalleştirme', () => {
  it('string girdisi kisayol DEGIL - object olarak kabul edilmedigi icin varsayilanlara duser', () => {
    const normalized = normalizeExecutionSession('bir-oturum', 0);

    assert.equal(normalized.adapterId, 'generic');
    assert.equal(normalized.worktreeLabel, '');
  });

  it('undefined ile cagrildiginda guvenli varsayilanlar doner', () => {
    const normalized = normalizeExecutionSession(undefined, 3);

    assert.equal(normalized.id, 'execution-4');
    assert.equal(normalized.adapterId, 'generic');
    assert.equal(normalized.sourceRevision, 0);
    assert.equal(normalized.status, 'proposed');
    assert.equal(normalized.worktreeLabel, '');
    assert.deepEqual(normalized.steps, []);
    assert.equal(normalized.createdAt, '');
    assert.equal(normalized.updatedAt, '');
  });

  it('bos obje ile cagrildiginda guvenli varsayilanlar doner', () => {
    const normalized = normalizeExecutionSession({}, 0);

    assert.equal(normalized.id, 'execution-1');
    assert.equal(normalized.adapterId, 'generic');
    assert.equal(normalized.status, 'proposed');
  });

  it('tam doldurulmus deger degerleri korur', () => {
    const normalized = normalizeExecutionSession({
      id: 'exec-1',
      adapterId: 'codex',
      sourceRevision: 3,
      status: 'running',
      worktreeLabel: 'wt-1',
      steps: [{
        role: 'implementer', risk: 'high', status: 'completed', exitCode: 0,
        outputSummary: 'basarili', startedAt: 't0', completedAt: 't1'
      }],
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z'
    }, 1);

    assert.equal(normalized.id, 'exec-1');
    assert.equal(normalized.adapterId, 'codex');
    assert.equal(normalized.sourceRevision, 3);
    assert.equal(normalized.status, 'running');
    assert.equal(normalized.worktreeLabel, 'wt-1');
    assert.deepEqual(normalized.steps, [{
      role: 'implementer', risk: 'high', status: 'completed', exitCode: 0,
      outputSummary: 'basarili', startedAt: 't0', completedAt: 't1'
    }]);
    assert.equal(normalized.createdAt, '2026-08-01T00:00:00.000Z');
    assert.equal(normalized.updatedAt, '2026-08-02T00:00:00.000Z');
  });

  it('gecersiz adapterId degeri generic e duser', () => {
    assert.equal(normalizeExecutionSession({ adapterId: 'bilinmeyen-adapter' }).adapterId, 'generic');
  });

  it('gecersiz status degeri proposed a duser', () => {
    assert.equal(normalizeExecutionSession({ status: 'bilinmeyen' }).status, 'proposed');
  });

  it('sourceRevision sonlu bir sayiya cevrilemeyen degerlerde KASTEN 0a duser - kardes kusur DUZELTILDI', () => {
    // KARDES DUZELTME: `normalizeSimulationRun.projectRevision` ile BIREBIR
    // AYNI kalip - `Number(source.sourceRevision || 0)` - burada da mevcuttu.
    // 'abc' truthy oldugu icin `|| 0` devreye girmiyor ve `Number('abc')`
    // sessizce NaN doner. Bu, projectRevision kusuruyla ayni kanit (`Number('abc'
    // || 0)` -> NaN) ile ispatlandigindan, ayni gorevde kasten duzeltildi.
    assert.equal(normalizeExecutionSession({ sourceRevision: 'abc' }).sourceRevision, 0);
    assert.ok(!Number.isNaN(normalizeExecutionSession({ sourceRevision: 'abc' }).sourceRevision));
    assert.equal(normalizeExecutionSession({ sourceRevision: NaN }).sourceRevision, 0);
    assert.equal(normalizeExecutionSession({ sourceRevision: Infinity }).sourceRevision, 0);
    assert.equal(normalizeExecutionSession({ sourceRevision: null }).sourceRevision, 0);
    assert.equal(normalizeExecutionSession({ sourceRevision: {} }).sourceRevision, 0);
    assert.equal(normalizeExecutionSession({ sourceRevision: '4' }).sourceRevision, 4);
  });

  it('step icindeki gecersiz role/risk/status degerleri kendi varsayilanlarina duser', () => {
    const normalized = normalizeExecutionSession({
      steps: [{ role: 'bilinmeyen', risk: 'bilinmeyen', status: 'bilinmeyen' }]
    });

    assert.equal(normalized.steps[0].role, 'planner');
    assert.equal(normalized.steps[0].risk, 'medium');
    assert.equal(normalized.steps[0].status, 'pending');
  });

  it('step icinde exitCode tam sayi degilse null olur', () => {
    const normalized = normalizeExecutionSession({ steps: [{ exitCode: 1.5 }, { exitCode: '2' }, { exitCode: 3 }] });

    assert.equal(normalized.steps[0].exitCode, null);
    assert.equal(normalized.steps[1].exitCode, null);
    assert.equal(normalized.steps[2].exitCode, 3);
  });

  it('step icinde outputSummary 2000 karakterden sonra kesilir', () => {
    const longText = 'a'.repeat(2500);
    const normalized = normalizeExecutionSession({ steps: [{ outputSummary: longText }] });

    assert.equal(normalized.steps[0].outputSummary.length, 2000);
  });
});

describe('normalizeSectionPatchProposal normalleştirme', () => {
  it('string girdisi kisayol DEGIL - object olarak kabul edilmedigi icin varsayilanlara duser', () => {
    const normalized = normalizeSectionPatchProposal('bir-yama', 0);

    assert.equal(normalized.sectionId, '');
    assert.equal(normalized.status, 'pending');
  });

  it('undefined ile cagrildiginda guvenli varsayilanlar doner - createdAt otomatik ISO zaman damgasi alir', () => {
    const before = new Date();
    const normalized = normalizeSectionPatchProposal(undefined, 3);
    const after = new Date();

    assert.equal(normalized.id, 'section-patch-4');
    assert.equal(normalized.impactAnalysisId, '');
    assert.equal(normalized.baseCanonicalRevision, 1);
    assert.equal(normalized.sectionId, '');
    assert.equal(normalized.originalContent, '');
    assert.equal(normalized.proposedContent, '');
    assert.equal(normalized.editedContent, '');
    assert.equal(normalized.rationale, '');
    assert.deepEqual(normalized.warnings, []);
    assert.equal(normalized.status, 'pending');
    assert.equal(normalized.resolvedAt, null);
    const createdAt = new Date(normalized.createdAt);
    assert.ok(createdAt.getTime() >= before.getTime() && createdAt.getTime() <= after.getTime());
  });

  it('provenance icin ozel varsayilanlar doner', () => {
    const normalized = normalizeSectionPatchProposal(undefined, 6);

    assert.equal(normalized.provenance.runId, 'legacy-section-patch-7');
    assert.equal(normalized.provenance.mode, 'rule-engine');
    assert.equal(normalized.provenance.providerId, null);
    assert.equal(normalized.provenance.model, null);
    assert.equal(normalized.provenance.promptVersion, '1.0.0');
    assert.equal(normalized.provenance.requestedAt, normalized.createdAt);
    assert.equal(normalized.provenance.completedAt, normalized.createdAt);
    assert.equal(normalized.provenance.latencyMs, 0);
    assert.equal(normalized.provenance.retryCount, 0);
    assert.equal(normalized.provenance.fallbackReason, null);
    assert.equal(normalized.provenance.schemaId, 'section-regeneration-v1');
    assert.equal(normalized.provenance.schemaVersion, 1);
    assert.equal(normalized.provenance.inputHash, 'not-sent-to-provider');
  });

  it('bos obje ile cagrildiginda guvenli varsayilanlar doner', () => {
    const normalized = normalizeSectionPatchProposal({}, 0);

    assert.equal(normalized.id, 'section-patch-1');
    assert.equal(normalized.status, 'pending');
    assert.equal(normalized.provenance.runId, 'legacy-section-patch-1');
  });

  it('tam doldurulmus deger degerleri korur', () => {
    const normalized = normalizeSectionPatchProposal({
      id: 'patch-1',
      impactAnalysisId: 'impact-1',
      baseCanonicalRevision: 4,
      sectionId: 'sec-1',
      originalContent: 'eski icerik',
      proposedContent: 'yeni icerik',
      editedContent: 'duzenlenmis icerik',
      rationale: 'Netlik icin',
      warnings: ['uyari-1'],
      status: 'accepted',
      provenance: {
        runId: 'run-1', mode: 'cloud-ai', providerId: 'openai', model: 'gpt-5',
        promptVersion: '2.0.0', requestedAt: 't0', completedAt: 't1',
        latencyMs: 120, retryCount: 1, fallbackReason: 'timeout',
        schemaId: 'custom-schema', schemaVersion: 3, inputHash: 'hash-abc'
      },
      resolvedAt: '2026-08-05T00:00:00.000Z'
    }, 2);

    assert.equal(normalized.id, 'patch-1');
    assert.equal(normalized.impactAnalysisId, 'impact-1');
    assert.equal(normalized.baseCanonicalRevision, 4);
    assert.equal(normalized.sectionId, 'sec-1');
    assert.equal(normalized.originalContent, 'eski icerik');
    assert.equal(normalized.proposedContent, 'yeni icerik');
    assert.equal(normalized.editedContent, 'duzenlenmis icerik');
    assert.equal(normalized.rationale, 'Netlik icin');
    assert.deepEqual(normalized.warnings, ['uyari-1']);
    assert.equal(normalized.status, 'accepted');
    assert.deepEqual(normalized.provenance, {
      runId: 'run-1', mode: 'cloud-ai', providerId: 'openai', model: 'gpt-5',
      promptVersion: '2.0.0', requestedAt: 't0', completedAt: 't1',
      latencyMs: 120, retryCount: 1, fallbackReason: 'timeout',
      schemaId: 'custom-schema', schemaVersion: 3, inputHash: 'hash-abc'
    });
    assert.equal(normalized.resolvedAt, '2026-08-05T00:00:00.000Z');
  });

  it('gecersiz status degeri pending e duser', () => {
    assert.equal(normalizeSectionPatchProposal({ status: 'bilinmeyen' }).status, 'pending');
  });

  it('gecersiz provenance.mode degeri rule-engine e duser', () => {
    assert.equal(normalizeSectionPatchProposal({ provenance: { mode: 'bilinmeyen' } }).provenance.mode, 'rule-engine');
  });

  it('baseCanonicalRevision 1 in altina inemez', () => {
    assert.equal(normalizeSectionPatchProposal({ baseCanonicalRevision: 0 }).baseCanonicalRevision, 1);
    assert.equal(normalizeSectionPatchProposal({ baseCanonicalRevision: -5 }).baseCanonicalRevision, 1);
  });
});

describe('normalizeImpactAnalysis normalleştirme', () => {
  it('string girdisi kisayol DEGIL - object olarak kabul edilmedigi icin varsayilanlara duser', () => {
    const normalized = normalizeImpactAnalysis('bir-etki', 0);

    assert.equal(normalized.userRequest, '');
    assert.equal(normalized.sourceKind, 'user_request');
  });

  it('undefined ile cagrildiginda guvenli varsayilanlar doner', () => {
    const normalized = normalizeImpactAnalysis(undefined, 5);

    assert.equal(normalized.id, 'impact-6');
    assert.equal(normalized.baseCanonicalRevision, 1);
    assert.equal(normalized.sourceScenarioId, undefined);
    assert.equal(normalized.sourceKind, 'user_request');
    assert.equal(normalized.sourceIdeaRevisionId, undefined);
    assert.equal(normalized.currentIdeaRevisionId, undefined);
    assert.equal(normalized.userRequest, '');
    assert.equal(normalized.summary, '');
    assert.deepEqual(normalized.affectedSections, []);
    assert.deepEqual(normalized.changedEntityIds, []);
    assert.deepEqual(normalized.entityEffects, []);
    assert.deepEqual(normalized.effectSummary, { total: 0, byEffect: {}, bySeverity: {} });
    assert.deepEqual(normalized.newTasks, []);
    assert.equal(normalized.architectureImpact, '');
    assert.deepEqual(normalized.newRisks, []);
    assert.deepEqual(normalized.contradictions, []);
    assert.deepEqual(normalized.contradictionDetails, []);
    assert.equal(normalized.status, 'proposed');
    assert.equal(normalized.createdAt, '');
    assert.equal(normalized.resolvedAt, null);
  });

  it('preview varsayilanlari: nextCanonicalRevision baseden 1 fazla, sayaclar 0 veya 1', () => {
    const normalized = normalizeImpactAnalysis({}, 0);

    assert.deepEqual(normalized.preview, {
      nextCanonicalRevision: 2,
      requirementCount: 1,
      taskCount: 0,
      testCount: 1,
      riskCount: 0,
      traceLinkCount: 2
    });
  });

  it('bos obje ile cagrildiginda guvenli varsayilanlar doner', () => {
    const normalized = normalizeImpactAnalysis({}, 0);

    assert.equal(normalized.id, 'impact-1');
    assert.equal(normalized.baseCanonicalRevision, 1);
    assert.equal(normalized.status, 'proposed');
  });

  it('tam doldurulmus deger degerleri korur - entityEffects donusturulur', () => {
    const normalized = normalizeImpactAnalysis({
      id: 'ia-1',
      baseCanonicalRevision: 3,
      sourceScenarioId: 'scn-1',
      sourceKind: 'idea_alignment',
      sourceIdeaRevisionId: 'idea-rev-1',
      currentIdeaRevisionId: 'idea-rev-2',
      userRequest: 'Yeni ozellik ekle',
      summary: 'Ozet',
      affectedSections: ['sec-1'],
      changedEntityIds: ['req-1'],
      entityEffects: [{
        sourceEntityId: 'req-1', sourceType: 'requirement', targetEntityId: 'task-1',
        targetType: 'task', targetLabel: 'Gorev 1', effect: 'invalidate', severity: 'high', depth: 2
      }],
      newTasks: ['task-yeni'],
      architectureImpact: 'Servis katmani etkilenir',
      newRisks: ['risk-yeni'],
      contradictions: ['dec-1'],
      contradictionDetails: [{
        decisionId: 'dec-1', decisionTitle: 'Eski karar', decisionText: 'Metin', resolution: 'supersede'
      }],
      status: 'accepted',
      createdAt: '2026-08-01T00:00:00.000Z',
      resolvedAt: '2026-08-02T00:00:00.000Z'
    }, 1);

    assert.equal(normalized.id, 'ia-1');
    assert.equal(normalized.baseCanonicalRevision, 3);
    assert.equal(normalized.sourceScenarioId, 'scn-1');
    assert.equal(normalized.sourceKind, 'idea_alignment');
    assert.equal(normalized.sourceIdeaRevisionId, 'idea-rev-1');
    assert.equal(normalized.currentIdeaRevisionId, 'idea-rev-2');
    assert.equal(normalized.userRequest, 'Yeni ozellik ekle');
    assert.equal(normalized.summary, 'Ozet');
    assert.deepEqual(normalized.affectedSections, ['sec-1']);
    assert.deepEqual(normalized.changedEntityIds, ['req-1']);
    assert.deepEqual(normalized.entityEffects, [{
      sourceEntityId: 'req-1', sourceType: 'requirement', targetEntityId: 'task-1',
      targetType: 'task', targetLabel: 'Gorev 1', effect: 'invalidate', severity: 'high', depth: 2
    }]);
    assert.deepEqual(normalized.newTasks, ['task-yeni']);
    assert.equal(normalized.architectureImpact, 'Servis katmani etkilenir');
    assert.deepEqual(normalized.newRisks, ['risk-yeni']);
    assert.deepEqual(normalized.contradictions, ['dec-1']);
    assert.deepEqual(normalized.contradictionDetails, [{
      decisionId: 'dec-1', decisionTitle: 'Eski karar', decisionText: 'Metin', resolution: 'supersede'
    }]);
    assert.equal(normalized.status, 'accepted');
    assert.equal(normalized.createdAt, '2026-08-01T00:00:00.000Z');
    assert.equal(normalized.resolvedAt, '2026-08-02T00:00:00.000Z');
  });

  it('targetLabel bos ise targetEntityId a yedeklenir', () => {
    const normalized = normalizeImpactAnalysis({
      entityEffects: [{ targetEntityId: 'task-9' }]
    });

    assert.equal(normalized.entityEffects[0].targetLabel, 'task-9');
  });

  it('gecersiz effect/severity degerleri kendi varsayilanlarina duser', () => {
    const normalized = normalizeImpactAnalysis({ entityEffects: [{ effect: 'bilinmeyen', severity: 'bilinmeyen' }] });

    assert.equal(normalized.entityEffects[0].effect, 'review');
    assert.equal(normalized.entityEffects[0].severity, 'medium');
  });

  it('depth negatif ise 0 a kirpilir', () => {
    assert.equal(normalizeImpactAnalysis({ entityEffects: [{ depth: -3 }] }).entityEffects[0].depth, 0);
  });

  it('gecersiz sourceKind degeri user_request a duser', () => {
    assert.equal(normalizeImpactAnalysis({ sourceKind: 'bilinmeyen' }).sourceKind, 'user_request');
  });

  it('gecersiz resolution degeri null olur (whitelist disi deger dusurulmez, null yapilir)', () => {
    const normalized = normalizeImpactAnalysis({ contradictionDetails: [{ resolution: 'bilinmeyen' }] });

    assert.equal(normalized.contradictionDetails[0].resolution, null);
  });

  it('gecersiz status degeri proposed a duser', () => {
    assert.equal(normalizeImpactAnalysis({ status: 'bilinmeyen' }).status, 'proposed');
  });

  it('sourceScenarioId bos string ise undefined doner (bos deger || undefined kalibi)', () => {
    const normalized = normalizeImpactAnalysis({ sourceScenarioId: '' });

    assert.equal(normalized.sourceScenarioId, undefined);
  });

  it('preview alanlari kismen saglanirsa kalan alanlar yine varsayilanlarini kullanir', () => {
    const normalized = normalizeImpactAnalysis({ preview: { requirementCount: 5 } });

    assert.equal(normalized.preview.requirementCount, 5);
    assert.equal(normalized.preview.taskCount, 0);
    assert.equal(normalized.preview.nextCanonicalRevision, 2);
  });

  it('preview.nextCanonicalRevision 2 nin altina inemez', () => {
    const normalized = normalizeImpactAnalysis({ preview: { nextCanonicalRevision: 1 } });

    assert.equal(normalized.preview.nextCanonicalRevision, 2);
  });
});

describe('normalizePlanningScenario normalleştirme', () => {
  it('string girdisi kisayol DEGIL - object olarak kabul edilmedigi icin varsayilanlara duser', () => {
    const normalized = normalizePlanningScenario('bir-senaryo', 0);

    assert.equal(normalized.name, 'Plan senaryosu 1');
    assert.deepEqual(normalized.decisions, []);
  });

  it('undefined ile cagrildiginda guvenli varsayilanlar doner - createdAt/updatedAt otomatik ayni ISO zaman damgasi', () => {
    const before = new Date();
    const normalized = normalizePlanningScenario(undefined, 2);
    const after = new Date();

    assert.equal(normalized.id, 'scenario-3');
    assert.equal(normalized.name, 'Plan senaryosu 3');
    assert.equal(normalized.description, '');
    assert.equal(normalized.baseCanonicalRevision, 1);
    assert.deepEqual(normalized.decisions, []);
    assert.equal(normalized.status, 'draft');
    assert.equal(normalized.mergedAt, null);
    assert.equal(normalized.impactAnalysisId, null);
    assert.equal(normalized.updatedAt, normalized.createdAt);
    const createdAt = new Date(normalized.createdAt);
    assert.ok(createdAt.getTime() >= before.getTime() && createdAt.getTime() <= after.getTime());
  });

  it('comparison varsayilanlari: skorlar 1, readinessDelta 0, sectionIds/dependencies bos', () => {
    const normalized = normalizePlanningScenario({}, 0);

    assert.deepEqual(normalized.comparison, {
      effortScore: 1,
      riskScore: 1,
      readinessDelta: 0,
      affectedSectionIds: [],
      dependencies: []
    });
  });

  it('bos obje ile cagrildiginda guvenli varsayilanlar doner', () => {
    const normalized = normalizePlanningScenario({}, 0);

    assert.equal(normalized.id, 'scenario-1');
    assert.equal(normalized.status, 'draft');
  });

  it('decision icinde decision alani BOS olan kayitlar tamamen filtrelenir', () => {
    // .filter(decision => decision.decision) - bos/eksik decision metni olan
    // alternatifler cikti dizisinden tamamen dusuruluyor.
    const normalized = normalizePlanningScenario({
      decisions: [{ title: 'Bos olan' }, { decision: 'Gecerli karar' }]
    });

    assert.equal(normalized.decisions.length, 1);
    assert.equal(normalized.decisions[0].decision, 'Gecerli karar');
  });

  it('decision id yoksa scenario-decision-N kalibinda uretilir (decisionIndex tabanli)', () => {
    const normalized = normalizePlanningScenario({
      decisions: [{ decision: 'Karar A' }, { decision: 'Karar B' }]
    });

    assert.equal(normalized.decisions[0].id, 'scenario-decision-1');
    assert.equal(normalized.decisions[1].id, 'scenario-decision-2');
  });

  it('affectedSectionIds/dependencies decisionlardan toplanir ve tekillestirilir', () => {
    const normalized = normalizePlanningScenario({
      decisions: [
        { decision: 'Karar A', affectedSectionIds: ['sec-1', 'sec-2'], dependencies: ['dep-1'] },
        { decision: 'Karar B', affectedSectionIds: ['sec-2', 'sec-3'], dependencies: ['dep-1', 'dep-2'] }
      ]
    });

    assert.deepEqual(normalized.comparison.affectedSectionIds, ['sec-1', 'sec-2', 'sec-3']);
    assert.deepEqual(normalized.comparison.dependencies, ['dep-1', 'dep-2']);
  });

  it('comparison.affectedSectionIds acikca saglanirsa decisionlardan toplanan degerin yerine gecer', () => {
    const normalized = normalizePlanningScenario({
      decisions: [{ decision: 'Karar A', affectedSectionIds: ['sec-1'] }],
      comparison: { affectedSectionIds: ['sec-override'] }
    });

    assert.deepEqual(normalized.comparison.affectedSectionIds, ['sec-override']);
  });

  it('tam doldurulmus deger degerleri korur', () => {
    const normalized = normalizePlanningScenario({
      id: 'scn-1',
      name: 'Alternatif A',
      description: 'Aciklama',
      baseCanonicalRevision: 2,
      decisions: [{ id: 'dec-1', title: 'Karar basligi', decision: 'Karar metni', rationale: 'Gerekce', affectedSectionIds: ['sec-1'], dependencies: [] }],
      comparison: { effortScore: 3, riskScore: 4, readinessDelta: 10 },
      status: 'selected',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-03T00:00:00.000Z',
      mergedAt: '2026-08-04T00:00:00.000Z',
      impactAnalysisId: 'impact-1'
    }, 1);

    assert.equal(normalized.id, 'scn-1');
    assert.equal(normalized.name, 'Alternatif A');
    assert.equal(normalized.description, 'Aciklama');
    assert.equal(normalized.baseCanonicalRevision, 2);
    assert.equal(normalized.decisions[0].id, 'dec-1');
    assert.equal(normalized.decisions[0].title, 'Karar basligi');
    assert.equal(normalized.decisions[0].decision, 'Karar metni');
    assert.equal(normalized.decisions[0].rationale, 'Gerekce');
    assert.equal(normalized.comparison.effortScore, 3);
    assert.equal(normalized.comparison.riskScore, 4);
    assert.equal(normalized.comparison.readinessDelta, 10);
    assert.equal(normalized.status, 'selected');
    assert.equal(normalized.createdAt, '2026-08-01T00:00:00.000Z');
    assert.equal(normalized.updatedAt, '2026-08-03T00:00:00.000Z');
    assert.equal(normalized.mergedAt, '2026-08-04T00:00:00.000Z');
    assert.equal(normalized.impactAnalysisId, 'impact-1');
  });

  it('comparison skorlari 1-5 araligina kirpilir', () => {
    assert.equal(normalizePlanningScenario({ comparison: { effortScore: 10 } }).comparison.effortScore, 5);
    assert.equal(normalizePlanningScenario({ comparison: { effortScore: -3 } }).comparison.effortScore, 1);
  });

  it('comparison.readinessDelta -25/25 araligina kirpilir', () => {
    assert.equal(normalizePlanningScenario({ comparison: { readinessDelta: 100 } }).comparison.readinessDelta, 25);
    assert.equal(normalizePlanningScenario({ comparison: { readinessDelta: -100 } }).comparison.readinessDelta, -25);
  });

  it('gecersiz status degeri draft a duser', () => {
    assert.equal(normalizePlanningScenario({ status: 'bilinmeyen' }).status, 'draft');
  });
});

describe('normalizeImplementationEvidencePackage normalleştirme', () => {
  it('string girdisi kisayol DEGIL - object olarak kabul edilmedigi icin varsayilanlara duser', () => {
    const normalized = normalizeImplementationEvidencePackage('bir-paket', 0);

    assert.equal(normalized.taskId, '');
    assert.equal(normalized.source, 'manual');
  });

  it('undefined ile cagrildiginda guvenli varsayilanlar doner - createdAt otomatik ISO zaman damgasi alir', () => {
    const before = new Date();
    const normalized = normalizeImplementationEvidencePackage(undefined, 4);
    const after = new Date();

    assert.equal(normalized.id, 'implementation-evidence-5');
    assert.equal(normalized.taskId, '');
    assert.equal(normalized.baseCanonicalRevision, 1);
    assert.equal(normalized.source, 'manual');
    assert.equal(normalized.summary, 'Uygulama kanıt paketi 5');
    assert.deepEqual(normalized.changedFiles, []);
    assert.deepEqual(normalized.testRuns, []);
    assert.deepEqual(normalized.acceptanceEvidence, []);
    assert.deepEqual(normalized.remainingIssues, []);
    assert.equal(normalized.rollbackNotes, '');
    assert.equal(normalized.status, 'review_required');
    assert.equal(normalized.resolvedAt, null);
    const createdAt = new Date(normalized.createdAt);
    assert.ok(createdAt.getTime() >= before.getTime() && createdAt.getTime() <= after.getTime());
  });

  it('review varsayilanlari: outcome needs_changes, findings bos, reviewedAt createdAt ile ayni', () => {
    const normalized = normalizeImplementationEvidencePackage(undefined, 0);

    assert.equal(normalized.review.outcome, 'needs_changes');
    assert.deepEqual(normalized.review.findings, []);
    assert.equal(normalized.review.reviewedAt, normalized.createdAt);
    assert.equal(normalized.review.reviewerNote, '');
  });

  it('bos obje ile cagrildiginda guvenli varsayilanlar doner', () => {
    const normalized = normalizeImplementationEvidencePackage({}, 0);

    assert.equal(normalized.id, 'implementation-evidence-1');
    assert.equal(normalized.status, 'review_required');
  });

  it('changedFiles path sahipsizse (bos) tamamen filtrelenir, path normalize edilir', () => {
    // .filter(item => item.path) - path bos ise dizi elemani tamamen dusuruluyor.
    // Kalan path'lerde ters slash / e cevrilir ve bastaki './' silinir.
    const normalized = normalizeImplementationEvidencePackage({
      changedFiles: [
        { path: '' },
        { path: '.\\src\\module\\file.ts', changeType: 'added', note: 'yeni dosya' }
      ]
    });

    assert.equal(normalized.changedFiles.length, 1);
    assert.equal(normalized.changedFiles[0].path, 'src/module/file.ts');
    assert.equal(normalized.changedFiles[0].changeType, 'added');
    assert.equal(normalized.changedFiles[0].note, 'yeni dosya');
  });

  it('changedFiles gecersiz changeType modified a duser', () => {
    const normalized = normalizeImplementationEvidencePackage({
      changedFiles: [{ path: 'a.ts', changeType: 'bilinmeyen' }]
    });

    assert.equal(normalized.changedFiles[0].changeType, 'modified');
  });

  it('testRuns command sahipsizse filtrelenir, gecersiz status not_run a duser', () => {
    const normalized = normalizeImplementationEvidencePackage({
      testRuns: [{ command: '' }, { command: 'npm test', status: 'bilinmeyen' }]
    });

    assert.equal(normalized.testRuns.length, 1);
    assert.equal(normalized.testRuns[0].command, 'npm test');
    assert.equal(normalized.testRuns[0].status, 'not_run');
  });

  it('acceptanceEvidence criterion sahipsizse filtrelenir, gecersiz status unclear a duser', () => {
    const normalized = normalizeImplementationEvidencePackage({
      acceptanceEvidence: [{ criterion: '' }, { criterion: 'Kabul kriteri 1', status: 'bilinmeyen' }]
    });

    assert.equal(normalized.acceptanceEvidence.length, 1);
    assert.equal(normalized.acceptanceEvidence[0].criterion, 'Kabul kriteri 1');
    assert.equal(normalized.acceptanceEvidence[0].status, 'unclear');
  });

  it('gecersiz source degeri manual a duser', () => {
    assert.equal(normalizeImplementationEvidencePackage({ source: 'bilinmeyen' }).source, 'manual');
  });

  it('gecersiz status degeri review_required a duser', () => {
    assert.equal(normalizeImplementationEvidencePackage({ status: 'bilinmeyen' }).status, 'review_required');
  });

  it('gecersiz review.outcome degeri needs_changes a duser', () => {
    assert.equal(normalizeImplementationEvidencePackage({ review: { outcome: 'bilinmeyen' } }).review.outcome, 'needs_changes');
  });

  it('tam doldurulmus deger degerleri korur', () => {
    const normalized = normalizeImplementationEvidencePackage({
      id: 'iep-1',
      taskId: 'task-1',
      baseCanonicalRevision: 2,
      source: 'codex',
      summary: 'Ozet',
      changedFiles: [{ path: 'src/a.ts', changeType: 'modified', note: 'not' }],
      testRuns: [{ command: 'npm run test:v4', status: 'passed', outputSummary: 'ok' }],
      acceptanceEvidence: [{ criterion: 'Kriter A', status: 'met', evidence: 'Kanit' }],
      remainingIssues: ['kalan sorun'],
      rollbackNotes: 'geri alma notu',
      review: { outcome: 'ready_for_approval', findings: ['bulgu-1'], reviewedAt: 't1', reviewerNote: 'not' },
      status: 'accepted',
      createdAt: '2026-08-01T00:00:00.000Z',
      resolvedAt: '2026-08-02T00:00:00.000Z'
    }, 3);

    assert.equal(normalized.id, 'iep-1');
    assert.equal(normalized.taskId, 'task-1');
    assert.equal(normalized.baseCanonicalRevision, 2);
    assert.equal(normalized.source, 'codex');
    assert.equal(normalized.summary, 'Ozet');
    assert.deepEqual(normalized.changedFiles, [{ path: 'src/a.ts', changeType: 'modified', note: 'not' }]);
    assert.deepEqual(normalized.testRuns, [{ command: 'npm run test:v4', status: 'passed', outputSummary: 'ok' }]);
    assert.deepEqual(normalized.acceptanceEvidence, [{ criterion: 'Kriter A', status: 'met', evidence: 'Kanit' }]);
    assert.deepEqual(normalized.remainingIssues, ['kalan sorun']);
    assert.equal(normalized.rollbackNotes, 'geri alma notu');
    assert.deepEqual(normalized.review, { outcome: 'ready_for_approval', findings: ['bulgu-1'], reviewedAt: 't1', reviewerNote: 'not' });
    assert.equal(normalized.status, 'accepted');
    assert.equal(normalized.createdAt, '2026-08-01T00:00:00.000Z');
    assert.equal(normalized.resolvedAt, '2026-08-02T00:00:00.000Z');
  });

  it('baseCanonicalRevision 1 in altina inemez', () => {
    assert.equal(normalizeImplementationEvidencePackage({ baseCanonicalRevision: 0 }).baseCanonicalRevision, 1);
  });
});

describe('normalizeDecision: kararin stage varsayilani (legacy-unclassified) - kullanicinin hic vermedigi karari ona atfetmemek icin', () => {
  it('stage belirtilmemis eski bir karar sessizce idea/technical olarak siniflandirilmaz, legacy-unclassified kalir', () => {
    const normalized = normalizeDecision({ decision: 'Veritabani olarak Postgres kullanilacak' }, 0);

    assert.equal(normalized.stage, 'legacy-unclassified');
  });

  it('gecerli stage degerleri (idea/technical) oldugu gibi korunur', () => {
    assert.equal(normalizeDecision({ decision: 'Karar', stage: 'idea' }).stage, 'idea');
    assert.equal(normalizeDecision({ decision: 'Karar', stage: 'technical' }).stage, 'technical');
  });

  it('gecersiz/bilinmeyen bir stage degeri de legacy-unclassified e duser, YOKSAYILMAZ ya da tahmin edilmez', () => {
    const normalized = normalizeDecision({ decision: 'Karar', stage: 'bilinmeyen-asama' });

    assert.equal(normalized.stage, 'legacy-unclassified');
  });
});

describe('normalizeProjectDocument: readiness dogrulama kapisi (readinessIsVerified)', () => {
  it('version 3 VE calculationProfile readiness-3.0 ise onceki readiness durumu ve qualityGate KORUNUR', () => {
    const project = {
      readiness: {
        version: 3,
        calculationProfile: 'readiness-3.0',
        status: 'ready',
        evidenceHash: 'readiness-fnv1a32-deadbeef',
        qualityGate: { passed: true, blockingCheckIds: [], conditions: [] },
        blockers: ['ozel-engel']
      }
    };

    const normalized = normalizeProjectDocument(project);

    assert.equal(normalized.readiness.calculationProfile, 'readiness-3.0');
    assert.equal(normalized.readiness.status, 'ready');
    assert.equal(normalized.readiness.evidenceHash, 'readiness-fnv1a32-deadbeef');
    assert.deepEqual(normalized.readiness.qualityGate, { passed: true, blockingCheckIds: [], conditions: [] });
    assert.deepEqual(normalized.readiness.blockers, ['ozel-engel']);
  });

  it('version/calculationProfile eslesmezse (veya hic yoksa) readiness legacy-unverified sayilir ve status blocked a zorlanir', () => {
    // Eski (V3 oncesi ya da baska bir hesaplama profiliyle uretilmis) readiness
    // kaydi "ready" ya da "needs_review" olsa bile GUVENILMEZ; kullanicinin
    // gormedigi bir hesaplamaya dayanarak kapiyi acik gostermemek icin status
    // sessizce 'blocked'a dusurulur.
    const project = {
      readiness: {
        version: 3,
        calculationProfile: 'legacy-unverified',
        status: 'ready',
        evidenceHash: 'onceki-hash',
        qualityGate: { passed: true, blockingCheckIds: [], conditions: [] },
        blockers: ['ozel-engel']
      }
    };

    const normalized = normalizeProjectDocument(project);

    assert.equal(normalized.readiness.calculationProfile, 'legacy-unverified');
    assert.equal(normalized.readiness.status, 'blocked');
    assert.equal(normalized.readiness.evidenceHash, 'legacy-unverified');
    assert.deepEqual(normalized.readiness.qualityGate, {
      passed: false,
      blockingCheckIds: [],
      conditions: [{
        id: 'readiness-calculation',
        label: 'Readiness kanıtı güncel',
        passed: false,
        message: 'Eski readiness kaydı Readiness 3.0 ile yeniden hesaplanmalı.',
        checkIds: []
      }]
    });
    assert.deepEqual(normalized.readiness.blockers, ['Canonical plan için Readiness 3.0 yeniden hesaplanmalı.']);
  });

  it('readiness hic yoksa (bos proje) da ayni guvenli olmayan varsayilanlara duser', () => {
    const normalized = normalizeProjectDocument({});

    assert.equal(normalized.readiness.calculationProfile, 'legacy-unverified');
    assert.equal(normalized.readiness.status, 'blocked');
  });
});

describe('normalizeProjectDocument: sourceSchemaRevision < 3 yeniden onay (reconfirmation) dali', () => {
  it('schemaRevision belirtilmemis (varsayilan 1, <3) eski projelerde conceptSummary yeniden onay gerektirir', () => {
    const project = {
      ideaLabSession: {
        conceptSummary: {
          summary: 'Ozet metni',
          userConfirmed: true,
          confirmedAt: '2020-01-01T00:00:00.000Z',
          openQuestions: ['Var olan soru']
        }
      }
    };

    const normalized = normalizeProjectDocument(project);
    const summary = normalized.ideaLabSession.conceptSummary;

    // userConfirmed=true olsa bile migration sonrasi ZORLA false'a cekilir.
    assert.equal(summary.userConfirmed, false);
    // confirmedAt spread ile undefined'a EZILIR (obje anahtari var ama degeri undefined).
    assert.equal(summary.confirmedAt, undefined);
    assert.ok('confirmedAt' in summary);
    // Eski soruya ek olarak migration uyarisi soru listesine EKLENIR, degistirilmez.
    assert.deepEqual(summary.openQuestions, [
      'Var olan soru',
      'Yeni hedef kullanıcı ve problem alanları migration sonrası doğrulanmalı.'
    ]);
  });

  it('schemaRevision 3 veya uzeri ise conceptSummary aynen (userConfirmed/confirmedAt korunarak) gecer', () => {
    const project = {
      schemaRevision: 3,
      ideaLabSession: {
        conceptSummary: {
          summary: 'Ozet metni',
          userConfirmed: true,
          confirmedAt: '2020-01-01T00:00:00.000Z',
          openQuestions: ['Var olan soru']
        }
      }
    };

    const normalized = normalizeProjectDocument(project);
    const summary = normalized.ideaLabSession.conceptSummary;

    assert.equal(summary.userConfirmed, true);
    assert.equal(summary.confirmedAt, '2020-01-01T00:00:00.000Z');
    assert.deepEqual(summary.openQuestions, ['Var olan soru']);
  });

  it('ideaLabSession.conceptSummary hic yoksa bu dal hic calismaz, alan eklenmez', () => {
    const normalized = normalizeProjectDocument({});

    assert.equal(normalized.ideaLabSession, undefined);
  });
});
