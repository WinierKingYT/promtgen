import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { PRODUCTION_ROOTS as PRODUCTION_ROOT_PATHS } from '../src/v4/source-boundaries.js';

/**
 * Yaşam döngüsü sözlüğü kapısı — INV-V3-01'i uygulayan mekanizma.
 *
 * ════════════════════════════════════════════════════════════════════════
 * DEĞİŞMEZ (INV-V3-01)
 * ════════════════════════════════════════════════════════════════════════
 *
 * > PromtGen'in tam olarak dört ürün aşaması vardır: `idea`, `solution`,
 * > `plan`, `handoff`. Bir aşamanın kendi içinde alt durumları olabilir.
 * > **Beşinci bir üst düzey yaşam döngüsü sözlüğü olamaz.** `PlanningPhase`
 * > göç dönemi köprüsü olarak **dondurulmuştur**: değer kazanamaz, yeni
 * > yazıcı kazanamaz.
 *
 * ════════════════════════════════════════════════════════════════════════
 * NEDEN DONDURMA, NEDEN SİLME DEĞİL — ölçümler (2026-09-08, `193b22d`)
 * ════════════════════════════════════════════════════════════════════════
 *
 * **1. Bu kodun ürettiği belgeler için enum hiçbir iş yapmıyor.** Üretimdeki
 * tek karar noktası `application/idea-guide-service.ts:84`:
 * `status === 'finalized' || activePhase === 'READY'`. `finalizePlan`
 * (`planning-engine.ts:557-558`) ikisini BİRLİKTE set eder; yani bu kodun
 * ürettiği her belge için ikinci koşul gereksizdir.
 *
 * **2. Ama göç eden belgeler için gereksiz DEĞİL.** `migrations.js:48-50`
 * `READY_FOR_EXPORT → 'READY'` eşlemesini yaparken `status` alanını `active`
 * bırakır (yalnız `EXPORTED` ayrıca `finalized` yazar). O ikinci koşul
 * bilinçli bir göç uyumluluğudur; silinirse diskteki eski bir proje
 * "tamamlanmamış" görünür.
 *
 * **3. `SuggestionBundle.phase` yazılıyor, hiç okunmuyor.** Dört yerde
 * `activePhase`'ten damgalanır (`planning-engine.ts:385`,
 * `idea-expansion-intake.ts:40`, `plan-code-alignment.ts:367`,
 * `deterministic-idea-planning.ts:137`) ve üretimde tek okuyucusu yoktur.
 * Kalıcı bir alan olduğu için silinmedi; bildirimine ölçüm tarihli bir not
 * yazıldı (`contracts.ts`).
 *
 * Silmek, tek canlı kararı eski içe aktarmalara hizmet eden bir alanı emekli
 * etmek için diskteki HER belgeye veri göçü demekti. Dondurmak bedava ve
 * değişmezi uygulanabilir kılıyor.
 *
 * ════════════════════════════════════════════════════════════════════════
 * NEDEN AYRI BETİK, `check-product-model.ts`'e EK DEĞİL
 * ════════════════════════════════════════════════════════════════════════
 *
 * O kapı **bırakılmış model kelimelerini** metinde sayar: iki kademeli, iki
 * yüzeyli (üretim + belgeler), çıktısı bir sözcük defteridir. Bu kapı ise
 * **yapısal** bir değişmezi doğrular: bir kümenin üyeliği, bir enum'un
 * genişliği ve bir alanın yazıcı kümesi. Aynı dosyada yaşasalardı tek bir
 * betiğin iki ilgisiz başarısızlık sözlüğü olurdu ve 455 satırlık dosya
 * büyümeye devam ederdi. Depo zaten "bir kapı, bir kural" ile yazılmış
 * (`check-legacy-boundary`, `check-duplicate-modules`,
 * `check-module-reachability`); bu betik o deseni sürdürüyor.
 *
 * Ortak olan tek şey üretim kökleridir ve o **yeniden bildirilmiyor**:
 * `src/v4/source-boundaries.ts` dosyasından okunuyor (`16abc11`'in dersi).
 *
 * ════════════════════════════════════════════════════════════════════════
 * KAPININ SINIRI — dürüstçe
 * ════════════════════════════════════════════════════════════════════════
 *
 * "Beşinci bir sözlük" keyfî biçimde tespit edilemez; hiçbir kalıp yarın
 * yazılacak `type DeliveryPhase` gibi bir şeyi kendiliğinden bilemez. Kapı
 * bugün ölçülmüş üç yüzeyi kilitler: canonical küme, dondurulmuş enum ve
 * `activePhase` yazıcıları. Sözlük sayısının kendisi bir insan kararıdır ve
 * kaydı `docs/LEGACY_MODEL_INVENTORY.md` §2 ile §10'dadır.
 */

const REPO_ROOT = path.resolve('.');

/**
 * Üretim kökleri — burada TANIMLANMAZ. Bkz. `src/v4/source-boundaries.ts`
 * dosya başlığı: iki kopya, birini değiştirip diğerini unutmanın yoluydu.
 */
const PRODUCTION_ROOTS = PRODUCTION_ROOT_PATHS.map(root => path.resolve(root));

/**
 * DONDURULMUŞ 1 — canonical aşama kümesi.
 *
 * Beklenti burada, denetlenen dosyada değil. Kapı ölçtüğü şeyden beklentisini
 * okusaydı kendi kendini doğrular, yani hiçbir şeyi doğrulamazdı.
 *
 * Sıra da dondurulmuştur: `PROJECT_STAGES` bir ilerleme dizisidir ve
 * `handoff` değerini ikinci sıraya almak sessiz bir davranış değişikliği olurdu.
 */
const FROZEN_PROJECT_STAGES = ['idea', 'solution', 'plan', 'handoff'] as const;

/**
 * DONDURULMUŞ 2 — `PlanningPhase` değerlerinin dokuzu.
 *
 * Yalnız sayı değil, değerlerin kendisi de donduruldu: bir değeri yeniden
 * adlandırmak da (`READY` → `HANDOFF_READY`) göç tablosunu ve
 * `idea-guide-service.ts:84` satırını sessizce bozardı. Sayı ayrıca
 * raporlanır, çünkü değişmezin cümlesi "dokuzda dondu" diyor.
 */
const FROZEN_PLANNING_PHASES = [
  'IDEA_EXPANSION', 'DISCOVERY', 'IDEA_LAB', 'CONCEPT_CONFIRMATION',
  'SHAPING', 'DESIGN', 'PLANNING', 'REVIEW', 'READY'
] as const;

interface DeclarationSite {
  /** Depo köküne göre POSIX yol. */
  readonly file: string;
  /** Bildirimi eşleyen kalıp; `file:line` bundan hesaplanır. */
  readonly pattern: RegExp;
  /** Hata metninde geçecek insan adı. */
  readonly label: string;
}

const PROJECT_STAGES_CONST: DeclarationSite = {
  file: 'src/v4/application/project-stages.ts',
  pattern: /export const PROJECT_STAGES\b[^=]*=\s*\[[^\]]*\]/,
  label: 'PROJECT_STAGES sabiti'
};

const PROJECT_STAGE_TYPE: DeclarationSite = {
  file: 'src/v4/contracts.ts',
  pattern: /export type ProjectStage\s*=[^\n]*/,
  label: 'ProjectStage tipi'
};

const PLANNING_PHASE_TYPE: DeclarationSite = {
  file: 'src/v4/contracts.ts',
  pattern: /export type PlanningPhase\s*=[^\n]*/,
  label: 'PlanningPhase tipi'
};

interface WriterEntry {
  readonly file: string;
  readonly sites: number;
  readonly reason: string;
}

/**
 * DONDURULMUŞ 3 — `lifecycle.activePhase` yazıcıları.
 *
 * Ölçüm (2026-09-08, `193b22d`): 201 üretim dosyasında 8 dosya, 13 konum.
 * Görev tarifi 5 dosya / 8 konum hatırlıyordu; ölçüm onu düzeltti — fark
 * `contracts.ts` (bildirim), `project-document.ts` (tohum),
 * `canonical-export-core.ts` (dışa aktarım) ve `planning-engine.ts` içinde
 * hatırlanandan iki fazla konumdur.
 *
 * `sites` alanı listeyi cırcıra çevirir: dosya yeni bir yazıcı kazanırsa sayı
 * değişir ve kapı düşer. Aynı alan kapının **kanaryası**dır (aşağıya bakın):
 * bozuk bir kalıp sıfır ölçer ve sıfır ihlal üretirdi.
 *
 * Okumalar kapsam dışıdır ve bu bilinçlidir. Değişmez "yeni yazıcı" diyor;
 * alanı okumak yeni bir sözlük doğurmaz, ona yeni bir kaynak yazmak doğurur.
 */
const FROZEN_WRITERS: readonly WriterEntry[] = [
  {
    file: 'src/v4/contracts.ts',
    sites: 1,
    reason:
      'Alanın kendi bildirimi (`ProjectLifecycle.activePhase`). Yazıcı değil, ŞEKLİN KENDİSİ. '
      + 'Listede durmasının sebebi: ikinci bir bildirim, beşinci sözlüğün doğduğu andır.'
  },
  {
    file: 'src/v4/project-document.ts',
    sites: 1,
    reason:
      '`createProjectDocument` yeni belgeyi `DISCOVERY` ile tohumlar. Alanın tek başlangıç noktası.'
  },
  {
    file: 'src/v4/planning-engine.ts',
    sites: 6,
    reason:
      'Canonical motor: fikir genişletme → DISCOVERY, paket uygulama → `inferNextPhase`, '
      + 'finalize → READY, yeniden açma → SHAPING, anlık görüntüye dönüş, konsept onayı → SHAPING.'
  },
  {
    file: 'src/v4/migrations.js',
    sites: 1,
    reason:
      'Göç köprüsü. `READY_FOR_EXPORT → READY` eşlemesi `status` alanını `active` bırakır; '
      + '`idea-guide-service.ts:84` satırındaki ikinci koşulu GEREKLİ kılan tek yer burasıdır.'
  },
  {
    file: 'src/v4/application/deterministic-idea-planning.ts',
    sites: 1,
    reason: 'Konsept onayı akışı `CONCEPT_CONFIRMATION` yazar.'
  },
  {
    file: 'src/v4/application/idea-lab-generation-service.ts',
    sites: 1,
    reason: 'Fikir aşamasındaki belgeye `IDEA_LAB` yazar; koşulu `currentStage(next) === idea`.'
  },
  {
    file: 'src/v4/application/canonical-export-core.ts',
    sites: 1,
    reason:
      'Dışa aktarılan belgeye kopyalar. `ProjectDocument` üzerine yazmaz ama alanın dış dünyaya '
      + 'çıktığı yerdir; yeni bir tüketici doğarsa burada görünür.'
  },
  {
    file: 'src/v4/domain/services/project-creation.ts',
    sites: 1,
    reason:
      '`routing.phase` yazar. ÜRETİMDE ÇAĞIRANI YOKTUR: `routeIdea` ve '
      + '`createCanonicalProjectInstance` yalnız `tests/v4/**` içinden çağrılır (ölçüldü 2026-09-08). '
      + 'Sessizce düşürülmedi — ölü olduğu KAYITLI kalsın diye burada duruyor.'
  }
];

/**
 * FAIL-LOUD ÖZ DENETİMİ — `check-module-reachability.ts:32-35` emsali:
 * *"Tarama bozulursa boş sonuç dönerdi ve kapı sessizce yeşil verirdi."*
 *
 * Üç ayrı koruma:
 *
 *   1. **Dosya sayısı eşiği** — yürüyüş bozulursa yakalar. Ölçülen 201; eşik ~%80.
 *   2. **Yazıcı kanaryası** — toplam yazma isabeti SIFIR olamaz. Kalıp bozulursa
 *      sıfır isabet döner, sıfır ihlal çıkar ve kapı "üretim temiz" derdi.
 *      Yalnız dosya saymak yetmezdi: dolu tarama + bozuk regex yine yeşil verirdi.
 *   3. **Bildirim kanaryası** — üç bildirim de bulunmak ZORUNDADIR. Bulunamayan
 *      bir bildirim "sıfır üye ölçüldü" demektir; o da sessiz bir yeşildir.
 */
const MINIMUM_EXPECTED_FILES = 160;

/** Uzantı filtresi YOK — `.d.ts` ve `.js` dahil her üretim dosyası taranır. */
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

const relative = (target: string) => path.relative(REPO_ROOT, target).split(path.sep).join('/');

/**
 * `activePhase` YAZMA konumu — iki biçim, ikisi de gerçek yazmadır:
 *
 *   A) atama            `next.lifecycle.activePhase = …`  (`=(?!=)` ile `==`/`===` elenir)
 *   B) nesne/tip alanı  `{ …, activePhase: … }`           (yayılmış literal ve bildirim)
 *
 * B kalıbının önündeki `[^\w$.]` koruması bir OKUMAYI yanlışlıkla yazma
 * saymamak içindir: `phase: project.lifecycle.activePhase` satırında anahtar
 * `phase`, `activePhase` ise değerin sonundadır ve ardından `:` gelmez.
 */
const WRITE_PATTERNS: readonly RegExp[] = [
  /\.activePhase\s*=(?!=)/g,
  /(?:^|[^\w$.])activePhase\s*:/g
];

interface WriteHit {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

function scanWrites(name: string, source: string): WriteHit[] {
  const hits: WriteHit[] = [];
  const lines = source.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    for (const pattern of WRITE_PATTERNS) {
      pattern.lastIndex = 0;
      const found = lines[index].match(pattern);
      if (!found) continue;
      for (let repeat = 0; repeat < found.length; repeat += 1) {
        hits.push({ file: name, line: index + 1, text: lines[index].trim() });
      }
    }
  }
  return hits.sort((left, right) => left.line - right.line);
}

interface ParsedDeclaration {
  readonly line: number;
  readonly members: readonly string[];
}

/**
 * Bildirim satırındaki tek tırnaklı literalleri çıkarır.
 *
 * Hem `export type X = 'a' | 'b'` hem `export const X … = ['a', 'b'] as const`
 * aynı işi görür: ikisinin de anlamı bir literal kümesidir. Bildirim
 * bulunamazsa `null` döner ve çağıran TARAMA BOZUK ile düşer — sessizce
 * "0 üye" demez.
 */
function parseDeclaration(site: DeclarationSite): ParsedDeclaration | null {
  const source = readFileSync(path.resolve(site.file), 'utf8');
  const match = source.match(site.pattern);
  if (!match || match.index === undefined) return null;
  return {
    line: source.slice(0, match.index).split('\n').length,
    members: [...match[0].matchAll(/'([^']+)'/g)].map(literal => literal[1])
  };
}

function sameSequence(measured: readonly string[], frozen: readonly string[]): boolean {
  return measured.length === frozen.length && measured.every((value, index) => value === frozen[index]);
}

// ── Tarama ──────────────────────────────────────────────────────────────────
const files = PRODUCTION_ROOTS.flatMap(collectFiles).sort();

if (files.length < MINIMUM_EXPECTED_FILES) {
  console.error(
    `Tarama yalnız ${files.length} üretim dosyası buldu; en az ${MINIMUM_EXPECTED_FILES} bekleniyordu. `
    + 'Kod temiz değil — TARAMA BOZUK. Dosya toplama adımını kontrol edin.'
  );
  process.exit(1);
}

const problems: string[] = [];

// ── Kural 1 — canonical küme tam olarak dört üyedir ──────────────────────────
const stageConst = parseDeclaration(PROJECT_STAGES_CONST);
const stageType = parseDeclaration(PROJECT_STAGE_TYPE);
const phaseType = parseDeclaration(PLANNING_PHASE_TYPE);

for (const [site, parsed] of [
  [PROJECT_STAGES_CONST, stageConst],
  [PROJECT_STAGE_TYPE, stageType],
  [PLANNING_PHASE_TYPE, phaseType]
] as const) {
  if (parsed && parsed.members.length) continue;
  console.error(
    `${site.label} (${site.file}) bulunamadı ya da hiç üye vermedi. `
    + 'Sözlükler temiz değil — TARAMA BOZUK. Bildirim kalıplarını kontrol edin.'
  );
  process.exit(1);
}

// Yukarıdaki döngü üçünü de garanti eder; `strict` altında daraltma için tekrar bağlanır.
const stages = stageConst as ParsedDeclaration;
const stageTypeMembers = stageType as ParsedDeclaration;
const phases = phaseType as ParsedDeclaration;

if (!sameSequence(stages.members, FROZEN_PROJECT_STAGES)) {
  problems.push(
    `KURAL 1 — canonical aşama kümesi değişti: ${PROJECT_STAGES_CONST.file}:${stages.line}`,
    `  beklenen (${FROZEN_PROJECT_STAGES.length}): ${FROZEN_PROJECT_STAGES.join(' → ')}`,
    `  ölçülen  (${stages.members.length}): ${stages.members.join(' → ') || '(boş)'}`,
    '  PromtGen\'in dört ürün aşaması vardır. Bir aşamanın ALT DURUMU olabilir; beşinci bir '
    + 'üst düzey aşama olamaz. Çözüm kapıyı gevşetmek değil, yeni durumu mevcut bir aşamanın '
    + 'içine yerleştirmektir. Gerçekten beşinci aşama gerekiyorsa bu bir ÜRÜN KARARIDIR: '
    + 'önce `docs/LEGACY_MODEL_INVENTORY.md` §10 içine yazılır, sonra buradaki liste güncellenir.'
  );
}

if (!sameSequence(stageTypeMembers.members, FROZEN_PROJECT_STAGES)) {
  problems.push(
    `KURAL 1 — \`ProjectStage\` tipi sabitle uyuşmuyor: ${PROJECT_STAGE_TYPE.file}:${stageTypeMembers.line}`,
    `  beklenen (${FROZEN_PROJECT_STAGES.length}): ${FROZEN_PROJECT_STAGES.join(' | ')}`,
    `  ölçülen  (${stageTypeMembers.members.length}): ${stageTypeMembers.members.join(' | ') || '(boş)'}`,
    '  Tip ile sabit ayrışırsa küme iki farklı şey söyler; ikisi tek kelimeyle konuşmalıdır.'
  );
}

// ── Kural 2 — `PlanningPhase` dokuz değerde donduruldu ───────────────────────
if (!sameSequence(phases.members, FROZEN_PLANNING_PHASES)) {
  problems.push(
    `KURAL 2 — \`PlanningPhase\` DONDURULMUŞTUR, değişti: ${PLANNING_PHASE_TYPE.file}:${phases.line}`,
    `  beklenen ${FROZEN_PLANNING_PHASES.length} değer: ${FROZEN_PLANNING_PHASES.join(' | ')}`,
    `  ölçülen  ${phases.members.length} değer: ${phases.members.join(' | ') || '(boş)'}`,
    '  `PlanningPhase` göç dönemi köprüsüdür ve DEĞER KAZANAMAZ. Yeni bir aşama fikri '
    + 'canonical `ProjectStage` modelinde veya bir aşamanın alt durumunda ifade edilir. '
    + 'Çözüm buraya bir değer eklemek değildir: eklenen her değer '
    + '`application/project-stages.ts` içindeki `PHASE_TO_STAGE` tablosuna da girmek zorunda '
    + 'kalır ve köprü kapatılacağı yerde genişler.'
  );
}

// ── Kural 3 — `activePhase` yazıcı kümesi dondurulmuştur ─────────────────────
const measuredWrites = new Map<string, WriteHit[]>();
for (const file of files) {
  const name = relative(file);
  const hits = scanWrites(name, readFileSync(file, 'utf8'));
  if (hits.length) measuredWrites.set(name, hits);
}

const measuredWriteTotal = [...measuredWrites.values()].reduce((sum, hits) => sum + hits.length, 0);
const frozenTotal = FROZEN_WRITERS.reduce((sum, entry) => sum + entry.sites, 0);

/** Kanarya — bkz. öz denetim (2). Boş bir ölçüm "temiz" değil, bozuk taramadır. */
if (measuredWriteTotal === 0) {
  console.error(
    'KANARYA DÜŞTÜ: üretimde tek bir `activePhase` yazma konumu bulunamadı; '
    + `${frozenTotal} bekleniyordu. `
    + 'Kod temiz değil — TARAMA BOZUK. `WRITE_PATTERNS` kalıplarını kontrol edin.'
  );
  process.exit(1);
}

const frozenByFile = new Map(FROZEN_WRITERS.map(entry => [entry.file, entry]));
let writerGrowth = false;

for (const [file, hits] of [...measuredWrites].sort()) {
  const entry = frozenByFile.get(file);
  if (!entry) {
    writerGrowth = true;
    problems.push(
      `KURAL 3 — YENİ YAZICI: ${file} (${hits.length} konum, dondurulmuş listede yok)`,
      ...hits.map(hit => `    ${hit.file}:${hit.line}  ${hit.text.slice(0, 110)}`)
    );
    continue;
  }
  if (hits.length > entry.sites) {
    writerGrowth = true;
    problems.push(
      `KURAL 3 — YAZICI ARTTI: ${file}  ${entry.sites} → ${hits.length} konum`,
      ...hits.map(hit => `    ${hit.file}:${hit.line}  ${hit.text.slice(0, 110)}`)
    );
  } else if (hits.length < entry.sites) {
    problems.push(
      `KURAL 3 — İLERLEME: ${file}  ${entry.sites} → ${hits.length} konum. Defter düşürülmeli.`,
      `    Gerekçe kaydı: ${entry.reason}`,
      '    `FROZEN_WRITERS` içindeki `sites` sayısını ELLE güncelleyin. Kapı kendi defterini '
      + 'yazmaz: küçülme kod incelemesinde GÖRÜNMELİDİR.'
    );
  }
}

for (const entry of FROZEN_WRITERS) {
  if (measuredWrites.has(entry.file)) continue;
  problems.push(
    `KURAL 3 — İLERLEME: ${entry.file}  ${entry.sites} → 0 konum. Satır tamamen silinebilir.`,
    `    Gerekçe kaydı: ${entry.reason}`
  );
}

if (writerGrowth) {
  problems.push(
    '  `PlanningPhase` DONDURULMUŞTUR: yeni değer de alamaz, YENİ YAZICI da. Çözüm '
    + '`FROZEN_WRITERS` listesine muafiyet eklemek değildir — aşama ilerlemesi canonical '
    + '`ProjectStage` modelinde ifade edilir (`application/project-stages.ts`). '
    + 'Köprüye yeni bir kaynak yazmak, kapatılacak modeli büyütmektir.'
  );
}

if (problems.length) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}

console.log(
  `Yaşam döngüsü sözlüğü doğrulandı: ${files.length} üretim dosyası tarandı (uzantı filtresi yok, .d.ts dahil).\n`
  + `  KURAL 1 — canonical küme ${FROZEN_PROJECT_STAGES.length} üye: ${FROZEN_PROJECT_STAGES.join(' → ')} `
  + `(${PROJECT_STAGES_CONST.file}:${stages.line} sabiti ile `
  + `${PROJECT_STAGE_TYPE.file}:${stageTypeMembers.line} tipi aynı şeyi söylüyor).\n`
  + `  KURAL 2 — \`PlanningPhase\` ${phases.members.length} değerde DONDURULDU `
  + `(${PLANNING_PHASE_TYPE.file}:${phases.line}). Yeni değer yok.\n`
  + `  KURAL 3 — \`lifecycle.activePhase\` yazıcıları: ${measuredWriteTotal} konum / ${measuredWrites.size} dosya, `
  + `dondurulmuş taban ${frozenTotal} / ${FROZEN_WRITERS.length}. Yeni yazıcı yok (kanarya doğrulandı).`
);
