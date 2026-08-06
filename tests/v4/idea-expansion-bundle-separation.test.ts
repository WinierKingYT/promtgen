import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeIdea, applyApprovedChanges, updateSuggestionStatus } from '../../src/v4/planning-engine.js';
import { addExpansionCardAsSuggestion } from '../../src/v4/application/idea-expansion-intake.js';
import {
  isExpansionBundle,
  selectExpansionBundle,
  selectTurnBundle
} from '../../src/v4/application/proposal-bundle-selectors.js';
import { buildIdeaCoachState } from '../../src/v4/application/idea-coach-service.js';
import type { ExpansionCard } from '../../src/v4/application/idea-expansion-service.js';
import type { ProjectDocumentV5 } from '../../src/v4/contracts.js';

const project = () => analyzeIdea('Şehir içi bisiklet rotası öneren bir mobil uygulama') as ProjectDocumentV5;

const card = (overrides: Partial<ExpansionCard> = {}): ExpansionCard => ({
  id: 'card-1',
  title: 'Verinin nerede durduğunu açıkça göster',
  description: 'Kullanıcı ilk açılışta verinin cihazda kaldığını görsün.',
  kind: 'feature',
  effort: 'low',
  impact: 'high',
  mvpHint: 'mvp-adayı',
  origin: 'ai',
  ...overrides
});

describe('keşif kartları turun öneri paketinden ayrılır', () => {
  it('kart, konuşma turunun paketine değil kendi paketine düşer', () => {
    const before = project();
    const turnBefore = selectTurnBundle(before);
    assert.ok(turnBefore, 'analyzeIdea zaten bir tur paketi açmış olmalı');

    const { project: next } = addExpansionCardAsSuggestion(before, card(), 'Güven ve gizlilik');

    const turnAfter = selectTurnBundle(next);
    assert.equal(turnAfter?.id, turnBefore.id, 'tur paketi değişmemeli');
    assert.equal(
      turnAfter?.items.length,
      turnBefore.items.length,
      'kart konuşma turunun seçenek listesine karışmamalı'
    );

    const expansion = selectExpansionBundle(next);
    assert.ok(expansion, 'kart için ayrı bir keşif paketi açılmalı');
    assert.notEqual(expansion.id, turnBefore.id);
    assert.ok(isExpansionBundle(expansion));
    assert.equal(expansion.items.length, 1);
    assert.equal(expansion.items[0].status, 'pending');
  });

  it('tur paketi uygulanınca keşif kartı sessizce ertelenmez', () => {
    const withCard = addExpansionCardAsSuggestion(project(), card(), 'Güven ve gizlilik').project;
    const turn = selectTurnBundle(withCard)!;

    // Konuşma turunu kapatan mevcut akış: bekleyenler ertelenir, paket uygulanır.
    const closing = structuredClone(withCard);
    const closingTurn = closing.proposalStore.bundles.find(bundle => bundle.id === turn.id)!;
    closingTurn.items.forEach(item => { if (item.status === 'pending') item.status = 'deferred'; });
    const applied = applyApprovedChanges(closing, turn.id);

    const expansion = selectExpansionBundle(applied);
    assert.ok(expansion, 'keşif paketi tur kapanınca yok olmamalı');
    assert.equal(
      expansion.items[0].status,
      'pending',
      'kullanıcının kendi eklediği kart, başka bir paketin kapanmasıyla ertelenmemeli'
    );
    assert.equal(expansion.status, 'open');
  });

  it('koçun karar sayıları turu anlatır, keşif kartlarını saymaz', () => {
    const before = project();
    const baseline = buildIdeaCoachState(before);
    const withCard = addExpansionCardAsSuggestion(before, card(), 'Güven ve gizlilik').project;
    const after = buildIdeaCoachState(withCard);

    assert.equal(after.criticalDecisionCount, baseline.criticalDecisionCount);
    assert.equal(after.deferrableDecisionCount, baseline.deferrableDecisionCount);
  });

  it('aynı kart ikinci kez eklenmez ve neden bildirilir', () => {
    const once = addExpansionCardAsSuggestion(project(), card(), 'Güven ve gizlilik');
    const twice = addExpansionCardAsSuggestion(once.project, card(), 'Güven ve gizlilik');
    assert.equal(twice.added, false);
    assert.equal(twice.project, once.project);
    assert.equal(selectExpansionBundle(twice.project)!.items.length, 1);
  });

  it('ikinci kart yeni paket açmaz, açık keşif paketine katılır', () => {
    const once = addExpansionCardAsSuggestion(project(), card(), 'Güven ve gizlilik');
    const twice = addExpansionCardAsSuggestion(once.project, card({ id: 'card-2', title: 'İkinci kart' }), 'Ölçüm');
    const expansionBundles = twice.project.proposalStore.bundles.filter(isExpansionBundle);
    assert.equal(expansionBundles.length, 1);
    assert.equal(expansionBundles[0].items.length, 2);
  });

  it('keşif paketi kapandıktan sonra gelen kart yeni bir pakete açılır', () => {
    const once = addExpansionCardAsSuggestion(project(), card(), 'Güven ve gizlilik');
    const bundle = selectExpansionBundle(once.project)!;
    const decided = updateSuggestionStatus(once.project, bundle.id, bundle.items[0].id, 'accepted');
    const applied = applyApprovedChanges(decided, bundle.id) as ProjectDocumentV5;
    assert.equal(applied.proposalStore.bundles.find(item => item.id === bundle.id)!.status, 'resolved');

    const again = addExpansionCardAsSuggestion(applied, card({ id: 'card-3', title: 'Üçüncü kart' }), 'Ölçüm');
    const open = selectExpansionBundle(again.project);
    assert.ok(open, 'kapanmış paketten sonra yeni bir keşif paketi açılmalı');
    assert.notEqual(open.id, bundle.id);
    assert.equal(open.status, 'open');
    assert.equal(open.items.length, 1);
  });

  it('kabul edilen keşif kartı mevcut kapıdan geçerek plana işlenir', () => {
    const once = addExpansionCardAsSuggestion(project(), card(), 'Güven ve gizlilik');
    const bundle = selectExpansionBundle(once.project)!;
    const decided = updateSuggestionStatus(once.project, bundle.id, bundle.items[0].id, 'accepted');
    const applied = applyApprovedChanges(decided, bundle.id) as ProjectDocumentV5;

    assert.equal(
      applied.canonicalRevision,
      once.project.canonicalRevision + 1,
      'kabul edilen kart canonical bir değişikliktir'
    );
    assert.ok(
      applied.sections.scope.items.some(item => item.includes('cihazda kaldığını')),
      'kabul edilen kartın içeriği ilgili bölüme işlenmeli'
    );
  });

  it('tur paketi seçicisi keşif paketini asla tur sanmaz', () => {
    const once = addExpansionCardAsSuggestion(project(), card(), 'Güven ve gizlilik');
    const turn = selectTurnBundle(once.project)!;
    // Tur paketi kapansa bile, keşif paketi turun yerine geçmemeli.
    const closed = structuredClone(once.project);
    const closedTurn = closed.proposalStore.bundles.find(item => item.id === turn.id)!;
    closedTurn.status = 'resolved';
    assert.equal(selectTurnBundle(closed)!.id, turn.id);
    assert.ok(!isExpansionBundle(selectTurnBundle(closed)!));
  });
});
