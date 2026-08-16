import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { coachProgress, nextCoachTurn } from '../../../src/v4/application/adaptive-idea-coach.js';
import { normalizeConcern } from '../../../src/v4/application/concerns.js';
import { createProjectDocument } from '../../../src/v4/project-document.js';
import type { Concern, ProjectDocumentV5 } from '../../../src/v4/contracts.js';

function project(concerns: Partial<Concern>[] = [], framed = true): ProjectDocumentV5 {
  const document = createProjectDocument({ idea: 'Unity’de at sistemi yapmak istiyorum' }) as ProjectDocumentV5;
  if (framed) {
    document.ideaDesign.framing = { kind: 'system', domain: 'game', environment: 'Unity', source: 'confirmed' };
  }
  document.ideaDesign.concerns = concerns.map((item, index) => normalizeConcern(item, index));
  return document;
}

describe('Adaptif koç — sıradaki tur', () => {
  it('cerceveleme bilinmiyorsa ILK soru odur', () => {
    // Yanlış çerçevede sorulan doğru soru da yanlıştır.
    const turn = nextCoachTurn(project([{ title: 'Stamina', uncertainty: 1, downstreamImpact: 1 }], false));

    assert.equal(turn.kind, 'framing');
    assert.match(turn.question, /Neyi tasarlıyoruz/);
  });

  it('cerceveleme bilindiginde en yuksek bilgi kazancli konu sorulur', () => {
    const turn = nextCoachTurn(project([
      { id: 'c-renk', title: 'İsim etiketi rengi', questions: ['Etiket rengi ne olsun?'], uncertainty: 0.9, downstreamImpact: 0.05 },
      { id: 'c-sahiplik', title: 'Sahiplik', questions: ['At kalıcı bir karakter mi?'], uncertainty: 0.9, downstreamImpact: 0.9 }
    ]));

    assert.equal(turn.kind, 'concern');
    assert.equal(turn.concernId, 'c-sahiplik');
    assert.equal(turn.question, 'At kalıcı bir karakter mi?');
  });

  it('sabit Problem->Kullanici->Deger sirasina bagli DEGIL', () => {
    // Sabit model olsaydı ilk soru "hedef kullanıcı kim?" olurdu; oyun alt
    // sistemi için bu yanlış ilk sorudur.
    const turn = nextCoachTurn(project([
      { id: 'c-mount', title: 'Biniş', questions: ['Ata nasıl binilecek?'], uncertainty: 0.8, downstreamImpact: 0.8 }
    ]));

    assert.equal(turn.concernId, 'c-mount');
    assert.doesNotMatch(turn.question, /hedef kullanıcı|target user/i);
  });

  it('soruyla birlikte NEDEN sorulduğu da doner - jargon kullanmadan', () => {
    const turn = nextCoachTurn(project([
      { id: 'c1', title: 'Kayıt', questions: ['Kayıt nasıl tutulacak?'], whyItMatters: 'Bu karar ilerleme ve ölüm sistemini belirliyor.', uncertainty: 0.8, downstreamImpact: 0.8 }
    ]));

    assert.equal(turn.why, 'Bu karar ilerleme ve ölüm sistemini belirliyor.');
    // Kullanıcı iç modeli öğrenmek zorunda değil.
    assert.doesNotMatch(turn.why, /concern|downstream|impact score/i);
  });

  it('konunun secenekleri tura tasinir', () => {
    const turn = nextCoachTurn(project([{
      id: 'c1',
      title: 'Beslenme',
      questions: ['Açlık sistemi olsun mu?'],
      uncertainty: 0.8,
      downstreamImpact: 0.8,
      options: [{ id: 'o1', title: 'Sürekli açlık', description: '', tradeoffs: ['Bakım yükü'] }]
    }]));

    assert.equal(turn.options.length, 1);
    assert.deepEqual(turn.options[0].tradeoffs, ['Bakım yükü']);
  });
});

describe('Durma koşulu', () => {
  it('sorulacak konu kalmayinca teknik tasarima gecmeyi onerir', () => {
    // AI kullanıcıyı sonsuz öneriyle oyalamamalı; bu olmadan ürün bir fikir
    // fırtınası makinesine dönüşür.
    const turn = nextCoachTurn(project([
      { id: 'c1', title: 'Stamina', status: 'decided' },
      { id: 'c2', title: 'Beslenme', status: 'deferred' }
    ]));

    assert.equal(turn.kind, 'ready');
    assert.match(turn.why, /teknik tasarıma geçmek daha değerli/);
  });

  it('skoru sifir olsa bile cozulmemis kritik karar sorulur', () => {
    const turn = nextCoachTurn(project([
      { id: 'c-kritik', title: 'Kayıt modeli', importance: 'critical', status: 'open', uncertainty: 0, downstreamImpact: 0 }
    ]));

    assert.equal(turn.kind, 'concern');
    assert.equal(turn.concernId, 'c-kritik');
  });

  it('hicbir konu sorulamaz halde olsa bile kritik karar varken HAZIR denmez', () => {
    // Bu, durma koşulundaki güvenlik ağı. Döngüsel bağımlılık kurulduğunda
    // hiçbir konu sorulabilir olmaz ve akış durma yoluna girer; o yolda
    // çözülmemiş kritik karar varsa "hazır" demek, kullanıcıyı eksik bir
    // fikirle teknik tasarıma göndermek olurdu.
    const turn = nextCoachTurn(project([
      { id: 'a', title: 'Kayıt modeli', importance: 'critical', status: 'open', dependsOn: ['b'] },
      { id: 'b', title: 'Ölüm davranışı', importance: 'critical', status: 'open', dependsOn: ['a'] }
    ]));

    assert.equal(turn.kind, 'concern');
    assert.ok(['a', 'b'].includes(turn.concernId || ''));
    assert.match(turn.question, /karara varmamız gerekiyor/);
  });

  it('hic konu yoksa da hazir denir - bos fikir sonsuza kadar konusulmaz', () => {
    assert.equal(nextCoachTurn(project([])).kind, 'ready');
  });
});

describe('İlerleme göstergesi', () => {
  it('konular kendi kategorileriyle gruplanir, soru sayisi verilmez', () => {
    const progress = coachProgress(project([
      { title: 'Biniş', category: 'Hareket', status: 'decided' },
      { title: 'Koşu', category: 'Hareket', status: 'open' },
      { title: 'Kayıt', category: 'Kalıcılık', status: 'open' }
    ]));

    const hareket = progress.groups.find(group => group.category === 'Hareket');
    assert.equal(hareket?.total, 2);
    assert.equal(hareket?.resolved, 1);
    assert.equal(progress.groups.length, 2);
  });

  it('engel sayisi bildirilir - yuzde degil', () => {
    const progress = coachProgress(project([
      { title: 'A', importance: 'critical', status: 'open' },
      { title: 'B', importance: 'critical', status: 'open' },
      { title: 'C', importance: 'important', status: 'open' }
    ]));

    assert.equal(progress.blocking, 2);
  });

  it('ertelenenler ayri sayilir - kaybolmazlar', () => {
    const progress = coachProgress(project([
      { title: 'Yetiştirme', status: 'deferred' },
      { title: 'Zırh', status: 'deferred' }
    ]));

    assert.equal(progress.deferred, 2);
  });

  it('engel yoksa ve sorulacak konu kalmadiysa hazir olur', () => {
    const progress = coachProgress(project([{ title: 'A', status: 'decided' }]));

    assert.equal(progress.ready, true);
  });

  it('engel varsa hazir olmaz', () => {
    const progress = coachProgress(project([{ title: 'A', importance: 'critical', status: 'open' }]));

    assert.equal(progress.ready, false);
  });
});
