import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import { getExpansionCategories, mergeExpansionCategories, type ExpansionCategory } from '../../src/v4/idea-expansion/categories.js';
import type { DomainPackExpansionAxis, ProjectDocumentV5 } from '../../src/v4/contracts.js';

const projectFor = (idea: string) => analyzeIdea(idea) as ProjectDocumentV5;

const CORE_IDS = [
  'onboarding', 'core-depth', 'data', 'trust', 'money', 'growth', 'measure', 'narrow'
];

/**
 * Domain-pack eksenlerinin (tier 2) sisteme telsiz olarak (henüz hiçbir pack eksen
 * bildirmediği için) sıfır davranış değişikliği ürettiğinin kanıtı: bu dizilim,
 * değişiklik öncesi (BY_DOMAIN'e doğrudan bağımlı eski kod) ile değişiklik sonrası
 * (registry.collectExpansionAxes() üzerinden okunan ama her zaman boş dönen kod)
 * arasında bit bit aynı kalmalıdır. Node ile REST API servisi CEO'nun tespit ettiği
 * ayrışan örnek: classifyProjectDomain 'web' döner ama registry.applicable 'backend-api'
 * paketini döner — iki mekanizma tutarsızdır, bu yüzden bu örnek özellikle sınanır.
 */
const ZERO_BEHAVIOUR_CHANGE_IDEAS: Array<{ idea: string; expectedIds: string[] }> = [
  {
    idea: 'Bir SaaS dashboard web uygulaması yapmak istiyorum',
    expectedIds: ['onboarding', 'core-depth', 'data', 'trust', 'money', 'growth', 'measure', 'narrow', 'accounts', 'integrations', 'a11y']
  },
  {
    idea: 'Unity ile multiplayer bir oyun yapmak istiyorum',
    expectedIds: ['onboarding', 'core-depth', 'data', 'trust', 'money', 'growth', 'measure', 'narrow', 'game-loop', 'simulated-state', 'network-authority', 'input-and-feel', 'content-pipeline']
  },
  {
    idea: 'Bir AI destekli chatbot yapmak istiyorum',
    expectedIds: ['onboarding', 'core-depth', 'data', 'trust', 'money', 'growth', 'measure', 'narrow', 'model-cost', 'accuracy', 'human-approval']
  },
  {
    idea: 'Bir şeyler yapmak istiyorum',
    expectedIds: ['onboarding', 'core-depth', 'data', 'trust', 'money', 'growth', 'measure', 'narrow']
  },
  {
    idea: 'Node ile REST API servisi',
    expectedIds: ['onboarding', 'core-depth', 'data', 'trust', 'money', 'growth', 'measure', 'narrow', 'accounts', 'integrations', 'a11y']
  }
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

  it('oyun projesine derinleştirilmiş oyun eksenlerini ekler: simüle durum, ağ yetkisi, girdi/his, içerik hattı', () => {
    const ids = getExpansionCategories(projectFor('Unity ile bir at sistemi yapmak istiyorum, multiplayer olacak')).map(c => c.id);
    assert.ok(ids.includes('game-loop'), 'game-loop kimliği hâlâ mevcut olmalı');
    assert.ok(ids.includes('simulated-state'), 'simulated-state ekseni eksik');
    assert.ok(ids.includes('network-authority'), 'network-authority ekseni eksik');
    assert.ok(ids.includes('input-and-feel'), 'input-and-feel ekseni eksik');
    assert.ok(ids.includes('content-pipeline'), 'content-pipeline ekseni eksik');
    assert.equal(ids.includes('accounts'), false, 'oyun projesinde web kategorisi olan accounts görünmemeli');
  });

  it('geriye dönük genel "multiplayer" ve "ilerleme/ödül" eksenleri artık daha derin eksenlerle değişti', () => {
    const ids = getExpansionCategories(projectFor('Unity ile bir oyun yapmak istiyorum')).map(c => c.id);
    assert.equal(ids.includes('multiplayer'), false, 'eski multiplayer ekseni network-authority ile değişmeli');
    assert.equal(ids.includes('progression'), false, 'eski progression ekseni simulated-state ile değişmeli');
  });

  it('her oyun ekseninde en az 3 somut başlangıç başlığı vardır', () => {
    const gameCategoryIds = ['game-loop', 'simulated-state', 'network-authority', 'input-and-feel', 'content-pipeline'];
    const categories = getExpansionCategories(projectFor('Unity ile bir at sistemi yapmak istiyorum, multiplayer olacak'));
    for (const id of gameCategoryIds) {
      const category = categories.find(c => c.id === id);
      assert.ok(category, `${id} kategorisi bulunamadı`);
      assert.ok(category.seedTitles.length >= 3, `${id} en az 3 başlangıç başlığı taşımalı`);
    }
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

  describe('sıfır davranış değişikliği kanıtı (pack eksenleri boş olduğu sürece)', () => {
    for (const { idea, expectedIds } of ZERO_BEHAVIOUR_CHANGE_IDEAS) {
      it(`"${idea}" için kimlik dizilimi değişmeden kalır`, () => {
        const ids = getExpansionCategories(projectFor(idea)).map(c => c.id);
        assert.deepEqual(ids, expectedIds);
      });
    }
  });

  describe('mergeExpansionCategories (tier 2 pack ekseni birleştirme sözleşmesi)', () => {
    const core: ExpansionCategory[] = [
      { id: 'onboarding', label: 'Çekirdek onboarding', hint: 'çekirdek', seedTitles: ['c1', 'c2'] },
      { id: 'data', label: 'Çekirdek veri', hint: 'çekirdek', seedTitles: ['c1', 'c2'] }
    ];
    const domainCategories: ExpansionCategory[] = [
      { id: 'accounts', label: 'Alan hesapları', hint: 'alan', seedTitles: ['d1', 'd2'] }
    ];

    it('pack ekseni boşken CORE + alan eksenlerini olduğu gibi verir (inert path)', () => {
      const result = mergeExpansionCategories(core, domainCategories, []);
      assert.deepEqual(result.map(c => c.id), ['onboarding', 'data', 'accounts']);
    });

    it('pack ekseni ekler ve CORE/alan sırasını bozmaz', () => {
      const packAxes: DomainPackExpansionAxis[] = [
        { id: 'pack-axis-1', label: 'Pack Ekseni 1', hint: 'pack ipucu', seedTitles: ['p1', 'p2'] }
      ];
      const result = mergeExpansionCategories(core, domainCategories, packAxes);
      assert.deepEqual(result.map(c => c.id), ['onboarding', 'data', 'accounts', 'pack-axis-1']);
    });

    it('CORE kimliğiyle çakışan pack eksenini eler; CORE her zaman kazanır', () => {
      const collidingPackAxis: DomainPackExpansionAxis = {
        id: 'onboarding',
        label: 'Pack sürümü onboarding',
        hint: 'pack ipucu',
        seedTitles: ['p1', 'p2']
      };
      const result = mergeExpansionCategories(core, domainCategories, [collidingPackAxis]);
      const onboarding = result.find(c => c.id === 'onboarding');
      assert.equal(result.filter(c => c.id === 'onboarding').length, 1, 'çakışan kimlik iki kez görünmemeli');
      assert.equal(onboarding?.label, 'Çekirdek onboarding', 'CORE, pack eksenine karşı kazanmalı');
    });

    it('alan (BY_DOMAIN) kimliğiyle çakışan pack eksenini eler; alan ekseni kazanır', () => {
      const collidingPackAxis: DomainPackExpansionAxis = {
        id: 'accounts',
        label: 'Pack sürümü accounts',
        hint: 'pack ipucu',
        seedTitles: ['p1', 'p2']
      };
      const result = mergeExpansionCategories(core, domainCategories, [collidingPackAxis]);
      const accounts = result.find(c => c.id === 'accounts');
      assert.equal(result.filter(c => c.id === 'accounts').length, 1);
      assert.equal(accounts?.label, 'Alan hesapları', 'BY_DOMAIN, pack eksenine karşı kazanmalı');
    });

    it('pack eksenlerini en fazla 6 ile sınırlar', () => {
      const manyAxes: DomainPackExpansionAxis[] = Array.from({ length: 9 }, (_, index) => ({
        id: `pack-axis-${index}`,
        label: `Pack Ekseni ${index}`,
        hint: 'pack ipucu',
        seedTitles: ['p1', 'p2']
      }));
      const result = mergeExpansionCategories(core, domainCategories, manyAxes);
      const packIds = result.map(c => c.id).filter(id => id.startsWith('pack-axis-'));
      assert.equal(packIds.length, 6, 'pack eksenleri 6 ile sınırlı olmalı');
      assert.deepEqual(packIds, ['pack-axis-0', 'pack-axis-1', 'pack-axis-2', 'pack-axis-3', 'pack-axis-4', 'pack-axis-5'], 'ilk 6 eksen korunmalı, sıralama bozulmamalı');
    });
  });
});
