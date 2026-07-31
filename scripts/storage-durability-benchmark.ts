import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createProjectDocument } from '../src/v4/project-document.js';
import { MemoryProjectRepository, restoreCheckpointAsNewRevision } from '../src/v4/storage.js';
import { createCheckpoint, computeDataChecksum, verifyDataIntegrity } from '../src/v4/storage/backup-manager.js';
import { createQuarantineRecord } from '../src/v4/storage/quarantine.js';

interface Assertion { label: string; passed: boolean }

const project = (idea: string, name?: string) => createProjectDocument({ idea, name });

async function checkpointIntegrity(): Promise<Assertion[]> {
  const source = project('Yerel çalışan not alma uygulaması', 'Integrity');
  const checkpoint = createCheckpoint(source);
  const checksum = computeDataChecksum(source);

  const corrupted = structuredClone(source);
  corrupted.identity.name = 'Diskte bozulmuş ad';

  return [
    { label: 'Checkpoint kimliği damgalanmış', passed: checkpoint.id.startsWith('chk-') },
    { label: 'Checkpoint sağlama toplamı taşıyor', passed: Boolean(checkpoint.checksumHash) },
    { label: 'Sağlama algoritması kayıtlı', passed: Boolean(checkpoint.checksumAlgorithm) },
    { label: 'Bozulmamış veri doğrulanır', passed: verifyDataIntegrity(source, checksum) },
    { label: 'Bozulmuş veri yakalanır', passed: !verifyDataIntegrity(corrupted, checksum) },
    {
      label: 'Aynı içerik aynı sağlamayı üretir (deterministik)',
      passed: computeDataChecksum(source) === computeDataChecksum(structuredClone(source))
    }
  ];
}

async function restoreCreatesNewRevision(): Promise<Assertion[]> {
  const current = project('Ekip içi görev takip aracı', 'Restore');
  current.canonicalRevision = 4;
  current.documentRevision = 7;

  const older = structuredClone(current);
  older.canonicalRevision = 2;
  older.documentRevision = 3;
  older.identity.name = 'Eski hâl';

  const restored = restoreCheckpointAsNewRevision(current, older);

  return [
    { label: 'Geri yükleme ileri revision üretir', passed: restored.canonicalRevision === current.canonicalRevision + 1 },
    { label: 'Doküman revision da ilerler', passed: restored.documentRevision === current.documentRevision + 1 },
    { label: 'Eski içerik geri gelir', passed: restored.identity.name === 'Eski hâl' },
    { label: 'Proje yeniden aktif olur', passed: restored.lifecycle.status === 'active' },
    { label: 'Finalize damgası temizlenir', passed: restored.lifecycle.finalizedAt === null },
    {
      label: 'Kaynak revision kaydı tutulur',
      passed: (restored.metadata as Record<string, { sourceRevision?: number }>).restoredFromCheckpoint?.sourceRevision === 2
    },
    {
      label: 'Geri yükleme revision geçmişine yazılır',
      passed: restored.revisions.at(-1)?.number === restored.canonicalRevision
    },
    { label: 'Girdi projesi değiştirilmez', passed: current.canonicalRevision === 4 && current.identity.name !== 'Eski hâl' }
  ];
}

async function restorePreservesForwardHistory(): Promise<Assertion[]> {
  const current = project('Fatura takip aracı', 'History');
  current.canonicalRevision = 3;
  current.documentRevision = 5;
  current.revisions = [
    { id: 'rev-1', number: 1, createdAt: '2026-01-01T00:00:00.000Z', summary: 'ilk', acceptedSuggestionIds: [], affectedSections: [] },
    { id: 'rev-2', number: 2, createdAt: '2026-01-02T00:00:00.000Z', summary: 'ikinci', acceptedSuggestionIds: [], affectedSections: [] }
  ] as typeof current.revisions;
  current.commandLog = [{ commandId: 'cmd-1', type: 'test', createdAt: '2026-01-01T00:00:00.000Z' }] as typeof current.commandLog;

  const older = structuredClone(current);
  older.canonicalRevision = 1;
  older.revisions = [];
  older.commandLog = [];

  const restored = restoreCheckpointAsNewRevision(current, older);

  return [
    // Geri yükleme geçmişi silmez; eski hâl yeni bir revision olarak eklenir.
    { label: 'Önceki revision kayıtları korunur', passed: restored.revisions.some(item => item.id === 'rev-1') },
    { label: 'İkinci revision da korunur', passed: restored.revisions.some(item => item.id === 'rev-2') },
    { label: 'Geçmişe yeni kayıt eklenir', passed: restored.revisions.length === 3 },
    { label: 'Komut günlüğü kaybolmaz', passed: restored.commandLog.length === 1 }
  ];
}

async function crossProjectCheckpointRejected(): Promise<Assertion[]> {
  const current = project('A projesi', 'A');
  const foreign = project('B projesi', 'B');
  let rejected = false;
  let message = '';
  try {
    restoreCheckpointAsNewRevision(current, foreign);
  } catch (error) {
    rejected = true;
    message = error instanceof Error ? error.message : String(error);
  }
  return [
    { label: 'Başka projeye ait checkpoint reddedilir', passed: rejected },
    { label: 'Ret nedeni açıklanır', passed: message.includes('başka bir projeye') },
    { label: 'İki proje farklı kimlik taşır', passed: current.id !== foreign.id }
  ];
}

async function quarantineKeepsBadPayload(): Promise<Assertion[]> {
  const badPayload = { corrupted: true, json: '{invalid}', nested: { value: 42 } };
  const record = createQuarantineRecord(badPayload, 'Şema doğrulaması başarısız');
  const serialized = JSON.stringify(record);

  return [
    { label: 'Karantina kaydı damgalanır', passed: record.id.startsWith('quarantine-') },
    { label: 'Neden kaydedilir', passed: record.reason === 'Şema doğrulaması başarısız' },
    // Bozuk kayıt sessizce atılmaz; ham hâli incelenebilir kalır.
    { label: 'Ham veri kaybolmaz', passed: JSON.stringify(record.rawPayload) === JSON.stringify(badPayload) },
    { label: 'Kayıt serileştirilebilir', passed: serialized.length > 0 && JSON.parse(serialized).id === record.id }
  ];
}

async function repositoryValidatesBeforeWrite(): Promise<Assertion[]> {
  const repository = new MemoryProjectRepository();
  const valid = project('Depoya yazılacak geçerli proje', 'Valid');
  const saved = await repository.save(valid);
  const loaded = await repository.get(valid.id);

  const invalid = structuredClone(valid);
  (invalid as unknown as { identity: unknown }).identity = null;
  let rejected = false;
  try {
    await repository.save(invalid);
  } catch {
    rejected = true;
  }

  const afterFailure = await repository.get(valid.id);
  const listed = await repository.list();

  return [
    { label: 'Geçerli proje yazılır', passed: saved.id === valid.id },
    { label: 'Yazılan proje geri okunur', passed: loaded?.id === valid.id },
    { label: 'Gidiş-dönüş kimlik korunur', passed: loaded?.identity.originalIdea === valid.identity.originalIdea },
    { label: 'Geçersiz belge yazılmaz', passed: rejected },
    // Başarısız yazma mevcut kaydı bozmamalı.
    { label: 'Başarısız yazma mevcut veriyi bozmaz', passed: afterFailure?.identity != null },
    { label: 'Listeleme yalnız geçerli kaydı döner', passed: listed.length === 1 }
  ];
}

const scenarios = [
  { id: 'checkpoint-integrity', title: 'Checkpoint bütünlüğü', intent: 'Checkpoint sağlama toplamı taşımalı ve diskte bozulan veriyi yakalamalı.', run: checkpointIntegrity },
  { id: 'restore-creates-new-revision', title: 'Geri yükleme yeni revision üretir', intent: 'Checkpoint geri yükleme üzerine yazmamalı; ileri doğru yeni bir revision olmalı.', run: restoreCreatesNewRevision },
  { id: 'restore-preserves-forward-history', title: 'Geri yükleme geçmişi silmez', intent: 'Eski hâle dönmek revision geçmişini ve komut günlüğünü kaybettirmemeli.', run: restorePreservesForwardHistory },
  { id: 'cross-project-checkpoint-rejected', title: 'Yabancı checkpoint reddi', intent: 'Başka bir projeye ait checkpoint geri yüklenememeli.', run: crossProjectCheckpointRejected },
  { id: 'quarantine-keeps-bad-payload', title: 'Karantina ham veriyi korur', intent: 'Bozuk kayıt sessizce atılmamalı; nedeniyle birlikte incelenebilir kalmalı.', run: quarantineKeepsBadPayload },
  { id: 'repository-validates-before-write', title: 'Depo yazmadan önce doğrular', intent: 'Geçersiz belge diske yazılmamalı ve başarısız yazma mevcut kaydı bozmamalı.', run: repositoryValidatesBeforeWrite }
];

const results = [];
for (const scenario of scenarios) {
  const assertions = await scenario.run();
  results.push({
    id: scenario.id,
    title: scenario.title,
    intent: scenario.intent,
    passed: assertions.every(item => item.passed),
    assertionCount: assertions.length,
    failedAssertions: assertions.filter(item => !item.passed).map(item => item.label),
    assertions
  });
}

const report = {
  benchmarkVersion: '1.0.0',
  capabilityId: 'local-storage-recovery',
  completed: results.length,
  passed: results.filter(item => item.passed).length,
  passRate: results.filter(item => item.passed).length / results.length,
  results
};

const jsonPath = resolve('benchmarks/storage/local-first/latest-report.json');
const markdownPath = resolve('docs/product/STORAGE_DURABILITY_REPORT.md');
const evidencePath = resolve('src/v4/product/generated-storage-durability-evidence.ts');
const json = `${JSON.stringify(report, null, 2)}\n`;
const markdown = [
  '# Local-First Depolama ve Yedekleme Benchmark',
  '',
  `Sonuç: **${report.passed}/${report.completed}** senaryo geçti (${results.reduce((sum, item) => sum + item.assertionCount, 0)} doğrulama).`,
  '',
  '| Senaryo | Sonuç | Doğrulama |',
  '|---|---:|---:|',
  ...results.map(item => `| ${item.title} | ${item.passed ? 'Geçti' : 'Kaldı'} | ${item.assertionCount} |`),
  '',
  '## Ölçülen davranış',
  '',
  ...scenarios.map(item => `- **${item.title}** — ${item.intent}`),
  '',
  '## Bu benchmarkın kanıtlamadıkları',
  '',
  '- Gerçek disk arızası, dolu disk veya işletim sistemi seviyesi bozulma taklit edilmez.',
  '- IndexedDB ve SQLite sürücülerinin kendi dayanıklılığı ölçülmez; ölçülen, PromtGen',
  '  tarafındaki bütünlük, karantina ve geri yükleme sözleşmesidir.',
  '- Masaüstü SQLite WAL davranışı ve yedek saklama sınırı ayrıca `src-tauri` testlerinde',
  '  doğrulanır (`sqlite_backup_retention_and_quarantine_are_bounded`).',
  '- Cihaz dışına otomatik eşitleme yoktur ve bu bilinçli bir sınırdır.',
  ''
].join('\n');
const evidence = [
  '// Bu dosya scripts/storage-durability-benchmark.ts tarafından üretilir.',
  'export const STORAGE_DURABILITY_BENCHMARK_EVIDENCE = Object.freeze({',
  `  completed: ${report.completed},`,
  `  passed: ${report.passed},`,
  `  source: 'docs/product/STORAGE_DURABILITY_REPORT.md'`,
  '});',
  ''
].join('\n');

const checkOnly = process.argv.includes('--check');
if (checkOnly) {
  const files = [[jsonPath, json], [markdownPath, markdown], [evidencePath, evidence]] as const;
  const stale = files.filter(([path, expected]) => {
    try {
      return readFileSync(path, 'utf8').replaceAll('\r\n', '\n') !== expected.replaceAll('\r\n', '\n');
    } catch {
      return true;
    }
  });
  if (stale.length) {
    console.error(`Depolama dayanıklılık kanıtı güncel değil: ${stale.map(([path]) => path).join(', ')}`);
    process.exit(1);
  }
} else {
  for (const path of [jsonPath, markdownPath, evidencePath]) mkdirSync(dirname(path), { recursive: true });
  writeFileSync(jsonPath, json);
  writeFileSync(markdownPath, markdown);
  writeFileSync(evidencePath, evidence);
}

console.log(`Storage durability benchmark: ${report.passed}/${report.completed}`);
if (report.passed !== report.completed) {
  for (const item of results.filter(entry => !entry.passed)) {
    console.error(`  ✗ ${item.id}: ${item.failedAssertions.join(' | ')}`);
  }
  process.exit(1);
}
