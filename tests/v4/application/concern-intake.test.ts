import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { concernsFromBundle } from '../../../src/v4/application/concern-intake.js';
import { normalizeConcern } from '../../../src/v4/application/concerns.js';
import { createProjectDocument } from '../../../src/v4/project-document.js';
import type { DiscoverySuggestionBundle } from '../../../src/v4/application/discovery-generation-service.js';
import type { ProjectDocumentV5, SuggestionItem } from '../../../src/v4/contracts.js';

function item(overrides: Partial<SuggestionItem> = {}): SuggestionItem {
  return {
    id: 's1', fingerprint: 'f1', kind: 'architecture', title: 'Sahiplik',
    description: 'At kalıcı mı, ulaşım aracı mı', pros: [], cons: ['Kayıt gerektirir'],
    effort: 'medium', impact: 'high', recommended: true, recommendationReason: '',
    affectedSections: ['scope'], dependencies: [], status: 'pending', ...overrides
  };
}

function bundle(overrides: Partial<DiscoverySuggestionBundle> = {}): DiscoverySuggestionBundle {
  return {
    id: 'b1', title: 'Tur 1', phase: 'DISCOVERY', status: 'open', createdAt: '2026-08-16T00:00:00.000Z',
    items: [item()], openQuestions: [], ...overrides
  };
}

const project = () => createProjectDocument({ idea: 'Unity’de at sistemi' }) as ProjectDocumentV5;

describe('Keşif paketi → konular', () => {
  it('paketteki oneri konuya donusur - motor beslenir', () => {
    // Bu bağ olmadan `ideaDesign.concerns` her projede boş kalır ve bütün
    // aşama modeli ölü kod olur.
    const next = concernsFromBundle(project(), bundle());

    assert.equal(next.ideaDesign.concerns.length, 1);
    assert.equal(next.ideaDesign.concerns[0].title, 'Sahiplik');
    assert.equal(next.ideaDesign.concerns[0].importance, 'critical');
  });

  it('REDDEDILEN oneri konuya cevrilmez', () => {
    // Kullanıcının "istemiyorum" dediği şeyi karar bekleyen bir engel yapmak,
    // reddedilen öneri hafızasıyla doğrudan çelişirdi.
    const next = concernsFromBundle(project(), bundle({ items: [item({ status: 'rejected' })] }));

    assert.deepEqual(next.ideaDesign.concerns, []);
  });

  it('ertelenen oneri de konuya cevrilmez', () => {
    const next = concernsFromBundle(project(), bundle({ items: [item({ status: 'deferred' })] }));

    assert.deepEqual(next.ideaDesign.concerns, []);
  });

  it('kullanicinin DUZENLEDIGI metin tasinir', () => {
    const next = concernsFromBundle(project(), bundle({
      items: [item({ status: 'edited', editedDescription: 'Kullanıcının kendi ifadesi' })]
    }));

    assert.equal(next.ideaDesign.concerns[0].description, 'Kullanıcının kendi ifadesi');
  });

  it('acik sorular da konu olur', () => {
    const next = concernsFromBundle(project(), bundle({ items: [], openQuestions: ['Kaç oyuncu?'] }));

    assert.equal(next.ideaDesign.concerns.length, 1);
    assert.deepEqual(next.ideaDesign.concerns[0].questions, ['Kaç oyuncu?']);
  });

  it('belirsizlik bildirilen konu daha yuksek oncelik alir', () => {
    const withUncertainty = concernsFromBundle(project(), bundle({ uncertainty: ['Sahiplik'] }));
    const without = concernsFromBundle(project(), bundle());

    assert.ok(withUncertainty.ideaDesign.concerns[0].uncertainty > without.ideaDesign.concerns[0].uncertainty);
  });

  it('KARARA BAGLANMIS konu sonraki turda dirilmez', () => {
    const document = project();
    document.ideaDesign.concerns = [normalizeConcern({
      id: 'ic-sahiplik', title: 'Sahiplik', status: 'decided', uncertainty: 0.1, downstreamImpact: 0.1
    })];

    const next = concernsFromBundle(document, bundle());

    assert.equal(next.ideaDesign.concerns.length, 1);
    assert.equal(next.ideaDesign.concerns[0].status, 'decided');
  });

  it('yeni konu eklenir, mevcutlar kaybolmaz', () => {
    const document = project();
    document.ideaDesign.concerns = [normalizeConcern({ id: 'ic-eski', title: 'Beslenme' })];

    const next = concernsFromBundle(document, bundle());

    assert.deepEqual(next.ideaDesign.concerns.map(concern => concern.title).sort(), ['Beslenme', 'Sahiplik']);
  });

  it('bos paket belgeyi DEGISTIRMEZ', () => {
    const document = project();

    assert.equal(concernsFromBundle(document, bundle({ items: [] })), document);
  });

  it('girdi belgeyi yerinde degistirmez', () => {
    const document = project();

    concernsFromBundle(document, bundle());

    assert.deepEqual(document.ideaDesign.concerns, []);
  });
});
