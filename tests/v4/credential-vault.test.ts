import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { SessionCredentialVault } from '../../src/v4/credential-vault.js';

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
});
