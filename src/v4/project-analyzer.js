import { scanForSecrets } from '../security/secret-detector.js';

export const PROJECT_ANALYSIS_POLICY = Object.freeze({
    maxFiles: 5000,
    maxTotalBytes: 100 * 1024 * 1024,
    maxReadableBytes: 256 * 1024,
    maxContextEntries: 100,
    ignoredDirectories: ['.git', '.svn', '.hg', 'node_modules', 'dist', 'build', 'target', 'coverage', '.next', '.nuxt', '.cache', 'vendor'],
    sensitiveNames: ['.env', '.env.local', '.env.production', '.npmrc', '.pypirc', 'credentials', 'credentials.json', 'secrets.json', 'id_rsa', 'id_ed25519'],
    textExtensions: ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'vue', 'svelte', 'py', 'rb', 'php', 'java', 'kt', 'kts', 'go', 'rs', 'cs', 'cpp', 'c', 'h', 'hpp', 'swift', 'dart', 'html', 'css', 'scss', 'less', 'sql', 'graphql', 'md', 'txt', 'json', 'jsonc', 'yaml', 'yml', 'toml', 'xml', 'ini', 'cfg', 'sh', 'ps1', 'bat', 'dockerfile']
});

const INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /system\s+prompt/i,
    /you\s+are\s+now/i,
    /disregard\s+(all\s+)?prior/i,
    /önceki\s+talimatları\s+(yok say|unut)/i
];

const LANGUAGE_BY_EXTENSION = Object.freeze({
    js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript',
    py: 'Python', rb: 'Ruby', php: 'PHP', java: 'Java', kt: 'Kotlin', kts: 'Kotlin', go: 'Go', rs: 'Rust', cs: 'C#',
    cpp: 'C++', c: 'C', h: 'C/C++', hpp: 'C++', swift: 'Swift', dart: 'Dart', vue: 'Vue', svelte: 'Svelte',
    html: 'HTML', css: 'CSS', scss: 'SCSS', sql: 'SQL'
});

const MANIFESTS = Object.freeze({
    'package.json': 'Node.js', 'cargo.toml': 'Rust', 'pyproject.toml': 'Python', 'requirements.txt': 'Python',
    'go.mod': 'Go', 'pom.xml': 'Java/Maven', 'build.gradle': 'Java/Gradle', 'build.gradle.kts': 'Kotlin/Gradle',
    'composer.json': 'PHP', 'gemfile': 'Ruby', 'pubspec.yaml': 'Dart/Flutter', 'dockerfile': 'Docker', 'docker-compose.yml': 'Docker Compose'
});

function normalizePath(file) {
    return String(file.webkitRelativePath || file.relativePath || file.path || file.name || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function extension(path) {
    const name = path.split('/').at(-1)?.toLowerCase() || '';
    if (name === 'dockerfile' || name === 'gemfile') return name;
    return name.includes('.') ? name.split('.').at(-1) : '';
}

function pathPolicy(path) {
    if (!path || path.startsWith('/') || /^[a-z]:\//i.test(path) || path.split('/').includes('..')) return { allowed: false, reason: 'unsafe_path' };
    const segments = path.toLowerCase().split('/');
    if (INJECTION_PATTERNS.some(pattern => pattern.test(path))) return { allowed: false, reason: 'suspicious_name' };
    if (segments.slice(0, -1).some(segment => PROJECT_ANALYSIS_POLICY.ignoredDirectories.includes(segment))) return { allowed: false, reason: 'ignored_directory' };
    const name = segments.at(-1);
    if (segments.some(segment => segment.startsWith('.') && segment !== '.github') || PROJECT_ANALYSIS_POLICY.sensitiveNames.includes(name) || name.endsWith('.pem') || name.endsWith('.key')) return { allowed: false, reason: 'sensitive_or_hidden' };
    return { allowed: true, reason: '' };
}

function localContentSignals(path, content) {
    const signals = {};
    if (path.toLowerCase().endsWith('package.json')) {
        try {
            const manifest = JSON.parse(content);
            signals.packageManager = manifest.packageManager || '';
            signals.frameworkHints = Object.keys({ ...(manifest.dependencies || {}), ...(manifest.devDependencies || {}) }).filter(name => ['react', 'vue', 'svelte', 'next', 'nuxt', 'vite', 'electron', '@tauri-apps/api'].includes(name));
            signals.scriptNames = Object.keys(manifest.scripts || {}).slice(0, 30);
        } catch { signals.manifestParseError = true; }
    }
    return signals;
}

export async function analyzeSelectedFiles(files, policy = PROJECT_ANALYSIS_POLICY) {
    const selected = Array.from(files || []);
    const inventory = [];
    const excluded = [];
    const languages = new Map();
    const frameworks = new Set();
    const manifests = new Set();
    const scriptNames = new Set();
    let totalBytes = 0;

    for (const file of selected) {
        const path = normalizePath(file);
        const pathResult = pathPolicy(path);
        const size = Number(file.size || 0);
        if (!pathResult.allowed) { excluded.push({ path, reason: pathResult.reason }); continue; }
        if (inventory.length >= policy.maxFiles) { excluded.push({ path, reason: 'file_limit' }); continue; }
        if (totalBytes + size > policy.maxTotalBytes) { excluded.push({ path, reason: 'total_size_limit' }); continue; }
        totalBytes += size;
        const ext = extension(path);
        const textEligible = policy.textExtensions.includes(ext) && size <= policy.maxReadableBytes && typeof file.text === 'function';
        const entry = { path, name: path.split('/').at(-1), extension: ext, size, kind: textEligible ? 'text' : 'metadata', secretDetected: false, injectionDetected: false, lineCount: null };
        if (LANGUAGE_BY_EXTENSION[ext]) languages.set(LANGUAGE_BY_EXTENSION[ext], (languages.get(LANGUAGE_BY_EXTENSION[ext]) || 0) + 1);
        const manifestKind = MANIFESTS[entry.name.toLowerCase()];
        if (manifestKind) manifests.add(manifestKind);
        if (textEligible) {
            try {
                const content = await file.text();
                entry.lineCount = content ? content.split(/\r?\n/).length : 0;
                entry.secretDetected = scanForSecrets(content);
                entry.injectionDetected = INJECTION_PATTERNS.some(pattern => pattern.test(content));
                if (!entry.secretDetected && !entry.injectionDetected) {
                    const signals = localContentSignals(path, content);
                    for (const framework of signals.frameworkHints || []) frameworks.add(framework);
                    for (const script of signals.scriptNames || []) scriptNames.add(script);
                    if (signals.packageManager) entry.packageManager = signals.packageManager;
                    if (signals.manifestParseError) entry.manifestParseError = true;
                }
            } catch { entry.readError = true; }
        }
        inventory.push(entry);
    }

    const languageSummary = [...languages.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, files: count }));
    const report = {
        version: 1, analyzedAt: new Date().toISOString(), source: 'browser-selection',
        totals: { selected: selected.length, included: inventory.length, excluded: excluded.length, bytes: totalBytes },
        languages: languageSummary, frameworks: [...frameworks], manifests: [...manifests], scriptNames: [...scriptNames],
        security: { secretFiles: inventory.filter(item => item.secretDetected).map(item => item.path), injectionFiles: inventory.filter(item => item.injectionDetected).map(item => item.path) },
        inventory, excluded
    };
    return report;
}

export function projectInventoryContext(report) {
    const languageText = report.languages.map(item => `${item.name} (${item.files})`).join(', ') || 'belirlenemedi';
    const summary = `${report.totals.included} dosya, ${Math.ceil(report.totals.bytes / 1024)} KB; diller: ${languageText}; manifestler: ${report.manifests.join(', ') || 'yok'}; framework sinyalleri: ${report.frameworks.join(', ') || 'yok'}.`;
    const safeEntries = report.inventory.filter(item => !item.secretDetected && !item.injectionDetected).slice(0, PROJECT_ANALYSIS_POLICY.maxContextEntries).map(item => ({ name: item.path.slice(0, 240), kind: item.kind, summary: `${item.extension || 'uzantısız'} · ${Math.ceil(item.size / 1024)} KB${item.lineCount == null ? '' : ` · ${item.lineCount} satır`}` }));
    return [{ name: 'Proje envanteri', kind: 'project-inventory', summary }, ...safeEntries];
}

export function wrapUntrustedProjectContext(context) {
    return `<UNTRUSTED_PROJECT_INVENTORY>\n${JSON.stringify(context)}\n</UNTRUSTED_PROJECT_INVENTORY>`;
}
