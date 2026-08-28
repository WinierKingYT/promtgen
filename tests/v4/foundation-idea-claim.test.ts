import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { verifyIdeaClaim } from '../../src/v4/application/foundation-idea-claim.js';

/** Canlı ölçümde kullanılan gerçek fikir cümlesi (qwen2.5:7b pilotu). */
const IDEA = 'unityde bir at sistemi yapmak istiyorum multiplayer olucak';

/**
 * Canlı ölçümden gelen KİRLİ vaka: model bunu `source:'idea'` diye verdi ama
 * "yarış", "savaş", "ekipman", "atların rengi, büyüklüğü" fikir cümlesinde
 * HİÇ GEÇMİYOR.
 */
const DIRTY_CLAIM = 'Unity oyun motorunda çok oyunculu bir at sistemi geliştirilecek; oyuncular atlarıyla yarış ve savaş yapabilecek, atlarına ekipman ekleyebilecek ve atların rengi, büyüklüğü gibi özellikleri özelleştirebilecek.';

/**
 * Canlı ölçümden gelen TEMİZ vaka (turn-2): fikirdeki "at sistemi" ve
 * "multiplayer" ifadelerini AÇAR, yeni özellik UYDURMAZ.
 */
const CLEAN_CLAIM = "Unity'de at hareketlerini ve becerilerini simüle etmek, birden fazla oyuncunun aynı anda aynı dünyada at sürebilmesini sağlamak.";

describe('verifyIdeaClaim', () => {
  it('ölçülen kirli vaka düşer: "atların rengi, büyüklüğü" fikirde yok', () => {
    const verdict = verifyIdeaClaim(DIRTY_CLAIM, IDEA);
    assert.equal(verdict.grounded, false);
    assert.equal(verdict.reason, 'butce-asimi');
  });

  it('ölçülen temiz vaka geçer: fikri açıyor, yeni özellik uydurmuyor', () => {
    const verdict = verifyIdeaClaim(CLEAN_CLAIM, IDEA);
    assert.equal(verdict.grounded, true, 'meşru bir yeniden ifade haksız yere düşürülmemeli');
    assert.equal(verdict.reason, null);
  });

  it('eşik temiz ve kirli vakanın ARASINDA kalır -- ikisi de kenarda değil', () => {
    // Eşiğin gerçekten iki vakayı ayırdığını sabitler; birinin ölçüsü
    // değişirse (ör. durak listesi) bu test önce kırılır.
    assert.equal(verifyIdeaClaim(CLEAN_CLAIM, IDEA).grounded, true);
    assert.equal(verifyIdeaClaim(DIRTY_CLAIM, IDEA).grounded, false);
  });

  it('Türkçe çekim düşürme sebebi DEĞİLDİR: fikirdeki "at", metindeki "atların" ile eşleşir', () => {
    // Bu metinde "at" kökü dışında hiçbir çıpa yok; naif tam-kelime eşleşmesi
    // olsaydı "anchor-yok" ile haksız yere düşerdi.
    const verdict = verifyIdeaClaim('atların bakımı', IDEA);
    assert.equal(verdict.grounded, true);
    assert.equal(verdict.reason, null);
  });

  it('Türkçe çekimin diğer biçimleri de çıpa sayılır', () => {
    for (const inflected of ['atları', 'ata', 'atlarıyla', 'atlar', 'atın']) {
      assert.equal(verifyIdeaClaim(inflected, IDEA).grounded, true, `${inflected} çıpa saymalı`);
    }
  });

  it('İ/ı tuzağı: büyük harfli "AT" ve "İyi" doğru küçültülür', () => {
    // Varsayılan toLowerCase "I" -> "i" yapar ve Türkçe kökü kaçırır.
    assert.equal(verifyIdeaClaim('ATLARIN bakımı', IDEA).grounded, true);
  });

  it('fikirle tek bir kelime bile paylaşmayan iddia düşer', () => {
    const verdict = verifyIdeaClaim('Kurumsal muhasebe ekipleri için fatura mutabakat paneli', IDEA);
    assert.equal(verdict.grounded, false);
    assert.equal(verdict.reason, 'anchor-yok');
  });

  it('boş fikir veya boş iddia doğrulanamaz', () => {
    assert.equal(verifyIdeaClaim('', IDEA).grounded, false);
    assert.equal(verifyIdeaClaim(DIRTY_CLAIM, '').grounded, false);
    assert.equal(verifyIdeaClaim('   ', '   ').reason, 'anchor-yok');
  });

  it('yalnız durak kelimelerden oluşan iddia doğrulanamaz', () => {
    assert.equal(verifyIdeaClaim('bu ve bir için olarak', IDEA).grounded, false);
  });

  it('fikrin kendisi her zaman kendini doğrular', () => {
    assert.equal(verifyIdeaClaim(IDEA, IDEA).grounded, true);
  });

  it('SAF: aynı girdi aynı sonucu verir ve girdi dizeleri değişmez', () => {
    const idea = IDEA;
    const claim = DIRTY_CLAIM;
    const first = verifyIdeaClaim(claim, idea);
    const second = verifyIdeaClaim(claim, idea);
    assert.deepEqual(first, second);
    assert.equal(idea, IDEA);
    assert.equal(claim, DIRTY_CLAIM);
  });

  it('uzun ve ayrıntılı bir fikir, uzun bir iddiaya bütçe açar', () => {
    // Bütçe fikrin hacmiyle ÖLÇEKLENİR: kullanıcı çok şey anlattıysa model de
    // uzun yazabilir. Kısa fikir + uzun iddia = düşürme; bu, ölçülen hatanın
    // ta kendisidir.
    const richIdea = 'Unity ile çok oyunculu bir at sistemi yapmak istiyorum. Atların hareketleri, koşma ve zıplama becerileri gerçekçi olsun. Oyuncular aynı sunucuda birbirini görsün, atları eyer ve dizgin gibi ekipmanlarla donatabilsin.';
    assert.equal(verifyIdeaClaim(DIRTY_CLAIM, richIdea).grounded, true);
  });
});
