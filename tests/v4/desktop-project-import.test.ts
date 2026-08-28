import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { isDesktopProjectImportAvailable, selectDesktopProjectFolder } from '../../src/v4/desktop-project-import.js';

/**
 * `desktop-project-import.ts` had zero test coverage before this conversion. It is a
 * thin Tauri IPC bridge: `@tauri-apps/api/core`'s `isTauri()` reads `globalThis.isTauri`
 * and its `invoke()` reads `window.__TAURI_INTERNALS__.invoke` (see
 * node_modules/@tauri-apps/api/core.js) — the same two seams already established in
 * tests/v4/credential-vault.test.ts's `DesktopCredentialVault` suite. Reused verbatim
 * here rather than inventing a new mocking approach.
 */
describe('isDesktopProjectImportAvailable', () => {
  let originalIsTauri: unknown;

  beforeEach(() => {
    originalIsTauri = (globalThis as { isTauri?: unknown }).isTauri;
  });
  afterEach(() => {
    const globalRef = globalThis as { isTauri?: unknown };
    if (originalIsTauri === undefined) delete globalRef.isTauri;
    else globalRef.isTauri = originalIsTauri;
  });

  it('Tauri dışında false döner', () => {
    delete (globalThis as { isTauri?: unknown }).isTauri;

    assert.equal(isDesktopProjectImportAvailable(), false);
  });

  it('Tauri içinde true döner', () => {
    (globalThis as { isTauri?: unknown }).isTauri = true;

    assert.equal(isDesktopProjectImportAvailable(), true);
  });
});

describe('selectDesktopProjectFolder', () => {
  let originalIsTauri: unknown;
  let originalWindow: unknown;

  beforeEach(() => {
    originalIsTauri = (globalThis as { isTauri?: unknown }).isTauri;
    originalWindow = (globalThis as { window?: unknown }).window;
  });
  afterEach(() => {
    const globalRef = globalThis as { isTauri?: unknown; window?: unknown };
    if (originalIsTauri === undefined) delete globalRef.isTauri;
    else globalRef.isTauri = originalIsTauri;
    if (originalWindow === undefined) delete globalRef.window;
    else globalRef.window = originalWindow;
  });

  function mockInvoke(handler: (cmd: string, args: unknown) => unknown): void {
    (globalThis as { window?: unknown }).window = {
      __TAURI_INTERNALS__: {
        invoke: async (cmd: string, args: unknown) => handler(cmd, args)
      }
    };
  }

  it('Tauri dışında IPC hiç çağrılmadan null döner', async () => {
    delete (globalThis as { isTauri?: unknown }).isTauri;
    // Kasıtlı olarak window/__TAURI_INTERNALS__ hiç kurulmadı: invoke çağrılırsa
    // (yani non-Tauri erken dönüşü delinirse) bu test TypeError ile patlar.

    const result = await selectDesktopProjectFolder();

    assert.equal(result, null);
  });

  it('Tauri içinde doğru komut adıyla IPC çağırır', async () => {
    (globalThis as { isTauri?: unknown }).isTauri = true;
    const calls: Array<{ cmd: string; args: unknown }> = [];
    mockInvoke((cmd, args) => { calls.push({ cmd, args }); return { version: 1 }; });

    await selectDesktopProjectFolder();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].cmd, 'select_and_inventory_project_folder');
  });

  it('Tauri içinde IPC sonucunu aynen döner', async () => {
    (globalThis as { isTauri?: unknown }).isTauri = true;
    const report = { version: 1, analyzedAt: '2026-08-23T00:00:00.000Z', source: 'desktop', totals: { selected: 1, included: 1, excluded: 0, bytes: 10 }, languages: [], frameworks: [], manifests: [], scriptNames: [], security: { secretFiles: [], injectionFiles: [] }, inventory: [], excluded: [] };
    mockInvoke(() => report);

    const result = await selectDesktopProjectFolder();

    assert.deepEqual(result, report);
  });

  it('Tauri içinde IPC null döndürdüğünde null döner', async () => {
    (globalThis as { isTauri?: unknown }).isTauri = true;
    mockInvoke(() => null);

    const result = await selectDesktopProjectFolder();

    assert.equal(result, null);
  });
});

console.log('✓ desktop project import — Tauri IPC bridge');
