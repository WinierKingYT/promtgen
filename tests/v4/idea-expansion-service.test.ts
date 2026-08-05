import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import {
  generateExpansionCards,
  clearExpansionCache
} from '../../src/v4/application/idea-expansion-service.js';
import type { ProjectDocumentV5 } from '../../src/v4/contracts.js';

const project = () => analyzeIdea('Şehir içi bisiklet rotası öneren bir mobil uygulama') as ProjectDocumentV5;

const card = (title: string) => ({
  id: `card-${title}`, title, description: `${title} açıklaması`,
  kind: 'feature', effort: 'low', impact: 'high', mvpHint: 'mvp-adayı'
});

/** Şemadan geçen bir yanıt döndüren sahte sağlayıcı. */
const okProvider = (calls: { count: number }) => ({
  model: 'mock',
  async structured({ schema }: { schema: { parse(value: unknown): unknown } }) {
    calls.count += 1;
    return schema.parse({ cards: [card('A'), card('B'), card('C'), card('D')] });
  }
});

const failingProvider = { model: 'mock', async structured() { throw new Error('SCHEMA_VALIDATION_FAILED'); } };

const aiSettings = { providerId: 'ollama', model: 'qwen2.5:7b', baseUrl: 'http://127.0.0.1:11434', useAiWhenAvailable: true } as any;
const offlineSettings = { providerId: 'offline', model: 'promtgen-local', baseUrl: '', useAiWhenAvailable: true } as any;

describe('generateExpansionCards', () => {
  beforeEach(() => clearExpansionCache());

  it('AI başarılıysa kartları ve local-ai modunu döner', async () => {
    const calls = { count: 0 };
    const result = await generateExpansionCards(project(), 'trust', {
      settings: aiSettings, provider: okProvider(calls)
    });
    assert.equal(result.mode, 'local-ai');
    assert.equal(result.cards.length, 4);
    assert.equal(result.categoryId, 'trust');
  });

  it('sağlayıcı yokken seedTitles ile fallback üretir', async () => {
    const result = await generateExpansionCards(project(), 'trust', { settings: offlineSettings });
    assert.equal(result.mode, 'fallback');
    assert.ok(result.cards.length >= 2, 'başlangıç başlıkları kart olarak sunulmalı');
    assert.ok(result.fallbackReason, 'fallback nedeni bildirilmeli');
  });

  it('AI hata verirse fallback üretir, hata yutulmaz', async () => {
    const result = await generateExpansionCards(project(), 'trust', {
      settings: aiSettings, provider: failingProvider
    });
    assert.equal(result.mode, 'fallback');
    assert.match(result.fallbackReason || '', /SCHEMA_VALIDATION_FAILED/);
  });

  it('bilinmeyen kategori için hata verir', async () => {
    await assert.rejects(
      () => generateExpansionCards(project(), 'olmayan-kategori', { settings: offlineSettings }),
      /kategori/i
    );
  });

  it('aynı kategori ve revision için ikinci çağrıda AI çağrılmaz', async () => {
    const calls = { count: 0 };
    const provider = okProvider(calls);
    const target = project();
    await generateExpansionCards(target, 'trust', { settings: aiSettings, provider });
    await generateExpansionCards(target, 'trust', { settings: aiSettings, provider });
    assert.equal(calls.count, 1, 'önbellek ikinci AI çağrısını engellemeli');
  });

  it('refresh: true önbelleği atlar', async () => {
    const calls = { count: 0 };
    const provider = okProvider(calls);
    const target = project();
    await generateExpansionCards(target, 'trust', { settings: aiSettings, provider });
    await generateExpansionCards(target, 'trust', { settings: aiSettings, provider, refresh: true });
    assert.equal(calls.count, 2);
  });
});
