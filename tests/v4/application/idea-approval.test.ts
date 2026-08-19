import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  approveIdeaDesign,
  ideaApprovalReadiness,
  readinessLines,
  reopenIdeaApproval
} from '../../../src/v4/application/idea-approval.js';
import { normalizeConcern, normalizeConcernDecision } from '../../../src/v4/application/concerns.js';
import { createProjectDocument } from '../../../src/v4/project-document.js';
import type { Concern, ConcernDecision, ProjectDocumentV5, StageApproval } from '../../../src/v4/contracts.js';

const APPROVED: StageApproval = {
  status: 'approved',
  approvedAtRevision: 4,
  approvedAt: '2026-08-16T00:00:00.000Z',
  reopenedReason: null
};

function project(concerns: Partial<Concern>[] = [], decisions: Partial<ConcernDecision>[] = []): ProjectDocumentV5 {
  const document = createProjectDocument({ idea: 'Unity’de at sistemi' }) as ProjectDocumentV5;
  document.ideaDesign.concerns = concerns.map((item, index) => normalizeConcern(item, index));
  document.ideaDesign.concernDecisions = decisions.map((item, index) => normalizeConcernDecision(item, index));
  return document;
}

/** Kapıyı yalnız bloklayan konu tarafından kapatılan, temiz bir belge. */
function cleanProject(): ProjectDocumentV5 {
  return project(
    [{ id: 'c-sahiplik', title: 'Sahiplik', status: 'decided' }],
    [{ id: 'd1', concernId: 'c-sahiplik', answer: 'Kalıcı karakter', decidedAtRevision: 2 }]
  );
}

describe('Idea Approval Gate — engeller', () => {
  it('temiz belge onaylanabilir', () => {
    const readiness = ideaApprovalReadiness(cleanProject());

    assert.deepEqual(readiness.obstacles, []);
    assert.equal(readiness.canApprove, true);
  });

  it('cozulmemis kritik karar kapiyi kapatir', () => {
    const readiness = ideaApprovalReadiness(project([
      { id: 'c-kayit', title: 'Kayıt modeli', importance: 'critical', status: 'open' }
    ]));

    assert.equal(readiness.canApprove, false);
    assert.equal(readiness.blocking, 1);
    assert.deepEqual(readiness.obstacles.map(item => item.kind), ['blocking-concern']);
  });

  it('"decided" denen ama kaydi olmayan karar kapiyi kapatir', () => {
    // İzlenebilirlik zinciri buradan başlıyor. Kaydı olmayan bir karar
    // sonradan hiçbir gereksinime bağlanamaz; "karar verildi" demek onu var
    // etmez.
    const readiness = ideaApprovalReadiness(project([
      { id: 'c-olum', title: 'Ölüm davranışı', status: 'decided' }
    ]));

    assert.equal(readiness.canApprove, false);
    assert.deepEqual(readiness.obstacles.map(item => item.kind), ['undocumented-decision']);
  });

  it('var olmayan konuya baglanmis karar kapiyi kapatir', () => {
    // Konu silinmiş ama cevabı durmaya devam ediyorsa, kullanıcının artık
    // sorulmayan bir soruya verdiği cevap onaylanmış olurdu.
    const readiness = ideaApprovalReadiness(project(
      [],
      [{ id: 'd1', concernId: 'c-yok', answer: 'Bir cevap' }]
    ));

    assert.equal(readiness.canApprove, false);
    assert.deepEqual(readiness.obstacles.map(item => item.kind), ['orphan-decision']);
  });

  it('konuda bulunmayan secenek secilmisse kapi kapanir', () => {
    const readiness = ideaApprovalReadiness(project(
      [{
        id: 'c-binis',
        title: 'Biniş',
        status: 'decided',
        options: [{ id: 'o-tus', title: 'Tuşla', description: '', tradeoffs: [] }]
      }],
      [{ id: 'd1', concernId: 'c-binis', chosenOptionId: 'o-olmayan' }]
    ));

    assert.equal(readiness.canApprove, false);
    assert.deepEqual(readiness.obstacles.map(item => item.kind), ['unknown-option']);
  });

  it('onkosulu sonradan degisen cevap bayat sayilir', () => {
    // Önce "kayıt modeli" karara bağlandı, ona dayanarak "ölüm davranışı"
    // cevaplandı, sonra kayıt modeli yeniden açılıp başka türlü karara
    // bağlandı. Ölüm cevabı artık geçerli olmayan bir öncüle dayanıyor.
    const readiness = ideaApprovalReadiness(project(
      [
        { id: 'c-kayit', title: 'Kayıt modeli', status: 'decided' },
        { id: 'c-olum', title: 'Ölüm davranışı', status: 'decided', dependsOn: ['c-kayit'] }
      ],
      [
        { id: 'd-olum', concernId: 'c-olum', answer: 'Kalıcı ölüm', decidedAtRevision: 3 },
        { id: 'd-kayit', concernId: 'c-kayit', answer: 'Slot bazlı', decidedAtRevision: 7 }
      ]
    ));

    assert.equal(readiness.canApprove, false);
    const stale = readiness.obstacles.find(item => item.kind === 'stale-answer');
    assert.equal(stale?.concernId, 'c-olum');
  });

  it('onkosul once karara baglandiysa cevap bayat degildir', () => {
    const readiness = ideaApprovalReadiness(project(
      [
        { id: 'c-kayit', title: 'Kayıt modeli', status: 'decided' },
        { id: 'c-olum', title: 'Ölüm davranışı', status: 'decided', dependsOn: ['c-kayit'] }
      ],
      [
        { id: 'd-kayit', concernId: 'c-kayit', answer: 'Slot bazlı', decidedAtRevision: 3 },
        { id: 'd-olum', concernId: 'c-olum', answer: 'Kalıcı ölüm', decidedAtRevision: 7 }
      ]
    ));

    assert.deepEqual(readiness.obstacles, []);
  });

  it('ertelenen ve cozulmemis onemli konular sayilir ama BLOKLAMAZ', () => {
    const readiness = ideaApprovalReadiness(project([
      { id: 'a', title: 'Yetiştirme', status: 'deferred' },
      { id: 'b', title: 'Zırh', status: 'deferred' },
      { id: 'c', title: 'Yarış modu', importance: 'important', status: 'open' }
    ]));

    assert.equal(readiness.deferred, 2);
    assert.equal(readiness.unresolvedImportant, 1);
    assert.equal(readiness.canApprove, true);
  });
});

describe('Idea Approval Gate — onay', () => {
  it('temiz belgede onay revizyonuyla birlikte yazilir', () => {
    const result = approveIdeaDesign(cleanProject(), { revision: 12, at: '2026-08-16T10:00:00.000Z' });

    assert.equal(result.approved, true);
    assert.equal(result.approved && result.approval.status, 'approved');
    assert.equal(result.approved && result.approval.approvedAtRevision, 12);
    assert.equal(result.approved && result.approval.approvedAt, '2026-08-16T10:00:00.000Z');
    assert.equal(result.approved && result.approval.reopenedReason, null);
  });

  it('engel varken onay REDDEDILIR - imza bosluğu ortmez', () => {
    const result = approveIdeaDesign(
      project([{ id: 'c', title: 'Kayıt modeli', importance: 'critical', status: 'open' }]),
      { revision: 12, at: '2026-08-16T10:00:00.000Z' }
    );

    assert.equal(result.approved, false);
    assert.match(result.approved ? '' : result.reason, /1 kritik karar/);
  });

  it('reddedilen onay belgeyi degistirmez', () => {
    const document = project([{ id: 'c', title: 'Kayıt', importance: 'critical', status: 'open' }]);
    const before = JSON.stringify(document);

    approveIdeaDesign(document, { revision: 12, at: '2026-08-16T10:00:00.000Z' });

    assert.equal(JSON.stringify(document), before);
  });

  it('onay belgeyi yerinde degistirmez - cagiran yazar', () => {
    const document = cleanProject();

    approveIdeaDesign(document, { revision: 12, at: '2026-08-16T10:00:00.000Z' });

    assert.equal(document.ideaDesign.approval.status, 'draft');
  });
});

describe('Idea Approval Gate — yeniden açma', () => {
  it('onay nedeniyle birlikte acilir', () => {
    const document = cleanProject();
    document.ideaDesign.approval = { ...APPROVED };

    const result = reopenIdeaApproval(document, 'Aslında multiplayer istiyorum');

    assert.equal(result.ideaApproval.status, 'discovery');
    assert.equal(result.ideaApproval.approvedAtRevision, null);
    assert.equal(result.ideaApproval.reopenedReason, 'Aslında multiplayer istiyorum');
  });

  it('fikir onayi acilinca TEKNIK onay da acilir', () => {
    // Fikir değişince teknik onay ayakta kalamaz: altındaki gerekçe değişti.
    const document = cleanProject();
    document.ideaDesign.approval = { ...APPROVED };
    document.solutionDesign.approval = { ...APPROVED };

    const result = reopenIdeaApproval(document, 'Kapsam değişti');

    assert.equal(result.solutionApproval.status, 'discovery');
    assert.match(result.notice, /teknik/i);
  });

  it('hic onaylanmamis teknik asama "acildi" diye bildirilmez', () => {
    // Olmayan bir şeyi geri aldığını söylemek, kullanıcıya yanlış bir kayıp
    // hissi verir.
    const document = cleanProject();
    document.ideaDesign.approval = { ...APPROVED };

    const result = reopenIdeaApproval(document, 'Kapsam değişti');

    assert.equal(result.solutionApproval.status, 'draft');
    assert.doesNotMatch(result.notice, /teknik/i);
  });

  it('gerekcesiz yeniden acma reddedilir', () => {
    // Sessiz geri dönüş V3'te yasak; neden yazılmadan onay geri alınamaz.
    assert.throws(() => reopenIdeaApproval(cleanProject(), '   '), /neden/i);
  });
});

describe('Kapı metni — yüzde değil engel', () => {
  it('engel yokken devam edilebilir denir', () => {
    const lines = readinessLines(ideaApprovalReadiness(cleanProject()));

    assert.ok(lines.includes('Bloklayan konu: 0'));
    assert.ok(lines.some(line => /Devam edilebilir/.test(line)));
  });

  it('hicbir satirda yuzde ya da X/Y skoru olmaz', () => {
    const lines = readinessLines(ideaApprovalReadiness(project([
      { id: 'a', title: 'Kayıt', importance: 'critical', status: 'open' },
      { id: 'b', title: 'Zırh', status: 'deferred' }
    ])));

    for (const line of lines) {
      assert.doesNotMatch(line, /%|\d+\s*\/\s*\d+/, `sahte kesinlik: ${line}`);
    }
  });

  it('engel varken devam edilebilir denmez ve engel sayisi gorunur', () => {
    const lines = readinessLines(ideaApprovalReadiness(project([
      { id: 'a', title: 'Kayıt', importance: 'critical', status: 'open' }
    ])));

    assert.ok(lines.includes('Bloklayan konu: 1'));
    assert.ok(!lines.some(line => /Devam edilebilir/.test(line)));
  });
});

describe('BOS onay atilamaz', () => {
  it('hic konu yokken kapi ACILMAZ', () => {
    // Pilot bunu canlida gosterdi: saglayici turu dustu, belge sifir konuyla
    // ilerledi ve HER IKI onayi da aldi. Yapisal denetimler yalniz var olan
    // konulari inceler; bos belgede hepsi sessizce gecer ve kapi "0 engel"
    // diyerek acilir. Imza, altinda hicbir karar yokken atilmis olurdu.
    const readiness = ideaApprovalReadiness(project());

    assert.equal(readiness.canApprove, false);
    assert.deepEqual(readiness.obstacles.map(item => item.kind), ['nothing-decided']);
    assert.match(readiness.obstacles[0].message, /keşif turu/);
  });

  it('konular VAR ama hicbiri ele alinmamissa da acilmaz', () => {
    const readiness = ideaApprovalReadiness(project([
      { id: 'c1', title: 'Sahiplik', importance: 'optional', status: 'open' }
    ]));

    assert.equal(readiness.canApprove, false);
    assert.match(readiness.obstacles[0].message, /Hiçbir konu karara bağlanmadı/);
  });

  it('ERTELEMEK de bir eylemdir; kapiyi bu denetim kapatmaz', () => {
    // Kullanici konuyu gormus ve "sonra" demis. Bu bir karardir; onu
    // "hicbir sey yapmadin" saymak verdigi karari yok saymak olurdu.
    const readiness = ideaApprovalReadiness(project([
      { id: 'c1', title: 'Zırh', importance: 'optional', status: 'deferred' }
    ]));

    assert.equal(readiness.canApprove, true);
  });

  it('bos belgede onay REDDEDILIR', () => {
    const result = approveIdeaDesign(project(), { revision: 3, at: '2026-08-19T00:00:00.000Z' });

    assert.equal(result.approved, false);
  });

  it('YAPISAL engel varken ayni sey iki kez soylenmez', () => {
    // "Bu konuda karar verilmedi" zaten yapilacak isi adiyla soyluyor;
    // ustune "hicbir konu karara baglanmadi" eklemek gurultu olurdu.
    const readiness = ideaApprovalReadiness(project([
      { id: 'c1', title: 'Sahiplik', importance: 'critical', status: 'open' }
    ]));

    assert.deepEqual(readiness.obstacles.map(item => item.kind), ['blocking-concern']);
  });
});
