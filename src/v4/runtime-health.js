import { getProviderMeta } from './provider-settings.js';
import { validateProviderSettings } from './provider-url-policy.js';

function check(id, label, status, detail, recommendation = '') {
    return { id, label, status, detail, recommendation };
}

export function buildRuntimeHealthReport(input = {}) {
    const {
        desktop = false,
        indexedDbAvailable = false,
        storage = null,
        execution = null,
        ollama = null,
        providerSettings = { providerId: 'offline', model: 'promtgen-local' },
        hasProviderCredential = false,
        providerConnection = null
    } = /** @type {any} */ (input);
    const checks = [];
    if (desktop) {
        checks.push(storage?.ok
            ? check('storage', 'Yerel veri', 'ok', `SQLite sağlam · ${storage.projectCount || 0} proje · ${storage.backupCount || 0} yedek`)
            : check('storage', 'Yerel veri', 'error', storage ? `SQLite kontrolü başarısız: ${storage.quickCheck || 'bilinmeyen hata'}` : 'SQLite sağlık bilgisi okunamadı.', 'Masaüstü veri sağlığı panelini aç.'));
        checks.push(execution?.gitAvailable
            ? check('git', 'Git', 'ok', execution.gitVersion || 'Git kullanılabilir.')
            : check('git', 'Git', 'error', 'Git komutu çalıştırılamıyor.', 'Git’i kur veya PATH ayarını düzelt.'));
        checks.push(execution?.codexAvailable
            ? check('codex', 'Codex CLI', 'ok', `${execution.codexVersion || 'Codex CLI kullanılabilir.'}${execution.codexSource === 'custom' ? ' · kullanıcı seçimi' : ' · PATH'}${execution.codexPath ? ` · ${execution.codexPath}` : ''}`)
            : check('codex', 'Codex CLI', 'warning', execution?.codexError || 'Codex CLI bulunamadı veya işletim sistemi çalıştırmayı engelledi.', 'Generic ajan exportu kullanılabilir; native zincir için Sistem Doktoru üzerinden doğrulanmış Codex CLI seçilebilir.'));
    } else {
        checks.push(indexedDbAvailable
            ? check('storage', 'Yerel veri', 'ok', 'IndexedDB bu tarayıcıda kullanılabilir.')
            : check('storage', 'Yerel veri', 'error', 'IndexedDB kullanılamıyor.', 'Kalıcı depolamaya izin veren güncel bir tarayıcı kullan.'));
        checks.push(check('desktop', 'Masaüstü özellikleri', 'info', 'SQLite, keyring ve izole Codex worktree yalnız masaüstü sürümünde çalışır.'));
    }

    checks.push(ollama?.ok
        ? check('ollama', 'Ollama', 'ok', `Loopback bağlantısı hazır · ${ollama.latencyMs || 0} ms`)
        : check('ollama', 'Ollama', 'info', 'Yerel Ollama servisi algılanmadı.', 'İsteğe bağlıdır; çevrimdışı akıllı motor Ollama olmadan çalışır.'));

    const provider = getProviderMeta(providerSettings.providerId);
    const validation = validateProviderSettings(providerSettings, provider);
    if (!validation.valid) {
        checks.push(check('provider', 'Seçili AI', 'error', validation.error, 'AI ayarlarını düzelt.'));
    } else if (providerConnection) {
        checks.push(providerConnection.ok
            ? check('provider', 'Seçili AI', 'ok', `${provider.label}: ${providerConnection.message}`)
            : check('provider', 'Seçili AI', 'warning', `${provider.label}: ${providerConnection.message}`, 'Yerel motor otomatik fallback olarak kullanılacak.'));
    } else if (provider.id === 'offline') {
        checks.push(check('provider', 'Seçili AI', 'ok', 'Yerel akıllı motor hazır; ağ veya anahtar gerektirmez.'));
    } else if (provider.id === 'ollama') {
        checks.push(ollama?.ok
            ? check('provider', 'Seçili AI', 'ok', `${provider.label} hazır.`)
            : check('provider', 'Seçili AI', 'warning', `${provider.label} seçili fakat servis yanıt vermiyor.`, 'Ollama’yı başlat veya yerel motora geç.'));
    } else {
        checks.push(hasProviderCredential
            ? check('provider', 'Seçili AI', 'info', `${provider.label} yapılandırıldı; bulut bağlantısı kullanıcı isteğiyle ayrıca test edilir.`)
            : check('provider', 'Seçili AI', 'warning', `${provider.label} için API anahtarı eksik.`, 'AI ayarlarından anahtar ekle veya yerel motora geç.'));
    }

    const errors = checks.filter(item => item.status === 'error').length;
    const warnings = checks.filter(item => item.status === 'warning').length;
    return {
        checkedAt: new Date().toISOString(),
        checks,
        summary: {
            errors,
            warnings,
            ok: checks.filter(item => item.status === 'ok').length,
            readyForPlanning: errors === 0,
            readyForNativeExecution: desktop && Boolean(execution?.gitAvailable && execution?.codexAvailable)
        }
    };
}
