import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ideaFoundationSchema } from '../../src/v4/ai/schemas/schemas.js';

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    summary: { source: 'idea', text: 'Unity tabanlı çok oyunculu at sistemi.' },
    problemStatement: { source: 'assumption', text: 'Oyuncular gerçekçi bir at binme deneyimi istiyor.' },
    targetUser: { source: 'idea', text: 'Unity geliştiricisi' },
    currentAlternative: { source: 'unknown', reason: 'Fikirde bugünkü çözüm yöntemi belirtilmemiş.' },
    desiredOutcome: { source: 'assumption', text: 'Oyuncular senkronize at sürebilir.' },
    mvpTarget: { source: 'idea', text: 'Tek sahnede iki oyunculu prototip.' },
    ...overrides
  };
}

describe('ideaFoundationSchema', () => {
  it('idea kaynaklı bir alanı text ile kabul eder', () => {
    const parsed = ideaFoundationSchema.parse(validPayload());
    assert.equal(parsed.summary.source, 'idea');
    assert.equal('text' in parsed.summary && parsed.summary.text, 'Unity tabanlı çok oyunculu at sistemi.');
  });

  it('assumption kaynaklı bir alanı text ile kabul eder', () => {
    const parsed = ideaFoundationSchema.parse(validPayload());
    assert.equal(parsed.problemStatement.source, 'assumption');
  });

  it('unknown kaynaklı bir alanı text OLMADAN, yalnız reason ile kabul eder', () => {
    const parsed = ideaFoundationSchema.parse(validPayload());
    assert.equal(parsed.currentAlternative.source, 'unknown');
    assert.equal('text' in parsed.currentAlternative, false, 'unknown alanda text ALANI hiç OLMAMALI');
    assert.equal('reason' in parsed.currentAlternative && parsed.currentAlternative.reason, 'Fikirde bugünkü çözüm yöntemi belirtilmemiş.');
  });

  it('unknown alanda fazladan text verilirse reddeder -- strict birlik', () => {
    const payload = validPayload({ currentAlternative: { source: 'unknown', reason: 'gerekçe', text: 'ekstra' } });
    assert.throws(() => ideaFoundationSchema.parse(payload));
  });

  it('idea alanında fazladan reason verilirse reddeder', () => {
    const payload = validPayload({ summary: { source: 'idea', text: 'metin', reason: 'ekstra' } });
    assert.throws(() => ideaFoundationSchema.parse(payload));
  });

  it('boş metinli idea alanını reddeder', () => {
    const payload = validPayload({ summary: { source: 'idea', text: '' } });
    assert.throws(() => ideaFoundationSchema.parse(payload));
  });

  it('bilinmeyen bir source değerini reddeder', () => {
    const payload = validPayload({ summary: { source: 'invented', text: 'x' } });
    assert.throws(() => ideaFoundationSchema.parse(payload));
  });

  it('modelin interpretationConfidence eklemesini reddeder', () => {
    const payload = { ...validPayload(), interpretationConfidence: 90 };
    assert.throws(() => ideaFoundationSchema.parse(payload));
  });

  it('modelin userConfirmed eklemesini reddeder', () => {
    const payload = { ...validPayload(), userConfirmed: true };
    assert.throws(() => ideaFoundationSchema.parse(payload));
  });

  it('modelin confirmedAt eklemesini reddeder', () => {
    const payload = { ...validPayload(), confirmedAt: new Date().toISOString() };
    assert.throws(() => ideaFoundationSchema.parse(payload));
  });

  it('modelin confidenceRationale eklemesini reddeder', () => {
    const payload = { ...validPayload(), confidenceRationale: ['x'] };
    assert.throws(() => ideaFoundationSchema.parse(payload));
  });

  it('targetUser 600 karakter sınırını aşan text reddeder', () => {
    const payload = validPayload({ targetUser: { source: 'idea', text: 'a'.repeat(601) } });
    assert.throws(() => ideaFoundationSchema.parse(payload));
  });

  it('summary 2400 karakter sınırını aşan text reddeder', () => {
    const payload = validPayload({ summary: { source: 'idea', text: 'a'.repeat(2401) } });
    assert.throws(() => ideaFoundationSchema.parse(payload));
  });
});
