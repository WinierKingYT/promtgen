import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listOllamaModels, missingModelWarning } from '../../src/v4/ai/ollama-models.js';

const respond = (body: unknown, ok = true, status = 200) =>
  (async () => ({ ok, status, json: async () => body })) as unknown as typeof fetch;

const SOHBET = {
  name: 'qwen2.5:7b',
  capabilities: ['completion', 'tools'],
  details: { parameter_size: '7.6B', context_length: 32768 }
};
const GOMME = { name: 'nomic-embed-text:latest', capabilities: ['embedding'], details: {} };

describe('Ollama model listesi', () => {
  it('kurulu sohbet modelleri donulur', async () => {
    const result = await listOllamaModels('http://127.0.0.1:11434', {
      fetchImpl: respond({ models: [SOHBET] })
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.ok && result.models, [
      { name: 'qwen2.5:7b', parameterSize: '7.6B', contextLength: 32768 }
    ]);
  });

  it('GOMME modelleri elenir - sohbet edemezler', async () => {
    // Listede görünmeleri kullanıcıyı çalışmayacak bir seçime yönlendirir.
    const result = await listOllamaModels('http://127.0.0.1:11434', {
      fetchImpl: respond({ models: [SOHBET, GOMME] })
    });

    assert.deepEqual(result.ok && result.models.map(m => m.name), ['qwen2.5:7b']);
  });

  it('capabilities alani olmayan ESKI surumde model elenmez', async () => {
    // Bilgi yokluğunu dışlama gerekçesi saymak eski kurulumları cezalandırırdı.
    const result = await listOllamaModels('http://127.0.0.1:11434', {
      fetchImpl: respond({ models: [{ name: 'llama3.2', details: {} }] })
    });

    assert.deepEqual(result.ok && result.models.map(m => m.name), ['llama3.2']);
  });

  it('sondaki egik cizgi adresi bozmaz', async () => {
    let istenen = '';
    const result = await listOllamaModels('http://127.0.0.1:11434/', {
      fetchImpl: (async (url: string) => {
        istenen = url;
        return { ok: true, status: 200, json: async () => ({ models: [] }) };
      }) as unknown as typeof fetch
    });

    assert.equal(result.ok, true);
    assert.equal(istenen, 'http://127.0.0.1:11434/api/tags');
  });

  it('ulasilamadiginda NEDEN doner, sessiz bos liste degil', async () => {
    const result = await listOllamaModels('http://127.0.0.1:11434', {
      fetchImpl: (async () => { throw new Error('fetch failed'); }) as unknown as typeof fetch
    });

    assert.equal(result.ok, false);
    assert.match(result.ok ? '' : result.reason, /ulaşılamadı.*fetch failed/is);
  });

  it('hatali durum kodu bildirilir', async () => {
    const result = await listOllamaModels('http://x', { fetchImpl: respond({}, false, 500) });

    assert.match(result.ok ? '' : result.reason, /500/);
  });

  it('bozuk yanit sessizce bos liste sayilmaz', async () => {
    const result = await listOllamaModels('http://x', { fetchImpl: respond({ hatali: true }) });

    assert.equal(result.ok, false);
  });

  it('bos adres reddedilir', async () => {
    assert.equal((await listOllamaModels('  ')).ok, false);
  });
});

describe('Kurulu olmayan model uyarısı', () => {
  const kurulu = [{ name: 'qwen2.5:7b', parameterSize: '7.6B', contextLength: 32768 }];

  it('kurulu olmayan model icin kurulu olanlari sayar', () => {
    // Elle kullanırken tam bunu yaşadım: varsayılan llama3.2 iken kurulu olan
    // yalnız qwen2.5:7b'ydi ve hiçbir tur çalışmıyordu.
    const uyari = missingModelWarning('llama3.2', kurulu);

    assert.match(uyari || '', /llama3\.2.*kurulu değil.*qwen2\.5:7b/s);
  });

  it('kurulu model icin uyari yok', () => {
    assert.equal(missingModelWarning('qwen2.5:7b', kurulu), null);
  });

  it('liste alinamadiysa uyari uydurulmaz', () => {
    // Liste boşken "kurulu değil" demek, bilmediğimiz şeyi iddia etmek olurdu.
    assert.equal(missingModelWarning('llama3.2', []), null);
  });
});
