import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  discoverConcerns,
  mergeConcerns,
  prioritizeConcerns
} from '../../../src/v4/application/idea-design-service.js';
import { normalizeConcern } from '../../../src/v4/application/concerns.js';
import type { DiscoveryOutput } from '../../../src/v4/ai/schemas/schemas.js';

type DiscoveryInput = Pick<DiscoveryOutput, 'options' | 'openQuestions' | 'uncertainty'>;

function option(overrides: Partial<DiscoveryOutput['options'][number]> = {}): DiscoveryOutput['options'][number] {
  return {
    kind: 'feature',
    title: 'Seçenek',
    description: 'Açıklama',
    pros: [],
    cons: [],
    effort: 'medium',
    impact: 'medium',
    affectedSections: ['scope'],
    recommended: false,
    ...overrides
  } as DiscoveryOutput['options'][number];
}

function discovery(overrides: Partial<DiscoveryInput> = {}): DiscoveryInput {
  return { options: [], openQuestions: [], uncertainty: [], ...overrides };
}

describe('Keşif çıktısı → Concern', () => {
  it('her secenek bir concern olur ve cons tradeoff olarak tasinir', () => {
    const concerns = discoverConcerns(discovery({
      options: [option({ title: 'At bakımı', description: 'Bakım sistemi', cons: ['Oyuncuya yük getirir'] })]
    }));

    assert.equal(concerns.length, 1);
    assert.equal(concerns[0].title, 'At bakımı');
    // Bedeli olmayan seçenek karşılaştırılamaz.
    assert.deepEqual(concerns[0].options[0].tradeoffs, ['Oyuncuya yük getirir']);
  });

  it('yuksek etkili mimari karar KRITIK olur - kapiyi bloklamasi gerekir', () => {
    const concerns = discoverConcerns(discovery({
      options: [option({ kind: 'architecture', title: 'Kayıt modeli', impact: 'high' })]
    }));

    assert.equal(concerns[0].importance, 'critical');
  });

  it('yuksek etkili KAPSAM onerisi kritik sayilmaz - kapsam ertelenebilir', () => {
    // Mimari kararı genelde ertelenemez, kapsam kararı ertelenebilir.
    const concerns = discoverConcerns(discovery({
      options: [option({ kind: 'feature', title: 'Yarış modu', impact: 'high' })]
    }));

    assert.equal(concerns[0].importance, 'important');
  });

  it('modelin belirsiz bildirdigi konu daha yuksek belirsizlik alir', () => {
    const withUncertainty = discoverConcerns(discovery({
      options: [option({ title: 'Sahiplik' })],
      uncertainty: ['Sahiplik']
    }));
    const without = discoverConcerns(discovery({ options: [option({ title: 'Sahiplik' })] }));

    assert.ok(withUncertainty[0].uncertainty > without[0].uncertainty);
  });

  it('acik sorular da concern olur ama kritik ilan edilmez', () => {
    // Henüz derecelendirilmemiş bir soruyu kritik saymak, kapıyı hak
    // etmediği bir yerde kapatırdı.
    const concerns = discoverConcerns(discovery({ openQuestions: ['Kaç oyuncu olacak?'] }));

    assert.equal(concerns.length, 1);
    assert.equal(concerns[0].importance, 'important');
    assert.deepEqual(concerns[0].questions, ['Kaç oyuncu olacak?']);
  });

  it('ayni baslik iki kez gelirse tek concern uretilir', () => {
    const concerns = discoverConcerns(discovery({
      options: [option({ title: 'Stamina' }), option({ title: 'stamina' })]
    }));

    assert.equal(concerns.length, 1);
  });

  it('bos kesif ciktisi bos liste dondurur, cokmez', () => {
    assert.deepEqual(discoverConcerns(discovery()), []);
  });
});

describe('Birleştirme — çözülmüş konu dirilmez', () => {
  const karara_baglanmis = normalizeConcern({
    id: 'c-stamina',
    title: 'Stamina',
    status: 'decided',
    importance: 'critical',
    uncertainty: 0.1,
    downstreamImpact: 0.1
  });

  it('karara baglanmis konu yeniden acilmaz', () => {
    // Olmazsa AI aynı şeyi her turda yeniden önerir ve kullanıcı aynı kararı
    // tekrar tekrar verir.
    const incoming = normalizeConcern({ title: 'Stamina', status: 'open', uncertainty: 0.9, downstreamImpact: 0.9 });

    const merged = mergeConcerns([karara_baglanmis], [incoming]);

    assert.equal(merged.length, 1);
    assert.equal(merged[0].status, 'decided');
    assert.equal(merged[0].uncertainty, 0.1);
  });

  it('ertelenmis konunun kaydi hic degistirilmez - "sonra" bir karardir', () => {
    // Yalnız `status`'e bakmak yetmez: spread onu zaten korur, yani öyle bir
    // test koruma kalksa da geçer. Asıl korunan şey kaydın BÜTÜNÜ.
    const ertelenmis = normalizeConcern({
      title: 'Yetiştirme',
      status: 'deferred',
      uncertainty: 0.2,
      downstreamImpact: 0.2,
      questions: ['Eski soru']
    });
    const incoming = normalizeConcern({
      title: 'Yetiştirme',
      status: 'open',
      uncertainty: 1,
      downstreamImpact: 1,
      questions: ['Yeni soru']
    });

    const merged = mergeConcerns([ertelenmis], [incoming]);

    assert.deepEqual(merged[0], ertelenmis);
  });

  it('alakasiz ilan edilmis konunun kaydi hic degistirilmez', () => {
    const alakasiz = normalizeConcern({
      title: 'Genetik',
      status: 'irrelevant',
      uncertainty: 0.1,
      downstreamImpact: 0.1
    });
    const incoming = normalizeConcern({ title: 'Genetik', status: 'open', uncertainty: 1, downstreamImpact: 1 });

    const merged = mergeConcerns([alakasiz], [incoming]);

    assert.deepEqual(merged[0], alakasiz);
  });

  it('acik konu yeni turda daha yuksek skor alabilir', () => {
    const acik = normalizeConcern({ title: 'Sahiplik', status: 'open', uncertainty: 0.3, downstreamImpact: 0.3 });
    const incoming = normalizeConcern({ title: 'Sahiplik', status: 'open', uncertainty: 0.9, downstreamImpact: 0.8 });

    const merged = mergeConcerns([acik], [incoming]);

    assert.equal(merged[0].uncertainty, 0.9);
    assert.equal(merged[0].downstreamImpact, 0.8);
  });

  it('acik konunun mevcut secenekleri korunur', () => {
    const acik = normalizeConcern({
      title: 'Sahiplik',
      status: 'open',
      options: [{ id: 'o1', title: 'Kalıcı karakter', description: '', tradeoffs: [] }]
    });
    const incoming = normalizeConcern({
      title: 'Sahiplik',
      status: 'open',
      options: [{ id: 'o2', title: 'Sadece ulaşım', description: '', tradeoffs: [] }]
    });

    const merged = mergeConcerns([acik], [incoming]);

    assert.equal(merged[0].options[0].id, 'o1');
  });

  it('yeni konu eklenir, mevcutlar kaybolmaz', () => {
    const merged = mergeConcerns(
      [normalizeConcern({ title: 'Stamina', status: 'open' })],
      [normalizeConcern({ title: 'Beslenme', status: 'open' })]
    );

    assert.deepEqual(merged.map(item => item.title).sort(), ['Beslenme', 'Stamina']);
  });
});

describe('Önceliklendirme', () => {
  it('en yuksek bilgi kazancli konu basa gelir', () => {
    const sorted = prioritizeConcerns([
      normalizeConcern({ title: 'Düşük', uncertainty: 0.2, downstreamImpact: 0.2 }),
      normalizeConcern({ title: 'Yüksek', uncertainty: 0.9, downstreamImpact: 0.9 })
    ]);

    assert.equal(sorted[0].title, 'Yüksek');
  });

  it('girdi dizisini degistirmez', () => {
    const input = [
      normalizeConcern({ title: 'A', uncertainty: 0.1, downstreamImpact: 0.1 }),
      normalizeConcern({ title: 'B', uncertainty: 0.9, downstreamImpact: 0.9 })
    ];

    prioritizeConcerns(input);

    assert.equal(input[0].title, 'A');
  });
});
