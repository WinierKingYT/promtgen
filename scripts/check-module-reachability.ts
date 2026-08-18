import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/**
 * Erişilebilirlik kontrolü — "soyutlamayı kur, bağlantıyı unut" hatasını yakalar.
 *
 * Bu oturumda aynı hata dört kez çıktı: Ürün Modeli V3 motorunun tamamı
 * arayüzden erişilemezdi, `concernTrace` ve `prioritizeConcerns` hiç
 * çağrılmıyordu, kapsam kararları plana ulaşmıyordu. Dördünde de birim
 * testleri yeşildi — çünkü hepsi modülü kendi içinde test ediyordu.
 *
 * Dördünü de yakalayan şey aynıydı: **çağrı yeri saymak.** Elle sayıldığı
 * sürece bir dahakine unutulur; bu betik onu zorunlu kılıyor.
 *
 * Üç sınıf ayrılır ve ikisi hata değildir:
 *
 * - `reachable`   Kendi dosyası dışında üretim kodundan çağrılıyor.
 * - `internal`    Yalnız kendi dosyasında kullanılıyor. Kod canlı ama dışa
 *                 aktarım gereksiz; bilgi amaçlı raporlanır, kapı düşürmez.
 * - `unreachable` Üretimde hiçbir yerde yok; yalnız testler çağırıyor.
 *
 * `unreachable` listesi bir **taban çizgisiyle** karşılaştırılır. Taban çizgisi
 * bir muafiyet değil, envanterdir: yeni bir erişilemez dışa aktarım eklemek de,
 * taban çizgisindeki birini bağlamak da betiği düşürür. İkincisi kasıtlı —
 * taban çizgisi yalnız küçülerek değişmeli ve bu değişiklik göze görünmeli.
 */

const APPLICATION_DIR = path.resolve('src', 'v4', 'application');
const BASELINE_PATH = path.resolve('benchmarks', 'reachability', 'baseline.json');
const REPORT_PATH = path.resolve('docs', 'product', 'MODULE_REACHABILITY.md');
const PRODUCTION_ROOTS = [path.resolve('src'), path.resolve('scripts')];

/** Tarama bozulursa boş sonuç dönerdi ve kapı sessizce yeşil verirdi. */
const MINIMUM_EXPECTED_EXPORTS = 120;

const EXPORT_PATTERN = /^export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z0-9_]+)/gm;

interface ExportRecord {
  module: string;
  symbol: string;
  state: 'reachable' | 'internal' | 'unreachable';
}

function collectFiles(root: string, extensions: readonly string[]): string[] {
  const files: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current)) {
      const full = path.join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (extensions.some(extension => entry.endsWith(extension))) files.push(full);
    }
  };
  walk(root);
  return files;
}

const productionFiles = PRODUCTION_ROOTS.flatMap(root => collectFiles(root, ['.ts', '.tsx', '.js']));
const sources = new Map(productionFiles.map(file => [file, readFileSync(file, 'utf8')]));

/**
 * Kelime siniri icin regex KULLANILMIYOR.
 *
 * Ilk surum sablon dizesi icinde bir kelime-siniri kacisi yaziyordu; sablon
 * dizesinde o kacis kelime siniri degil BACKSPACE karakteri anlamina gelir.
 * Regex hicbir seyle eslesmedi ve 173 disa aktarimin 173'u "erisilemez" cikti.
 * Jetonlama hem kacis katmani birakmiyor hem de tanim geregi daha dogru.
 */
function tokenize(source: string): string[] {
  return source.split(/[^A-Za-z0-9_$]+/);
}

const tokensByFile = new Map([...sources].map(([file, source]) => [file, tokenize(source)]));

function referenceCount(symbol: string, excludeFile: string): number {
  let count = 0;
  for (const [file, tokens] of tokensByFile) {
    if (file === excludeFile) continue;
    for (const token of tokens) if (token === symbol) count += 1;
  }
  return count;
}

/** Tanim satirinin kendisi sayilmaz; yoksa her sembol kendini canli gosterirdi. */
function isDefinitionLine(line: string, symbol: string): boolean {
  const tokens = tokenize(line.trim()).filter(Boolean);
  if (tokens[0] !== 'export') return false;
  const index = tokens.indexOf(symbol);
  return index > 0 && ['function', 'const', 'class', 'async'].includes(tokens[index - 1]);
}

function selfReferenceCount(symbol: string, source: string): number {
  return source
    .split('\n')
    .filter(line => !isDefinitionLine(line, symbol))
    .filter(line => tokenize(line).includes(symbol))
    .length;
}

const records: ExportRecord[] = [];
for (const file of collectFiles(APPLICATION_DIR, ['.ts'])) {
  const source = readFileSync(file, 'utf8');
  const moduleName = path.basename(file);
  for (const match of source.matchAll(EXPORT_PATTERN)) {
    const symbol = match[1];
    const outside = referenceCount(symbol, file);
    const inside = selfReferenceCount(symbol, source);
    records.push({
      module: moduleName,
      symbol,
      state: outside > 0 ? 'reachable' : inside > 0 ? 'internal' : 'unreachable'
    });
  }
}

/**
 * İkinci koruma. Birincisi yalnız dışa aktarım taramasını koruyordu; referans
 * sayımı bozulduğunda her sembol "erişilemez" çıkıyor ve rapor sessizce
 * saçmalıyordu. Tam olarak bu oldu: şablon dizesinde `` kelime sınırı değil
 * backspace karakteridir ve regex hiçbir şeyle eşleşmedi.
 */
const MAXIMUM_PLAUSIBLE_UNREACHABLE_RATIO = 0.5;

if (records.length < MINIMUM_EXPECTED_EXPORTS) {
  console.error(`Tarama yalnız ${records.length} dışa aktarım buldu; en az ${MINIMUM_EXPECTED_EXPORTS} bekleniyordu. Tarama bozulmuş olabilir.`);
  process.exit(1);
}

const key = (record: ExportRecord) => `${record.module}::${record.symbol}`;
const unreachable = records.filter(record => record.state === 'unreachable').map(key).sort();
const internal = records.filter(record => record.state === 'internal').map(key).sort();

if (unreachable.length > records.length * MAXIMUM_PLAUSIBLE_UNREACHABLE_RATIO) {
  console.error(
    `${records.length} dışa aktarımın ${unreachable.length} tanesi erişilemez göründü. `
    + 'Bu oran gerçekçi değil; referans sayımı bozulmuş olabilir.'
  );
  process.exit(1);
}

const checkOnly = process.argv.includes('--check');
const baseline: string[] = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).unreachable;

const added = unreachable.filter(item => !baseline.includes(item));
const fixed = baseline.filter(item => !unreachable.includes(item));

const report = `# Modül Erişilebilirliği

\`src/v4/application\` katmanındaki dışa aktarımların üretim kodundan gerçekten
çağrılıp çağrılmadığı. \`npm run check:reachability\` bunu zorlar.

- Toplam dışa aktarım: **${records.length}**
- Üretimden erişilebilir: **${records.filter(r => r.state === 'reachable').length}**
- Yalnız kendi modülünde kullanılan: **${internal.length}**
- Üretimde hiç çağrılmayan: **${unreachable.length}**

## Neden var

"Soyutlamayı doğru kur, bağlantıyı eksik bırak" hatası birim testleriyle
görünmez: modül kendi içinde test edilir ve yeşil verir. Onu yakalayan tek şey
çağrı yeri saymaktır.

## Üretimde çağrılmayanlar

Bunlar testlerden çağrılıyor ama üründe karşılığı yok. Her biri ya bağlanmalı
ya silinmeli; listenin **büyümesi** kapıyı düşürür.

${unreachable.map(item => `- \`${item}\``).join('\n') || '_Yok._'}

## Yalnız kendi modülünde kullanılanlar

Kod canlı; dışa aktarım gereksiz olabilir. Kapıyı düşürmez, bilgi amaçlıdır.

${internal.map(item => `- \`${item}\``).join('\n') || '_Yok._'}
`;

if (checkOnly) {
  const problems: string[] = [];
  if (added.length) {
    problems.push(`Yeni erişilemez dışa aktarım: ${added.join(', ')}. Ya üretime bağla ya sil.`);
  }
  if (fixed.length) {
    problems.push(`Taban çizgisindeki şu maddeler artık erişilebilir: ${fixed.join(', ')}. baseline.json güncellenmeli — taban çizgisi yalnız küçülerek değişir ve bu değişiklik göze görünmelidir.`);
  }
  const current = (() => {
    try { return readFileSync(REPORT_PATH, 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; }
  })();
  if (current !== report.replace(/\r\n/g, '\n')) problems.push('MODULE_REACHABILITY.md güncel değil.');

  if (problems.length) {
    for (const problem of problems) console.error(problem);
    process.exitCode = 1;
  } else {
    console.log(`Erişilebilirlik doğrulandı: ${records.length} dışa aktarım, ${unreachable.length}'i taban çizgisinde.`);
  }
} else {
  writeFileSync(BASELINE_PATH, `${JSON.stringify({ unreachable }, null, 2)}\n`, 'utf8');
  writeFileSync(REPORT_PATH, report, 'utf8');
  console.log(`Erişilebilirlik raporu yazıldı: ${unreachable.length} erişilemez, ${internal.length} yalnız-içeride.`);
}
