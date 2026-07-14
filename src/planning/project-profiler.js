export function profileProjectFromText(text) {
    const textLower = text.toLowerCase();
    const domains = [];
    const platforms = [];
    const capabilities = [];
    const uncertainties = [];

    // Domain detection
    if (textLower.includes('game') || textLower.includes('oyun') || textLower.includes('physics') || textLower.includes('render') || textLower.includes('unity') || textLower.includes('unreal') || textLower.includes('godot')) {
        domains.push({ name: 'game', confidence: 0.85 });
    }
    if (textLower.includes('mobil') || textLower.includes('mobile') || textLower.includes('android') || textLower.includes('ios') || textLower.includes('flutter') || textLower.includes('react native') || textLower.includes('kotlin') || textLower.includes('swift')) {
        domains.push({ name: 'mobile', confidence: 0.80 });
    }
    if (textLower.includes('api') || textLower.includes('backend') || textLower.includes('server') || textLower.includes('db') || textLower.includes('database') || textLower.includes('sql') || textLower.includes('veritabanı')) {
        domains.push({ name: 'backend', confidence: 0.90 });
    }
    if (textLower.includes('script') || textLower.includes('cli') || textLower.includes('scrap') || textLower.includes('tool') || textLower.includes('otomasyon') || textLower.includes('automation')) {
        domains.push({ name: 'script', confidence: 0.75 });
    }
    if (textLower.includes('ai') || textLower.includes('yapay zeka') || textLower.includes('llm') || textLower.includes('model') || textLower.includes('gpt') || textLower.includes('agent')) {
        domains.push({ name: 'ai', confidence: 0.85 });
    }
    // Web detection must be explicit, not a fallback
    if (textLower.includes('web') || textLower.includes('website') || textLower.includes('tarayıcı') || textLower.includes('browser') || textLower.includes('react') || textLower.includes('vue') || textLower.includes('angular') || textLower.includes('html') || textLower.includes('frontend') || textLower.includes('arayüz')) {
        domains.push({ name: 'web', confidence: 0.75 });
    }
    // Fail-safe: unknown domain instead of defaulting to web
    if (domains.length === 0) {
        domains.push({ name: 'unknown', confidence: 0.20 });
        uncertainties.push('Projenin çalışma ortamı ve kullanıcı arayüzü henüz net değil. Web, masaüstü, mobil veya CLI mı olacak?');
    }

    // Platform detection
    if (textLower.includes('ios')) platforms.push('ios');
    if (textLower.includes('android')) platforms.push('android');
    if (textLower.includes('web') || textLower.includes('tarayıcı') || textLower.includes('browser') || textLower.includes('website')) platforms.push('browser');
    if (textLower.includes('windows') || textLower.includes('masaüstü') || textLower.includes('desktop') || textLower.includes('tauri')) platforms.push('windows');
    if (platforms.length === 0) {
        platforms.push('cross-platform');
    }

    // Capabilities
    if (textLower.includes('database') || textLower.includes('db') || textLower.includes('kayıt') || textLower.includes('storage') || textLower.includes('depolama')) {
        capabilities.push('local-storage-persistence');
    }
    if (textLower.includes('güvenlik') || textLower.includes('security') || textLower.includes('şifre') || textLower.includes('auth') || textLower.includes('login')) {
        capabilities.push('cryptographic-authentication');
    }
    if (textLower.includes('api') || textLower.includes('http') || textLower.includes('fetch') || textLower.includes('web service') || textLower.includes('sunucu')) {
        capabilities.push('network-communication');
    }

    // Uncertainties generator
    if (domains.some(d => d.name === 'game')) {
        uncertainties.push('Oyun mekanikleri gerçek zamanlı mı yoksa sıra tabanlı mı olacak?');
        uncertainties.push('Lokal bir save-system mi yoksa bulut tabanlı bir veritabanı mı tercih edilecek?');
    } else if (domains.some(d => d.name === 'mobile')) {
        uncertainties.push('Uygulama yerel (Swift/Kotlin) mi yoksa hibrit (Flutter/React Native) mi geliştirilecek?');
    } else if (!domains.some(d => d.name === 'unknown')) {
        uncertainties.push('Kullanıcı verileri nerede depolanacak? local-first mi yoksa uzaktaki bir API sunucusunda mı?');
    }

    return {
        domains,
        platforms,
        capabilities,
        uncertainties
    };
}

/**
 * Generates the full project profile text block for LLM prompt injection.
 * Returns a structured multi-line string listing all detected domains,
 * platforms and capabilities for the LLM to reason about.
 */
export function buildProfilePromptBlock(profile) {
    const lines = ['Proje Profili:'];

    if (profile.domains.length > 0) {
        lines.push('Domains:');
        profile.domains.forEach(d => {
            lines.push(`  - ${d.name} (confidence: ${d.confidence.toFixed(2)})`);
        });
    }

    if (profile.platforms.length > 0) {
        lines.push('Platforms:');
        profile.platforms.forEach(p => lines.push(`  - ${p}`));
    }

    if (profile.capabilities.length > 0) {
        lines.push('Capabilities:');
        profile.capabilities.forEach(c => lines.push(`  - ${c}`));
    }

    if (profile.uncertainties.length > 0) {
        lines.push('Belirsizlikler:');
        profile.uncertainties.forEach(u => lines.push(`  - ${u}`));
    }

    return lines.join('\n');
}
