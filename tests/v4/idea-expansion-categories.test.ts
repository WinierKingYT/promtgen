import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import { getExpansionCategories } from '../../src/v4/idea-expansion/categories.js';
import type { ProjectDocumentV5 } from '../../src/v4/contracts.js';

const projectFor = (idea: string) => analyzeIdea(idea) as ProjectDocumentV5;

const CORE_IDS = [
  'onboarding', 'core-depth', 'data', 'trust', 'money', 'growth', 'measure', 'narrow'
];

describe('getExpansionCategories', () => {
  it('her projede çekirdek kategorileri verir', () => {
    const ids = getExpansionCategories(projectFor('Bir şeyler yapmak istiyorum')).map(c => c.id);
    for (const id of CORE_IDS) assert.ok(ids.includes(id), `${id} kategorisi eksik`);
  });

  it('web projesine web kategorilerini ekler', () => {
    const ids = getExpansionCategories(projectFor('Bir SaaS dashboard web uygulaması yapmak istiyorum')).map(c => c.id);
    assert.ok(ids.includes('accounts'), 'web projesinde hesap ve yetkiler bulunmalı');
    assert.ok(ids.includes('integrations'));
    assert.ok(ids.includes('a11y'));
  });

  it('oyun projesine oyun kategorilerini ekler ve web kategorilerini eklemez', () => {
    const ids = getExpansionCategories(projectFor('Unity ile bir oyun yapmak istiyorum')).map(c => c.id);
    assert.ok(ids.includes('game-loop'));
    assert.equal(ids.includes('accounts'), false);
  });

  it('saf fonksiyondur: aynı girdi aynı çıktıyı verir', () => {
    const project = projectFor('Mobil bir uygulama yapmak istiyorum');
    assert.deepEqual(getExpansionCategories(project), getExpansionCategories(project));
  });

  it('her kategoride etiket, ipucu ve en az iki başlangıç başlığı vardır', () => {
    for (const category of getExpansionCategories(projectFor('Bir web uygulaması yapmak istiyorum'))) {
      assert.ok(category.label.trim().length > 0, `${category.id} etiketsiz`);
      assert.ok(category.hint.trim().length > 0, `${category.id} ipucusuz`);
      assert.ok(category.seedTitles.length >= 2, `${category.id} en az 2 başlangıç başlığı taşımalı`);
    }
  });

  it('kategori kimlikleri benzersizdir', () => {
    const ids = getExpansionCategories(projectFor('Bir web uygulaması yapmak istiyorum')).map(c => c.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});
