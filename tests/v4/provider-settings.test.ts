import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BUILT_IN_NVIDIA_MODEL,
  DEFAULT_PROVIDER_ID,
  getDefaultProviderSettings,
  getProviderMeta,
  hasSavedProviderSettings,
  loadProviderSettings,
  saveProviderSettings,
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

describe('getProviderMeta fallback resolution (characterization)', () => {
  it('falls back to the NVIDIA catalogue entry for an unknown provider id', () => {
    const meta = getProviderMeta('not-a-real-provider');
    assert.equal(meta.id, DEFAULT_PROVIDER_ID);
  });

  it('falls back to the NVIDIA catalogue entry when the provider id is undefined', () => {
    const meta = getProviderMeta(undefined);
    assert.equal(meta.id, DEFAULT_PROVIDER_ID);
  });
});

describe('upgradeProviderSettings edge inputs (characterization)', () => {
  it('returns the built-in default settings when stored settings are null', () => {
    const upgraded = upgradeProviderSettings(null);
    assert.deepEqual(upgraded, getDefaultProviderSettings());
  });

  it('returns the built-in default settings when stored settings are undefined', () => {
    const upgraded = upgradeProviderSettings(undefined);
    assert.deepEqual(upgraded, getDefaultProviderSettings());
  });
});

/**
 * `loadProviderSettings`/`saveProviderSettings` touch the `localStorage`
 * global, which does not exist in this Node test environment by default
 * (`typeof localStorage === 'undefined'`). These tests stub a minimal
 * `Storage` implementation to exercise the branches that actually read from
 * and write to persisted settings — the paths a real browser session takes.
 */
class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();
  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.has(key) ? (this.store.get(key) as string) : null; }
  key(index: number): string | null { return [...this.store.keys()][index] ?? null; }
  removeItem(key: string): void { this.store.delete(key); }
  setItem(key: string, value: string): void { this.store.set(key, value); }
}

type GlobalWithStorage = typeof globalThis & { localStorage?: Storage };

function withStubbedLocalStorage(run: (storage: MemoryStorage) => void): void {
  const globalWithStorage = globalThis as GlobalWithStorage;
  const previous = globalWithStorage.localStorage;
  const stub = new MemoryStorage();
  globalWithStorage.localStorage = stub;
  try {
    run(stub);
  } finally {
    globalWithStorage.localStorage = previous;
  }
}

describe('loadProviderSettings storage I/O (characterization)', () => {
  it('returns the built-in defaults when localStorage is unavailable', () => {
    assert.equal(typeof (globalThis as GlobalWithStorage).localStorage, 'undefined');
    assert.deepEqual(loadProviderSettings(), getDefaultProviderSettings());
  });

  it('returns the built-in defaults when nothing has been persisted yet', () => {
    withStubbedLocalStorage(() => {
      assert.deepEqual(loadProviderSettings(), getDefaultProviderSettings());
    });
  });

  it('migrates a persisted legacy provider selection on load', () => {
    withStubbedLocalStorage((storage) => {
      storage.setItem('promtgen-provider-settings-v1', JSON.stringify({
        providerId: 'ollama',
        model: 'qwen-local',
        baseUrl: 'http://127.0.0.1:11434',
        useAiWhenAvailable: true,
        useLocalMemory: true
      }));
      const loaded = loadProviderSettings();
      assert.equal(loaded.providerId, 'ollama');
      assert.equal(loaded.model, 'qwen-local');
      assert.equal(loaded.useLocalMemory, true);
    });
  });

  it('falls back to the built-in defaults when the persisted value is not valid JSON', () => {
    withStubbedLocalStorage((storage) => {
      storage.setItem('promtgen-provider-settings-v1', '{not-json');
      assert.deepEqual(loadProviderSettings(), getDefaultProviderSettings());
    });
  });
});

describe('hasSavedProviderSettings (first-run detection signal)', () => {
  it('returns false when localStorage is unavailable', () => {
    assert.equal(typeof (globalThis as GlobalWithStorage).localStorage, 'undefined');
    assert.equal(hasSavedProviderSettings(), false);
  });

  it('returns false when nothing has been persisted yet', () => {
    withStubbedLocalStorage(() => {
      assert.equal(hasSavedProviderSettings(), false);
    });
  });

  it('returns true once any settings have been saved', () => {
    withStubbedLocalStorage((storage) => {
      storage.setItem('promtgen-provider-settings-v1', JSON.stringify(getDefaultProviderSettings()));
      assert.equal(hasSavedProviderSettings(), true);
    });
  });
});

describe('saveProviderSettings storage I/O (characterization)', () => {
  it('normalizes settings and persists them to localStorage', () => {
    withStubbedLocalStorage((storage) => {
      const saved = saveProviderSettings({
        providerId: 'ollama',
        model: 'llama3.2',
        baseUrl: 'http://127.0.0.1:11434',
        useAiWhenAvailable: true,
        useLocalMemory: false
      });
      assert.equal(saved.providerId, 'ollama');
      const persisted = storage.getItem('promtgen-provider-settings-v1');
      assert.ok(persisted);
      assert.deepEqual(JSON.parse(persisted as string), saved);
    });
  });

  it('does not throw when localStorage is unavailable', () => {
    assert.equal(typeof (globalThis as GlobalWithStorage).localStorage, 'undefined');
    const saved = saveProviderSettings(getDefaultProviderSettings());
    assert.equal(saved.providerId, DEFAULT_PROVIDER_ID);
  });
});
