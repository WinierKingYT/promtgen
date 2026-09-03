import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applySolutionDiscovery,
  canDiscoverSolution
} from '../../../src/v4/application/solution-discovery-service.js';
import { solutionDiscoverySchema } from '../../../src/v4/ai/schemas/schemas.js';
import { solutionDiscoveryTask } from '../../../src/v4/ai/tasks/solution-discovery.js';
import { normalizeConcern } from '../../../src/v4/application/concerns.js';
import { createProjectDocument } from '../../../src/v4/project-document.js';
import type { SolutionDiscoveryOutput } from '../../../src/v4/ai/schemas/schemas.js';
import type { Decision, ProjectDocumentV5 } from '../../../src/v4/contracts.js';

const APPROVED = {
  status: 'approved' as const,
  approvedAtRevision: 3,
  approvedAt: '2026-08-16T00:00:00.000Z',
  reopenedReason: null
};

const IDEA_DECISION: Decision = {
  stage: 'idea',
  id: 'dec-cevrimdisi',
  title: 'Çevrimdışı çalışma',
  decision: 'Uygulama sahada internetsiz çalışacak.',
  rationale: 'Kullanıcı sahada.',
  alternatives: [],
  consequences: [],
  status: 'accepted',
  sourceSuggestionId: '',
  affectedSectionIds: []
};

function approvedProject(): ProjectDocumentV5 {
  const document = createProjectDocument({ idea: 'Saha envanter uygulaması' }) as ProjectDocumentV5;
  document.ideaDesign.approval = { ...APPROVED };
  document.decisions = [IDEA_DECISION];
  return document;
}

function output(overrides: Partial<SolutionDiscoveryOutput> = {}): Pick<SolutionDiscoveryOutput, 'technicalConcerns' | 'candidates' | 'openQuestions'> {
  return {
    technicalConcerns: [{
      title: 'Yerel veri deposu',
      description: 'Cihazda veri nasıl tutulacak',
      category: 'Depolama',
      importance: 'critical',
      whyItMatters: 'Senkronizasyon ve çakışma çözümünü belirliyor.',
      questions: ['Veriler cihazda nasıl tutulacak?'],
      uncertainty: 0.8,
      downstreamImpact: 0.9,
      dependsOnTitles: []
    }],
    candidates: [],
    openQuestions: [],
    ...overrides
  };
}

describe('Teknik keşif kapısı', () => {
  it('fikir onaylanmadan teknik kesif calismaz', () => {
    // Cevabı henüz bilinmeyen bir sorunun teknik çözümü tartışılamaz.
    const gate = canDiscoverSolution(createProjectDocument({ idea: 'Bir fikir' }) as ProjectDocumentV5);

    assert.equal(gate.open, false);
  });

  it('fikir onaylandiysa acilir', () => {
    assert.equal(canDiscoverSolution(approvedProject()).open, true);
  });

  it('onay alinmis gorunse bile bloklayan fikir konusu kapiyi kapatir', () => {
    const document = approvedProject();
    document.ideaDesign.concerns = [normalizeConcern({ id: 'c', title: 'Kayıt', importance: 'critical', status: 'open' })];

    assert.equal(canDiscoverSolution(document).open, false);
  });
});

describe('Teknik keşif çıktısı → canonical model', () => {
  it('teknik konular concern olur', () => {
    const result = applySolutionDiscovery(output(), approvedProject());

    assert.equal(result.concerns.length, 1);
    assert.equal(result.concerns[0].title, 'Yerel veri deposu');
    assert.equal(result.concerns[0].importance, 'critical');
  });

  it('bagimlilik BASLIKTAN kimlige cevrilir', () => {
    const result = applySolutionDiscovery(output({
      technicalConcerns: [
        { ...output().technicalConcerns[0], title: 'Yerel veri deposu' },
        { ...output().technicalConcerns[0], title: 'Senkronizasyon', dependsOnTitles: ['Yerel veri deposu'] }
      ]
    }), approvedProject());

    assert.deepEqual(result.concerns[1].dependsOn, [result.concerns[0].id]);
  });

  it('karsiligi olmayan bagimlilik basligi DUSER - uydurulmus bagimlilik akisi kilitlemez', () => {
    const result = applySolutionDiscovery(output({
      technicalConcerns: [{ ...output().technicalConcerns[0], dependsOnTitles: ['Hiç bahsedilmeyen konu'] }]
    }), approvedProject());

    assert.deepEqual(result.concerns[0].dependsOn, []);
  });

  it('gerekcesi olan aday kabul edilir', () => {
    const result = applySolutionDiscovery(output({
      candidates: [{
        concernTitle: 'Yerel veri deposu',
        title: 'SQLite',
        category: 'veritabanı',
        rationale: 'Çevrimdışı kararının gereği.',
        tradeoffs: ['Eşzamanlı yazma sınırlı'],
        reversibility: 'costly',
        derivedFromIdeaDecisionIds: ['dec-cevrimdisi'],
        derivedFromIdeaConcernIds: []
      }]
    }), approvedProject());

    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0].concernId, result.concerns[0].id);
    assert.deepEqual(result.refused, []);
  });

  it('gerekcesiz geri donulemez aday ELENIR ve nedeni doner', () => {
    // Modelin "PostgreSQL öneriyorum" demesi engellenemez; çekirdeğin onu
    // kabul etmesi engellenir. Sessiz düşüş olmaz.
    const result = applySolutionDiscovery(output({
      candidates: [{
        concernTitle: 'Yerel veri deposu',
        title: 'PostgreSQL',
        category: 'veritabanı',
        rationale: 'Yaygın ve güçlü.',
        tradeoffs: [],
        reversibility: 'irreversible',
        derivedFromIdeaDecisionIds: [],
        derivedFromIdeaConcernIds: []
      }]
    }), approvedProject());

    assert.deepEqual(result.candidates, []);
    assert.equal(result.refused.length, 1);
    assert.match(result.refused[0].reason, /hangi fikir kararından/i);
  });

  it('uydurulmus karar kimligi gerekce sayilmaz', () => {
    const result = applySolutionDiscovery(output({
      candidates: [{
        concernTitle: 'Yerel veri deposu',
        title: 'Realm',
        category: 'veritabanı',
        rationale: 'Hızlı.',
        tradeoffs: [],
        reversibility: 'irreversible',
        derivedFromIdeaDecisionIds: ['dec-hayali'],
        derivedFromIdeaConcernIds: []
      }]
    }), approvedProject());

    assert.equal(result.refused.length, 1);
  });

  it('geri donulebilir aday KABUL EDILIR ama uydurma kimlik BELGEYE YAZILMAZ', () => {
    // Ucuz bir seçeneği konuşmak keşfin kendisidir; ama gerekçesi uydurmaysa
    // belge çözülemeyen bir soyağacı iddiası taşıyamaz.
    const result = applySolutionDiscovery(output({
      candidates: [{
        concernTitle: 'Yerel veri deposu',
        title: 'JSON dosyası',
        category: 'veritabanı',
        rationale: 'Basit.',
        tradeoffs: [],
        reversibility: 'reversible',
        derivedFromIdeaDecisionIds: ['dec-hayali', 'dec-uydurma'],
        derivedFromIdeaConcernIds: ['ic-hayali']
      }]
    }), approvedProject());

    assert.equal(result.candidates.length, 1);
    assert.deepEqual(result.candidates[0].evidence, { ideaDecisionIds: [], ideaConcernIds: [] });
    assert.deepEqual(result.refused, []);
  });

  it('geri donulebilir adayda GERCEK kimlik kalir, uydurmalar duser', () => {
    const result = applySolutionDiscovery(output({
      candidates: [{
        concernTitle: 'Yerel veri deposu',
        title: 'IndexedDB',
        category: 'veritabanı',
        rationale: 'Tarayıcıda çevrimdışı.',
        tradeoffs: [],
        reversibility: 'reversible',
        derivedFromIdeaDecisionIds: ['dec-hayali', 'dec-cevrimdisi', 'dec-uydurma'],
        derivedFromIdeaConcernIds: []
      }]
    }), approvedProject());

    assert.equal(result.candidates.length, 1);
    assert.deepEqual(result.candidates[0].evidence, {
      ideaDecisionIds: ['dec-cevrimdisi'],
      ideaConcernIds: []
    });
  });

  it('geri donulemez aday BIR gercek kimlikle kabul edilmeye devam eder', () => {
    // Süzme yalnız neyin saklandığını değiştirir; kimin kabul edildiğini değil.
    const result = applySolutionDiscovery(output({
      candidates: [{
        concernTitle: 'Yerel veri deposu',
        title: 'SQLite',
        category: 'veritabanı',
        rationale: 'Çevrimdışı kararının gereği.',
        tradeoffs: [],
        reversibility: 'irreversible',
        derivedFromIdeaDecisionIds: ['dec-hayali', 'dec-cevrimdisi', 'dec-uydurma'],
        derivedFromIdeaConcernIds: []
      }]
    }), approvedProject());

    assert.deepEqual(result.refused, []);
    assert.equal(result.candidates.length, 1);
    assert.deepEqual(result.candidates[0].evidence, {
      ideaDecisionIds: ['dec-cevrimdisi'],
      ideaConcernIds: []
    });
  });

  it('geri donulemez aday YALNIZ uydurma kimlikle REDDEDILMEYE devam eder', () => {
    const result = applySolutionDiscovery(output({
      candidates: [{
        concernTitle: 'Yerel veri deposu',
        title: 'PostgreSQL',
        category: 'veritabanı',
        rationale: 'Yaygın.',
        tradeoffs: [],
        reversibility: 'irreversible',
        derivedFromIdeaDecisionIds: ['dec-hayali'],
        derivedFromIdeaConcernIds: ['ic-hayali']
      }]
    }), approvedProject());

    assert.deepEqual(result.candidates, []);
    assert.equal(result.refused.length, 1);
    assert.match(result.refused[0].reason, /hangi fikir kararından/i);
  });

  it('suzulen kimlik sayisi IZLENEBILIR - sessiz dusus olmaz', () => {
    const result = applySolutionDiscovery(output({
      candidates: [{
        concernTitle: 'Yerel veri deposu',
        title: 'IndexedDB',
        category: 'veritabanı',
        rationale: 'Tarayıcıda çevrimdışı.',
        tradeoffs: [],
        reversibility: 'reversible',
        derivedFromIdeaDecisionIds: ['dec-hayali', 'dec-cevrimdisi'],
        derivedFromIdeaConcernIds: ['ic-hayali']
      }]
    }), approvedProject());

    assert.equal(result.ungroundedEvidenceIdCount, 2);
  });

  it('onemsiz konu, ayni etkideki kritik konunun onune gecmez', () => {
    const result = applySolutionDiscovery(output({
      technicalConcerns: [
        { ...output().technicalConcerns[0], title: 'Kritik', importance: 'critical', downstreamImpact: 0.8 },
        { ...output().technicalConcerns[0], title: 'İsteğe bağlı', importance: 'optional', downstreamImpact: 0.8 }
      ]
    }), approvedProject());

    assert.ok(result.concerns[0].downstreamImpact > result.concerns[1].downstreamImpact);
  });
});

describe('Teknik keşif görevi', () => {
  it('gercek kimlikler baglama yazilir - model gormeden gerekce gosteremez', () => {
    const context = solutionDiscoveryTask.buildContext(approvedProject()) as Record<string, unknown>;

    assert.deepEqual(
      (context.approvedIdeaDecisions as Array<{ id: string }>).map(item => item.id),
      ['dec-cevrimdisi']
    );
  });

  it('kabul EDILMEMIS fikir karari baglama yazilmaz', () => {
    const document = approvedProject();
    document.decisions = [{ ...IDEA_DECISION, status: 'proposed' }];

    const context = solutionDiscoveryTask.buildContext(document) as Record<string, unknown>;

    assert.deepEqual(context.approvedIdeaDecisions, []);
  });

  it('reddedilen adaylar baglamda gorunur - ayni oneri tekrarlanmasin', () => {
    const document = approvedProject();
    document.solutionDesign.candidates = [{
      id: 'cand-pg', concernId: '', title: 'PostgreSQL', category: 'db', rationale: '',
      tradeoffs: [], reversibility: 'irreversible',
      evidence: { ideaDecisionIds: [], ideaConcernIds: [] },
      status: 'rejected', rejectionReason: 'Sunucu yok'
    }];

    const context = solutionDiscoveryTask.buildContext(document) as Record<string, unknown>;

    assert.deepEqual(context.rejectedCandidates, [{ title: 'PostgreSQL', reason: 'Sunucu yok' }]);
  });

  it('istem gerekce uydurmayi acikca yasaklar', () => {
    const prompt = solutionDiscoveryTask.buildPrompt(approvedProject());

    assert.match(prompt, /Kimlik uydurma/);
    assert.match(prompt, /karar değildir/);
  });

  it('sema gerekceyi ZORUNLU kilmaz - zorunlu olsa model uydururdu', () => {
    const parsed = solutionDiscoverySchema.safeParse({
      technicalConcerns: [output().technicalConcerns[0]],
      candidates: [{
        concernTitle: 'Yerel veri deposu',
        title: 'SQLite',
        category: 'db',
        rationale: 'Gerekçe',
        reversibility: 'reversible'
      }]
    });

    assert.equal(parsed.success, true);
  });

  it('BOS teknik konu listesi gecerli bir cevaptir', () => {
    // Ürün "teknik karar gerekmiyor"u meşru bir sonuç sayıyor. Şema alt sınır
    // dayatsaydı dürüst cevap şemadan düşerdi ve teknik tarafta yerel yedek
    // motor olmadığı için tur hata verirdi; model de listeyi doldurmak için
    // konu uydurmaya itilirdi.
    const parsed = solutionDiscoverySchema.safeParse({ technicalConcerns: [] });

    assert.equal(parsed.success, true);
  });

  it('bos kesif ciktisi bos sonuc uretir, cokmez', () => {
    const result = applySolutionDiscovery(
      { technicalConcerns: [], candidates: [], openQuestions: [] },
      approvedProject()
    );

    assert.deepEqual(result.concerns, []);
    assert.deepEqual(result.candidates, []);
  });

  it('sema bilinmeyen ust seviye alani reddeder', () => {
    const parsed = solutionDiscoverySchema.safeParse({
      technicalConcerns: [output().technicalConcerns[0]],
      surpriseField: 'x'
    });

    assert.equal(parsed.success, false);
  });
});
