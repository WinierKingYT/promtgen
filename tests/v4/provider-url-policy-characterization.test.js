// Karakterizasyon testleri: dönüşümden (JS -> TS) ÖNCE mevcut davranışı sabitler.
// STEP 1 denetiminde bulunan, kabul/red kararı veren ama testsiz kalan dallar için yazıldı:
//   - bozuk URL girdisi (catch dalı)
//   - fragment/hash içeren Ollama adresi
//   - Ollama için değer verilmediğinde varsayılan loopback adrese düşme
//   - openai/nvidia/ollama dışındaki providerId'ler için sabit endpoint döndürmeme (boş dize)
//   - tanınmayan providerId'nin normalizeProviderSettings içinde güvenli şekilde 'offline'a düşmesi
// NOT: bu dosya bir zamanlar `getFixedProviderEndpoint`i de sabitliyordu.
// Dönüşüm bittiği ve o export'un üretimde hiçbir çağıranı olmadığı için hem
// fonksiyon hem testleri kaldırıldı (bkz. src/v4/provider-url-policy.ts).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeProviderBaseUrl,
  normalizeProviderSettings
} from '../../src/v4/provider-url-policy.js';

describe('normalizeProviderBaseUrl — bozuk URL girdisi', () => {
  it('ayrıştırılamayan bir dize verildiğinde "geçerli bir URL olmalı" ile reddeder', () => {
    assert.throws(
      () => normalizeProviderBaseUrl('ollama', 'http://'),
      /Ollama API adresi geçerli bir URL olmalı\./
    );
  });
});

describe('normalizeProviderBaseUrl — fragment/hash reddi', () => {
  it('loopback adresine eklenmiş bir fragment kimlik/sorgu ile aynı şekilde reddedilir', () => {
    assert.throws(
      () => normalizeProviderBaseUrl('ollama', 'http://127.0.0.1:11434#frag'),
      /Ollama adresi kimlik bilgisi, sorgu veya fragment içeremez\./
    );
  });
});

describe('normalizeProviderBaseUrl — Ollama varsayılan loopback adresi', () => {
  it('değer verilmediğinde sabit 127.0.0.1:11434 loopback adresine düşer', () => {
    assert.equal(normalizeProviderBaseUrl('ollama'), 'http://127.0.0.1:11434');
  });

  it('boş dize verildiğinde de aynı varsayılana düşer', () => {
    assert.equal(normalizeProviderBaseUrl('ollama', ''), 'http://127.0.0.1:11434');
  });
});

describe('normalizeProviderBaseUrl — sabit endpoint sahibi olmayan sağlayıcılar', () => {
  it('gemini için boş dize döner (Gemini bu politika tarafından pinlenmez)', () => {
    assert.equal(normalizeProviderBaseUrl('gemini', 'https://attacker.example'), '');
  });

  it('offline için boş dize döner', () => {
    assert.equal(normalizeProviderBaseUrl('offline', 'https://attacker.example'), '');
  });

  it('tanınmayan bir providerId için de boş dize döner', () => {
    assert.equal(normalizeProviderBaseUrl('made-up-provider', 'https://attacker.example'), '');
  });
});

describe('normalizeProviderSettings — tanınmayan providerId güvenli şekilde offline’a düşer', () => {
  it('PROVIDER_IDS içinde olmayan bir providerId "offline" olarak normalize edilir ve baseUrl boşalır', () => {
    const normalized = normalizeProviderSettings({ providerId: 'attacker-controlled', model: 'safe-model', baseUrl: 'https://attacker.example' });
    assert.equal(normalized.providerId, 'offline');
    assert.equal(normalized.baseUrl, '');
  });
});
