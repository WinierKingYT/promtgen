import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BUILT_IN_NVIDIA_MODEL,
  DEFAULT_PROVIDER_ID,
  getDefaultProviderSettings,
  upgradeProviderSettings
} from '../../src/v4/provider-settings.js';

describe('built-in provider profile', () => {
  it('starts new installations with NVIDIA GLM-5.2 enabled as the preferred AI', () => {
    const settings = getDefaultProviderSettings();
    assert.equal(settings.providerId, DEFAULT_PROVIDER_ID);
    assert.equal(settings.model, BUILT_IN_NVIDIA_MODEL);
    assert.equal(settings.baseUrl, 'https://integrate.api.nvidia.com/v1');
    assert.equal(settings.useAiWhenAvailable, true);
  });

  it('moves legacy NVIDIA defaults to GLM-5.2 without overriding another provider choice', () => {
    assert.equal(upgradeProviderSettings({
      providerId: 'nvidia',
      model: 'meta/llama-3.3-70b-instruct',
      baseUrl: 'https://integrate.api.nvidia.com/v1'
    }).model, BUILT_IN_NVIDIA_MODEL);

    const ollama = upgradeProviderSettings({
      providerId: 'ollama',
      model: 'qwen-local',
      baseUrl: 'http://127.0.0.1:11434'
    });
    assert.equal(ollama.providerId, 'ollama');
    assert.equal(ollama.model, 'qwen-local');
  });
});
