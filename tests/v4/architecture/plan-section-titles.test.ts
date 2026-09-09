import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PLAN_SECTION_DEFINITIONS,
  planSectionTitle,
  planSectionTitles
} from '../../../src/v4/project-document.js';

const root = resolve(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

/**
 * A5 — KULLANICIYA HAM İNGİLİZCE BÖLÜM KİMLİĞİ GÖSTERİLİYORDU.
 *
 * ÖLÇÜM (bu paketten önce): iki gösterim yeri `affectedSections` dizisini
 * olduğu gibi basıyordu — "Etkilenen bölümler: vision, scope, requirements".
 * `PLAN_SECTION_DEFINITIONS` o kimliklerin Türkçe başlığını (`Vizyon ve
 * Problem`, `Kapsam`, …) zaten taşıyordu; kimse okumuyordu.
 */
describe('Plan bölüm başlığı çözümlemesi', () => {
  it('bilinen her kimlik kendi Türkçe başlığına çözülür', () => {
    for (const section of PLAN_SECTION_DEFINITIONS) {
      assert.equal(planSectionTitle(section.id), section.title);
    }
    assert.equal(planSectionTitle('vision'), 'Vizyon ve Problem');
    assert.equal(planSectionTitle('scope'), 'Kapsam');
  });

  it('tanımsız kimlik BİLİNÇLİ olarak ham adıyla kalır', () => {
    // Burada A2'deki gibi fırlatılmaz ve bu bir eksiklik değil. Bu listelerin
    // içeriği yalnız kodun ürettiği kimliklerden gelmiyor: senaryo formu
    // kullanıcının yazdığı kimlikleri, eski belgeler de artık tanımlı olmayan
    // kimlikleri (ör. `idea-coach-service` içindeki `privacy`) taşıyabilir.
    // Fırlatmak, kullanıcının kendi yazdığı satır yüzünden ekranı düşürürdü.
    assert.equal(planSectionTitle('privacy'), 'privacy');
    assert.equal(planSectionTitle(''), '');
  });

  it('liste çözümleyicisi sırayı korur', () => {
    assert.deepEqual(
      planSectionTitles(['scope', 'requirements', 'architecture']),
      ['Kapsam', 'Gereksinimler', 'Mimari']
    );
  });
});

describe('Bölüm kimliği basan yüzeyler', () => {
  it('iki gösterim yeri ORTAK çözümleyiciyi kullanır, ham kimlik basmaz', () => {
    for (const path of [
      'src/react/components/IdeaOutcomeBar.tsx',
      'src/react/components/PlanAlignmentNotice.tsx'
    ]) {
      const source = read(path);
      assert.ok(source.includes("import { planSectionTitles } from '../../v4/project-document.js';"), path);
      assert.ok(source.includes('planSectionTitles(') , path);
      assert.ok(!source.includes('affectedSections.join('), `${path}: ham kimlik basılmamalı`);
    }
  });

  /**
   * ÜÇÜNCÜ YÜZEY BİLEREK DEĞİŞMEDİ. `PlanningScenarioPanel` bir GÖSTERİM
   * değil, bir GİRDİ alanıdır: kullanıcının yazdığı metin virgülden bölünüp
   * doğrudan `affectedSectionIds` olarak SAKLANIR ve aşağı akışta
   * (`regenerate-affected-sections`, `applySection`) kimlik olarak eşleşir.
   * Alanı Türkçe başlığa çevirmek, saklanan değeri de başlığa çevirir ve o
   * eşleşmeyi kırardı. Yarım değiştirmek yerine ham kimlikte bırakıldı.
   */
  it('senaryo formu ham kimlik ile gidip ham kimlik ile döner', () => {
    const source = read('src/react/components/PlanningScenarioPanel.tsx');
    assert.ok(source.includes("useState('scope, requirements, architecture')"));
    assert.ok(source.includes("affectedSectionIds: sections.split(',')"));
    assert.ok(!source.includes('planSectionTitles('), 'girdi alanı başlığa çevrilmemeli');
  });
});
