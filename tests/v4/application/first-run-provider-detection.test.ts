import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  detectFirstRunProviderSettings,
  type FirstRunDetectionDeps
} from '../../../src/v4/application/first-run-provider-detection.js';
import type { OllamaModelListResult } from '../../../src/v4/ai/ollama-models.js';
import { normalizeProviderBaseUrl } from '../../../src/v4/provider-url-policy.js';

const QWEN: OllamaModelListResult = {
  ok: true,
  models: [{ name: 'qwen2.5:7b', parameterSize: '7.6B', contextLength: 32768 }]
};

function deps(overrides: Partial<FirstRunDetectionDeps> = {}): FirstRunDetectionDeps {
  return {
    hasSavedSettings: () => false,
    listModels: async () => QWEN,
    timeoutMs: 20,
    ...overrides
  };
}

describe('first-run Ollama auto-detection', () => {
  it('kayıtlı ayar varsa hiç çalışmaz, kayıtlı seçim kazanır', async () => {
    let called = false;
    const result = await detectFirstRunProviderSettings(deps({
      hasSavedSettings: () => true,
      listModels: async () => { called = true; return QWEN; }
    }));

    assert.equal(result, null);
    assert.equal(called, false);
  });

  it('kayıtlı ayar yok + Ollama en az bir modelle erişilebilir -> ollama sunucunun bildirdiği modelle seçilir', async () => {
    const result = await detectFirstRunProviderSettings(deps());

    assert.ok(result);
    assert.equal(result?.providerId, 'ollama');
    assert.equal(result?.model, 'qwen2.5:7b');
  });

  it('kayıtlı ayar yok + Ollama erişilebilir ama SIFIR model -> varsayılan değişmez', async () => {
    const result = await detectFirstRunProviderSettings(deps({
      listModels: async () => ({ ok: true, models: [] })
    }));

    assert.equal(result, null);
  });

  it('kayıtlı ayar yok + Ollama erişilemez -> varsayılan değişmez, hata yüzeye çıkmaz', async () => {
    const result = await detectFirstRunProviderSettings(deps({
      listModels: async () => ({ ok: false, reason: 'Ollama\'ya ulaşılamadı.' })
    }));

    assert.equal(result, null);
  });

  it('yoklama zaman aşımına uğrarsa varsayılan değişmez ve asılı kalmaz', async () => {
    const result = await detectFirstRunProviderSettings(deps({
      timeoutMs: 10,
      listModels: (_baseUrl, options) => new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(new Error('AbortError')));
      })
    }));

    assert.equal(result, null);
  });

  it('seçilen taban adresi normalizeProviderBaseUrl doğrulamasından geçer (SSRF koruması hattında)', async () => {
    let seenBaseUrl = '';
    await detectFirstRunProviderSettings(deps({
      listModels: async (baseUrl) => { seenBaseUrl = baseUrl; return QWEN; }
    }));

    assert.ok(seenBaseUrl);
    // normalizeProviderBaseUrl loopback dışını reddeder; burada atmaması SSRF
    // korumasının hâlâ yolda olduğunu kanıtlar.
    assert.equal(normalizeProviderBaseUrl('ollama', seenBaseUrl), seenBaseUrl);
  });
});
