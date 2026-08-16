import { spawnSync } from 'node:child_process';

/**
 * Test paketlerini `&&` zinciri yerine tek tek koşturur ve hepsini koşup
 * sonunda özet basar.
 *
 * Neden: `npm test` 21 dosyayı tek bir `&&` zincirinde koşuyordu ve
 * `test:all` da onu üretim paketinden ÖNCE çağırıyordu. Sonuç olarak eski
 * (compatibility) kodda tek bir kırık import, 354 üretim testinin hiç
 * koşmamasına ve build → E2E → release-evidence zincirinin tamamen
 * bloklanmasına yol açıyordu. 2026-08-07 ile 2026-08-16 arasında tam olarak
 * bu oldu: bir bayat import dokuz gün boyunca yalnız kendini değil, altında
 * yatan ikinci bir gerçek hatayı da (görsel sözleşmenin platform bağımlılığı)
 * sakladı.
 *
 * Bu koşucu iki şeyi değiştirir:
 *   1. Üretim paketi önce koşar — eski kod artık üretim doğrulamasını
 *      rehin alamaz.
 *   2. Bir paket düşse de kalanlar koşar — tek turda tam tablo görülür,
 *      "önce şunu düzelt, sonra diğerini gör" turu gerekmez.
 *
 * Çıkış kodu: paketlerden herhangi biri düşerse 1.
 */

const NODE = process.execPath;

/**
 * Alt paketler npm üzerinden değil doğrudan node ile çağrılır. Windows'ta
 * `npm` bir .cmd sarmalayıcısıdır; onu spawn etmek ya `shell: true` gerektirir
 * (Node 22+ bunu DEP0190 ile uyarıyor: argümanlar kaçırılmadan birleşiyor) ya
 * da `shell: false` ile EINVAL verir. npm'i npm içinden çağırmak zaten
 * gereksiz bir dolambaçtı; komutlar doğrudan çağrılınca hem uyarı hem platform
 * dalı ortadan kalkıyor.
 */

/** Eski V1/V2/V3 paketi. Üretim import grafiğinde değil; yalnız veri
 *  uyumluluğu ve regresyon kanıtı için tutuluyor (bkz. module-registry:
 *  src/core, src/state, src/discovery = compatibility). */
const COMPAT_FILES = [
  'test.js',
  'tests/unit/stage-contracts.test.js',
  'tests/unit/patch-policy.test.js',
  'tests/unit/approval-service.test.js',
  'tests/integration/patch-transaction.test.js',
  'tests/integration/persistence.test.js',
  'tests/workflow/complete-workflow.test.js',
  'tests/domain/traceability-graph.test.js',
  'tests/domain/modules.test.js',
  'tests/domain/phases.test.js',
  'tests/state/v3-state.test.js',
  'tests/core/entity-store.test.js',
  'tests/discovery/discovery-engine.test.js',
  'tests/decision/decision-engine.test.js',
  'tests/artifact/artifact-engine.test.js',
  'tests/task/task-prompt.test.js',
  'tests/core/traceability.test.js',
  'tests/core/reviewer.test.js',
  'tests/core/modules.test.js',
  'tests/core/state-engine.test.js',
  'tests/core/v3-application-service.test.js'
];

const COMPAT_STEPS = COMPAT_FILES.map(file => ({ label: `compat · ${file}`, command: NODE, args: [file] }));

const PRODUCTION_STEPS = [
  { label: 'V4 üretim', command: NODE, args: ['scripts/run-v4-tests.mjs'] },
  { label: 'Güvenlik (redaction)', command: NODE, args: ['--import', 'tsx', 'tests/security/redaction.test.js'] }
];

const SUITES = {
  compat: COMPAT_STEPS,
  // Üretim önce: eski kodun kırılması artık üretim doğrulamasını rehin alamaz.
  // Uyumluluk dosyaları düz listelenir ki özet hangisinin düştüğünü söylesin.
  all: [...PRODUCTION_STEPS, ...COMPAT_STEPS]
};

const suiteName = process.argv[2];
const steps = SUITES[suiteName];

if (!steps) {
  console.error(`Bilinmeyen paket: ${suiteName ?? '(verilmedi)'}. Seçenekler: ${Object.keys(SUITES).join(', ')}`);
  process.exit(1);
}

const failures = [];

for (const step of steps) {
  const result = spawnSync(step.command, step.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: false
  });

  if (result.error) {
    console.error(`\n[${step.label}] başlatılamadı: ${result.error.message}`);
    failures.push(step.label);
    continue;
  }
  if ((result.status ?? 1) !== 0) failures.push(step.label);
}

console.log(`\n${'='.repeat(58)}`);
console.log(`Paket: ${suiteName} · ${steps.length - failures.length}/${steps.length} geçti`);

if (failures.length > 0) {
  console.log('Düşenler:');
  for (const label of failures) console.log(`  ✗ ${label}`);
  console.log('='.repeat(58));
  process.exit(1);
}

console.log('Hepsi geçti.');
console.log('='.repeat(58));
