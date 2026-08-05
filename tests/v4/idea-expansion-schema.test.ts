import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ideaExpansionSchema,
  partitionExpansionCards,
  MINIMUM_EXPANSION_CARDS
} from '../../src/v4/ai/schemas/schemas.js';

const card = (title: string, overrides: Record<string, unknown> = {}) => ({
  id: `card-${title}`,
  title,
  description: `${title} için bu projeye özel açıklama.`,
  kind: 'feature',
  effort: 'low',
  impact: 'high',
  mvpHint: 'mvp-adayı',
  ...overrides
});

describe('ideaExpansionSchema', () => {
  it('geçerli kart listesini kabul eder', () => {
    const parsed = ideaExpansionSchema.parse({ cards: [card('A'), card('B'), card('C')] });
    assert.equal(parsed.cards.length, 3);
  });

  it('bozuk kartı atar, geçerlileri korur', () => {
    const parsed = ideaExpansionSchema.parse({
      cards: [card('A'), card('B'), card('C'), card('Bozuk', { effort: 'imkansiz' })]
    });
    assert.deepEqual(parsed.cards.map(item => item.title), ['A', 'B', 'C']);
  });

  it('kurtarılan kartı değiştirmez', () => {
    const saglam = card('Sağlam', { kind: 'risk', impact: 'medium', mvpHint: 'sonraya' });
    const parsed = ideaExpansionSchema.parse({
      cards: [saglam, card('B'), card('C'), card('Bozuk', { kind: 'yok' })]
    });
    assert.deepEqual(parsed.cards[0], saglam);
  });

  it('geçerli kart sayısı alt sınırın altına düşerse reddeder', () => {
    assert.throws(() => ideaExpansionSchema.parse({
      cards: [card('A'), card('B'), card('Bozuk', { mvpHint: 'belki' })]
    }));
  });

  it('10 karttan fazlasını reddeder', () => {
    const cards = Array.from({ length: 11 }, (_, index) => card(`K${index}`));
    assert.throws(() => ideaExpansionSchema.parse({ cards }));
  });

  it('partitionExpansionCards geçerli ve geçersizi ayırır', () => {
    const { usable, dropped } = partitionExpansionCards([card('A'), card('Bozuk', { impact: 'devasa' })]);
    assert.equal(usable.length, 1);
    assert.equal(dropped.length, 1);
  });

  it('alt sınır 3 olarak dışa açılır', () => {
    assert.equal(MINIMUM_EXPANSION_CARDS, 3);
  });
});
