import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PRODUCT_CONTRACT } from '../../src/v4/product/product-contract.js';
import { renderProductDocuments, renderRepoRootDocuments } from '../../src/v4/product/product-documentation.js';
import { PROJECT_STAGES, STAGE_NAMES } from '../../src/v4/application/project-stages.js';
import { PRODUCTION_ROOTS } from '../../src/v4/source-boundaries.js';

describe('Focused Planner product contract', () => {
  it('has one primary user, one bounded promise, and an explicit Planner/Labs split', () => {
    assert.match(PRODUCT_CONTRACT.primaryUser['tr-TR'], /bireysel geliştirici/i);
    assert.match(PRODUCT_CONTRACT.positioning['tr-TR'], /local-first/i);
    assert.deepEqual(PRODUCT_CONTRACT.coreNavigation, ['Projeler', 'Yeni Proje', 'Yaşayan Plan', 'Revizyonlar', 'Export']);
    assert.ok(PRODUCT_CONTRACT.labsNavigation.includes('Codex Yürütmesi'));
    assert.doesNotMatch(PRODUCT_CONTRACT.positioning['tr-TR'], /herhangi bir proje|kusursuz|tam otomatik/i);
  });

  it('publishes a bounded support matrix and keeps high-risk domains unsupported', () => {
    const support = new Map(PRODUCT_CONTRACT.supportedProjects.map(project => [project.id, project.support]));
    assert.equal(support.get('web-app'), 'candidate-stable');
    assert.equal(support.get('backend-api'), 'candidate-stable');
    assert.equal(support.get('game-2d'), 'experimental');
    assert.equal(support.get('game-3d'), 'unsupported');
    assert.equal(support.get('critical-health'), 'unsupported');
    assert.equal(support.get('critical-finance'), 'unsupported');
  });

  it('keeps generated product documentation aligned with the contract', () => {
    for (const [fileName, expected] of Object.entries(renderProductDocuments())) {
      const filePath = path.resolve('docs', 'product', fileName);
      assert.ok(existsSync(filePath), `${fileName} exists`);
      const normalize = (content: string) => `${content.replace(/\r\n/g, '\n').trimEnd()}\n`;
      assert.equal(normalize(readFileSync(filePath, 'utf8')), normalize(expected), `${fileName} matches ProductContract`);
    }
  });

  it('keeps the legacy onboarding prototype outside active app workspaces', () => {
    assert.equal(existsSync(path.resolve('apps', 'web-prototype')), false);
    assert.equal(existsSync(path.resolve('experiments', 'legacy-web-prototype', 'README.md')), true);
    const rootPackage = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8'));
    assert.deepEqual(rootPackage.workspaces, ['apps/*', 'packages/*']);
    const appSource = readFileSync(path.resolve('src', 'react', 'components', 'StartScreen.tsx'), 'utf8');
    assert.match(appSource, /PRODUCT_CONTRACT|getProductCopy/);
  });
});

describe('İki farklı "unsupported"', () => {
  const byId = new Map(PRODUCT_CONTRACT.supportedProjects.map(item => [item.id, item]));

  it('her unsupported alan hangi anlamda oldugunu SOYLER', () => {
    // Tek kelimeyle söylenmesi belgeleri birbirine düşürüyordu: `game-3d`
    // "alan paketi yok" gerekçesiyle unsupported yazıyordu ve okuyan "hiç
    // çalışmıyor" sanıyordu; oysa v2 çalışması o alanda ölçüm yapıyor.
    for (const project of PRODUCT_CONTRACT.supportedProjects) {
      if (project.support !== 'unsupported') continue;
      assert.ok(
        project.unsupportedReason === 'unmeasured' || project.unsupportedReason === 'refused',
        `${project.id} hangi anlamda unsupported olduğunu söylemiyor`
      );
    }
  });

  it('guvenlik-kritik alanlar REDDEDILMIS, olculmemis degil', () => {
    // Bu ayrım tek yönlü bir kapı: "ölçmedik" kanıtla açılabilir, "reddedildi"
    // açılamaz. Kritik sağlık ve finansı `unmeasured` yapmak, iyi veri
    // geldiğinde bu alanları desteklemenin kapısını açardı.
    for (const id of ['critical-health', 'critical-finance', 'large-distributed']) {
      assert.equal(byId.get(id)?.unsupportedReason, 'refused', id);
    }
  });

  it('reddedilen alanlar bunun bir olcum eksikligi olmadigini yazar', () => {
    for (const id of ['critical-health', 'critical-finance', 'large-distributed']) {
      const limitations = byId.get(id)?.limitations.join(' ') || '';
      assert.match(limitations, /ölçüm eksikliği DEĞİL|olcum eksikligi DEGIL/, id);
    }
  });

  it('desteklenen alanlar gerekce alani TASIMAZ', () => {
    // Anlamsız bir alanı doldurmak, gelecekte birinin ona bakıp yanlış sonuca
    // varmasına yol açar.
    for (const project of PRODUCT_CONTRACT.supportedProjects) {
      if (project.support === 'unsupported') continue;
      assert.equal(project.unsupportedReason, undefined, project.id);
    }
  });
});

describe('Kök ajan dosyaları', () => {
  const rootDocuments = renderRepoRootDocuments();
  const normalize = (content: string) => `${content.replace(/\r\n/g, '\n').trimEnd()}\n`;

  it('AGENTS.md ve CLAUDE.md depo kokunde ve uretici ile ayni', () => {
    // Kapı (`check:product-docs`) bunu zaten zorluyor; test aynı şeyi ikinci
    // kez söylüyor çünkü `docs/product/` için de öyle yapılmış. Kapı CI'da,
    // test geliştiricinin makinesinde düşer.
    assert.deepEqual(Object.keys(rootDocuments).sort(), ['AGENTS.md', 'CLAUDE.md']);
    for (const [fileName, expected] of Object.entries(rootDocuments)) {
      const filePath = path.resolve(fileName);
      assert.ok(existsSync(filePath), `${fileName} exists`);
      assert.equal(normalize(readFileSync(filePath, 'utf8')), normalize(expected), `${fileName} matches`);
    }
  });

  it('her ikisi de canonical yasam dongusunu TEK kaynaktan yazar', () => {
    // Aşama adları elle yazılsaydı beşinci bir aşama eklendiğinde bu dosyalar
    // sessizce eskirdi. Test, döngünün `PROJECT_STAGES` sırasını takip
    // ettiğini doğrular.
    for (const [fileName, content] of Object.entries(rootDocuments)) {
      let cursor = -1;
      for (const stage of PROJECT_STAGES) {
        const index = content.indexOf(`${STAGE_NAMES[stage]} (\`${stage}\`)`);
        assert.ok(index > cursor, `${fileName}: ${stage} canonical sırada değil`);
        cursor = index;
      }
    }
  });

  it('yasak modeli ilan etmez ama MVP kuralini yazar', () => {
    // DOC-06'nın dersi: üretilmiş olmak yetmiyor. Eski `MVP_SCOPE.md`
    // üretiliyordu ve kapı yeşildi, yine de bırakılan çerçeveyi ilan ediyordu.
    // O belge V3-09'da sözleşmeden türetildi; aşağıdaki blok orayı da bekler.
    for (const [fileName, content] of Object.entries(rootDocuments)) {
      assert.doesNotMatch(content, /Fikir → MVP → Plan|MVP Kapsamı/i, fileName);
      assert.ok(content.includes(PRODUCT_CONTRACT.mvpRule), `${fileName}: MVP kuralı sözleşmeden gelmiyor`);
      for (const identity of PRODUCT_CONTRACT.mistakenIdentities) {
        assert.ok(content.includes(identity), `${fileName}: "${identity}" eksik`);
      }
    }
  });

  it('uretim koklerini kopyalamaz, sinir modulunden okur', () => {
    for (const [fileName, content] of Object.entries(rootDocuments)) {
      for (const root of PRODUCTION_ROOTS) {
        assert.ok(content.includes(`\`${root}\``), `${fileName}: ${root} yazılmamış`);
      }
    }
  });
});

describe('Sözleşme, çalışan ürünü anlatır', () => {
  it('vaat IKI ONAYI da icerir - V3 yapisinin tanimlayici ozelligi', () => {
    // Eski vaat "MVP sınırlarını seç ve planını dışa aktar" diyordu; teknik
    // tasarım aşaması hiç yoktu. Sözleşme çalışan üründen geri kalırsa,
    // kullanıcıya var olmayan bir akış anlatmış oluruz.
    const promise = PRODUCT_CONTRACT.promise['tr-TR'];

    assert.match(promise, /onayla/i);
    assert.match(promise, /nasıl kuracağımızı|teknik/i);
  });

  it('kullanici problemleri teknik kararlarin gomulmesini de sayar', () => {
    // V3'ün var olma sebebi bu problem. Listede yoksa sözleşme neden
    // değiştiğimizi açıklamıyor demektir.
    assert.ok(
      PRODUCT_CONTRACT.userProblems.some(problem => /teknik karar/i.test(problem)),
      'teknik kararların gömülmesi bir kullanıcı problemi olarak sayılmıyor'
    );
  });

  it('yapmayacaklari ile olmadiklari AYRI listelerde durur', () => {
    // `nonGoals` ürünün yapmayacağı işleri sayar; `mistakenIdentities` okuyanın
    // yanlış varsaydığı kimlikleri. Tek listede toplanırsa ayrım kaybolur ve
    // "sunmayacağız" ile "değiliz" aynı cümle gibi okunur.
    assert.ok(PRODUCT_CONTRACT.nonGoals.some(goal => /Bulut senkronizasyonu/.test(goal)));
    assert.ok(PRODUCT_CONTRACT.mistakenIdentities.length >= 5);
    for (const identity of PRODUCT_CONTRACT.mistakenIdentities) {
      assert.ok(!PRODUCT_CONTRACT.nonGoals.includes(identity), identity);
      assert.match(identity, /değildir/);
    }
  });

  it('MVP kurali sozlesmede TEK cumle olarak yasar', () => {
    // Kural bugüne kadar yalnız `docs/LEGACY_MODEL_INVENTORY.md` içinde düzyazı
    // olarak duruyordu; alıntılayan her yer kendi kelimelerini yazardı.
    assert.match(PRODUCT_CONTRACT.mvpRule, /MVP kavramı yasak değildir/);
    assert.match(PRODUCT_CONTRACT.mvpRule, /evrensel yaşam döngüsü/);
  });

  it('kimlik ve surum V3 ile hizali', () => {
    assert.equal(PRODUCT_CONTRACT.id, 'promtgen-project-design-planner');
    assert.equal(PRODUCT_CONTRACT.version, 3);
  });
});

describe('Üretilen ürün belgeleri — DOC-06', () => {
  const productDocuments = renderProductDocuments();

  /**
   * Bırakılan çerçevenin İLAN edilmiş hâli — çıplak `MVP` kelimesi değil.
   *
   * Kelimenin kendisi yasak değildir (`PRODUCT_CONTRACT.mvpRule`); yasak olan
   * onu her projenin evrensel kapsam/aşama çerçevesi gibi yazmaktır. Bu yüzden
   * kalıp kelimeyi değil, **iddiayı** arar: bir gün sözleşmenin kuralı bir ürün
   * belgesine basılırsa test haklı olarak susar, "MVP kapsamı" başlığı geri
   * gelirse düşer.
   */
  const ABANDONED_FRAME = /\bMVP['’]?\w*\s+(kapsam|içi|dışı|hedef|sınır|plan|tek iş)|Fikir\s*(→|->|=>)\s*MVP/i;

  it('cekirdek kapsam belgesi sozlesmeden turetilir', () => {
    // DOC-06 tam olarak buydu: belge üretiliyordu ama metni üreticinin
    // kaynağına gömülüydü, sözleşmeden gelmiyordu. `check:product-docs`
    // belgenin üreticiyle eşleşmesini doğrular; üreticinin sözleşmeyle
    // eşleşmesini yalnız bu test doğrular.
    const scope = productDocuments['CORE_SCOPE.md'];
    assert.ok(scope, 'CORE_SCOPE.md üretilmiyor');
    assert.equal(productDocuments['MVP_SCOPE.md'], undefined, 'eski anahtar hâlâ üretiliyor');
    assert.equal(existsSync(path.resolve('docs', 'product', 'MVP_SCOPE.md')), false, 'eski belge diskte kalmış');

    assert.ok(scope.includes(PRODUCT_CONTRACT.promise['tr-TR']), 'tek iş sözleşmeden gelmiyor');
    for (const output of PRODUCT_CONTRACT.coreExports) {
      assert.ok(scope.includes(output), `çekirdek çıktı eksik: ${output}`);
    }
    let cursor = -1;
    for (const stage of PROJECT_STAGES) {
      const index = scope.indexOf(`${STAGE_NAMES[stage]} (\`${stage}\`)`);
      assert.ok(index > cursor, `CORE_SCOPE.md: ${stage} canonical sırada değil`);
      cursor = index;
    }
  });

  it('hicbir uretilen urun belgesi birakilan cerceveyi ILAN etmez', () => {
    for (const [fileName, content] of Object.entries(productDocuments)) {
      assert.doesNotMatch(content, ABANDONED_FRAME, fileName);
    }
  });
});
