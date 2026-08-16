import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  approveSolutionDesign,
  reopenSolutionApproval,
  solutionApprovalReadiness
} from '../../../src/v4/application/solution-approval.js';
import { normalizeConcern, normalizeConcernDecision } from '../../../src/v4/application/concerns.js';
import { createProjectDocument } from '../../../src/v4/project-document.js';
import type { Concern, ConcernDecision, Decision, ProjectDocumentV5 } from '../../../src/v4/contracts.js';

const APPROVED = {
  status: 'approved' as const,
  approvedAtRevision: 3,
  approvedAt: '2026-08-16T00:00:00.000Z',
  reopenedReason: null
};

function ideaDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    stage: 'idea',
    id: 'dec-cevrimdisi',
    title: 'Çevrimdışı çalışma',
    decision: 'Sahada internetsiz çalışacak.',
    rationale: 'Gerekçe',
    alternatives: [],
    consequences: [],
    status: 'accepted',
    sourceSuggestionId: '',
    affectedSectionIds: [],
    ...overrides
  };
}

function technicalDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    ...ideaDecision(),
    stage: 'technical',
    id: 'decision-cand-sqlite',
    title: 'SQLite',
    decision: 'Yerel depolama SQLite.',
    evidence: { ideaDecisionIds: ['dec-cevrimdisi'], ideaConcernIds: [] },
    rejectedAlternatives: [],
    ...overrides
  };
}

interface Setup {
  concerns?: Partial<Concern>[];
  concernDecisions?: Partial<ConcernDecision>[];
  decisions?: Decision[];
  ideaApproved?: boolean;
}

function project(setup: Setup = {}): ProjectDocumentV5 {
  const document = createProjectDocument({ idea: 'Saha envanter uygulaması' }) as ProjectDocumentV5;
  if (setup.ideaApproved !== false) document.ideaDesign.approval = { ...APPROVED };
  document.decisions = setup.decisions ?? [ideaDecision(), technicalDecision()];
  document.solutionDesign.concerns = (setup.concerns ?? [
    { id: 'tc-depolama', title: 'Yerel veri deposu', status: 'decided' }
  ]).map((item, index) => normalizeConcern(item, index));
  document.solutionDesign.concernDecisions = (setup.concernDecisions ?? [
    { id: 'cd1', concernId: 'tc-depolama', answer: 'SQLite', decisionId: 'decision-cand-sqlite' }
  ]).map((item, index) => normalizeConcernDecision(item, index));
  return document;
}

describe('Technical Approval Gate — engeller', () => {
  it('temiz teknik tasarim onaylanabilir', () => {
    const readiness = solutionApprovalReadiness(project());

    assert.deepEqual(readiness.obstacles, []);
    assert.equal(readiness.canApprove, true);
  });

  it('cozulmemis kritik TEKNIK karar kapiyi kapatir', () => {
    const readiness = solutionApprovalReadiness(project({
      concerns: [{ id: 'tc-senk', title: 'Senkronizasyon', importance: 'critical', status: 'open' }],
      concernDecisions: []
    }));

    assert.equal(readiness.canApprove, false);
    assert.equal(readiness.blocking, 1);
  });

  it('canonical kayda BAGLANMAMIS teknik karar kapiyi kapatir', () => {
    // Bağlanmamışsa gereksinim ve görev üretimi o kararı hiç göremez;
    // plan, konuşmada kalmış bir karara dayanır.
    const readiness = solutionApprovalReadiness(project({
      concernDecisions: [{ id: 'cd1', concernId: 'tc-depolama', answer: 'SQLite', decisionId: null }]
    }));

    assert.deepEqual(readiness.obstacles.map(item => item.kind), ['unlinked-technical-decision']);
  });

  it('var olmayan canonical karara isaret eden bag da kabul edilmez', () => {
    const readiness = solutionApprovalReadiness(project({
      concernDecisions: [{ id: 'cd1', concernId: 'tc-depolama', answer: 'SQLite', decisionId: 'decision-hayali' }]
    }));

    assert.deepEqual(readiness.obstacles.map(item => item.kind), ['unlinked-technical-decision']);
  });

  it('dayandigi fikir karari geri alinmis teknik karar kapiyi kapatir', () => {
    // Kanıt zinciri koptuğunda bunu söyleyebiliyoruz; bir güven yüzdesi
    // bunu asla gösteremezdi.
    const readiness = solutionApprovalReadiness(project({
      decisions: [ideaDecision({ status: 'superseded' }), technicalDecision()]
    }));

    assert.deepEqual(readiness.obstacles.map(item => item.kind), ['ungrounded-technical-decision']);
  });

  it('fikir KONUSUNA dayanan karar, konu karara bagliyken gecerli kalir', () => {
    const document = project({ decisions: [technicalDecision({ evidence: { ideaDecisionIds: [], ideaConcernIds: ['ic-cevrimdisi'] } })] });
    document.ideaDesign.concerns = [normalizeConcern({ id: 'ic-cevrimdisi', title: 'Çevrimdışı', status: 'decided' })];

    assert.deepEqual(solutionApprovalReadiness(document).obstacles, []);
  });

  it('kaniti hic olmayan ESKI teknik karar engel sayilmaz', () => {
    // `evidence` alanı V3 öncesi kararlarda yok; onları toptan engel ilan
    // etmek göçü cezaya çevirirdi.
    const legacy = technicalDecision();
    delete legacy.evidence;

    assert.deepEqual(solutionApprovalReadiness(project({ decisions: [legacy] })).obstacles, []);
  });

  it('hicbir seye atif yapmayan karar "dayanagi gecersiz" diye suclanmaz', () => {
    // Geri dönülebilir bir aday gerekçesiz kabul edilebilir; kanıtı boş olur.
    // Böyle bir karar için "dayandığı fikir kararı artık geçerli değil" demek
    // düpedüz yanlış bir cümle olurdu — hiç dayanak gösterilmemişti.
    const readiness = solutionApprovalReadiness(project({
      decisions: [technicalDecision({ evidence: { ideaDecisionIds: [], ideaConcernIds: [] } })]
    }));

    assert.deepEqual(readiness.obstacles, []);
  });

  it('henuz kabul edilmemis teknik karar denetlenmez', () => {
    const readiness = solutionApprovalReadiness(project({
      decisions: [ideaDecision({ status: 'superseded' }), technicalDecision({ status: 'proposed' })]
    }));

    assert.deepEqual(readiness.obstacles, []);
  });
});

describe('Technical Approval Gate — onay', () => {
  it('temiz belgede onay yazilir', () => {
    const result = approveSolutionDesign(project(), { revision: 20, at: '2026-08-16T12:00:00.000Z' });

    assert.equal(result.approved, true);
    assert.equal(result.approved && result.approval.approvedAtRevision, 20);
  });

  it('FIKIR onayi alinmadan teknik onay verilemez', () => {
    // Idea → Solution atlaması da kaldırıldı.
    const result = approveSolutionDesign(
      project({ ideaApproved: false }),
      { revision: 20, at: '2026-08-16T12:00:00.000Z' }
    );

    assert.equal(result.approved, false);
    assert.match(result.approved ? '' : result.reason, /Fikir tasarımı onaylanmadan/);
  });

  it('engel varken onay reddedilir', () => {
    const result = approveSolutionDesign(
      project({ concerns: [{ id: 'tc', title: 'Senk', importance: 'critical', status: 'open' }], concernDecisions: [] }),
      { revision: 20, at: '2026-08-16T12:00:00.000Z' }
    );

    assert.equal(result.approved, false);
    assert.match(result.approved ? '' : result.reason, /Teknik tasarımda/);
  });

  it('onay belgeyi yerinde degistirmez', () => {
    const document = project();

    approveSolutionDesign(document, { revision: 20, at: '2026-08-16T12:00:00.000Z' });

    assert.equal(document.solutionDesign.approval.status, 'draft');
  });
});

describe('Technical Approval Gate — yeniden açma', () => {
  it('etkilenen teknik kararlar sayilarak bildirilir', () => {
    const document = project();
    document.solutionDesign.approval = { ...APPROVED };

    const result = reopenSolutionApproval(document, 'Cihaz hedefi değişti');

    assert.equal(result.solutionApproval.status, 'discovery');
    assert.deepEqual(result.affectedDecisionIds, ['decision-cand-sqlite']);
    assert.match(result.notice, /1 teknik karar gözden geçirilmeli/);
  });

  it('etkilenen karar yoksa sayi uydurulmaz', () => {
    const document = project({ decisions: [ideaDecision()] });
    document.solutionDesign.approval = { ...APPROVED };

    const result = reopenSolutionApproval(document, 'Neden');

    assert.doesNotMatch(result.notice, /gözden geçirilmeli/);
  });

  it('gerekcesiz yeniden acma reddedilir', () => {
    assert.throws(() => reopenSolutionApproval(project(), '  '), /neden/i);
  });
});
