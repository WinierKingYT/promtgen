import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { PRODUCTION_ROOTS as PRODUCTION_ROOT_PATHS } from '../src/v4/source-boundaries.js';
import {
  DOC_SCAN_ROOTS,
  TIER2_DOC_RATCHET,
  TIER2_RATCHET,
  type DocScanRoot,
  type ProductModelRatchetEntry
} from './lib/product-model-ratchet.js';

/**
 * Ürün modeli kapısı — depo bırakılan modele sessizce geri kayamaz.
 *
 * Kök `CLAUDE.md` canonical yaşam döngüsünü yazıyor:
 * `Fikir Tasarımı → Çözüm Tasarımı → Uygulama Planı → Agent Devri`.
 * Ama bir ajana "unutma" demek, unutmayı yasaklayan bir kapıdan zayıftır.
 * `0b492fc` (uyumluluk sınırı) aynı dersi bir kez öğretti: düzyazı bir sonraki
 * ajanı durdurmuyor.
 *
 * ════════════════════════════════════════════════════════════════════════
 * İKİ KADEME — ve ikisi bilerek farklı sertlikte.
 * ════════════════════════════════════════════════════════════════════════
 *
 * **Kademe 1 — sert yasak.** Bırakılmış yaşam döngüsü sabitleri
 * (`MVP_DEFINED`, `IDEA_CAPTURED`, … `EXPORTED`), eski akış ifadesi
 * (`Fikir → MVP`, `Idea → MVP`) ve eski planlayıcı kimliği
 * (`promtgen-focused-planner`). Bunların üretimde meşru bir geleceği yoktur.
 * Ölçüldü (2026-09-05, `ec0f525`): üretim kökünde **tek bir dosyada** geçiyorlar
 * — `src/v4/migrations.js`, `PHASE_MAP` göç tablosu. Muafiyet listesinde tek
 * giriş odur ve gerekçesi girişin yanında yazılıdır.
 *
 * **Kademe 2 — cırcır (ratchet), muafiyet DEĞİL.** İki yüzeyi vardır: üretim
 * kaynağı (`PRODUCTION_ROOTS`) ve **belgeler** (`DOC_SCAN_ROOTS`). Mekanizma
 * tek: dosya başına sayım defterlenir, büyüme reddedilir, küçülme elle işlenir.
 * Belge yüzeyi V3-09'da eklendi ve gerekçesi ölçümdür: o pakete kadar
 * `README.md`, `docs/product/ROADMAP.md` ve `docs/product/FEATURE_FREEZE.md`
 * bırakılan modeli anlatıyordu ve hiçbir kapı bunu görmüyordu. Ayrıntı ve
 * "neden dizin taraması, neden açık liste değil" için
 * `scripts/lib/product-model-ratchet.ts` içindeki belge cırcırı başlığına
 * bakın.
 *
 * Kademe 1 belgelere UYGULANMAZ ve bu bilinçlidir: `FEATURE_FREEZE.md`
 * içindeki tarihli karar kaydı eski akış ifadesini (`Fikir → MVP → Plan`)
 * bırakıldığını anlatmak için taşır. Sert yasak orayı düşürür ve denetim izini
 * silmeye zorlardı.
 *
 * Çıplak `MVP` kelimesi Kademe 1 gibi yasaklanamaz; kuralın kendisi bunu
 * söylüyor: *"MVP kavramı yasak değildir … yasak olan, MVP'nin PromtGen'in
 * evrensel yaşam döngüsü aşaması olmasıdır."* Ölçülen (2026-09-08): üretimde
 * 23 dosyada 51 geçiş, belgelerde 21 dosyada 106 geçiş. Hepsini yasaklamak ya
 * derlemeyi düşürürdü ya da kırk küsur girişlik, zamanla çöp tenekesine
 * dönecek bir muafiyet listesi doğururdu. Bunun yerine dosya başına sayım
 * `scripts/lib/product-model-ratchet.ts` içinde defterlenir ve kapı yalnız
 * **büyümeyi** reddeder. Emsal: `benchmarks/reachability/baseline.json`.
 *
 * ════════════════════════════════════════════════════════════════════════
 * ALINAN KARARLAR — hepsi bilinçli, hiçbiri varsayılan değil.
 * ════════════════════════════════════════════════════════════════════════
 *
 * **1. Uzantı filtresi YOK; `.d.ts` KAPSAM İÇİNDE.**
 * Bu depo `.ts`, `.tsx`, `.js` ve `.d.ts` karıştırır (ölçüldü: 201 dosya —
 * 146 `.ts` (2'si `.d.ts`), 34 `.tsx`, 20 `.js`, 1 `.css`). Filtreli tarama
 * eksik bakar ve sessizce "temiz" der. `.d.ts` özellikle kapsam içindedir:
 * bu depoda `.d.ts` yan dosyaları uygulamayı `tsc`'den gizleyebiliyor; tam da
 * derleyicinin görmediği yer, bir kapının körleşmemesi gereken yerdir.
 *
 * **2. Yorumlar SAYILIR.**
 * `check-legacy-boundary.ts` yorum satırlarını maskeler ve haklıdır: yoruma
 * alınmış bir `import` gerçek bir derleme bağımlılığı değildir. Burada tersi
 * geçerlidir. Kademe 2'nin varlık sebebi **geri sızan çerçeveyi** yakalamaktır
 * ve eski modeli yeniden anlatan bir yorum, deponun bir sonraki ajana yanlış
 * modeli öğretmesidir — çalışan koddan daha sinsi bir biçimde, çünkü hiçbir
 * test onu düşürmez. Dize içi geçişler de aynı sebeple sayılır: kullanıcıya
 * görünen metnin çoğu zaten bir dizedir.
 *
 * **3. `product-contract.ts` kapsam DIŞI, `product-documentation.ts` DEĞİL.**
 * Kuralı söylemek kuralı çiğnemek değildir. `src/v4/product/product-contract.ts`
 * kuralın YAZILDIĞI yerdir (`mvpRule`, `mistakenIdentities`); altı geçişinin
 * altısı da kuralın kendi metnidir, bu yüzden her iki kademeden de muaftır.
 *
 * `product-documentation.ts` ise **muaf tutulmadı** ve bu, görevin tarifinden
 * bilinçli bir sapmaydı. Ölçüldüğünde beş geçişin yalnız ikisi kuralı anlatan
 * yorumdu; üçü eski `MVP_SCOPE.md` üreticisinin kendi gömülü metniydi. Envanter
 * bunu DOC-06 diye adlandırıp *"kapı yeşil kalırken yasaklanan modeli ilan eden
 * tek yer"* diyor (`docs/LEGACY_MODEL_INVENTORY.md` §3). Dosyayı toptan muaf
 * tutmak, kapının tam da envanterin işaret ettiği kör noktayı kutsaması olurdu.
 * Muaf tutulmadığı için borç görünür kaldı ve V3-09'da kapandı: belge
 * `CORE_SCOPE.md` oldu, üç cümle sözleşmeye bağlandı, defter 5 → 2 düştü.
 * Kalan iki geçiş kuralın kendi anlatısıdır.
 *
 * Yalnız **eski akış ifadesi** için ikisi de muaftır: `Fikir → MVP → Görevler`
 * cümlesi o iki dosyada modeli ilan etmek için değil, **bırakıldığını söylemek**
 * için geçer. Yaşam döngüsü SABİTLERİ muafiyeti ise ikisini de kapsamaz —
 * bir düzyazının içinde `MVP_DEFINED` yazmanın meşru bir gerekçesi yoktur.
 *
 * **4. Küçülme kapıyı düşürür, ama hata değildir.**
 * Bir dosyanın sayısı azaldığında kapı ilerlemeyi rapor eder ve defterin
 * güncellenmesini ister — düşürerek. Kapı defteri KENDİ YAZMAZ: kendi taban
 * çizgisini yazan bir kapı kendini yeşile boyayabilir ve küçülme kod
 * incelemesinde görünmez olurdu. `check-module-reachability.ts` aynı gerekçeyle
 * aynı şeyi söylüyor: *"taban çizgisi yalnız küçülerek değişir ve bu değişiklik
 * göze görünmelidir."* Kapı, yapıştırılacak satırı hazır yazar.
 */

const REPO_ROOT = path.resolve('.');

/**
 * Üretim kökleri — burada TANIMLANMAZ, `src/v4/source-boundaries.ts`'ten okunur.
 * O sabitin tek ev olmasının sebebi tam olarak budur (bkz. dosya başlığı,
 * `16abc11`): iki kopya, birini değiştirip diğerini unutmanın yoluydu.
 */
const PRODUCTION_ROOTS = PRODUCTION_ROOT_PATHS.map(root => path.resolve(root));

/**
 * KADEME 1 — bırakılmış yaşam döngüsü sabitleri.
 *
 * `\b…\b` sınırı kasıtlı: `EXPORTED` ile `READY_FOR_EXPORT` ayrı maddelerdir ve
 * `_` bir kelime karakteri olduğu için `MVP_DEFINED` çıplak `MVP` sayımına
 * (Kademe 2) sızmaz. İki kademe aynı karakteri iki kez saymaz.
 */
const LEGACY_STAGE_TOKENS = [
  'MVP_DEFINED', 'IDEA_CAPTURED', 'PROFILE_DRAFTED', 'PROJECT_PROFILED',
  'DISCOVERY_IN_PROGRESS', 'OBJECTIVES_DEFINED', 'SCOPE_DEFINED', 'DELIVERABLES_DEFINED',
  'REQUIREMENTS_DRAFTED', 'TECH_OPTIONS_READY', 'TECH_STACK_SELECTED', 'ARCHITECTURE_DRAFTED',
  'TASKS_DRAFTED', 'AGENT_PACKAGE_DRAFTED', 'EXECUTION_PLAN_DRAFTED', 'REVIEW_IN_PROGRESS',
  'READY_FOR_EXPORT', 'EXPORTED', 'promtgen-focused-planner'
] as const;

const LEGACY_STAGE_PATTERN = new RegExp(`\\b(?:${LEGACY_STAGE_TOKENS.join('|')})\\b`, 'g');

/**
 * KADEME 1 — eski akış ifadesi.
 *
 * Ok karakterinin dört yazımı da yakalanır (`→`, `->`, `=>`, `›`); yalnız
 * `→` aranırsa bir sonraki yazan ASCII oku kullanır ve kapı sessiz kalır.
 * Büyük/küçük harfe duyarlıdır: `Fikir`/`Idea` özel adlar gibi kullanılıyor ve
 * duyarsız arama `idea` değişken adlarını yanlış işaretlerdi.
 */
const LEGACY_FLOW_PATTERN = /\b(?:Idea|Fikir)\s*(?:→|->|=>|›)\s*MVP\b/g;

/** KADEME 2 — çıplak kelime. Kuralın kendisi bunu yasaklamaz; cırcır yalnız büyümeyi yasaklar. */
const BARE_MVP_PATTERN = /\bMVP\b/g;

/**
 * KADEME 1 muafiyet listesi — TEK giriş, gerekçesi yanında.
 *
 * `src/v4/migrations.js` eski kayıt dosyalarını içe aktarır; `PHASE_MAP` eski
 * literalleri BİLMEK ZORUNDADIR, yoksa kullanıcının diskteki projesi açılmaz.
 * Bu bir borç değil, göç sözleşmesidir.
 *
 * `hits` alanı muafiyeti bir cırcıra çevirir: dosya yeni eski-model çerçevesi
 * kazanırsa sayı değişir ve kapı düşer. Aynı alan kapının **kendi kanaryası**dır
 * — bkz. aşağıdaki öz denetim.
 */
const TIER1_ALLOWLIST = [
  {
    file: 'src/v4/migrations.js',
    hits: 19,
    reason:
      'PHASE_MAP göç tablosu. Eski kayıt dosyalarını içe aktarmak için eski aşama '
      + 'literallerini bilmek zorundadır; silinirse kullanıcının diskteki projesi açılmaz.'
  }
] as const;

/**
 * Kural METNİNİN yazıldığı dosyalar — yalnız eski AKIŞ İFADESİ için muaf.
 *
 * `Fikir → MVP → Görevler` cümlesi bu iki dosyada modeli ilan etmek için değil,
 * bırakıldığını söylemek için geçer. Yaşam döngüsü sabitleri bu muafiyetin
 * dışındadır.
 */
const FLOW_PHRASE_EXEMPT_FILES: readonly string[] = [
  'src/v4/product/product-contract.ts',
  'src/v4/product/product-documentation.ts'
];

/**
 * KADEME 2 kapsam dışı — tek dosya.
 *
 * Kuralın canonical evi. Altı geçişin altısı da `mvpRule` / `mistakenIdentities`
 * metnidir; saymak, depoyu kuralı söylediği için cezalandırmak olurdu.
 * `product-documentation.ts` bilerek BURADA DEĞİL — gerekçe dosya başlığında (3).
 */
const TIER2_EXEMPT_FILES: readonly string[] = [
  'src/v4/product/product-contract.ts'
];

/**
 * FAIL-LOUD ÖZ DENETİMİ — `check-module-reachability.ts:32-35` emsali:
 * *"Tarama bozulursa boş sonuç dönerdi ve kapı sessizce yeşil verirdi."*
 *
 * Burada iki ayrı koruma var ve ikincisi daha güçlü olanı:
 *
 * 1. Dosya sayısı eşiği — yürüyüş bozulursa yakalar. Ölçülen 201; eşik ~%80.
 * 2. **Kanarya:** muafiyet listesindeki dosya beklenen Kademe 1 isabetini
 *    vermek ZORUNDADIR. Bu, her koşuda gerçek regex yolunu bilinen bir
 *    pozitife karşı çalıştırır. Kalıp bozulursa sıfır isabet döner, sıfır ihlal
 *    çıkar ve kapı "üretim temiz" derdi. Kanarya tam olarak bunu imkânsız kılar.
 *    (Yalnız dosya sayısı saymak yetmezdi: dolu bir tarama + bozuk bir regex
 *    yine sessizce yeşil verirdi.)
 */
const MINIMUM_EXPECTED_FILES = 160;

/**
 * Belge yüzeyinin aynı korumaları.
 *
 * Eşik: ölçülen 69 `.md`; ~%80'i. Kanaryaya ayrıca ihtiyaç yoktur çünkü belge
 * defteri kendisi kanaryadır: `docs/LEGACY_MODEL_INVENTORY.md` 28 geçiş vermek
 * ZORUNDADIR. Kalıp bozulursa sıfır ölçülür, "küçüldü" yolu tetiklenir ve kapı
 * düşer. Yine de eşik ayrı durur; bozuk bir yürüyüş "ilerleme" gibi görünmesin,
 * ekranda TARAMA BOZUK yazsın diye.
 */
const MINIMUM_EXPECTED_DOC_FILES = 55;

interface Hit {
  readonly file: string;
  readonly line: number;
  readonly text: string;
  readonly token: string;
}

/** Uzantı filtresi YOK — üretim kökünün altındaki her dosya taranır. */
function collectFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current)) {
      const full = path.join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(root);
  return files;
}

/**
 * Belge yüzeyi — burada uzantı filtresi VAR ve gerekçesi üretim tarafının
 * tersidir. Orada her dosya ürün davranışının kaynağıdır; burada kök dizinler
 * kodun, verinin ve üretilen ağaçların yanında durur. Taranan şey deponun
 * okunan metnidir, o da `.md`'dir.
 */
function collectMarkdown(root: DocScanRoot): string[] {
  const files: string[] = [];
  const walk = (current: string, recursive: boolean) => {
    for (const entry of readdirSync(current)) {
      const full = path.join(current, entry);
      if (statSync(full).isDirectory()) {
        if (recursive) walk(full, true);
      } else if (full.endsWith('.md')) {
        files.push(full);
      }
    }
  };
  walk(path.resolve(root.dir), root.recursive);
  return files;
}

const relative = (target: string) => path.relative(REPO_ROOT, target).split(path.sep).join('/');

interface RatchetVerdict {
  readonly grown: string[];
  readonly shrunk: string[];
  readonly measuredTotal: number;
  readonly baselineTotal: number;
}

/**
 * Ölçümü deftere karşı okur. İki yüzey de aynı fonksiyonu çağırır: kural bir
 * kez yazılır, iki defter aynı anlama gelir.
 */
function compareToLedger(
  measured: ReadonlyMap<string, number>,
  ledger: readonly ProductModelRatchetEntry[]
): RatchetVerdict {
  const baseline = new Map(ledger.map(entry => [entry.file, entry]));
  const grown: string[] = [];
  const shrunk: string[] = [];

  for (const [file, count] of [...measured].sort()) {
    const entry = baseline.get(file);
    if (!entry) grown.push(`  YENİ  ${file}  ${count} geçiş  (defterde yok)`);
    else if (count > entry.count) grown.push(`  ARTTI ${file}  ${entry.count} → ${count}`);
    else if (count < entry.count) shrunk.push(`  ${file}  ${entry.count} → ${count}  (sahip: ${entry.owner})`);
  }
  for (const entry of ledger) {
    if (!measured.has(entry.file)) {
      shrunk.push(`  ${entry.file}  ${entry.count} → 0  (sahip: ${entry.owner}) — satır tamamen silinebilir`);
    }
  }

  return {
    grown,
    shrunk,
    measuredTotal: [...measured.values()].reduce((sum, count) => sum + count, 0),
    baselineTotal: ledger.reduce((sum, entry) => sum + entry.count, 0)
  };
}

/** Yorum maskelemesi YOK — gerekçe dosya başlığında (2). Satır satır gezilir ki `file:line` bedavaya gelsin. */
function scan(file: string, source: string, pattern: RegExp): Hit[] {
  const hits: Hit[] = [];
  const lines = source.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    pattern.lastIndex = 0;
    for (const match of lines[index].matchAll(pattern)) {
      hits.push({ file, line: index + 1, text: lines[index].trim(), token: match[0] });
    }
  }
  return hits;
}

const files = PRODUCTION_ROOTS.flatMap(collectFiles).sort();

if (files.length < MINIMUM_EXPECTED_FILES) {
  console.error(
    `Tarama yalnız ${files.length} üretim dosyası buldu; en az ${MINIMUM_EXPECTED_FILES} bekleniyordu. `
    + 'Kod temiz değil — TARAMA BOZUK. Dosya toplama adımını kontrol edin.'
  );
  process.exit(1);
}

const sources = new Map(files.map(file => [file, readFileSync(file, 'utf8')]));

// ── Kademe 1 ────────────────────────────────────────────────────────────────
/** `Set<string>` bilerek: `as const` liste değişmez literal tip üretiyor ve `.has(string)` derlenmezdi. */
const allowedFiles = new Set<string>(TIER1_ALLOWLIST.map(entry => entry.file));
const tier1ByFile = new Map<string, Hit[]>();

for (const [file, source] of sources) {
  const name = relative(file);
  const hits = [
    ...scan(name, source, LEGACY_STAGE_PATTERN),
    ...(FLOW_PHRASE_EXEMPT_FILES.includes(name) ? [] : scan(name, source, LEGACY_FLOW_PATTERN))
  ].sort((left, right) => left.line - right.line);
  if (hits.length) tier1ByFile.set(name, hits);
}

const problems: string[] = [];

/** Kanarya — regex yolunun kendisini bilinen bir pozitife karşı doğrular. */
for (const entry of TIER1_ALLOWLIST) {
  const actual = tier1ByFile.get(entry.file)?.length ?? 0;
  if (actual === entry.hits) continue;
  if (actual === 0) {
    console.error(
      `KANARYA DÜŞTÜ: ${entry.file} içinde ${entry.hits} Kademe 1 isabeti bekleniyordu, hiç bulunamadı. `
      + 'Kod temiz değil — TARAMA BOZUK. Kalıpları kontrol edin.'
    );
    process.exit(1);
  }
  problems.push(
    `Muaf dosya ${entry.file} ${actual} Kademe 1 isabeti taşıyor, ${entry.hits} bekleniyordu. `
    + 'Muafiyet göç tablosunun BUGÜNKÜ hâli içindir; tabloya eski model eklenmez. '
    + 'Gerçekten meşruysa TIER1_ALLOWLIST içindeki `hits` düşürülmeli/yükseltilmeli ve gerekçesi yazılmalıdır.'
  );
}

const tier1Violations = [...tier1ByFile].filter(([file]) => !allowedFiles.has(file));

if (tier1Violations.length) {
  const total = tier1Violations.reduce((sum, [, hits]) => sum + hits.length, 0);
  problems.push(`KADEME 1 — bırakılmış model sabitleri üretimde: ${total} isabet, ${tier1Violations.length} dosya.`);
  for (const [file, hits] of tier1Violations) {
    for (const hit of hits) problems.push(`  ${file}:${hit.line}  '${hit.token}'  ${hit.text.slice(0, 110)}`);
  }
  problems.push(
    '  Çözüm muafiyet eklemek değildir: canonical yaşam döngüsü '
    + '`idea → solution → plan → handoff`. Tek meşru istisna göç tablosudur.'
  );
}

// ── Kademe 2 ────────────────────────────────────────────────────────────────
const measured = new Map<string, number>();
for (const [file, source] of sources) {
  const name = relative(file);
  if (TIER2_EXEMPT_FILES.includes(name)) continue;
  const count = (source.match(BARE_MVP_PATTERN) ?? []).length;
  if (count) measured.set(name, count);
}

const { grown, shrunk, measuredTotal, baselineTotal } = compareToLedger(measured, TIER2_RATCHET);

if (grown.length) {
  problems.push(
    `KADEME 2 — eski model çerçevesi BÜYÜDÜ: toplam ${baselineTotal} → ${measuredTotal}.`,
    ...grown,
    '  Cırcır yalnız küçülür. Yeni çıplak `MVP` metni üretime eklenmez; '
    + 'bir projenin kendi kapsamını MVP diye adlandırması meşrudur, PromtGen\'in her fikre MVP çerçevesi dayatması değildir.'
  );
}

if (shrunk.length) {
  problems.push(
    `KADEME 2 — İLERLEME: toplam ${baselineTotal} → ${measuredTotal}. Defter düşürülmeli.`,
    ...shrunk,
    '  `scripts/lib/product-model-ratchet.ts` içindeki `TIER2_RATCHET` sayılarını elle güncelleyin. '
    + 'Kapı defteri kendi yazmaz: küçülme kod incelemesinde GÖRÜNMELİDİR.'
  );
}

// ── Kademe 2 · belgeler ─────────────────────────────────────────────────────
const docFiles = DOC_SCAN_ROOTS.flatMap(collectMarkdown).sort();

if (docFiles.length < MINIMUM_EXPECTED_DOC_FILES) {
  console.error(
    `Belge taraması yalnız ${docFiles.length} '.md' buldu; en az ${MINIMUM_EXPECTED_DOC_FILES} bekleniyordu. `
    + 'Belgeler temiz değil — TARAMA BOZUK. `DOC_SCAN_ROOTS` ve dosya toplama adımını kontrol edin.'
  );
  process.exit(1);
}

const measuredDocs = new Map<string, number>();
for (const file of docFiles) {
  const count = (readFileSync(file, 'utf8').match(BARE_MVP_PATTERN) ?? []).length;
  if (count) measuredDocs.set(relative(file), count);
}

const docVerdict = compareToLedger(measuredDocs, TIER2_DOC_RATCHET);

if (docVerdict.grown.length) {
  problems.push(
    `KADEME 2 (BELGELER) — eski model çerçevesi BÜYÜDÜ: toplam ${docVerdict.baselineTotal} → ${docVerdict.measuredTotal}.`,
    ...docVerdict.grown,
    '  Bakımdaki bir belge bırakılan modele geri dönemez. Yeni bir tarihsel kayıt '
    + 'ekleniyorsa satırı `TIER2_DOC_RATCHET` içine `owner: \'PRESERVE_LEGACY\'` ve gerekçesiyle yazılır.'
  );
}

if (docVerdict.shrunk.length) {
  problems.push(
    `KADEME 2 (BELGELER) — İLERLEME: toplam ${docVerdict.baselineTotal} → ${docVerdict.measuredTotal}. Defter düşürülmeli.`,
    ...docVerdict.shrunk,
    '  `scripts/lib/product-model-ratchet.ts` içindeki `TIER2_DOC_RATCHET` sayılarını elle güncelleyin. '
    + '`PRESERVE_LEGACY` satırlarının düşmesi beklenen bir ilerleme DEĞİLDİR: '
    + 'düştüyse bir denetim izi silinmiş olabilir, önce onu doğrulayın.'
  );
}

if (problems.length) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}

console.log(
  `Ürün modeli doğrulandı: ${files.length} üretim dosyası tarandı (uzantı filtresi yok, .d.ts dahil).\n`
  + `  Kademe 1 — bırakılmış yaşam döngüsü sabitleri: 0 ihlal `
  + `(${TIER1_ALLOWLIST.length} muaf dosya, ${TIER1_ALLOWLIST.reduce((sum, entry) => sum + entry.hits, 0)} isabet kanaryayı doğruladı).\n`
  + `  Kademe 2 — çıplak 'MVP' cırcırı (üretim): ${measuredTotal} geçiş / ${measured.size} dosya, `
  + `taban çizgisi ${baselineTotal} / ${TIER2_RATCHET.length}. Büyüme yok.\n`
  + `  Kademe 2 — çıplak 'MVP' cırcırı (belgeler): ${docVerdict.measuredTotal} geçiş / ${measuredDocs.size} dosya `
  + `(${docFiles.length} '.md' tarandı), taban çizgisi ${docVerdict.baselineTotal} / ${TIER2_DOC_RATCHET.length}. Büyüme yok.`
);
