import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * İzole Codex Worktree Yürütmesi yeteneğinin kanıtı Rust tarafındadır
 * (native-e2e: src-tauri/src/execution.rs). Bu script o testleri gerçekten
 * çalıştırır ve sonucu kayıt defterinin okuyabileceği kanıta çevirir.
 *
 * Senaryo listesi uydurulmaz; cargo çıktısındaki test adlarından okunur.
 */

interface ScenarioResult {
  id: string;
  title: string;
  passed: boolean;
}

const SCENARIO_TITLES: Record<string, string> = {
  codex_selection_only_accepts_expected_executable_names: 'Yalnız codex/codex.exe adlı dosya seçilebilir',
  execution_roles_have_fixed_sandbox_and_risk: 'Her ajan rolünün sandbox ve risk seviyesi sabittir',
  execution_role_order_cannot_be_skipped: 'Rol sırası atlanamaz',
  project_labels_are_path_safe: 'Proje etiketleri yol güvenlidir',
  native_codex_worktree_and_patch_flow_runs_end_to_end: 'İzole worktree ve patch akışı uçtan uca çalışır',
  authenticode_status_mapping_fails_closed: 'İmza durumu eşlemesi fail-closed davranır',
  signature_gate_accepts_valid_and_blocks_downgrade: 'Geçerli imza geçer, bozulan imza engellenir',
  signature_notice_names_the_actual_risk: 'İmza uyarısı gerçek riski adlandırır',
  unsigned_fake_codex_is_reported_as_unsigned_or_unverifiable: 'İmzasız binary imzalı olarak raporlanmaz'
};

function runCargoTests(): string {
  try {
    return execFileSync(
      'cargo',
      ['test', '--manifest-path', 'src-tauri/Cargo.toml', 'execution::tests', '--', '--test-threads', '1'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
  } catch (error) {
    // Testler kaldığında cargo sıfırdan farklı çıkar; çıktıyı yine de ayrıştır
    // ki hangi senaryonun düştüğü rapora yansısın.
    const shell = error as { stdout?: string; stderr?: string };
    const output = `${shell.stdout || ''}${shell.stderr || ''}`;
    if (!output.trim()) throw error;
    return output;
  }
}

function parseScenarios(output: string): ScenarioResult[] {
  const pattern = /^test\s+execution::tests::(\S+)\s+\.\.\.\s+(ok|FAILED|ignored)/gm;
  const results: ScenarioResult[] = [];
  for (const match of output.matchAll(pattern)) {
    const [, name, verdict] = match;
    results.push({
      id: name,
      title: SCENARIO_TITLES[name] || name,
      passed: verdict === 'ok'
    });
  }
  // Cargo sırası değişebilir; --check karşılaştırması deterministik kalmalı.
  return results.sort((left, right) => left.id.localeCompare(right.id));
}

const output = runCargoTests();
const results = parseScenarios(output);

if (results.length === 0) {
  console.error('Native yürütme benchmarkı: cargo çıktısından hiç senaryo okunamadı.');
  console.error(output.split('\n').slice(-15).join('\n'));
  process.exit(1);
}

const report = {
  benchmarkVersion: '1.0.0',
  capabilityId: 'native-codex-execution',
  completed: results.length,
  passed: results.filter(item => item.passed).length,
  passRate: results.filter(item => item.passed).length / results.length,
  results
};

const jsonPath = resolve('benchmarks/native-execution/latest-report.json');
const markdownPath = resolve('docs/product/NATIVE_EXECUTION_REPORT.md');
const evidencePath = resolve('src/v4/product/generated-native-execution-evidence.ts');
const json = `${JSON.stringify(report, null, 2)}\n`;
const markdown = [
  '# İzole Codex Worktree Yürütmesi Benchmark',
  '',
  `Sonuç: **${report.passed}/${report.completed}** senaryo geçti.`,
  '',
  'Bu senaryolar `src-tauri/src/execution.rs` içindeki native testlerden okunur;',
  'liste elle yazılmaz, `cargo test` çıktısından ayrıştırılır.',
  '',
  '| Senaryo | Sonuç |',
  '|---|---:|',
  ...results.map(item => `| ${item.title} | ${item.passed ? 'Geçti' : 'Kaldı'} |`),
  '',
  '## Bu benchmarkın kanıtlamadıkları',
  '',
  '- Codex CLI\'ın kendi davranışı ölçülmez; testler sahte bir çalıştırılabilir kullanır.',
  '- İmza doğrulaması yalnız Windows\'ta gerçek bir denetim yapar; diğer platformlarda',
  '  durum `unsupported-platform` olarak raporlanır ve bu açıkça gösterilir.',
  '- Ajan çıktısının doğruluğu değil, sandbox/rol/worktree sınırlarının korunduğu ölçülür.',
  ''
].join('\n');
const evidence = [
  '// Bu dosya scripts/native-execution-benchmark.ts tarafından üretilir.',
  'export const NATIVE_EXECUTION_BENCHMARK_EVIDENCE = Object.freeze({',
  `  completed: ${report.completed},`,
  `  passed: ${report.passed},`,
  `  source: 'docs/product/NATIVE_EXECUTION_REPORT.md'`,
  '});',
  ''
].join('\n');

const checkOnly = process.argv.includes('--check');
if (checkOnly) {
  const files = [
    [jsonPath, json],
    [markdownPath, markdown],
    [evidencePath, evidence]
  ] as const;
  const stale = files.filter(([path, expected]) => {
    try {
      return readFileSync(path, 'utf8').replaceAll('\r\n', '\n') !== expected.replaceAll('\r\n', '\n');
    } catch {
      return true;
    }
  });
  if (stale.length) {
    console.error(`Native yürütme kanıtı güncel değil: ${stale.map(([path]) => path).join(', ')}`);
    process.exit(1);
  }
} else {
  for (const path of [jsonPath, markdownPath, evidencePath]) mkdirSync(dirname(path), { recursive: true });
  writeFileSync(jsonPath, json);
  writeFileSync(markdownPath, markdown);
  writeFileSync(evidencePath, evidence);
}

console.log(`Native execution benchmark: ${report.passed}/${report.completed}`);
if (report.passed !== report.completed) {
  for (const item of results.filter(entry => !entry.passed)) console.error(`  ✗ ${item.id}`);
  process.exit(1);
}
