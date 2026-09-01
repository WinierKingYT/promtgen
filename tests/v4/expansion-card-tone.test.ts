import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  dropCommandToneExpansionCards,
  hasCommandTone,
  hasTaskToneTitle
} from '../../src/v4/application/expansion-card-tone.js';

const card = (title: string, description: string) => ({ title, description });

/**
 * CANLI ÖLÇÜM (qwen2.5:7b / Ollama, fikir = "unityde bir at sistemi yapmak
 * istiyorum multiplayer olucak"): kartlar FİKİR değil GÖREV gibi yazılmıştı.
 * Aşağıdaki dört açıklama ölçümden HARFİ HARFİNE alınmıştır; hepsi emir
 * kipiyle bir geliştiriciye verilmiş iş tanımıdır.
 *
 * Kullanıcının kendi sözü ise bir ŞEY istiyordu: "at sistemine health,
 * stamina, at sürme, at envanteri gibi şeyler eklenecek".
 */
const measuredCommandTone = [
  card('Yarış şablonları', 'At yarışı için farklı şablonları oluşturun. Örneğin, klasik yarış, uzun mesafe yarışı ve hız yarışı gibi.'),
  card('Zamanlayıcılar', 'At yarışlarının akışını ve zamanlamasını kontrol edecek zamanlayıcılar ve akış kontrol mekanizmaları oluşturun.'),
  card('Etkileşim araçları', 'Oyuncuların atlarına etkileşim kurabilecek araçlar oluşturun.'),
  card('Koordineli hareket', 'Atlar arasında koordineli hareketler oluşturun.')
];

/** Kullanıcıya bir ŞEYİ anlatan meşru açıklamalar. Hiçbiri elenmemeli. */
const legitimate = [
  card('At dayanıklılığı', 'At koştukça yorulur, dinlenmesi gerekir.'),
  card('Görünürlük', 'Oyuncular birbirinin atını görebilir.'),
  card('Ağ eşitlemesi', 'Atın hareketi ağ üzerinden eşitlenir.')
];

/**
 * AYNI CANLI ÖLÇÜM, BAŞLIK SÜTUNU. Aşağıdaki dokuz başlık ekrandan HARFİ
 * HARFİNE alınmıştır; hepsi bir geliştiriciye verilmiş iş kalemidir, kullanıcıya
 * anlatılan bir ŞEY değil.
 */
const measuredTaskTitles = [
  'At hareket öncelikleri belirleme',
  'Atın yorulma mekanizması geliştirme',
  'At rehin alım ve salımı davranışları implemente etme',
  'Atların yarışma davranışlarını geliştirme',
  'Atların farklı karakteristiği ekleme',
  'At hareket etkileşimleri geliştirme',
  'Rehine durumu takibini geliştirmek',
  'Çerezlerle oturum yönetimi geliştirmek',
  'Atın rehin alım/salımı için sesler ekleyin'
];

/**
 * AYNI ÖLÇÜMÜN İYİ KARTLARI. `Atı uzaktan çağırma` ürünün tam olarak istediği
 * karttır ve `-ma` ile biter: kuralı eke değil FİİLE bağlamanın tek sebebi
 * budur.
 */
const measuredGoodTitles = [
  'Atı uzaktan çağırma',
  'At dayanıklılığı',
  'Eyer ve envanter',
  'At hareket modeli',
  'Yarışma mekanizması',
  'Saldırganlık ve defans'
];

describe('hasTaskToneTitle', () => {
  it('ölçümdeki dokuz görev başlığını yakalar', () => {
    for (const title of measuredTaskTitles) {
      assert.equal(hasTaskToneTitle(title), true, `görev başlığı kaçtı: ${title}`);
    }
  });

  /**
   * EN KRİTİK REGRESYON. `çağırma` da `-ma` ile biter ama OYUNCUNUN yaptığı
   * şeydir; elenirse kullanıcı ürünün en iyi önerisini hiç göremez.
   */
  it('`Atı uzaktan çağırma` başta olmak üzere iyi başlıkları korur', () => {
    for (const title of measuredGoodTitles) {
      assert.equal(hasTaskToneTitle(title), false, `yanlış eleme: ${title}`);
    }
  });

  /**
   * ASİMETRİ: dar liste. Aşağıdakiler `-ma/-me` ile biter ama fiil geliştirme
   * fiili değildir; hepsi KORUNUR.
   */
  it('geliştirme fiili olmayan ad-fiilleri elemez', () => {
    const notTasks = [
      'Atı tımar etme',
      'Ata binme ve inme',
      'Oyuncunun atı besleme',
      'Yarış sırasında yorulma',
      'Atların sürü hâlinde toplanması',
      'Atları toplama',
      'Atı besleme',
      'Engel atlama'
    ];
    for (const title of notTasks) {
      assert.equal(hasTaskToneTitle(title), false, `yanlış eleme: ${title}`);
    }
  });

  /**
   * CANLI ÖLÇÜM (aynı koşu). 2. TEKİL emir Türkçede EKSİZDİR: fiil kökünün
   * kendisi. Ek arayan kural onu göremez.
   */
  it('eksiz 2. tekil emirle biten başlığı yakalar', () => {
    assert.equal(hasTaskToneTitle('Azalan değeri sürekli görünür kıl'), true);
    assert.equal(hasTaskToneTitle('Atlar için ayrı bir envanter oluştur'), true);
    assert.equal(hasTaskToneTitle('Yorulma eşiğini sen belirle'), true);
  });

  /**
   * EN KRİTİK REGRESYON (eksiz emir). Eksiz emir fiil KÖKÜDÜR ve Türkçede pek
   * çok kök aynı anda isimdir: "kur" (döviz kuru), "kıl" (saç teli), "seç"
   * (seçim). Liste bu yüzden DAR ve KAPALIDIR; aşağıdakilerin hiçbiri
   * elenmemelidir.
   */
  it('eksiz emirle çakışan isimleri elemez', () => {
    const nouns = [
      'Döviz kuru',
      'Atın kılı',
      'Renk seçimi',
      'Oyuncunun seçimi',
      'Yarış göstergesi',
      'At kılları',
      'Ahır kurulumu',
      'Yem kabı ve su kovası'
    ];
    for (const title of nouns) {
      assert.equal(hasTaskToneTitle(title), false, `yanlış eleme: ${title}`);
    }
  });

  /** Aynı liste açıklama sütununda da geçerlidir; cümle sonuna bakılır. */
  it('eksiz emri açıklamada da yakalar, ismi elemez', () => {
    assert.equal(hasCommandTone('Azalan değeri sürekli görünür kıl.'), true);
    assert.equal(hasCommandTone('Atın kılı rüzgârda dalgalanır.'), false);
    assert.equal(hasCommandTone('Sunucu sayısı sabit, değişen tek şey döviz kuru.'), false);
    assert.equal(hasCommandTone('Oyuncu ahırda kendi atını seçer.'), false);
  });

  /**
   * ASİMETRİ (eksiz emir). Aşağıdaki kökler OYUNCUNUN yaptığı şeylerdir ya da
   * sık birer isimdir; liste ölçümle büyür, tahminle değil.
   */
  it('oyuncu eylemi olan eksiz kökleri elemez', () => {
    const playerActions = [
      'Atı ahırdan seç',
      'Atı otlakta besle',
      'Engelin üstünden atla',
      'Dizgini sıkı tut'
    ];
    for (const title of playerActions) {
      assert.equal(hasTaskToneTitle(title), false, `yanlış eleme: ${title}`);
    }
  });

  /** Tek kelimelik başlıkta "ondan önce içerik" koşulu tutmaz; korunur. */
  it('tek kelimelik başlığı elemez', () => {
    assert.equal(hasTaskToneTitle('Geliştirme'), false);
    assert.equal(hasTaskToneTitle('Ekleme'), false);
  });

  it('boş veya anlamsız başlıkta görev bulmaz', () => {
    assert.equal(hasTaskToneTitle(''), false);
    assert.equal(hasTaskToneTitle('   '), false);
    assert.equal(hasTaskToneTitle('...'), false);
  });
});

describe('hasCommandTone', () => {
  it('ölçümdeki dört emir kipli açıklamayı yakalar', () => {
    for (const item of measuredCommandTone) {
      assert.equal(hasCommandTone(item.description), true, `emir kipi kaçtı: ${item.description}`);
    }
  });

  it('meşru açıklamaları emir saymaz', () => {
    for (const item of legitimate) {
      assert.equal(hasCommandTone(item.description), false, `yanlış eleme: ${item.description}`);
    }
  });

  /**
   * EN KRİTİK REGRESYON. `-in / -ın / -un / -ün` ile biten her kelime fiil
   * DEĞİLDİR: isimler, sıfatlar, zarflar ve iyelik ekleri aynı harflerle
   * biter. Yanlış eleme kullanıcıdan GERÇEK bir öneriyi gizler.
   */
  it('emir kipine benzeyen isim/sıfat/zarfları elemez', () => {
    const notCommands = [
      'Bu mod uzun mesafe yarışları için tasarlanmış bir oyun.',
      'At yarışı bir yarış oyunu gibi ilerler, bu yüzden tempo uzun.',
      'Bunu bir yarış modu olarak düşün.',
      'Vadi derin, akşamları hava serin.',
      'Ahır köye yakın, bütün atlar orada durur.',
      'Yarışın bitişi yarın.'
    ];
    for (const sentence of notCommands) {
      assert.equal(hasCommandTone(sentence), false, `yanlış pozitif: ${sentence}`);
    }
  });

  it('iyelik ekli kelimeleri emir saymaz', () => {
    const possessive = [
      'Atın hareketi ağ üzerinden eşitlenir.',
      'Oyuncunun elindeki dizgin atın yönünü belirler.',
      'Sistemin yapısı tek bir sunucuya bağlıdır.'
    ];
    for (const sentence of possessive) {
      assert.equal(hasCommandTone(sentence), false, `iyelik eki emir sanıldı: ${sentence}`);
    }
  });

  /**
   * 3. TEKİL İSTEK KİPİ ("-sın/-sin/-sun/-sün") ürün hakkında bir DİLEKTİR ve
   * tam olarak istenen kart dilidir. Aşağıdaki üç cümle e2e sahte kartlarından
   * HARFİ HARFİNE alınmıştır (tests/e2e/idea-expansion-board.spec.ts); ilk
   * uygulama üçünü de eleyip panoyu boşaltmış ve e2e kapısı bunu yakalamıştı.
   */
  it('istek kipini ("-sın") emir saymaz', () => {
    const wishes = [
      'Sürüş geçmişi buluta gitmeden telefonda saklansın.',
      'Konum paylaşımı için ayrı ve geri alınabilir bir izin sorulsun.',
      'Kullanıcı tüm sürüş verisini tek adımda silebilsin.',
      'Atın yorulması oyuncuya açıkça gösterilsin.',
      'Envanter her oyuncuda ayrı tutulsun.'
    ];
    for (const sentence of wishes) {
      assert.equal(hasCommandTone(sentence), false, `istek kipi emir sanıldı: ${sentence}`);
    }
  });

  /**
   * CANLI ÖLÇÜM. Cümle emir kipiyle biter ama parantezli bir ek arkasına
   * eklendiği için emir fiili cümlenin SONU olmaktan çıkar ve ilk uygulama onu
   * kaçırdı. Parantez içi ek ölçümden ÖNCE atılır; cümle-sonu kuralı
   * değişmeden kalır.
   */
  it('parantezli ek yüzünden gizlenen emir fiilini yakalar', () => {
    const measured = 'Atların hangi olaylara tepki vermesi gerektiğini belirleyin (örneğin, rehin alınma, yarışma, ve diğer atlarla etkileşim).';
    assert.equal(hasCommandTone(measured), true);
    assert.equal(
      hasCommandTone('Atlar için farklı yürüyüş türleri oluşturun (tırıs, dörtnal).'),
      true
    );
  });

  /**
   * CANLI ÖLÇÜM (aynı koşu). Parantezin yaptığını virgül de yapar: emir fiili
   * cümlenin ortasında kalır, arkasına "örneğin ..." diye bir örnek ara sözü
   * yapışır ve cümle-sonu kuralı kaçırır.
   */
  it('virgülle eklenen örnek ara sözünün gizlediği emri yakalar', () => {
    const measured = 'Atların farklı kıyafet seçenekleri ile donanımını ekleyin, örneğin uzun kuyruk ve eyer.';
    assert.equal(hasCommandTone(measured), true);
    assert.equal(
      hasCommandTone('Atlar için farklı yürüyüş türleri oluşturun, mesela tırıs ve dörtnal.'),
      true
    );
  });

  /**
   * EN KRİTİK REGRESYON (virgül). Virgül Türkçede meşru bir liste/yan cümle
   * ayracıdır; onu toptan cümle sınırı saymak aşağıdaki cümleleri elerdi.
   * Yalnız açık ÖRNEK belirteciyle başlayan ara söz atılır.
   */
  it('virgüllü meşru cümleleri emir saymaz', () => {
    const notCommands = [
      'At koştukça yorulur, dinlenmesi gerekir.',
      'At koşar, yorulur ve dinlenir.',
      'Atın enerji seviyesi azalır ve atın hareket hızını etkiler.',
      'Atın, oyuncunun elindeki dizginle yönlendirilir.',
      'Bu, uzun bir oyun için düşünülmüş derin bir mekanik.',
      'Eyer, dizgin ve nal ayrı ayrı takılır.'
    ];
    for (const sentence of notCommands) {
      assert.equal(hasCommandTone(sentence), false, `yanlış pozitif: ${sentence}`);
    }
  });

  /** Örnek ara sözünü atmak meşru cümleyi emir yapmamalı. */
  it('örnek ara sözlü meşru cümleyi emir saymaz', () => {
    assert.equal(
      hasCommandTone('Atın yorulması oyuncuya açıkça gösterilsin, örneğin nefes sesiyle.'),
      false
    );
    assert.equal(
      hasCommandTone('At koştukça yorulur, örneğin uzun mesafede daha hızlı.'),
      false
    );
  });

  /** Parantez atmak meşru cümleyi emir yapmamalı. */
  it('parantezli meşru açıklamayı emir saymaz', () => {
    assert.equal(
      hasCommandTone('Atın yorulması oyuncuya açıkça gösterilsin (nefes sesi, yavaşlama).'),
      false
    );
    assert.equal(
      hasCommandTone('At koştukça yorulur (uzun mesafede daha hızlı).'),
      false
    );
  });

  it('boş veya anlamsız girdide emir bulmaz', () => {
    assert.equal(hasCommandTone(''), false);
    assert.equal(hasCommandTone('   '), false);
    assert.equal(hasCommandTone('...'), false);
  });
});

describe('dropCommandToneExpansionCards', () => {
  it('emir kipli kartları tek tek eler, partiyi reddetmez', () => {
    const batch = [measuredCommandTone[0], legitimate[0], measuredCommandTone[2], legitimate[1]];
    const result = dropCommandToneExpansionCards(batch);
    assert.deepEqual(result.cards.map(item => item.title), ['At dayanıklılığı', 'Görünürlük']);
    assert.equal(result.commandToneCount, 2);
  });

  it('tüm parti emir kipliyse hepsi elenir ama fırlatmaz', () => {
    const result = dropCommandToneExpansionCards(measuredCommandTone);
    assert.deepEqual(result.cards, []);
    assert.equal(result.commandToneCount, 4);
  });

  it('meşru partiye hiç dokunmaz', () => {
    const result = dropCommandToneExpansionCards(legitimate);
    assert.equal(result.commandToneCount, 0);
    assert.deepEqual(result.cards.map(item => item.title), legitimate.map(item => item.title));
  });

  /**
   * BAĞLAMA: aynı fonksiyon hem başlığı hem açıklamayı denetler. Açıklaması
   * kusursuz olsa bile başlık bir iş kalemiyse kart elenir.
   */
  it('açıklaması meşru olsa da görev başlıklı kartı eler', () => {
    const batch = [
      card('Atın yorulma mekanizması geliştirme', 'At koştukça yorulur, dinlenmesi gerekir.'),
      card('Atı uzaktan çağırma', 'Oyuncular, atları oyunun belirli noktalarından uzaktan çağırabilirler.')
    ];
    const result = dropCommandToneExpansionCards(batch);
    assert.deepEqual(result.cards.map(item => item.title), ['Atı uzaktan çağırma']);
    assert.equal(result.commandToneCount, 1);
  });

  it('ölçümdeki dokuz görev başlığının hepsini eler', () => {
    const batch = measuredTaskTitles.map(title => card(title, 'At koştukça yorulur.'));
    const result = dropCommandToneExpansionCards(batch);
    assert.deepEqual(result.cards, []);
    assert.equal(result.commandToneCount, measuredTaskTitles.length);
  });

  it('ölçümdeki iyi başlıkların hiçbirine dokunmaz', () => {
    const batch = measuredGoodTitles.map(title => card(title, 'At koştukça yorulur.'));
    const result = dropCommandToneExpansionCards(batch);
    assert.equal(result.commandToneCount, 0);
    assert.deepEqual(result.cards.map(item => item.title), measuredGoodTitles);
  });

  it('boş partide boş sonuç döner', () => {
    assert.deepEqual(dropCommandToneExpansionCards([]), { cards: [], commandToneCount: 0 });
  });

  it('SAF: girdiyi mutasyona uğratmaz, aynı nesneleri geri verir', () => {
    const batch = [legitimate[0], measuredCommandTone[1], legitimate[2]];
    const snapshot = batch.map(item => ({ ...item }));
    const result = dropCommandToneExpansionCards(batch);
    assert.equal(batch.length, 3, 'girdi dizisi kısaltılmamalı');
    assert.deepEqual(batch, snapshot, 'girdi kartları değiştirilmemeli');
    assert.equal(result.cards[0], batch[0], 'kalan kartlar kopyalanmadan geri verilmeli');
    assert.equal(result.cards[1], batch[2]);
  });

  it('DETERMİNİST: aynı girdi her çağrıda aynı sonucu verir', () => {
    const batch = [...measuredCommandTone, ...legitimate];
    const first = dropCommandToneExpansionCards(batch);
    const second = dropCommandToneExpansionCards(batch);
    assert.deepEqual(first.cards.map(item => item.title), second.cards.map(item => item.title));
    assert.equal(first.commandToneCount, second.commandToneCount);
  });

  /**
   * ASİMETRİ: emin değilsen TUT. Açıklaması olmayan kart ölçülemez; emir
   * sayılıp elenirse kullanıcı gerçek bir öneriyi hiç görmez.
   */
  it('açıklamasız kartı korur', () => {
    const result = dropCommandToneExpansionCards([card('At envanteri', '')]);
    assert.equal(result.commandToneCount, 0);
    assert.equal(result.cards.length, 1);
  });
});
