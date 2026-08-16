import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  acceptCandidate,
  answerConcern,
  approveStage,
  confirmFraming,
  declineCandidate,
  deferConcern,
  dismissConcern,
  reopenApproval
} from '../../../src/v4/application/stage-commands.js';
import { normalizeConcern } from '../../../src/v4/application/concerns.js';
import { normalizeTechnologyCandidate } from '../../../src/v4/application/solution-design.js';
import { createProjectDocument } from '../../../src/v4/project-document.js';
import type { Concern, Decision, ProjectDocumentV5 } from '../../../src/v4/contracts.js';

const APPROVED = {
  status: 'approved' as const, approvedAtRevision: 2,
  approvedAt: '2026-08-16T00:00:00.000Z', reopenedReason: null
};
const AT = '2026-08-16T10:00:00.000Z';

function project(concerns: Partial<Concern>[] = []): ProjectDocumentV5 {
  const document = createProjectDocument({ idea: 'Unity’de at sistemi' }) as ProjectDocumentV5;
  document.ideaDesign.framing = { kind: 'system', domain: 'game', environment: 'Unity', source: 'confirmed' };
  document.ideaDesign.concerns = concerns.map((item, index) => normalizeConcern(item, index));
  return document;
}

const SAHIPLIK: Partial<Concern> = {
  id: 'ic-sahiplik',
  title: 'Sahiplik',
  whyItMatters: 'Kayıt ve ilerlemeyi belirliyor.',
  options: [
    { id: 'o-kalici', title: 'Kalıcı karakter', description: '', tradeoffs: ['Kayıt gerektirir'] },
    { id: 'o-ulasim', title: 'Sadece ulaşım', description: '', tradeoffs: [] }
  ]
};

describe('Çerçevelemeyi onaylama', () => {
  it('onay yalniz kullanicidan gelir', () => {
    const result = confirmFraming(project(), { kind: 'system', domain: 'game', environment: 'Unity' });

    assert.equal(result.error, null);
    assert.equal(result.project.ideaDesign.framing.source, 'confirmed');
  });

  it('bos cerceveleme kabul edilmez', () => {
    const result = confirmFraming(project(), { kind: 'unknown', domain: '  ', environment: '' });

    assert.match(result.error || '', /alan ya da ortam/);
  });
});

describe('Konuyu karara bağlama', () => {
  it('uc kayit BIRLIKTE dogar: durum, bag ve canonical karar', () => {
    // Ayrı ayrı yazılabilseydi izlenebilirlik zinciri yarım kalabilirdi.
    const result = answerConcern(project([SAHIPLIK]), {
      concernId: 'ic-sahiplik', chosenOptionId: 'o-kalici',
      answer: 'At kalıcı bir karakter.', rationale: 'Bağ kurulması isteniyor.', revision: 3
    });

    assert.equal(result.error, null);
    assert.equal(result.project.ideaDesign.concerns[0].status, 'decided');
    const link = result.project.ideaDesign.concernDecisions[0];
    assert.equal(link.decisionId, 'decision-ic-sahiplik');
    const decision = result.project.decisions.find(item => item.id === 'decision-ic-sahiplik');
    assert.equal(decision?.stage, 'idea');
    assert.equal(decision?.status, 'accepted');
  });

  it('secilmeyen secenekler karara ALTERNATIF olarak yazilir', () => {
    const result = answerConcern(project([SAHIPLIK]), {
      concernId: 'ic-sahiplik', chosenOptionId: 'o-kalici', answer: 'Kalıcı.', rationale: '', revision: 3
    });

    const decision = result.project.decisions.find(item => item.id === 'decision-ic-sahiplik');
    assert.deepEqual(decision?.alternatives, ['Sadece ulaşım']);
    assert.deepEqual(decision?.consequences, ['Kayıt gerektirir']);
  });

  it('kendi cevabini yazan kullanicinin secenegi bos kalir', () => {
    const result = answerConcern(project([SAHIPLIK]), {
      concernId: 'ic-sahiplik', chosenOptionId: null, answer: 'Üçüncü bir yol.', rationale: '', revision: 3
    });

    assert.equal(result.project.ideaDesign.concernDecisions[0].chosenOptionId, null);
  });

  it('bos karar reddedilir ve belge DEGISMEZ', () => {
    const document = project([SAHIPLIK]);
    const before = JSON.stringify(document);

    const result = answerConcern(document, {
      concernId: 'ic-sahiplik', chosenOptionId: null, answer: '   ', rationale: '', revision: 3
    });

    assert.match(result.error || '', /boş bırakılamaz/);
    assert.equal(JSON.stringify(result.project), before);
  });

  it('var olmayan secenek reddedilir', () => {
    const result = answerConcern(project([SAHIPLIK]), {
      concernId: 'ic-sahiplik', chosenOptionId: 'o-hayali', answer: 'Cevap', rationale: '', revision: 3
    });

    assert.match(result.error || '', /bulunmuyor/);
  });

  it('var olmayan konu reddedilir', () => {
    const result = answerConcern(project([SAHIPLIK]), {
      concernId: 'ic-yok', chosenOptionId: null, answer: 'Cevap', rationale: '', revision: 3
    });

    assert.match(result.error || '', /belgede yok/);
  });

  it('TEKNIK konunun karari technical asamaya yazilir', () => {
    // Aşama kapsayıcıdan okunur; komut çağıranın söylediğine güvenmez.
    const document = project();
    document.solutionDesign.concerns = [normalizeConcern({ id: 'tc-depolama', title: 'Depolama' })];

    const result = answerConcern(document, {
      concernId: 'tc-depolama', chosenOptionId: null, answer: 'SQLite', rationale: '', revision: 3
    });

    assert.equal(result.project.decisions[0].stage, 'technical');
    assert.equal(result.project.solutionDesign.concernDecisions.length, 1);
    assert.deepEqual(result.project.ideaDesign.concernDecisions, []);
  });

  it('ayni konu iki kez cevaplanirsa kayitlar cogalmaz', () => {
    const once = answerConcern(project([SAHIPLIK]), {
      concernId: 'ic-sahiplik', chosenOptionId: 'o-kalici', answer: 'İlk cevap', rationale: '', revision: 3
    }).project;

    const twice = answerConcern(once, {
      concernId: 'ic-sahiplik', chosenOptionId: 'o-ulasim', answer: 'Fikrimi değiştirdim', rationale: '', revision: 4
    }).project;

    assert.equal(twice.decisions.length, 1);
    assert.equal(twice.ideaDesign.concernDecisions.length, 1);
    assert.equal(twice.ideaDesign.concernDecisions[0].answer, 'Fikrimi değiştirdim');
  });

  it('girdi belgeyi yerinde degistirmez', () => {
    const document = project([SAHIPLIK]);

    answerConcern(document, { concernId: 'ic-sahiplik', chosenOptionId: null, answer: 'Cevap', rationale: '', revision: 3 });

    assert.equal(document.ideaDesign.concerns[0].status, 'open');
  });
});

describe('Erteleme ve kapsam dışı', () => {
  it('ertelenen konu kapiyi BLOKLAMAZ ama kaybolmaz', () => {
    const result = deferConcern(project([{ ...SAHIPLIK, importance: 'critical' }]), 'ic-sahiplik');

    assert.equal(result.project.ideaDesign.concerns[0].status, 'deferred');
    assert.match(result.notice, /kapsam dışı sayılmadı/);
  });

  it('kapsam disi birakilan konu kaydedilir', () => {
    const result = dismissConcern(project([SAHIPLIK]), 'ic-sahiplik');

    assert.equal(result.project.ideaDesign.concerns[0].status, 'irrelevant');
    assert.match(result.notice, /kapsam dışı/);
  });
});

describe('Onay ve geri alma', () => {
  it('kapi reddederse belge degismez ve neden doner', () => {
    const document = project([{ id: 'c', title: 'Kayıt', importance: 'critical', status: 'open' }]);

    const result = approveStage(document, 'idea', { revision: 4, at: AT });

    assert.match(result.error || '', /1 kritik karar/);
    assert.equal(result.project.ideaDesign.approval.status, 'draft');
  });

  it('temiz belgede onay yazilir', () => {
    const document = answerConcern(project([SAHIPLIK]), {
      concernId: 'ic-sahiplik', chosenOptionId: 'o-kalici', answer: 'Kalıcı.', rationale: '', revision: 3
    }).project;

    const result = approveStage(document, 'idea', { revision: 4, at: AT });

    assert.equal(result.error, null);
    assert.equal(result.project.ideaDesign.approval.approvedAtRevision, 4);
    assert.match(result.notice, /nasıl kuracağımızı/);
  });

  it('gerekcesiz geri alma reddedilir', () => {
    const document = project();
    document.ideaDesign.approval = { ...APPROVED };

    const result = reopenApproval(document, 'idea', '  ');

    assert.match(result.error || '', /nedenini yazman/);
    assert.equal(result.project.ideaDesign.approval.status, 'approved');
  });

  it('fikir onayi geri alininca teknik onay da acilir ve bu SOYLENIR', () => {
    const document = project();
    document.ideaDesign.approval = { ...APPROVED };
    document.solutionDesign.approval = { ...APPROVED };

    const result = reopenApproval(document, 'idea', 'Multiplayer istiyorum');

    assert.equal(result.project.solutionDesign.approval.status, 'discovery');
    assert.match(result.notice, /teknik onay da yeniden açıldı/);
  });
});

describe('Aday kararı', () => {
  function solutionProject(): ProjectDocumentV5 {
    const document = project();
    document.ideaDesign.approval = { ...APPROVED };
    document.decisions = [{
      stage: 'idea', id: 'dec-bag', title: 'Bağ kurma', decision: 'At kalıcı karakter.',
      rationale: '', alternatives: [], consequences: [], status: 'accepted',
      sourceSuggestionId: '', affectedSectionIds: []
    } as Decision];
    document.solutionDesign.concerns = [normalizeConcern({ id: 'tc-depolama', title: 'Depolama' })];
    document.solutionDesign.candidates = [normalizeTechnologyCandidate({
      id: 'cand-so', concernId: 'tc-depolama', title: 'ScriptableObject',
      reversibility: 'costly', evidence: { ideaDecisionIds: ['dec-bag'], ideaConcernIds: [] }
    })];
    return document;
  }

  it('kabul edilen aday canonical teknik karara donusur ve konu kapanir', () => {
    const result = acceptCandidate(solutionProject(), {
      candidateId: 'cand-so', statement: 'ScriptableObject + JSON', rationale: 'Bağ kararının gereği.',
      rejectedAlternatives: [], revision: 5
    });

    assert.equal(result.error, null);
    assert.equal(result.project.decisions.at(-1)?.stage, 'technical');
    assert.equal(result.project.solutionDesign.concerns[0].status, 'decided');
    assert.equal(result.project.solutionDesign.concernDecisions[0].decisionId, 'decision-cand-so');
  });

  it('gerekcesiz alternatif kabul edilmez ve belge degismez', () => {
    const document = solutionProject();

    const result = acceptCandidate(document, {
      candidateId: 'cand-so', statement: 'SO', rationale: 'Gerekçe',
      rejectedAlternatives: [{ candidateId: 'x', title: 'Bulut', reason: ' ' }], revision: 5
    });

    assert.match(result.error || '', /neden seçilmediği/);
    assert.deepEqual(result.project.solutionDesign.concernDecisions, []);
  });

  it('reddedilen aday nedeniyle kaydedilir', () => {
    const result = declineCandidate(solutionProject(), 'cand-so', 'Editör bağımlılığı istemiyorum');

    assert.equal(result.project.solutionDesign.candidates[0].status, 'rejected');
    assert.match(result.notice, /bir daha önerilmeyecek/);
  });

  it('nedensiz ret kabul edilmez', () => {
    const result = declineCandidate(solutionProject(), 'cand-so', '');

    assert.match(result.error || '', /neden/i);
    assert.equal(result.project.solutionDesign.candidates[0].status, 'proposed');
  });
});
