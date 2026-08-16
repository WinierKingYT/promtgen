import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  admitCandidate,
  normalizeTechnologyCandidate,
  promoteCandidate,
  rejectCandidate
} from '../../../src/v4/application/solution-design.js';
import { normalizeConcern } from '../../../src/v4/application/concerns.js';
import { createProjectDocument } from '../../../src/v4/project-document.js';
import type { Decision, ProjectDocumentV5, TechnologyCandidate } from '../../../src/v4/contracts.js';

function ideaDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    stage: 'idea',
    id: 'dec-cevrimdisi',
    title: 'Çevrimdışı çalışma',
    decision: 'Uygulama tamamen çevrimdışı çalışacak.',
    rationale: 'Kullanıcı sahada internetsiz.',
    alternatives: [],
    consequences: [],
    status: 'accepted',
    sourceSuggestionId: '',
    affectedSectionIds: [],
    ...overrides
  };
}

function project(decisions: Decision[] = [ideaDecision()]): ProjectDocumentV5 {
  const document = createProjectDocument({ idea: 'Saha ekibi için envanter uygulaması' }) as ProjectDocumentV5;
  document.decisions = decisions;
  document.solutionDesign.concerns = [normalizeConcern({ id: 'tc-depolama', title: 'Depolama' })];
  return document;
}

function candidate(overrides: Partial<TechnologyCandidate> = {}): TechnologyCandidate {
  return normalizeTechnologyCandidate({
    id: 'cand-sqlite',
    concernId: 'tc-depolama',
    title: 'SQLite',
    category: 'veritabanı',
    rationale: 'Çevrimdışı çalışma kararı yerel bir veri deposu gerektiriyor.',
    tradeoffs: ['Eşzamanlı yazma sınırlı'],
    reversibility: 'costly',
    evidence: { ideaDecisionIds: ['dec-cevrimdisi'], ideaConcernIds: [] },
    ...overrides
  });
}

describe('Erken teknoloji yasağı', () => {
  it('gerekcesi fikir kararina dayanan aday kabul edilir', () => {
    const result = admitCandidate(candidate(), project());

    assert.equal(result.admitted, true);
  });

  it('hicbir fikir kararina dayanmayan geri donulemez oneri REDDEDILIR', () => {
    // "E-ticaret sitesi istiyorum" cümlesine "React + Node + PostgreSQL"
    // cevabı verilmez; problem henüz bilinmiyor.
    const result = admitCandidate(
      candidate({ evidence: { ideaDecisionIds: [], ideaConcernIds: [] } }),
      project()
    );

    assert.equal(result.admitted, false);
    assert.match(result.reason, /hangi.*karar|gerekçe/i);
  });

  it('var olmayan karara atif yapan aday da reddedilir - uydurulmus gerekce gecmez', () => {
    // Aksi hâlde model gerekçeyi kimlik uydurarak üretebilirdi.
    const result = admitCandidate(
      candidate({ evidence: { ideaDecisionIds: ['dec-hayali'], ideaConcernIds: [] } }),
      project()
    );

    assert.equal(result.admitted, false);
  });

  it('henuz kabul edilmemis fikir karari gerekce sayilmaz', () => {
    const result = admitCandidate(
      candidate(),
      project([ideaDecision({ status: 'proposed' })])
    );

    assert.equal(result.admitted, false);
  });

  it('teknik olmayan asamadan gelen karar gerekce sayilmaz', () => {
    // `legacy-unclassified` bir karar, kullanıcının fikir aşamasında verdiği
    // karar olarak sayılamaz — hangi aşamaya ait olduğu bilinmiyor.
    const result = admitCandidate(
      candidate(),
      project([ideaDecision({ stage: 'legacy-unclassified' })])
    );

    assert.equal(result.admitted, false);
  });

  it('geri donulebilir oneri gerekcesiz de sunulabilir', () => {
    // Yasak, geri dönülemez kararları erken çivilemeye karşıdır; ucuz bir
    // öneriyi konuşmak keşfin kendisidir.
    const result = admitCandidate(
      candidate({ reversibility: 'reversible', evidence: { ideaDecisionIds: [], ideaConcernIds: [] } }),
      project()
    );

    assert.equal(result.admitted, true);
  });

  it('karara baglanmis fikir KONUSU da gecerli gerekcedir', () => {
    const document = project([]);
    document.ideaDesign.concerns = [normalizeConcern({ id: 'ic-cevrimdisi', title: 'Çevrimdışı', status: 'decided' })];

    const result = admitCandidate(
      candidate({ evidence: { ideaDecisionIds: [], ideaConcernIds: ['ic-cevrimdisi'] } }),
      document
    );

    assert.equal(result.admitted, true);
  });

  it('cozulmemis fikir konusu gerekce sayilmaz', () => {
    const document = project([]);
    document.ideaDesign.concerns = [normalizeConcern({ id: 'ic-cevrimdisi', title: 'Çevrimdışı', status: 'open' })];

    const result = admitCandidate(
      candidate({ evidence: { ideaDecisionIds: [], ideaConcernIds: ['ic-cevrimdisi'] } }),
      document
    );

    assert.equal(result.admitted, false);
  });

  it('daha once reddedilmis aday yeniden sunulamaz', () => {
    // Fikir tarafındaki "çözülmüş konu dirilmez" değişmezinin teknik
    // karşılığı; olmazsa AI aynı teknolojiyi her turda yeniden önerir.
    const document = project();
    document.solutionDesign.candidates = [rejectCandidate(candidate(), 'Ekip SQLite bilmiyor')];

    const result = admitCandidate(candidate({ id: 'cand-yeni' }), document);

    assert.equal(result.admitted, false);
    assert.match(result.reason, /reddedildi/i);
  });
});

describe('Öneri ≠ Karar', () => {
  const evaluated = [
    { candidateId: 'cand-pg', title: 'PostgreSQL', reason: 'Sunucu gerektiriyor, çevrimdışı çalışmıyor.' }
  ];

  it('kabul edilen aday canonical TEKNIK karara donusur', () => {
    const result = promoteCandidate(candidate(), project(), {
      statement: 'Yerel depolama SQLite ile yapılacak.',
      rationale: 'Çevrimdışı çalışma kararının gereği.',
      rejectedAlternatives: evaluated,
      revision: 9
    });

    assert.equal(result.promoted, true);
    assert.equal(result.promoted && result.decision.stage, 'technical');
    assert.equal(result.promoted && result.decision.status, 'accepted');
    assert.equal(result.promoted && result.decision.sourceSuggestionId, 'cand-sqlite');
  });

  it('karar, neden secilmedigini tasiyan alternatifleri saklar - bu bir ADR', () => {
    const result = promoteCandidate(candidate(), project(), {
      statement: 'SQLite',
      rationale: 'Gerekçe',
      rejectedAlternatives: evaluated,
      revision: 9
    });

    assert.deepEqual(
      result.promoted ? result.decision.rejectedAlternatives : [],
      evaluated
    );
  });

  it('gerekcesiz reddedilmis alternatif kabul edilmez', () => {
    // "PostgreSQL'i değerlendirdik" demek, neden seçilmediğini söylemeden
    // bir ADR oluşturmaz.
    const result = promoteCandidate(candidate(), project(), {
      statement: 'SQLite',
      rationale: 'Gerekçe',
      rejectedAlternatives: [{ candidateId: 'cand-pg', title: 'PostgreSQL', reason: '  ' }],
      revision: 9
    });

    assert.equal(result.promoted, false);
    assert.match(result.promoted ? '' : result.reason, /neden seçilmediği/i);
  });

  it('gerekcesiz karar kabul edilmez', () => {
    const result = promoteCandidate(candidate(), project(), {
      statement: 'SQLite',
      rationale: '   ',
      rejectedAlternatives: [],
      revision: 9
    });

    assert.equal(result.promoted, false);
  });

  it('kabul edilmeyen aday karara yukseltilemez', () => {
    const result = promoteCandidate(
      candidate({ evidence: { ideaDecisionIds: [], ideaConcernIds: [] } }),
      project(),
      { statement: 'SQLite', rationale: 'Gerekçe', rejectedAlternatives: [], revision: 9 }
    );

    assert.equal(result.promoted, false);
  });

  it('eski alternatives alani da doldurulur - mevcut tuketiciler kirilmaz', () => {
    const result = promoteCandidate(candidate(), project(), {
      statement: 'SQLite',
      rationale: 'Gerekçe',
      rejectedAlternatives: evaluated,
      revision: 9
    });

    assert.deepEqual(result.promoted ? result.decision.alternatives : [], ['PostgreSQL']);
  });

  it('guven yuzdesi degil KANIT tasinir', () => {
    const result = promoteCandidate(candidate(), project(), {
      statement: 'SQLite',
      rationale: 'Gerekçe',
      rejectedAlternatives: [],
      revision: 9
    });

    const decision = result.promoted ? result.decision : null;
    assert.deepEqual(decision?.evidence?.ideaDecisionIds, ['dec-cevrimdisi']);
    assert.equal('confidence' in (decision || {}), false);
  });
});

describe('Aday normalleştirme', () => {
  it('eksik alanlari guvenli varsayilanlarla doldurur', () => {
    const normalized = normalizeTechnologyCandidate({}, 2);

    assert.equal(normalized.id, 'candidate-3');
    assert.equal(normalized.status, 'proposed');
    assert.deepEqual(normalized.evidence, { ideaDecisionIds: [], ideaConcernIds: [] });
  });

  it('bilinmeyen geri donulebilirlik en TEMKINLI degere duser', () => {
    // Bilinmiyorsa ucuz varsaymak, yasağı kazara devre dışı bırakırdı.
    const normalized = normalizeTechnologyCandidate({ reversibility: 'belki' as never });

    assert.equal(normalized.reversibility, 'irreversible');
  });

  it('reddedilen aday nedenini tasir', () => {
    const rejected = rejectCandidate(candidate(), 'Ekip bilmiyor');

    assert.equal(rejected.status, 'rejected');
    assert.equal(rejected.rejectionReason, 'Ekip bilmiyor');
  });

  it('nedensiz reddetme kabul edilmez', () => {
    assert.throws(() => rejectCandidate(candidate(), ''), /neden/i);
  });
});
