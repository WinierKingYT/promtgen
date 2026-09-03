import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { stageRail } from '../../../src/v4/application/workspace-stages.js';
import { normalizeConcern, normalizeConcernDecision } from '../../../src/v4/application/concerns.js';
import { createProjectDocument } from '../../../src/v4/project-document.js';
import type { Concern, ProjectDocumentV5 } from '../../../src/v4/contracts.js';

const APPROVED = {
  status: 'approved' as const,
  approvedAtRevision: 3,
  approvedAt: '2026-08-16T00:00:00.000Z',
  reopenedReason: null
};

function project(options: { concerns?: Partial<Concern>[]; idea?: boolean; solution?: boolean; framed?: boolean; finalized?: boolean } = {}): ProjectDocumentV5 {
  const document = createProjectDocument({ idea: 'Unity’de at sistemi' }) as ProjectDocumentV5;
  if (options.framed !== false) {
    document.ideaDesign.framing = { kind: 'system', domain: 'game', environment: 'Unity', source: 'confirmed' };
  }
  document.ideaDesign.concerns = (options.concerns || []).map((item, index) => normalizeConcern(item, index));
  document.ideaDesign.concernDecisions = document.ideaDesign.concerns
    .filter(concern => concern.status === 'decided')
    .map((concern, index) => normalizeConcernDecision({ id: `cd-${index}`, concernId: concern.id, answer: 'Cevap' }, index));
  if (options.idea) document.ideaDesign.approval = { ...APPROVED };
  if (options.solution) document.solutionDesign.approval = { ...APPROVED };
  if (options.finalized) document.lifecycle.status = 'finalized';
  return document;
}

const byId = (rail: ReturnType<typeof stageRail>, id: string) => rail.find(entry => entry.id === id);

describe('Aşama rayı', () => {
  it('dort ust duzey asama gorunur', () => {
    assert.deepEqual(stageRail(project()).map(entry => entry.label), ['FİKİR', 'ÇÖZÜM', 'PLAN', 'DEVİR']);
  });

  it('kilitli asama GIZLENMEZ, nedeni yazilir', () => {
    // Görmediği bir yolun kapalı olduğunu kullanıcı anlayamaz.
    const solution = byId(stageRail(project()), 'solution');

    assert.equal(solution?.state, 'locked');
    assert.match(solution?.lockReason || '', /Fikir tasarımı henüz onaylanmadı/);
  });

  it('bloklayan konu varken kilit nedeni ENGEL SAYISINI soyler', () => {
    const solution = byId(stageRail(project({
      concerns: [{ id: 'c', title: 'Kayıt', importance: 'critical', status: 'open' }]
    })), 'solution');

    assert.match(solution?.lockReason || '', /1 kritik karar/);
  });

  it('fikir onaylaninca fikir "tamamlandi", cozum "guncel" olur', () => {
    const rail = stageRail(project({ idea: true }));

    assert.equal(byId(rail, 'idea')?.state, 'done');
    assert.equal(byId(rail, 'solution')?.state, 'current');
  });

  it('iki onay da alininca plan acilir ama DEVIR plan finalize olana dek kilitli', () => {
    const rail = stageRail(project({ idea: true, solution: true }));

    assert.equal(byId(rail, 'plan')?.state, 'current');
    // Agent Devri, yarim bir plani coding agent'a birakmasin diye kapali kalir.
    assert.equal(byId(rail, 'handoff')?.state, 'locked');
    assert.match(byId(rail, 'handoff')?.lockReason || '', /Plan henüz finalize edilmedi/);
  });

  it('plan finalize olunca DEVIR acilir', () => {
    const rail = stageRail(project({ idea: true, solution: true, finalized: true }));

    assert.equal(byId(rail, 'handoff')?.state, 'current');
    assert.equal(byId(rail, 'handoff')?.lockReason, null);
  });
});

describe('Başlıklar — kullanıcı sistemi öğrenmez', () => {
  it('konusulan konu kullanicinin kendi cumlesiyle gorunur', () => {
    const rail = stageRail(project({
      concerns: [{ id: 'c', title: 'Atın oyuncuyla ilişkisi', uncertainty: 0.9, downstreamImpact: 0.9 }]
    }));

    assert.equal(byId(rail, 'idea')?.caption, 'Şimdi “Atın oyuncuyla ilişkisi” konusunu netleştiriyoruz.');
  });

  it('cerceveleme bilinmiyorsa once o soylenir', () => {
    const rail = stageRail(project({ framed: false }));

    assert.equal(byId(rail, 'idea')?.caption, 'Ne tasarladığımızı netleştiriyoruz.');
  });

  it('konusulacak konu kalmayinca fikir tasariminin net oldugu soylenir', () => {
    const rail = stageRail(project({ concerns: [{ id: 'c', title: 'Stamina', status: 'decided' }] }));

    assert.equal(byId(rail, 'idea')?.caption, 'Fikir tasarımı yeterince net.');
  });

  it('hicbir metinde IC MODEL terimi gecmez', () => {
    // Kullanıcı `Concern Map`, `Decision Graph`, `Canonical Revision` gibi
    // kavramları öğrenmek zorunda kalmaz. Bunlar iç modeldir.
    const rail = stageRail(project({
      concerns: [
        { id: 'a', title: 'Kayıt', importance: 'critical', status: 'open' },
        { id: 'b', title: 'Stamina', status: 'deferred' }
      ]
    }));
    const shown = rail.flatMap(entry => [entry.label, entry.caption, entry.lockReason || '', ...entry.lines, ...entry.groups.map(group => group.label)]);

    for (const text of shown) {
      assert.doesNotMatch(text, /concern|canonical|revision|trace|decision graph|schema/i, `iç model sızdı: ${text}`);
    }
  });

  it('hicbir metinde yuzde ya da X/Y skoru gecmez', () => {
    const rail = stageRail(project({ concerns: [{ id: 'a', title: 'Kayıt', importance: 'critical', status: 'open' }] }));
    const shown = rail.flatMap(entry => [entry.caption, entry.lockReason || '', ...entry.lines]);

    for (const text of shown) {
      assert.doesNotMatch(text, /%|\d+\s*\/\s*\d+/, `sahte kesinlik: ${text}`);
    }
  });
});

describe('İlerleme — anket değil', () => {
  it('konular kendi kategorileriyle gruplanir', () => {
    const rail = stageRail(project({
      concerns: [
        { id: 'a', title: 'Biniş', category: 'Hareket', status: 'decided' },
        { id: 'b', title: 'Kayıt', category: 'Kalıcılık', status: 'open', uncertainty: 0.9, downstreamImpact: 0.9 }
      ]
    }));

    assert.deepEqual(byId(rail, 'idea')?.groups, [
      { label: 'Hareket', state: 'done' },
      { label: 'Kalıcılık', state: 'active' }
    ]);
  });

  it('sirada bekleyen grup "todo" olur', () => {
    const rail = stageRail(project({
      concerns: [
        { id: 'a', title: 'Kayıt', category: 'Kalıcılık', status: 'open', uncertainty: 0.9, downstreamImpact: 0.9 },
        { id: 'b', title: 'Zırh', category: 'Ekipman', status: 'open', uncertainty: 0.1, downstreamImpact: 0.1 }
      ]
    }));

    assert.deepEqual(byId(rail, 'idea')?.groups.find(group => group.label === 'Ekipman')?.state, 'todo');
  });

  it('gruplar yalniz icinde bulunulan asamada gosterilir', () => {
    const rail = stageRail(project({ idea: true, concerns: [{ id: 'a', title: 'Biniş', category: 'Hareket' }] }));

    assert.deepEqual(byId(rail, 'idea')?.groups, []);
  });

  it('engel satirlari yalniz icinde bulunulan asamada gosterilir', () => {
    const rail = stageRail(project());

    assert.ok(byId(rail, 'idea')!.lines.length > 0);
    assert.deepEqual(byId(rail, 'solution')?.lines, []);
  });
});

describe('Ray ne zaman görünür — çelişki yasağı', () => {
  it('yeni projede gorunur: fikir asamasindadir, ray dogruyu soyler', () => {
    assert.ok(stageRail(project()).length > 0);
  });

  it('ESKI akisla plani olan belgede HIC gorunmez', () => {
    // Ray "PLAN kilitli: fikir tasarımı onaylanmadı" derdi; oysa plan
    // çalışıyor ve erişilebilir. Ekranın iki yarısının çelişmesi, ilerleme
    // göstergesi hiç olmamasından kötüdür.
    const document = project();
    document.decisions = [{
      id: 'd1', title: 'Kimlik', decision: 'E-posta', rationale: '', alternatives: [],
      consequences: [], status: 'accepted', sourceSuggestionId: '', affectedSectionIds: []
    }];

    assert.deepEqual(stageRail(document), []);
  });

  it('asama modeline girmis belgede plani olsa bile gorunur', () => {
    const document = project({ concerns: [{ id: 'c', title: 'Sahiplik', status: 'decided' }] });
    document.decisions = [{
      id: 'd1', title: 'Kimlik', decision: 'E-posta', rationale: '', alternatives: [],
      consequences: [], status: 'accepted', sourceSuggestionId: '', affectedSectionIds: []
    }];

    assert.ok(stageRail(document).length > 0);
  });

  it('eski fikir revizyonundan uretilmis plan da rayi susturur', () => {
    const document = project();
    document.sourceIdeaRevisionId = 'rev-1';

    assert.deepEqual(stageRail(document), []);
  });
});
