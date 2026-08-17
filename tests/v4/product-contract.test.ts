import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PRODUCT_CONTRACT } from '../../src/v4/product/product-contract.js';
import { renderProductDocuments } from '../../src/v4/product/product-documentation.js';

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
