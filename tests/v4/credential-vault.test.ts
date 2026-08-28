import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { SessionCredentialVault, DesktopCredentialVault, createCredentialVault } from '../../src/v4/credential-vault.js';

/** Tarayıcı `sessionStorage`'ının yeterli taklidi. */
function fakeSessionStorage() {
  const data = new Map<string, string>();
  return {
    store: {
      getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
      setItem: (key: string, value: string) => { data.set(key, value); },
      removeItem: (key: string) => { data.delete(key); }
    },
    data
  };
}

const globalRef = globalThis as { sessionStorage?: unknown };
let original: unknown;

beforeEach(() => { original = globalRef.sessionStorage; });
afterEach(() => {
  if (original === undefined) delete globalRef.sessionStorage;
  else globalRef.sessionStorage = original;
});

describe('SessionCredentialVault', () => {
  it('anahtari sessionStorage`a yazar; yeni bir kasa ornegi onu okuyabilir', async () => {
    const fake = fakeSessionStorage();
    globalRef.sessionStorage = fake.store;

    await new SessionCredentialVault().set('openai', 'sk-test-123');

    // Sayfa yenilemesinin karşılığı: modül belleği değil, YENİ bir örnek.
    // Eski davranışta (salt bellek Map) bu satır null dönerdi ve kullanıcı
    // her yenilemede bağlantıyı kaybediyordu.
    const afterReload = await new SessionCredentialVault().get('openai');
    assert.equal(afterReload, 'sk-test-123');
    assert.equal(fake.data.get('promtgen.credential.openai'), 'sk-test-123');
  });

  it('remove her iki katmandan da siler', async () => {
    const fake = fakeSessionStorage();
    globalRef.sessionStorage = fake.store;
    const vault = new SessionCredentialVault();

    await vault.set('gemini', 'anahtar');
    await vault.remove('gemini');

    assert.equal(await vault.get('gemini'), null);
    assert.equal(await new SessionCredentialVault().get('gemini'), null);
    assert.equal(fake.data.has('promtgen.credential.gemini'), false);
  });

  it('sessionStorage yoksa cokmez, bellekte tutar', async () => {
    delete globalRef.sessionStorage;
    const vault = new SessionCredentialVault();

    await vault.set('nvidia', 'bellek-anahtari');

    assert.equal(await vault.get('nvidia'), 'bellek-anahtari');
  });

  it('sessionStorage hata firlatirsa bellege duser', async () => {
    // Gizlilik modlarında erişimin kendisi throw edebiliyor; kasa yine
    // çalışmalı, yalnız kalıcılık kaybolmalı.
    globalRef.sessionStorage = {
      getItem() { throw new Error('erişim reddedildi'); },
      setItem() { throw new Error('erişim reddedildi'); },
      removeItem() { throw new Error('erişim reddedildi'); }
    };
    const vault = new SessionCredentialVault();

    await vault.set('openai', 'yedek');

    assert.equal(await vault.get('openai'), 'yedek');
  });

  it('saglayicilar birbirinin anahtarini gormez', async () => {
    const fake = fakeSessionStorage();
    globalRef.sessionStorage = fake.store;
    const vault = new SessionCredentialVault();

    await vault.set('openai', 'openai-anahtari');
    await vault.set('gemini', 'gemini-anahtari');

    assert.equal(await vault.get('openai'), 'openai-anahtari');
    assert.equal(await vault.get('gemini'), 'gemini-anahtari');
  });

  it('hic yazilmamis bir saglayici icin null doner', async () => {
    const fake = fakeSessionStorage();
    globalRef.sessionStorage = fake.store;
    const vault = new SessionCredentialVault();

    assert.equal(await vault.get('hic-kullanilmamis-saglayici'), null);
  });
});

/**
 * `createCredentialVault`, `isTauri()` sonucuna gore hangi kasa
 * uygulamasinin secildigini belirliyor. Bu secim mantigi onceden hic test
 * edilmemisti.
 */
describe('createCredentialVault', () => {
  let originalIsTauri: unknown;

  beforeEach(() => {
    originalIsTauri = (globalThis as { isTauri?: unknown }).isTauri;
  });
  afterEach(() => {
    const globalRef = globalThis as { isTauri?: unknown };
    if (originalIsTauri === undefined) delete globalRef.isTauri;
    else globalRef.isTauri = originalIsTauri;
  });

  it('Tauri disinda SessionCredentialVault doner', () => {
    delete (globalThis as { isTauri?: unknown }).isTauri;

    const vault = createCredentialVault();

    assert.ok(vault instanceof SessionCredentialVault);
  });

  it('Tauri icinde DesktopCredentialVault doner', () => {
    (globalThis as { isTauri?: unknown }).isTauri = true;

    const vault = createCredentialVault();

    assert.ok(vault instanceof DesktopCredentialVault);
  });
});

/**
 * Masaustu kasasi hicbir zaman anahtar tutmuyor; her cagriyi Tauri IPC'sine
 * (`invoke`) devrediyor. `@tauri-apps/api/core`, komutu
 * `window.__TAURI_INTERNALS__.invoke` uzerinden cagiriyor - bu, Tauri
 * calisma zamaninin sinandigi tek nokta, bu yuzden onu burada taklit
 * ediyoruz (resmi `mockIPC` yardimcisi `window` global'inin var oldugunu
 * varsayiyor; bu test ortaminda yok, o yuzden dogrudan taklit ediyoruz).
 */
describe('DesktopCredentialVault', () => {
  let originalWindow: unknown;

  beforeEach(() => {
    originalWindow = (globalThis as { window?: unknown }).window;
  });
  afterEach(() => {
    const globalRef = globalThis as { window?: unknown };
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

  it('set, dogru komut adi ve yukle IPC cagirir', async () => {
    const calls: Array<{ cmd: string; args: unknown }> = [];
    mockInvoke((cmd, args) => { calls.push({ cmd, args }); return undefined; });

    await new DesktopCredentialVault().set('openai', 'sentetik-test-anahtari');

    assert.equal(calls.length, 1);
    assert.equal(calls[0].cmd, 'set_provider_credential');
    assert.deepEqual(calls[0].args, { provider: 'openai', credential: 'sentetik-test-anahtari' });
  });

  it('get, dogru komutla cagirir ve IPC sonucunu aynen doner', async () => {
    mockInvoke((cmd, args) => {
      assert.equal(cmd, 'get_provider_credential');
      assert.deepEqual(args, { provider: 'openai' });
      return 'sentetik-depodaki-anahtar';
    });

    const result = await new DesktopCredentialVault().get('openai');

    assert.equal(result, 'sentetik-depodaki-anahtar');
  });

  it('get, IPC null dondurdugunde null doner (depoda anahtar yok)', async () => {
    mockInvoke(() => null);

    const result = await new DesktopCredentialVault().get('nvidia');

    assert.equal(result, null);
  });

  it('remove, dogru komut adi ve yukle IPC cagirir', async () => {
    const calls: Array<{ cmd: string; args: unknown }> = [];
    mockInvoke((cmd, args) => { calls.push({ cmd, args }); return undefined; });

    await new DesktopCredentialVault().remove('gemini');

    assert.equal(calls.length, 1);
    assert.equal(calls[0].cmd, 'delete_provider_credential');
    assert.deepEqual(calls[0].args, { provider: 'gemini' });
  });
});
