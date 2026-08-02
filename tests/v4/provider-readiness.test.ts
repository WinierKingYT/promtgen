import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  evaluateProviderReadiness,
  providerGateOpen,
  providerRecoveryHint,
  type ProviderProbeResult,
  type ProviderReadinessSettings
} from '../../src/v4/application/provider-readiness-service.js';
import { getDefaultProviderSettings } from '../../src/v4/provider-settings.js';

const ok: ProviderProbeResult = { ok: true, errorCode: null, message: 'Bağlantı doğrulandı.' };
const fail = (errorCode: string, message = 'Bağlantı kurulamadı.'): ProviderProbeResult => ({ ok: false, errorCode, message });

/** Hangi ayarla çağrıldığını kaydeden probe; ağ kullanılmaz. */
function recordingProbe(handler: (settings: ProviderReadinessSettings, credential: string) => ProviderProbeResult) {
  const calls: Array<{ settings: ProviderReadinessSettings; credential: string }> = [];
  return {
    calls,
    probe: async (settings: ProviderReadinessSettings, credential: string) => {
      calls.push({ settings, credential });
      return handler(settings, credential);
    }
  };
}

const noCredentials = { credentialFor: async () => '' };

describe('provider readiness gate', () => {
  it('varsayılan ayar yerleşik NVIDIA GLM-5.2 profilini seçer', async () => {
    const defaults = getDefaultProviderSettings();
    assert.equal(defaults.providerId, 'nvidia');
    assert.equal(defaults.model, 'z-ai/glm-5.2');
    assert.equal(defaults.baseUrl, 'https://integrate.api.nvidia.com/v1');

    const { probe } = recordingProbe(() => fail('network'));
    const result = await evaluateProviderReadiness(defaults, { probe, ...noCredentials });

    assert.equal(result.state, 'needs-credential');
    assert.equal(result.providerId, 'nvidia');
    assert.equal(providerGateOpen(result), false);
    assert.match(result.message, /API anahtarı/);
  });

  it('yerelde çalışan Ollama bulunduğunda anahtar istemeden hazır olur', async () => {
    const { probe, calls } = recordingProbe(settings => (settings.providerId === 'ollama' ? ok : fail('network')));
    const result = await evaluateProviderReadiness(
      { ...getDefaultProviderSettings(), providerId: 'offline', useAiWhenAvailable: false },
      { probe, ...noCredentials }
    );

    assert.equal(result.state, 'ready');
    assert.equal(result.providerId, 'ollama');
    assert.equal(result.autoSelected, true);
    assert.equal(providerGateOpen(result), true);
    // Yerel yol için kimlik bilgisi hiç istenmemeli.
    assert.equal(calls.at(-1)?.credential, '');
    assert.match(calls.at(-1)?.settings.baseUrl || '', /127\.0\.0\.1:11434/);
  });

  it('anahtar gerektiren sağlayıcı seçili ama anahtar yoksa kapı açılmaz', async () => {
    const { probe, calls } = recordingProbe(() => ok);
    const result = await evaluateProviderReadiness(
      { providerId: 'nvidia', model: 'z-ai/glm-5.2' },
      { probe, ...noCredentials }
    );

    assert.equal(result.state, 'needs-credential');
    assert.equal(result.errorCode, 'missing-credential');
    assert.equal(providerGateOpen(result), false);
    // Anahtar yokken sağlayıcıya boşuna istek atılmamalı.
    assert.equal(calls.length, 0);
    assert.match(providerRecoveryHint(result), /plan belgesine yazılmaz/);
  });

  it('anahtarı olan NVIDIA doğrulanınca kapı açılır', async () => {
    const { probe, calls } = recordingProbe(() => ok);
    const result = await evaluateProviderReadiness(
      { providerId: 'nvidia', model: 'z-ai/glm-5.2' },
      { probe, credentialFor: async () => 'nvapi-test-key' }
    );

    assert.equal(result.state, 'ready');
    assert.equal(result.providerId, 'nvidia');
    assert.equal(result.autoSelected, false);
    assert.equal(providerGateOpen(result), true);
    assert.equal(calls[0]?.credential, 'nvapi-test-key');
  });

  it('her başarısızlık sınıfı için düzeltici adım üretir', async () => {
    const cases: Array<[string, RegExp]> = [
      ['authentication', /yeni bir anahtar/],
      ['endpoint', /model kimliğini/],
      ['rate_limit', /istek sınırına/],
      ['provider', /geçici olarak/],
      ['configuration', /localhost/],
      ['timeout', /zaman aşımına/],
      ['network', /güvenlik duvarı/]
    ];
    for (const [errorCode, expected] of cases) {
      const { probe } = recordingProbe(() => fail(errorCode));
      const result = await evaluateProviderReadiness(
        { providerId: 'nvidia', model: 'z-ai/glm-5.2' },
        { probe, credentialFor: async () => 'nvapi-test-key' }
      );
      assert.equal(result.state, 'unreachable', `${errorCode} ulaşılamaz sayılmalı`);
      assert.equal(providerGateOpen(result), false);
      assert.match(providerRecoveryHint(result), expected, `${errorCode} için düzeltici adım eksik`);
    }
  });

  it('AI açıkça kapatılmışsa yerel sağlayıcı otomatik seçilmez sayılmaz ve kapı kapalı kalır', async () => {
    const { probe } = recordingProbe(() => fail('network'));
    const result = await evaluateProviderReadiness(
      { providerId: 'nvidia', useAiWhenAvailable: false },
      { probe, credentialFor: async () => 'nvapi-test-key' }
    );
    assert.equal(result.state, 'needs-setup');
    assert.equal(providerGateOpen(result), false);
  });

  it('kurulum seçeneklerinde anahtarsız yol başta gelir ve offline listelenmez', async () => {
    const { probe } = recordingProbe(() => fail('network'));
    const result = await evaluateProviderReadiness(
      { ...getDefaultProviderSettings(), providerId: 'offline', useAiWhenAvailable: false },
      { probe, ...noCredentials }
    );

    assert.equal(result.options.some(option => option.providerId === 'offline'), false);
    assert.equal(result.options[0]?.providerId, 'ollama');
    assert.equal(result.options[0]?.requiresCredential, false);
    assert.equal(result.options.some(option => option.providerId === 'nvidia'), true);
    assert.equal(result.options.every(option => option.label.length > 0), true);
  });
});
