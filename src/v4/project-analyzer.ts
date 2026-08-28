import { scanForSecrets } from '../security/secret-detector.js';
// Injection tespitinin tek üretim sahibi context-isolation'dır. Bu dosya
// eskiden kendi zayıf kalıp kopyasını taşıyordu (5 kalıp, normalizasyon yok);
// kanonik dedektör 8 kalıp, NFKC ve Türkçe diakritik katlaması uygular.
import { containsPromptInjection } from './security/context-isolation.js';

/**
 * Bir tarayıcı `File`in bu modülün gerçekten kullandığı alt kümesi. Gerçek
 * `File`/`Blob` bu şekli yapısal olarak karşılar (webkitRelativePath dahil);
 * `relativePath`/`path` standart değildir ama masaüstü/test kaynaklı
 * seçimlerde bulunabilir — bu yüzden opsiyonel tutulur.
 */
export interface SelectableFile {
  readonly name: string;
  readonly size: number;
  readonly webkitRelativePath?: string;
  readonly relativePath?: string;
  readonly path?: string;
  text?: () => Promise<string>;
}

export const PROJECT_ANALYSIS_POLICY = Object.freeze({
    maxFiles: 5000,
    maxTotalBytes: 100 * 1024 * 1024,
    maxReadableBytes: 256 * 1024,
    maxContextEntries: 100,
    ignoredDirectories: ['.git', '.svn', '.hg', 'node_modules', 'dist', 'build', 'target', 'coverage', '.next', '.nuxt', '.cache', 'vendor'],
    sensitiveNames: ['.env', '.env.local', '.env.production', '.npmrc', '.pypirc', 'credentials', 'credentials.json', 'secrets.json', 'id_rsa', 'id_ed25519'],
    textExtensions: ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'vue', 'svelte', 'py', 'rb', 'php', 'java', 'kt', 'kts', 'go', 'rs', 'cs', 'cpp', 'c', 'h', 'hpp', 'swift', 'dart', 'html', 'css', 'scss', 'less', 'sql', 'graphql', 'md', 'txt', 'json', 'jsonc', 'yaml', 'yml', 'toml', 'xml', 'ini', 'cfg', 'sh', 'ps1', 'bat', 'dockerfile']
});

export type ProjectAnalysisPolicy = typeof PROJECT_ANALYSIS_POLICY;

const LANGUAGE_BY_EXTENSION: Record<string, string> = Object.freeze({
    js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript',
    py: 'Python', rb: 'Ruby', php: 'PHP', java: 'Java', kt: 'Kotlin', kts: 'Kotlin', go: 'Go', rs: 'Rust', cs: 'C#',
    cpp: 'C++', c: 'C', h: 'C/C++', hpp: 'C++', swift: 'Swift', dart: 'Dart', vue: 'Vue', svelte: 'Svelte',
    html: 'HTML', css: 'CSS', scss: 'SCSS', sql: 'SQL'
});

const MANIFESTS: Record<string, string> = Object.freeze({
    'package.json': 'Node.js', 'cargo.toml': 'Rust', 'pyproject.toml': 'Python', 'requirements.txt': 'Python',
    'go.mod': 'Go', 'pom.xml': 'Java/Maven', 'build.gradle': 'Java/Gradle', 'build.gradle.kts': 'Kotlin/Gradle',
    'composer.json': 'PHP', 'gemfile': 'Ruby', 'pubspec.yaml': 'Dart/Flutter', 'dockerfile': 'Docker', 'docker-compose.yml': 'Docker Compose'
});

function normalizePath(file: SelectableFile): string {
    return String(file.webkitRelativePath || file.relativePath || file.path || file.name || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function extension(path: string): string {
    const name = path.split('/').at(-1)?.toLowerCase() || '';
    if (name === 'dockerfile' || name === 'gemfile') return name;
    return name.includes('.') ? (name.split('.').at(-1) as string) : '';
}

interface PathPolicyResult {
    allowed: boolean;
    reason: string;
}

function pathPolicy(path: string): PathPolicyResult {
    if (!path || path.startsWith('/') || /^[a-z]:\//i.test(path) || path.split('/').includes('..')) return { allowed: false, reason: 'unsafe_path' };
    const segments = path.toLowerCase().split('/');
    if (containsPromptInjection(path)) return { allowed: false, reason: 'suspicious_name' };
    if (segments.slice(0, -1).some(segment => PROJECT_ANALYSIS_POLICY.ignoredDirectories.includes(segment))) return { allowed: false, reason: 'ignored_directory' };
    const name = segments.at(-1);
    if (segments.some(segment => segment.startsWith('.') && segment !== '.github') || (name != null && PROJECT_ANALYSIS_POLICY.sensitiveNames.includes(name)) || Boolean(name?.endsWith('.pem')) || Boolean(name?.endsWith('.key'))) return { allowed: false, reason: 'sensitive_or_hidden' };
    return { allowed: true, reason: '' };
}

interface LocalContentSignals {
    packageManager?: string;
    frameworkHints?: string[];
    scriptNames?: string[];
    manifestParseError?: true;
}

/**
 * JSON.parse sınırı: `content` doğrulanmamış dosya içeriğidir. Ayrıştırılan
 * değerin gerçek şeklini garanti edemeyiz; bu yüzden beklenen package.json
 * alanlarını adlandırılmış bir arayüze `as` ile bağlıyoruz. Bu, orijinal
 * JS'in davranışını birebir korur: şekil uymazsa (örn. içerik `null` ise)
 * aşağıdaki alan erişimleri aynı şekilde fırlatır ve aynı catch tarafından
 * yakalanır — burada ek bir çalışma zamanı doğrulaması eklenmez.
 */
interface PackageManifestShape {
    packageManager?: string;
    dependencies?: Record<string, unknown>;
    devDependencies?: Record<string, unknown>;
    scripts?: Record<string, unknown>;
}

function localContentSignals(path: string, content: string): LocalContentSignals {
    const signals: LocalContentSignals = {};
    if (path.toLowerCase().endsWith('package.json')) {
        try {
            const manifest = JSON.parse(content) as PackageManifestShape;
            signals.packageManager = manifest.packageManager || '';
            signals.frameworkHints = Object.keys({ ...(manifest.dependencies || {}), ...(manifest.devDependencies || {}) }).filter(name => ['react', 'vue', 'svelte', 'next', 'nuxt', 'vite', 'electron', '@tauri-apps/api'].includes(name));
            signals.scriptNames = Object.keys(manifest.scripts || {}).slice(0, 30);
        } catch { signals.manifestParseError = true; }
    }
    return signals;
}

export interface ProjectInventoryEntry {
    path: string;
    name: string;
    extension: string;
    size: number;
    kind: 'text' | 'metadata';
    secretDetected: boolean;
    injectionDetected: boolean;
    lineCount: number | null;
    packageManager?: string;
    manifestParseError?: true;
    readError?: true;
}

export interface ProjectInventoryExcludedEntry {
    path: string;
    reason: string;
}

export interface ProjectInventoryReport {
    version: number;
    analyzedAt: string;
    source: string;
    rootName?: string;
    totals: { selected: number; included: number; excluded: number; bytes: number };
    languages: Array<{ name: string; files: number }>;
    frameworks: string[];
    manifests: string[];
    scriptNames: string[];
    security: { secretFiles: string[]; injectionFiles: string[] };
    inventory: ProjectInventoryEntry[];
    excluded: ProjectInventoryExcludedEntry[];
}

export async function analyzeSelectedFiles(
    files: Iterable<SelectableFile> | ArrayLike<SelectableFile> | null | undefined,
    policy: ProjectAnalysisPolicy = PROJECT_ANALYSIS_POLICY
): Promise<ProjectInventoryReport> {
    const selected = Array.from(files || []);
    const inventory: ProjectInventoryEntry[] = [];
    const excluded: ProjectInventoryExcludedEntry[] = [];
    const languages = new Map<string, number>();
    const frameworks = new Set<string>();
    const manifests = new Set<string>();
    const scriptNames = new Set<string>();
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
        const entry: ProjectInventoryEntry = { path, name: path.split('/').at(-1) ?? '', extension: ext, size, kind: textEligible ? 'text' : 'metadata', secretDetected: false, injectionDetected: false, lineCount: null };
        if (LANGUAGE_BY_EXTENSION[ext]) languages.set(LANGUAGE_BY_EXTENSION[ext], (languages.get(LANGUAGE_BY_EXTENSION[ext]) || 0) + 1);
        const manifestKind = MANIFESTS[entry.name.toLowerCase()];
        if (manifestKind) manifests.add(manifestKind);
        if (textEligible) {
            try {
                const content = await (file.text as () => Promise<string>)();
                entry.lineCount = content ? content.split(/\r?\n/).length : 0;
                entry.secretDetected = scanForSecrets(content);
                entry.injectionDetected = containsPromptInjection(content);
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
    const report: ProjectInventoryReport = {
        version: 1, analyzedAt: new Date().toISOString(), source: 'browser-selection',
        totals: { selected: selected.length, included: inventory.length, excluded: excluded.length, bytes: totalBytes },
        languages: languageSummary, frameworks: [...frameworks], manifests: [...manifests], scriptNames: [...scriptNames],
        security: { secretFiles: inventory.filter(item => item.secretDetected).map(item => item.path), injectionFiles: inventory.filter(item => item.injectionDetected).map(item => item.path) },
        inventory, excluded
    };
    return report;
}

export interface ProjectInventoryContextItem {
    name: string;
    kind: string;
    summary: string;
}

export function projectInventoryContext(report: ProjectInventoryReport): ProjectInventoryContextItem[] {
    const languageText = report.languages.map(item => `${item.name} (${item.files})`).join(', ') || 'belirlenemedi';
    const summary = `${report.totals.included} dosya, ${Math.ceil(report.totals.bytes / 1024)} KB; diller: ${languageText}; manifestler: ${report.manifests.join(', ') || 'yok'}; framework sinyalleri: ${report.frameworks.join(', ') || 'yok'}.`;
    const safeEntries = report.inventory.filter(item => !item.secretDetected && !item.injectionDetected).slice(0, PROJECT_ANALYSIS_POLICY.maxContextEntries).map(item => ({ name: item.path.slice(0, 240), kind: item.kind, summary: `${item.extension || 'uzantısız'} · ${Math.ceil(item.size / 1024)} KB${item.lineCount == null ? '' : ` · ${item.lineCount} satır`}` }));
    return [{ name: 'Proje envanteri', kind: 'project-inventory', summary }, ...safeEntries];
}

export function wrapUntrustedProjectContext(context: unknown): string {
    return `<UNTRUSTED_PROJECT_INVENTORY>\n${JSON.stringify(context)}\n</UNTRUSTED_PROJECT_INVENTORY>`;
}
