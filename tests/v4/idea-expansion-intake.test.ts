import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import { addExpansionCardAsSuggestion } from '../../src/v4/application/idea-expansion-intake.js';
import type { ProjectDocumentV5 } from '../../src/v4/contracts.js';

const project = () => analyzeIdea('Şehir içi bisiklet rotası öneren bir mobil uygulama') as ProjectDocumentV5;

const card = {
  id: 'card-1',
  title: 'Verinin nerede durduğunu açıkça göster',
  description: 'Kullanıcı ilk açılışta verinin cihazda kaldığını görsün.',
  kind: 'feature',
  effort: 'low',
  impact: 'high',
  mvpHint: 'mvp-adayı'
};

const openBundle = (next: ProjectDocumentV5) =>
  next.proposalStore.bundles.find(bundle => bundle.status === 'open');

describe('addExpansionCardAsSuggestion', () => {
  it('kartı bekleyen öneri olarak açık pakete ekler', () => {
    const next = addExpansionCardAsSuggestion(project(), card, 'Güven ve gizlilik');
    const bundle = openBundle(next);
    assert.ok(bundle, 'açık paket oluşmalı');
    const item = bundle.items.find(entry => entry.title === card.title);
    assert.ok(item, 'kart öneri olarak eklenmeli');
    assert.equal(item.status, 'pending');
    assert.equal(item.kind, 'feature');
    assert.equal(item.effort, 'low');
    assert.equal(item.impact, 'high');
  });

  it('canonical planı değiştirmez', () => {
    const before = project();
    const next = addExpansionCardAsSuggestion(before, card, 'Güven ve gizlilik');
    assert.equal(next.canonicalRevision, before.canonicalRevision);
    assert.equal(next.requirements.length, before.requirements.length);
    assert.equal(next.decisions.length, before.decisions.length);
  });

  it('aynı kartı iki kez eklemez', () => {
    const once = addExpansionCardAsSuggestion(project(), card, 'Güven ve gizlilik');
    const twice = addExpansionCardAsSuggestion(once, card, 'Güven ve gizlilik');
    const items = openBundle(twice).items.filter(entry => entry.title === card.title);
    assert.equal(items.length, 1);
  });

  it('fikir defterine de kayıt düşer', () => {
    const next = addExpansionCardAsSuggestion(project(), card, 'Güven ve gizlilik');
    const records = next.ideaDiscussion?.records || [];
    assert.ok(records.some(record => record.text === card.title), 'kayıt defterinde iz kalmalı');
  });
});
