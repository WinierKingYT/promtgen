import { invoke, isTauri } from '@tauri-apps/api/core';

const STORAGE_PREFIX = 'promtgen.credential.';

/**
 * `sessionStorage` erişilemeyebiliyor: bazı gizlilik modlarında ve gömülü
 * tarayıcılarda okuma/yazma denemesi doğrudan hata fırlatıyor. Bu yüzden her
 * çağrı korunuyor ve erişilemediğinde bellek yedeğine düşülüyor — kasa
 * çalışmaya devam eder, yalnız kalıcılık kaybolur.
 */
const memoryFallback = new Map();

function sessionStore() {
    try {
        if (typeof sessionStorage === 'undefined') return null;
        // Erişimin gerçekten çalıştığını yazmayı deneyerek doğrula; yalnız
        // `typeof` kontrolü bazı ortamlarda yetmiyor.
        const probe = `${STORAGE_PREFIX}__probe__`;
        sessionStorage.setItem(probe, '1');
        sessionStorage.removeItem(probe);
        return sessionStorage;
    } catch {
        return null;
    }
}

/**
 * Web kasası. Anahtar **sekme oturumu boyunca** durur: sayfa yenilendiğinde
 * korunur, sekme kapandığında silinir.
 *
 * Neden `localStorage` değil: anahtar diskte süresiz kalırdı ve makineye
 * erişen herkese açık olurdu. Neden salt bellek değil: her sayfa yenilemesi
 * bağlantıyı düşürüyor ve kullanıcı sağlayıcıyı tekrar tekrar bağlamak zorunda
 * kalıyordu.
 *
 * Kabul edilen risk: `sessionStorage`'daki değer bir XSS tarafından okunabilir.
 * Bu depoda saldırı yüzeyi dar — `src/` içinde tek bir
 * `dangerouslySetInnerHTML`/`innerHTML` yok, React tüm içeriği kaçırıyor — ama
 * risk sıfır değil. Masaüstü uygulaması bu takası hiç yapmaz: orada anahtar
 * işletim sisteminin kasasına gider (`DesktopCredentialVault`).
 */
export class SessionCredentialVault {
    async set(provider, credential) {
        memoryFallback.set(provider, credential);
        sessionStore()?.setItem(STORAGE_PREFIX + provider, credential);
    }

    async get(provider) {
        const stored = sessionStore()?.getItem(STORAGE_PREFIX + provider);
        if (typeof stored === 'string' && stored) return stored;
        return memoryFallback.get(provider) || null;
    }

    async remove(provider) {
        memoryFallback.delete(provider);
        sessionStore()?.removeItem(STORAGE_PREFIX + provider);
    }
}

export class DesktopCredentialVault {
    async set(provider, credential) { await invoke('set_provider_credential', { provider, credential }); }
    async get(provider) { return invoke('get_provider_credential', { provider }); }
    async remove(provider) { await invoke('delete_provider_credential', { provider }); }
}

export function createCredentialVault() { return isTauri() ? new DesktopCredentialVault() : new SessionCredentialVault(); }
