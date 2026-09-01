import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dropCrossSectionDuplicates } from '../../src/v4/application/expansion-section-dedup.js';

const card = (title: string, description: string) => ({ title, description });

/**
 * CANLI ÖLÇÜM (qwen2.5:7b / Ollama, fikir = "unityde bir at sistemi yapmak
 * istiyorum multiplayer olucak"). Pano dokuz bölümü aynı anda gösterdikten
 * SONRA DOM'dan sayıldı: 40 kartın yalnız 33'ü benzersizdi.
 *
 *   "At dayanıklılığı"            -> 3 bölümde
 *   "Eyer ve envanter"            -> 3 bölümde
 *   "Atı uzaktan çağırma"         -> 3 bölümde
 *   "At dayanıklılığı geliştirme" -> 2 bölümde
 *
 * Aşağıdaki başlık ve açıklamalar o ölçümden BİREBİR alınmıştır.
 *
 * Kusur kategori İÇİ elemede değildi: `dropDuplicateExpansionCards` her
 * partide doğru çalışıyordu. Tekrarlar ayrı partilerdeydi ve pano tek
 * kategori gösterdiği sürece hiç yan yana gelmiyorlardı.
 */
const ENDURANCE_CLEAN = card('At dayanıklılığı', 'At koştukça yorulur, dinlenmesi gerekir.');
const ENDURANCE_CLEAN_TWIN = card('At dayanıklılığı', 'At koştukça yorulur ve dinlenmesi gerekir.');
const ENDURANCE_TASK = card('At dayanıklılığı geliştirme', 'At koştukça yorulur ve dinlenmesi gerekir.');
const SADDLE_CLEAN = card('Eyer ve envanter', 'Atın üzerinde taşınan eşyalar için ayrı bir çanta bulunur.');
const SADDLE_TASK = card('Eyer ve envanter geliştirmek', 'Atın üzerinde taşınan eşyalar için ayrı bir çanta bulunur.');
const CALL_HORSE = card('Atı uzaktan çağırma', 'Oyuncular, atları oyunun belirli noktalarından uzaktan çağırabilirler.');

/** Aynı ölçümden, gerçekten AYRI kartlar. Hiçbiri elenmemeli. */
const WEATHER = card('At hava durumuna göre davranış', 'Yağmurda at daha yavaş koşar, çamurda kayabilir.');
const ARMOR = card('Atın zırhlama mekanizması', 'Savaşa girecek ata koruyucu plakalar takılabilir.');
const STORAGE = card('Verinin nerede durduğunu açıkça göster', 'Kayıtların sunucuda mı yoksa oyuncunun makinesinde mi tutulduğu yazılı olsun.');

const section = (categoryId: string, cards: { title: string; description: string }[]) => ({ categoryId, cards });

describe('dropCrossSectionDuplicates', () => {
  it('üç bölümde tekrarlanan "At dayanıklılığı" yalnız ilk bölümde kalır', () => {
    const views = dropCrossSectionDuplicates([
      section('mekanikler', [ENDURANCE_CLEAN, WEATHER]),
      section('hareket', [ENDURANCE_CLEAN_TWIN, ARMOR]),
      section('deneyim', [ENDURANCE_CLEAN, STORAGE])
    ]);
    assert.deepEqual(views.map(view => view.cards.map(item => item.title)), [
      ['At dayanıklılığı', 'At hava durumuna göre davranış'],
      ['Atın zırhlama mekanizması'],
      ['Verinin nerede durduğunu açıkça göster']
    ]);
  });

  it('"At dayanıklılığı geliştirme", temiz başlık DAHA SONRA gelse bile elenir', () => {
    const views = dropCrossSectionDuplicates([
      section('deneyim', [ENDURANCE_TASK]),
      section('mekanikler', [ENDURANCE_CLEAN])
    ]);
    assert.deepEqual(views.map(view => view.cards.map(item => item.title)), [
      [],
      ['At dayanıklılığı']
    ]);
  });

  it('"Eyer ve envanter geliştirmek" / "Eyer ve envanter" çifti de temiz başlıkla çözülür', () => {
    const early = dropCrossSectionDuplicates([
      section('a', [SADDLE_TASK]),
      section('b', [SADDLE_CLEAN])
    ]);
    assert.deepEqual(early.map(view => view.cards.map(item => item.title)), [[], ['Eyer ve envanter']]);

    const late = dropCrossSectionDuplicates([
      section('a', [SADDLE_CLEAN]),
      section('b', [SADDLE_TASK])
    ]);
    assert.deepEqual(late.map(view => view.cards.map(item => item.title)), [['Eyer ve envanter'], []]);
  });

  it('üç bölümdeki birebir aynı "Atı uzaktan çağırma" teke iner', () => {
    const views = dropCrossSectionDuplicates([
      section('a', [CALL_HORSE]),
      section('b', [CALL_HORSE]),
      section('c', [CALL_HORSE])
    ]);
    assert.deepEqual(views.map(view => view.cards.length), [1, 0, 0]);
  });

  it('gerçekten farklı kartlar KORUNUR', () => {
    const views = dropCrossSectionDuplicates([
      section('a', [WEATHER]),
      section('b', [ARMOR]),
      section('c', [STORAGE]),
      section('d', [ENDURANCE_CLEAN])
    ]);
    assert.deepEqual(views.map(view => view.cards.length), [1, 1, 1, 1]);
    assert.equal(views.every(view => view.isCoveredByOtherSections === false), true);
  });

  it('aynı girdi aynı çıktıyı verir (sıra kararlı)', () => {
    const build = () => [
      section('a', [ENDURANCE_CLEAN, WEATHER]),
      section('b', [ENDURANCE_TASK, ARMOR]),
      section('c', [SADDLE_CLEAN, SADDLE_TASK, STORAGE])
    ];
    const first = dropCrossSectionDuplicates(build());
    const second = dropCrossSectionDuplicates(build());
    assert.deepEqual(
      first.map(view => [view.categoryId, view.cards.map(item => item.title), view.isCoveredByOtherSections]),
      second.map(view => [view.categoryId, view.cards.map(item => item.title), view.isCoveredByOtherSections])
    );
  });

  it('girdi dizileri ve kart nesneleri MUTASYONA UĞRAMAZ', () => {
    const cardsA = [ENDURANCE_CLEAN, WEATHER];
    const cardsB = [ENDURANCE_TASK];
    const input = [section('a', cardsA), section('b', cardsB)];
    const snapshot = JSON.stringify(input);

    const views = dropCrossSectionDuplicates(input);

    assert.equal(JSON.stringify(input), snapshot, 'girdi değişmemeli');
    assert.equal(cardsA.length, 2);
    assert.equal(cardsB.length, 1);
    assert.notEqual(views[0].cards, cardsA, 'çıktı dizisi girdi dizisinin kendisi olmamalı');
    // Kartlar KOPYALANMAZ: kalan kart girdideki NESNENİN AYNISIDIR.
    assert.equal(views[0].cards[0], ENDURANCE_CLEAN);
  });

  it('tüm kartları üst bölümlerle çakışan bölüm boş kaldığını bildirir', () => {
    const views = dropCrossSectionDuplicates([
      section('a', [ENDURANCE_CLEAN, SADDLE_CLEAN]),
      section('b', [ENDURANCE_TASK, SADDLE_TASK])
    ]);
    assert.equal(views[1].cards.length, 0);
    assert.equal(views[1].isCoveredByOtherSections, true);
    assert.equal(views[0].isCoveredByOtherSections, false);
  });

  it('HİÇ kartı olmayan bölüm "çakıştı" demez', () => {
    const views = dropCrossSectionDuplicates([
      section('a', [ENDURANCE_CLEAN]),
      section('hazirlaniyor', [])
    ]);
    assert.equal(views[1].cards.length, 0);
    assert.equal(views[1].isCoveredByOtherSections, false, 'kart gelmemiş bölüm çakışmış sayılmaz');
  });

  /**
   * ÖLÇÜLDÜ: bu bayrak eklenmeden önce e2e kapısı düştü. Sağlayıcı oturum
   * içinde düşünce her bölüm yedek (seed) kartlarına iniyor; bu kartların
   * açıklaması tek bir kalıptan üretildiği için elle seçilmiş, gerçekten
   * farklı başlıklar birbirinin tekrarı sanılıp siliniyordu. Kullanıcı AI'sız
   * kaldığı anda elindeki tek öneri listesini de kaybediyordu.
   */
  const seed = (title: string, hint: string) =>
    card(title, `${hint} sorusuna bu başlangıç önerisiyle bakabilirsin.`);

  it('muaf bölüm ne kart kaybeder ne de başka bölümü eler', () => {
    const views = dropCrossSectionDuplicates([
      { categoryId: 'yedek-a', cards: [seed('Hesap açma', 'Kimler kullanacak'), seed('İlk ekran', 'Kimler kullanacak')], isExemptFromDedup: true },
      { categoryId: 'yedek-b', cards: [seed('Hesap açma', 'Kimler kullanacak')], isExemptFromDedup: true },
      { categoryId: 'model', cards: [seed('Hesap açma', 'Kimler kullanacak')] }
    ]);
    assert.equal(views[0].cards.length, 2, 'muaf bölümün kartları olduğu gibi kalır');
    assert.equal(views[1].cards.length, 1, 'muaf bölüm başka muaf bölümle çakışmaz');
    assert.equal(views[1].isCoveredByOtherSections, false);
    // Muaf bölüm KAYNAK da değildir: model bölümü onun yüzünden boşalmaz.
    assert.equal(views[2].cards.length, 1);
  });

  it('kartın kimliği korunur: çıktı yalnız süzer, alan üretmez', () => {
    const rich = { title: 'Atı uzaktan çağırma', description: CALL_HORSE.description, id: 'x1', origin: 'ai' };
    const views = dropCrossSectionDuplicates([section('a', [rich])]);
    assert.equal(views[0].cards[0], rich);
  });
});
