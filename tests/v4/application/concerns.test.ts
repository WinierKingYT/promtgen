import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  blockingConcerns,
  concernPriority,
  isAskable,
  isBlocking,
  normalizeConcern,
  normalizeConcernDecision,
  selectNextConcern
} from '../../../src/v4/application/concerns.js';
import { stageGate } from '../../../src/v4/application/project-stages.js';
import { createProjectDocument } from '../../../src/v4/project-document.js';
import type { Concern, ProjectDocumentV5 } from '../../../src/v4/contracts.js';

function concern(overrides: Partial<Concern> = {}): Concern {
  return normalizeConcern({
    id: 'c1',
    title: 'Konu',
    importance: 'important',
    status: 'open',
    decisionRequired: true,
    uncertainty: 0.5,
    downstreamImpact: 0.5,
    ...overrides
  });
}

describe('Concern normalleştirme', () => {
  it('eksik alanlari guvenli varsayilanlarla doldurur', () => {
    const normalized = normalizeConcern({}, 3);

    assert.equal(normalized.id, 'concern-4');
    assert.equal(normalized.importance, 'important');
    assert.equal(normalized.status, 'open');
    assert.deepEqual(normalized.questions, []);
    assert.deepEqual(normalized.options, []);
  });

  it('0-1 disina tasan skorlari kirpar', () => {
    const normalized = normalizeConcern({ uncertainty: 5, downstreamImpact: -2 });

    assert.equal(normalized.uncertainty, 1);
    assert.equal(normalized.downstreamImpact, 0);
  });

  it('gecersiz importance/status degerlerini reddeder', () => {
    const normalized = normalizeConcern({ importance: 'cok-onemli' as never, status: 'bilinmeyen' as never });

    assert.equal(normalized.importance, 'important');
    assert.equal(normalized.status, 'open');
  });

  it('decisionRequired yalniz acikca false ise kapanir', () => {
    assert.equal(normalizeConcern({}).decisionRequired, true);
    assert.equal(normalizeConcern({ decisionRequired: false }).decisionRequired, false);
  });
});

describe('Bloklama', () => {
  it('yalniz kritik + karar gerektiren + cozulmemis olan bloklar', () => {
    assert.equal(isBlocking(concern({ importance: 'critical', status: 'open' })), true);
    assert.equal(isBlocking(concern({ importance: 'important', status: 'open' })), false);
    assert.equal(isBlocking(concern({ importance: 'critical', decisionRequired: false })), false);
  });

  it('deferred bloklamaz - "sonra" da bir karardir', () => {
    // Kullanıcı ertelediyse bunu yok saymak, verdiği kararı geri almak olurdu.
    assert.equal(isBlocking(concern({ importance: 'critical', status: 'deferred' })), false);
  });

  it('irrelevant bloklamaz - konunun bu projeye ait olmadigina karar verilmis', () => {
    assert.equal(isBlocking(concern({ importance: 'critical', status: 'irrelevant' })), false);
  });

  it('blockingConcerns yalniz bloklayanlari dondurur', () => {
    const list = [
      concern({ id: 'a', importance: 'critical', status: 'open' }),
      concern({ id: 'b', importance: 'critical', status: 'decided' }),
      concern({ id: 'c', importance: 'optional', status: 'open' })
    ];

    assert.deepEqual(blockingConcerns(list).map(item => item.id), ['a']);
  });
});

describe('Bilgi kazanci onceligi', () => {
  it('yuksek etkili belirsiz soru, dusuk etkili sorunun onune gecer', () => {
    // "At ulaşım aracı mı, kalıcı sistem mi?" save/stats/ownership/death'i
    // birden belirler; "isim etiketi rengi" hiçbirini belirlemez.
    const yuksek = concern({ id: 'sahiplik', uncertainty: 0.9, downstreamImpact: 0.9 });
    const dusuk = concern({ id: 'etiket-rengi', uncertainty: 0.9, downstreamImpact: 0.05 });

    assert.ok(concernPriority(yuksek) > concernPriority(dusuk));
  });

  it('cozulmus concern sirayi mesgul etmez', () => {
    const cozulmus = concern({ status: 'decided', uncertainty: 1, downstreamImpact: 1 });

    assert.equal(concernPriority(cozulmus), 0);
  });

  it('bloklayan concern ayni skorlu bloklamayanin onune gecer', () => {
    const bloklayan = concern({ id: 'a', importance: 'critical', uncertainty: 0.6, downstreamImpact: 0.6 });
    const bloklamayan = concern({ id: 'b', importance: 'important', uncertainty: 0.6, downstreamImpact: 0.6 });

    assert.ok(concernPriority(bloklayan) > concernPriority(bloklamayan));
  });

  it('irrelevant sifir oncelik alir', () => {
    assert.equal(concernPriority(concern({ importance: 'irrelevant', uncertainty: 1, downstreamImpact: 1 })), 0);
  });
});

describe('Sıradaki konunun seçimi', () => {
  it('en yuksek oncelikli sorulabilir konuyu secer', () => {
    const list = [
      concern({ id: 'dusuk', uncertainty: 0.2, downstreamImpact: 0.2 }),
      concern({ id: 'yuksek', uncertainty: 0.9, downstreamImpact: 0.9 })
    ];

    assert.equal(selectNextConcern(list)?.id, 'yuksek');
  });

  it('bagimliligi cozulmemis konu henuz sorulmaz', () => {
    // Sırasız soru sormak aynı şeyi iki kez sormaya yol açar.
    const onkosul = concern({ id: 'onkosul', status: 'open', uncertainty: 0.3, downstreamImpact: 0.3 });
    const bagimli = concern({ id: 'bagimli', dependsOn: ['onkosul'], uncertainty: 1, downstreamImpact: 1 });

    assert.equal(isAskable(bagimli, [onkosul, bagimli]), false);
    assert.equal(selectNextConcern([onkosul, bagimli])?.id, 'onkosul');
  });

  it('bagimlilik cozulunce bagimli konu sorulabilir hale gelir', () => {
    const onkosul = concern({ id: 'onkosul', status: 'decided' });
    const bagimli = concern({ id: 'bagimli', dependsOn: ['onkosul'], uncertainty: 1, downstreamImpact: 1 });

    assert.equal(isAskable(bagimli, [onkosul, bagimli]), true);
    assert.equal(selectNextConcern([onkosul, bagimli])?.id, 'bagimli');
  });

  it('bilinmeyen bagimlilik akisi kilitlemez', () => {
    // AI var olmayan bir kimlik ürettiğinde hatayı kullanıcıya ödetmeyiz.
    const bagimli = concern({ id: 'bagimli', dependsOn: ['hic-olmayan'] });

    assert.equal(isAskable(bagimli, [bagimli]), true);
  });

  it('sorulabilir konu kalmayinca null doner - bu durma kosulu, hata degil', () => {
    const list = [concern({ id: 'a', status: 'decided' }), concern({ id: 'b', status: 'deferred' })];

    assert.equal(selectNextConcern(list), null);
  });
});

describe('Kapı bloklayan konulara takılır', () => {
  function project(): ProjectDocumentV5 {
    return createProjectDocument({ idea: 'Kapı testi' }) as ProjectDocumentV5;
  }

  it('onay alinmis gorunse bile cozulmemis kritik karar kapiyi kapatir', () => {
    const document = project();
    document.ideaDesign.approval = {
      status: 'approved',
      approvedAtRevision: 1,
      approvedAt: '2026-08-16T00:00:00.000Z',
      reopenedReason: null
    };
    document.ideaDesign.concerns = [concern({ id: 'kritik', importance: 'critical', status: 'open' })];

    const gate = stageGate(document, 'solution');

    // Onay, altındaki boşluğu örtbas eden bir imza olamaz.
    assert.equal(gate.open, false);
    assert.equal(gate.reason, 'Fikir tasarımında çözülmemiş 1 kritik karar var.');
  });

  it('kritik kararlar cozulunce ve onay alininca kapi acilir', () => {
    const document = project();
    document.ideaDesign.approval = {
      status: 'approved',
      approvedAtRevision: 1,
      approvedAt: '2026-08-16T00:00:00.000Z',
      reopenedReason: null
    };
    document.ideaDesign.concerns = [concern({ id: 'kritik', importance: 'critical', status: 'decided' })];

    assert.equal(stageGate(document, 'solution').open, true);
  });

  it('kapi yuzde degil ENGEL SAYISI bildirir', () => {
    const document = project();
    document.ideaDesign.approval = {
      status: 'approved',
      approvedAtRevision: 1,
      approvedAt: '2026-08-16T00:00:00.000Z',
      reopenedReason: null
    };
    document.ideaDesign.concerns = [
      concern({ id: 'k1', importance: 'critical', status: 'open' }),
      concern({ id: 'k2', importance: 'critical', status: 'open' })
    ];

    assert.match(stageGate(document, 'solution').reason || '', /2 kritik karar/);
  });
});

describe('ConcernDecision normalleştirme', () => {
  it('serbest cevapta chosenOptionId null kalir', () => {
    const decision = normalizeConcernDecision({ concernId: 'c1', answer: 'Kendi cevabım' });

    assert.equal(decision.chosenOptionId, null);
    assert.equal(decision.answer, 'Kendi cevabım');
  });

  it('canonical karara henuz baglanmadiysa decisionId null', () => {
    assert.equal(normalizeConcernDecision({ concernId: 'c1' }).decisionId, null);
  });
});
