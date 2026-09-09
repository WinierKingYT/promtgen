import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getExpansionCardGroundingHint } from '../../src/v4/application/expansion-card-grounding-hint.js';
import type { FoundationContext } from '../../src/v4/ai/context/context-builder.js';

/**
 * E1 -- kartın zeminli temelle hiç kelime paylaşmadığına dair HAFİF bir
 * ipucu. A6'nın (`model-strength-hint.ts`) aynı dürüstlük disipliniyle:
 * ÖLÇÜLEMEYEN her durumda `null` döner -- yokluk bir "paylaşıyor" iddiası
 * DEĞİLDİR, tersi de değildir.
 */

const foundation = (fields: Array<{ field: string; text: string }>): FoundationContext => ({
  userConfirmed: false,
  fields: fields.map(entry => ({
    field: entry.field as FoundationContext['fields'][number]['field'],
    source: 'idea' as const,
    origin: 'kullanıcının kendi sözü — güvenilir zemin',
    grounded: true as const,
    text: entry.text
  }))
});

describe('getExpansionCardGroundingHint', () => {
  it('proje zeminsizse (null) hiçbir şey döndürmez', () => {
    const hint = getExpansionCardGroundingHint(
      { title: 'Rota geçmişi', description: 'Kullanıcı daha önce gittiği rotaları görebilir.' },
      null
    );
    assert.equal(hint, null);
  });

  it('temel hiç alan taşımıyorsa (boş fields) hiçbir şey döndürmez', () => {
    const hint = getExpansionCardGroundingHint(
      { title: 'Rota geçmişi', description: 'Kullanıcı daha önce gittiği rotaları görebilir.' },
      { userConfirmed: false, fields: [] }
    );
    assert.equal(hint, null);
  });

  it('kart temelle ORTAK KELİME paylaşmıyorsa ipucu döner', () => {
    const grounded = foundation([
      { field: 'targetUser', text: 'Şehirde bisiklet kullanan yetişkinler' }
    ]);
    const hint = getExpansionCardGroundingHint(
      { title: 'Uzay istasyonu simülasyonu', description: 'Oyuncular yörüngede modül inşa eder.' },
      grounded
    );
    assert.ok(hint && hint.length > 0, 'ortak kelime yoksa ipucu gösterilmeli');
  });

  it('kart temelle ORTAK KELİME paylaşıyorsa (çekimli hâliyle bile) ipucu YOKTUR', () => {
    const grounded = foundation([
      { field: 'targetUser', text: 'Şehirde bisiklet kullanan yetişkinler' }
    ]);
    const hint = getExpansionCardGroundingHint(
      { title: 'Bisikletlerin bakımı', description: 'Kullanıcı bisikletinin bakım geçmişini kaydeder.' },
      grounded
    );
    assert.equal(hint, null, 'ortak kök varken ipucu YANLIŞ bir uyarı olurdu');
  });

  it('kart metni ölçülemeyecek kadar İNCEyse (çok az içerik parçacığı) hiçbir şey döndürmez', () => {
    const grounded = foundation([
      { field: 'targetUser', text: 'Şehirde bisiklet kullanan yetişkinler' }
    ]);
    const hint = getExpansionCardGroundingHint({ title: 'Ağ', description: 'Var.' }, grounded);
    assert.equal(hint, null, 'ölçülemeyen kart için ne pozitif ne negatif iddia edilmemeli');
  });

  it('temel metni ölçülemeyecek kadar İNCEyse hiçbir şey döndürmez', () => {
    const grounded = foundation([{ field: 'targetUser', text: 'Ağ var' }]);
    const hint = getExpansionCardGroundingHint(
      { title: 'Uzay istasyonu simülasyonu', description: 'Oyuncular yörüngede modül inşa eder.' },
      grounded
    );
    assert.equal(hint, null);
  });

  it('birden çok zeminli alan varsa hepsi kelime havuzuna girer', () => {
    const grounded = foundation([
      { field: 'targetUser', text: 'Şehirde yaşayan yetişkinler' },
      { field: 'problemStatement', text: 'Güvenli bisiklet rotası bulmak zor.' }
    ]);
    const hint = getExpansionCardGroundingHint(
      { title: 'Rota güvenliği puanı', description: 'Her rota güvenlik açısından puanlanır.' },
      grounded
    );
    assert.equal(hint, null, 'ikinci alandaki "rota" ve "güvenli" kelimeleri kartla örtüşüyor');
  });
});
