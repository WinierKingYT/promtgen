import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/**
 * Uyumluluk sınırı kapısı — üretim kodu eski katmana bağımlı olamaz.
 *
 * `docs/architecture-v4.md:36` bunu düzyazıyla söylüyordu. Düzyazı bir sonraki
 * ajanı durdurmaz; bu betik durdurur.
 *
 * **Kural.** `src/v4/**` ve `src/react/**` içindeki bir import, bu iki kökün
 * dışına çözülüyorsa ihlaldir. Paket importları (`zod`, `react`, `node:fs`)
 * ihlal değildir — yalnız kökten kaçan **göreli** importlar sayılır.
 *
 * Kural bu şekilde yazıldı, on iki eski dizin tek tek sayılmadı: yarın
 * `src/telemetry/` eklenirse hiçbir liste güncellenmeden yakalanır.
 *
 * **İzin verilen yön tek taraflıdır.** Uyumluluk katmanından üretime *göç
 * edilebilir*; üretim uyumluluğa *bağımlı olamaz*.
 *
 * ---
 *
 * ## Neden dize eşleme değil, gerçek yol çözümlemesi
 *
 * `src/v4/` kendi `security/` ve `domain/` dizinlerine sahiptir ve bunların
 * adları eski dizinlerle aynıdır. `\.\./(security|domain)/` araması `src/v4`
 * üzerinde 13 sonuç döndürür ve **12'si yanlış pozitiftir** — hedefi göreli
 * derinlik belirler:
 *
 *   src/v4/ai/provider-adapters.ts      '../security/secret-guard.js'
 *     -> src/v4/security/…                                        MEŞRU
 *   src/v4/ai/tasks/discovery.ts        '../../security/context-isolation.js'
 *     -> src/v4/security/…                                        MEŞRU
 *   src/v4/application/change-impact-service.ts '../domain/idea-plan-alignment.js'
 *     -> src/v4/domain/…                                          MEŞRU
 *
 * Dize eşleyen bir kapı ya bu gürültüyle boğulur ya da sessiz kalana kadar
 * ayarlanır. Bu yüzden her belirteç `path.resolve(dirname(file), specifier)`
 * ile gerçek hedefe çözülür ve depo köküne göre karşılaştırılır.
 *
 * `vite.config.ts` alias'ı, `tsconfig.json` `paths` ve `package.json` `imports`
 * haritası yoktur (V3-00 §1.4); göreli çözümleme bu yüzden eksiksizdir.
 */

const REPO_ROOT = path.resolve('.');

/** Üretim kökleri. `src/` altındaki diğer on iki dizin uyumluluk katmanıdır. */
const PRODUCTION_ROOTS = [
  path.resolve('src', 'v4'),
  path.resolve('src', 'react')
];

/**
 * Uzantı filtresi YOK — dizinin tamamı taranır.
 *
 * Bu depo `.ts`, `.tsx`, `.js` ve `.d.ts` karıştırır (ölçüldü: 145 `.ts`,
 * 34 `.tsx`, 20 `.js`, 2 `.d.ts`; taranmayan tek dosya bir `.css`). Filtreli
 * bir tarama eksik bakar ve sessizce "temiz" der; kapının varlık sebebi tam
 * olarak bunun tersidir.
 *
 * `.d.ts` yan dosyaları **kapsam içindedir** ve bu bilinçli bir karardır:
 * bir bildirim dosyasındaki `import type` de gerçek bir derleme bağımlılığıdır.
 * Ayrı bir uzantı kuralı gerekmez — `.d.ts` zaten `.ts` ile biter, yani
 * "uzantı filtresi yok" ilkesi onları kendiliğinden kapsar.
 */
const SCANNED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'] as const;

/**
 * Muafiyet listesi. Part 1 sonrası **boş olmalıdır**.
 *
 * Buraya bir giriş eklemek gerekiyorsa kapı doğru şeyi yakalamış demektir:
 * dosyayı taşı, importu muaf tutma.
 */
const ALLOWLIST: readonly string[] = [];

/**
 * Fail-loud öz denetimi — `check-module-reachability.ts:32-35` emsali.
 *
 * Orada yorum şöyle: "Tarama bozulursa boş sonuç dönerdi ve kapı sessizce yeşil
 * verirdi." Aynı tehlike burada daha büyük: bozuk bir tarama sıfır ihlal bulur
 * ve kapı "üretim temiz" der. Ölçülen değerler 2026-09-04'te **199 dosya** ve
 * **595 göreli import kenarı**ydı; eşikler bunun yaklaşık %80'ine konuldu.
 * Amaç sıkı bir taban çizgisi tutmak değil, çöken bir taramayı ayırt etmektir.
 */
const MINIMUM_EXPECTED_FILES = 160;
const MINIMUM_EXPECTED_EDGES = 480;

interface ImportEdge {
  readonly file: string;
  readonly line: number;
  readonly specifier: string;
  readonly resolved: string;
}

function collectFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current)) {
      const full = path.join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (SCANNED_EXTENSIONS.some(extension => entry.endsWith(extension))) files.push(full);
    }
  };
  walk(root);
  return files;
}

/**
 * Yorum satırlarını aynı uzunlukta boşlukla değiştirir.
 *
 * Yoruma alınmış bir import yanlış pozitif üretirdi. Silmek yerine maskelemek
 * kasıtlı: karakter ofsetleri ve satır numaraları korunur, yoksa raporlanan
 * `file:line` kayardı. Yalnız satır başındaki yorumlar maskelenir; `'https://…'`
 * gibi dizeleri kesmemek için satır içi `//` aranmaz.
 */
function maskCommentLines(source: string): string {
  return source
    .split('\n')
    .map(line => {
      const trimmed = line.trimStart();
      const isCommentLine = trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
      return isCommentLine ? ' '.repeat(line.length) : line;
    })
    .join('\n');
}

/**
 * Dört biçim de yakalanır. Dinamik `import()` göz ardı EDİLEMEZ:
 * `src/react/Workspace.tsx` gerçekten `await import('../v4/exporter.js')`
 * kullanıyor, yani bu biçim bu depoda canlıdır.
 */
const SPECIFIER_PATTERNS: readonly RegExp[] = [
  /\bfrom\s*['"]([^'"]+)['"]/g,          // import … from '…'  ve  export … from '…'
  /\bimport\s*['"]([^'"]+)['"]/g,        // yan etkili  import '…'
  /\bimport\s*\(\s*['"]([^'"]+)['"]/g,   // dinamik     import('…')
  /\brequire\s*\(\s*['"]([^'"]+)['"]/g   // CommonJS    require('…')
];

function lineOf(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (source[i] === '\n') line += 1;
  return line;
}

function collectEdges(file: string): ImportEdge[] {
  const masked = maskCommentLines(readFileSync(file, 'utf8'));
  /** Ofsete göre tekilleştirme: aynı belirteci iki kalıp yakalarsa bir kez sayılsın. */
  const byOffset = new Map<number, { specifier: string; line: number }>();

  for (const pattern of SPECIFIER_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of masked.matchAll(pattern)) {
      const specifier = match[1];
      const offset = match.index ?? 0;
      byOffset.set(offset + match[0].indexOf(specifier), { specifier, line: lineOf(masked, offset) });
    }
  }

  const edges: ImportEdge[] = [];
  for (const { specifier, line } of byOffset.values()) {
    // Yalnız göreli importlar kaçabilir. `zod`, `react`, `node:fs` paket
    // belirteçleridir ve dosya sistemine hiç çözülmezler.
    if (!specifier.startsWith('.')) continue;
    edges.push({ file, line, specifier, resolved: path.resolve(path.dirname(file), specifier) });
  }
  return edges;
}

function isInsideProduction(target: string): boolean {
  return PRODUCTION_ROOTS.some(root => {
    const relative = path.relative(root, target);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  });
}

const files = PRODUCTION_ROOTS.flatMap(collectFiles);
const edges = files.flatMap(collectEdges);

if (files.length < MINIMUM_EXPECTED_FILES) {
  console.error(
    `Tarama yalnız ${files.length} üretim dosyası buldu; en az ${MINIMUM_EXPECTED_FILES} bekleniyordu. `
    + 'Kod temiz değil — TARAMA BOZUK. Dosya toplama adımını kontrol edin.'
  );
  process.exit(1);
}

if (edges.length < MINIMUM_EXPECTED_EDGES) {
  console.error(
    `Tarama yalnız ${edges.length} import kenarı buldu; en az ${MINIMUM_EXPECTED_EDGES} bekleniyordu. `
    + 'Kod temiz değil — TARAMA BOZUK. Belirteç kalıplarını kontrol edin.'
  );
  process.exit(1);
}

const violations = edges
  .filter(edge => !isInsideProduction(edge.resolved))
  .filter(edge => !ALLOWLIST.includes(`${path.relative(REPO_ROOT, edge.file).replace(/\\/g, '/')}:${edge.specifier}`))
  // Kalıp sırasına göre değil dosya:satır sırasına göre raporla; aksi hâlde aynı
  // dosyanın satırları karışık çıkar ve okuyan düzeltme sırasını kaybeder.
  .sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line);

const relative = (target: string) => path.relative(REPO_ROOT, target).replace(/\\/g, '/');

if (violations.length) {
  console.error(`Uyumluluk sınırı ihlali: ${violations.length} import üretim kökünün dışına çıkıyor.\n`);
  for (const violation of violations) {
    console.error(`  ${relative(violation.file)}:${violation.line}`);
    console.error(`    '${violation.specifier}'  ->  ${relative(violation.resolved)}\n`);
  }
  console.error(
    'Kural: src/v4/** ve src/react/** üretimdir; src/ altındaki diğer dizinler\n'
    + 'uyumluluk katmanıdır. İzin verilen yön tek taraflıdır — uyumluluktan\n'
    + 'üretime GÖÇ EDİLİR, üretim uyumluluğa BAĞIMLI OLAMAZ.\n\n'
    + 'Çözüm importu muaf tutmak değil, modülü üretim köküne taşımaktır.'
  );
  process.exit(1);
}

console.log(
  `Uyumluluk sınırı doğrulandı: ${files.length} üretim dosyası tarandı, `
  + `${edges.length} göreli import kenarı çözüldü, 0 ihlal.`
);
