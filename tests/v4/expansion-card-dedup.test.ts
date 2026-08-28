import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dropDuplicateExpansionCards } from '../../src/v4/application/expansion-card-dedup.js';

const card = (title: string, description: string) => ({ title, description });

/**
 * CANLI ÖLÇÜM (qwen2.5:7b / Ollama, fikir = "unityde bir at sistemi yapmak
 * istiyorum multiplayer olucak", kategori = "Multiplayer Mekanikleri"):
 * 8 kartın 4'ü aynı mekanizmanın parantez içinde değişen varyasyonuydu.
 * BAŞLIKLAR ölçümden birebir alınmıştır. Açıklamalar kayda geçmediği için
 * yeniden kurulmuştur ve bilerek KÖTÜMSER kurulmuştur: her biri farklı
 * fiillerle yazılmıştır, yani metin benzerliği gerçekte olduğundan DÜŞÜKTÜR.
 * Eleme bu kötümser metinde bile çalışmalıdır.
 */
const measuredDuplicates = [
  card('At Etkileşimleri (Kafa Saldırısı)', 'Oyuncular atın kafasıyla nesnelere vurarak onları itebilir.'),
  card('At Etkileşimleri (Sürükleme)', 'Oyuncular atı kullanarak nesneleri sürükleyebilir.'),
  card('At Etkileşimleri (Toplama)', 'Oyuncular atı kullanarak nesneleri toplayabilir.'),
  card('At Etkileşimleri (Sürükleme ve Döndürme)', 'Oyuncular atı kullanarak nesneleri sürükleyip döndürebilir.')
];

/**
 * CANLI ÖLÇÜM #2 (qwen2.5:7b / Ollama, aynı fikir, kategori = "Multisatırlık
 * oyun mekanikleri"): dokuz kartın İKİSİ panoda BİREBİR AYNI BAŞLIKLA yan yana
 * duruyordu. Aşağıdaki metinler DOM'dan alındığı hâliyle, harfi harfine.
 *
 * Oran kuralı bunu yakalayamaz: başlık aynı olsa da açıklamalar uzun ve
 * farklıdır, açıklama parçacıkları sayıca baskın gelir ve toplam oran
 * ÖLÇÜLDÜ = 0.368 -- 0.45 eşiğinin ALTINDA. Başlık çakışması açıklama
 * gürültüsünde boğuluyor. Bu yüzden başlık AYRI bir kural olmak zorundadır.
 */
const measuredSameTitlePair = [
  card(
    'At hareketi: Zamanlamalı ilerleme',
    'At hareketi, oyuncuların kontrolündeyken ve oyunu çözdükçe zenginleşen bir animasyon ve ses efektlerle süslenmelidir. Her at hareketi, oyunun geçtiği süre ve oyuncu stratejisiyle birlikte farklılık gösterebilir.'
  ),
  card(
    'At hareketi: Zamanlamalı ilerleme',
    'Atların hareketleri, zamanlamalarına göre ve belirli noktalarında ileri gelse. Örneğin, bir atın belirli bir mesafeyi belirli bir süre içinde kaplaması gibi.'
  )
];

/** Aynı partiden, gerçekten AYRI fikirler. Hiçbiri elenmemeli. */
const measuredDistinct = [
  card('At Hareketi Sinciri', 'Atın konumu ve hızı tüm oyuncularda aynı anda görünmeli.'),
  card('Zaman Aşımını Sınchronize Etme', 'Sunucu ile istemci arasındaki gecikme telafi edilmeli.'),
  card('Oyuncu Envanteri', 'Her oyuncunun kendi eyer ve koşum takımı listesi olmalı.'),
  card('Sesli Sohbet', 'Yakındaki oyuncular birbirini mesafeye bağlı olarak duyabilmeli.'),
  card('Ağ Senkronizasyonu (Konum)', 'Atın koordinatları sunucuda doğrulanıp istemcilere yayılmalı.'),
  card('Ağ Senkronizasyonu (Ses)', 'Oyuncuların mikrofon verisi mesafeye göre süzülerek iletilmeli.')
];

describe('dropDuplicateExpansionCards', () => {
  it('ölçümdeki dört varyasyon kartını tek karta indirir ve İLKİNİ tutar', () => {
    const result = dropDuplicateExpansionCards(measuredDuplicates);
    assert.equal(result.cards.length, 1, 'dördü de aynı mekanizmanın varyasyonu; tek kart kalmalı');
    assert.equal(result.cards[0].title, 'At Etkileşimleri (Kafa Saldırısı)');
    assert.equal(result.duplicateCount, 3);
  });

  it('gerçekten farklı kartların hiçbirini elemez', () => {
    const result = dropDuplicateExpansionCards(measuredDistinct);
    assert.equal(result.cards.length, measuredDistinct.length);
    assert.equal(result.duplicateCount, 0);
    assert.deepEqual(result.cards.map(item => item.title), measuredDistinct.map(item => item.title));
  });

  it('karışık partide yalnız tekrarları eler, farklıları sırasıyla korur', () => {
    const batch = [
      measuredDuplicates[0], measuredDistinct[0], measuredDuplicates[1],
      measuredDistinct[1], measuredDuplicates[2], measuredDuplicates[3], measuredDistinct[2]
    ];
    const result = dropDuplicateExpansionCards(batch);
    assert.deepEqual(result.cards.map(item => item.title), [
      'At Etkileşimleri (Kafa Saldırısı)',
      'At Hareketi Sinciri',
      'Zaman Aşımını Sınchronize Etme',
      'Oyuncu Envanteri'
    ]);
    assert.equal(result.duplicateCount, 3);
  });

  it('sıra kararlıdır: hangisi önce geldiyse o kalır', () => {
    const forward = dropDuplicateExpansionCards([measuredDuplicates[1], measuredDuplicates[3]]);
    const backward = dropDuplicateExpansionCards([measuredDuplicates[3], measuredDuplicates[1]]);
    assert.equal(forward.cards.length, 1);
    assert.equal(backward.cards.length, 1);
    assert.equal(forward.cards[0].title, 'At Etkileşimleri (Sürükleme)');
    assert.equal(backward.cards[0].title, 'At Etkileşimleri (Sürükleme ve Döndürme)');
  });

  it('aynı girdi her zaman aynı sonucu verir', () => {
    const first = dropDuplicateExpansionCards(measuredDuplicates);
    const second = dropDuplicateExpansionCards(measuredDuplicates);
    assert.deepEqual(first.cards.map(item => item.title), second.cards.map(item => item.title));
    assert.equal(first.duplicateCount, second.duplicateCount);
  });

  it('SAF: girdi dizisini ve kart nesnelerini değiştirmez', () => {
    const input = measuredDuplicates.map(item => Object.freeze({ ...item }));
    Object.freeze(input);
    const snapshot = JSON.stringify(input);
    const result = dropDuplicateExpansionCards(input);
    assert.equal(JSON.stringify(input), snapshot, 'girdi olduğu gibi kalmalı');
    assert.equal(input.length, 4, 'girdi dizisi kısalmamalı');
    assert.equal(result.cards[0], input[0], 'kalan kart kopyalanmadan aynen geri verilmeli');
  });

  it('Türkçe büyük/küçük harf tuzağına düşmez (I/ı, İ/i)', () => {
    const result = dropDuplicateExpansionCards([
      card('ATIN İLETİŞİMİ', 'OYUNCULAR ATIN DURUMUNU BİRBİRİNE İLETİR.'),
      card('atın iletişimi', 'oyuncular atın durumunu birbirine iletir.')
    ]);
    assert.equal(result.cards.length, 1);
    assert.equal(result.cards[0].title, 'ATIN İLETİŞİMİ');
  });

  it('boş dizi, tek kart ve tamamen aynı kartlar', () => {
    assert.deepEqual(dropDuplicateExpansionCards([]), { cards: [], duplicateCount: 0 });

    const single = dropDuplicateExpansionCards([measuredDuplicates[0]]);
    assert.equal(single.cards.length, 1);
    assert.equal(single.duplicateCount, 0);

    const identical = dropDuplicateExpansionCards([
      measuredDuplicates[0], measuredDuplicates[0], measuredDuplicates[0]
    ]);
    assert.equal(identical.cards.length, 1);
    assert.equal(identical.duplicateCount, 2);
  });

  it('içeriksiz kartları benzer saymaz — boş metin herkese benzemez', () => {
    const result = dropDuplicateExpansionCards([
      card('', ''),
      card('   ', '   '),
      card('Sesli Sohbet', 'Yakındaki oyuncular birbirini duyabilmeli.')
    ]);
    assert.equal(result.cards.length, 3, 'ölçülemeyen kart elenmez; emin değilsen TUT');
    assert.equal(result.duplicateCount, 0);
  });

  /**
   * Tek ortak kelime oranı doğrudan 1.00'e çıkarır. Ölçülemeyecek kadar ince
   * kartta oran anlamsızdır ve alakasız iki kartı aynı sayardı; asimetri
   * gereği böyle kartlar TUTULUR.
   */
  it('ölçülemeyecek kadar ince kartları benzer saymaz', () => {
    const result = dropDuplicateExpansionCards([
      card('A', 'A açıklaması'),
      card('B', 'B açıklaması'),
      card('C', 'C açıklaması')
    ]);
    assert.equal(result.cards.length, 3);
    assert.equal(result.duplicateCount, 0);
  });

  /**
   * ÖLÇÜLEN KUSUR: bu çift oran kuralından 0.368 ile GEÇİYORDU (eşik 0.45)
   * ve panoda iki kez aynı başlıkla görünüyordu. Başlık kuralı bunu keser.
   */
  it('canlı ölçümdeki BİREBİR AYNI başlıklı çifti eler, İLKİNİ tutar', () => {
    const result = dropDuplicateExpansionCards(measuredSameTitlePair);
    assert.equal(result.cards.length, 1, 'aynı başlık panoda iki kez görünemez');
    assert.equal(result.cards[0], measuredSameTitlePair[0]);
    assert.equal(result.duplicateCount, 1);
  });

  it('başlık aynıysa açıklama tamamen alakasız olsa bile eler', () => {
    const result = dropDuplicateExpansionCards([
      card('Envanter Sistemi', 'Oyuncular eyer, koşum ve yem taşıyabilmeli.'),
      card('Envanter Sistemi', 'Gökyüzü hava durumu bulutların yoğunluğuna göre değişir.')
    ]);
    assert.equal(result.cards.length, 1, 'başlık kartın kimliğidir; açıklama farkı bunu meşrulaştırmaz');
    assert.equal(result.cards[0].description, 'Oyuncular eyer, koşum ve yem taşıyabilmeli.');
    assert.equal(result.duplicateCount, 1);
  });

  it('başlık kuralı Türkçe İ/ı tuzağına düşmez', () => {
    const result = dropDuplicateExpansionCards([
      card('At İlerlemesi', 'Sunucu her karede atın koordinatlarını doğrular.'),
      card('AT İLERLEMESİ', 'Oyuncu kamerası eyer yüksekliğine göre ayarlanır.')
    ]);
    assert.equal(result.cards.length, 1, '"İ" ile "i" aynı harftir; başlık aynıdır');
    assert.equal(result.cards[0].title, 'At İlerlemesi');
    assert.equal(result.duplicateCount, 1);
  });

  /**
   * REGRESYON: başlık kuralı oran kuralının yerini ALMAZ. Aşağıdaki dört
   * kartın normalize başlıkları BİRBİRİNDEN FARKLIDIR; onları eleyen hâlâ
   * 0.45 eşiğinin arkasındaki oran kuralıdır.
   */
  it('başlıkları farklı ama içeriği yakın kartlar oran kuralıyla elenmeye DEVAM eder', () => {
    const titles = measuredDuplicates.map(item => item.title);
    assert.equal(new Set(titles).size, titles.length, 'başlıklar birebir aynı DEĞİL');

    const result = dropDuplicateExpansionCards(measuredDuplicates);
    assert.equal(result.cards.length, 1);
    assert.equal(result.duplicateCount, 3);
  });

  /**
   * ASİMETRİ: başlıkları çok yakın ama AYNI OLMAYAN kartlar TUTULUR.
   * Ölçüldü -- yalnız başlık üzerinden benzerlik: "Ağ Senkronizasyonu (Konum)"
   * ile "(Ses)" arası 0.667. Elenmesi gereken üçlü ("At etkileşimleri:
   * Sürükleme ve Toplama / Sürükleme / Toplama") 0.667-0.857 bandındadır.
   * Bantlar 0.667'de ÇAKIŞIYOR: ayıran bir eşik YOKTUR. Bu yüzden yakın-başlık
   * toleransı EKLENMEDİ -- yanlış eleme gerçek bir fikri gizler.
   */
  it('başlıkları yakın ama aynı olmayan farklı kartlar KORUNUR', () => {
    const result = dropDuplicateExpansionCards([
      card('Ağ Senkronizasyonu (Konum)', 'Atın koordinatları sunucuda doğrulanıp istemcilere yayılmalı.'),
      card('Ağ Senkronizasyonu (Ses)', 'Oyuncuların mikrofon verisi mesafeye göre süzülerek iletilmeli.')
    ]);
    assert.equal(result.cards.length, 2, 'emin değilsen TUT');
    assert.equal(result.duplicateCount, 0);
  });

  it('başlıksız kartlar başlık kuralıyla elenmez', () => {
    const result = dropDuplicateExpansionCards([
      card('', 'Sunucu ile istemci arasındaki gecikme telafi edilmeli.'),
      card('   ', 'Her oyuncunun kendi eyer ve koşum takımı listesi olmalı.')
    ]);
    assert.equal(result.cards.length, 2, 'boş başlık kimlik değildir; ölçülemeyen kart TUTULUR');
    assert.equal(result.duplicateCount, 0);
  });

  it('SAF: başlık kuralı da girdiyi değiştirmez', () => {
    const input = Object.freeze(measuredSameTitlePair.map(item => Object.freeze({ ...item })));
    const snapshot = JSON.stringify(input);
    const result = dropDuplicateExpansionCards(input);
    assert.equal(JSON.stringify(input), snapshot);
    assert.equal(input.length, 2);
    assert.equal(result.cards[0], input[0]);
  });

  it('ek alanları taşıyan kartlar olduğu gibi geri verilir', () => {
    const rich = { title: 'Tek Kart', description: 'Açıklama', kind: 'feature', effort: 'low' };
    const result = dropDuplicateExpansionCards([rich]);
    assert.deepEqual(result.cards[0], rich);
  });
});
