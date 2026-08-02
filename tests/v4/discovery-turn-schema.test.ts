import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { discoverySchema } from '../../src/v4/ai/schemas/schemas.js';

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    reply: 'Anladım, devam edelim.',
    analysisNote: 'Kullanıcının cevabı değerlendirildi.',
    summary: 'Özet',
    options: [
      { kind: 'feature', title: 'A', description: 'Açıklama', pros: [], cons: [], effort: 'low', impact: 'low', affectedSections: ['scope'], recommended: true },
      { kind: 'feature', title: 'B', description: 'Açıklama', pros: [], cons: [], effort: 'low', impact: 'low', affectedSections: ['scope'], recommended: false },
      { kind: 'feature', title: 'C', description: 'Açıklama', pros: [], cons: [], effort: 'low', impact: 'low', affectedSections: ['scope'], recommended: false }
    ],
    openQuestions: [],
    uncertainty: [],
    nextQuestionText: 'Hedef kullanıcı kim?',
    optionalPaths: [],
    ...overrides
  };
}

describe('discoverySchema — birleşik tur alanları', () => {
  it('uncertainty, nextQuestionText ve optionalPaths alanlarını kabul eder', () => {
    const parsed = discoverySchema.parse(validPayload({
      uncertainty: ['Hedef kullanıcı hâlâ belirsiz'],
      optionalPaths: [{ title: 'Kullanıcıyı daralt', reason: 'Grup çok geniş', prompt: 'Kullanıcı gruplarını karşılaştır.' }]
    }));
    assert.deepEqual(parsed.uncertainty, ['Hedef kullanıcı hâlâ belirsiz']);
    assert.equal(parsed.optionalPaths[0].title, 'Kullanıcıyı daralt');
    assert.equal(parsed.nextQuestionText, 'Hedef kullanıcı kim?');
  });

  it('uncertainty ve optionalPaths eksikse varsayılan boş dizi kullanır', () => {
    const payload: Record<string, unknown> = validPayload();
    delete payload.uncertainty;
    delete payload.optionalPaths;
    const parsed = discoverySchema.parse(payload);
    assert.deepEqual(parsed.uncertainty, []);
    assert.deepEqual(parsed.optionalPaths, []);
  });

  it('nextQuestionText zorunludur', () => {
    const payload: Record<string, unknown> = validPayload();
    delete payload.nextQuestionText;
    assert.throws(() => discoverySchema.parse(payload));
  });

  it('uncertainty en fazla 2 öğe kabul eder', () => {
    const payload = validPayload({ uncertainty: ['a', 'b', 'c'] });
    assert.throws(() => discoverySchema.parse(payload));
  });

  it('optionalPaths en fazla 3 öğe kabul eder', () => {
    const payload = validPayload({
      optionalPaths: Array.from({ length: 4 }, (_, index) => ({ title: `T${index}`, reason: 'R', prompt: 'P' }))
    });
    assert.throws(() => discoverySchema.parse(payload));
  });
});
