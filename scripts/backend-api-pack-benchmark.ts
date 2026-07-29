import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assessBackendApiPack } from '../src/v4/domain-packs/backend-api.js';
import { applyModuleActivation, previewModuleActivation } from '../src/v4/module-registry.js';
import { analyzeIdea } from '../src/v4/planning-engine.js';

interface Scenario {
  id: string;
  title: string;
  idea: string;
  expectedQuestions: string[];
  expectedChecks: string[];
  absentChecks?: string[];
}

const scenarios: Scenario[] = [
  {
    id: 'rest-auth-data',
    title: 'Yetkili ve veri saklayan REST API',
    idea: 'Token ile yetkilendirilen istemcilerin PostgreSQL veritabanına sipariş yazdığı REST API.',
    expectedQuestions: ['api.contract', 'api.error-model', 'api.authentication', 'api.data-consistency', 'api.operations'],
    expectedChecks: ['api.contract', 'api.error-model', 'api.authentication', 'api.data-consistency', 'api.operations']
  },
  {
    id: 'public-read-api',
    title: 'Hesapsız salt okunur API',
    idea: 'Herkese açık katalog verisini salt okunur REST endpoint üzerinden sunan backend servis.',
    expectedQuestions: ['api.contract', 'api.error-model', 'api.operations'],
    expectedChecks: ['api.contract', 'api.error-model', 'api.operations'],
    absentChecks: ['api.authentication', 'api.idempotency']
  },
  {
    id: 'webhook-worker',
    title: 'Webhook ve kuyruk işleyicisi',
    idea: 'Harici partner webhooklarını alıp kuyruk worker ile asenkron işleyen API entegrasyon servisi.',
    expectedQuestions: ['api.contract', 'api.error-model', 'api.idempotency', 'api.operations'],
    expectedChecks: ['api.contract', 'api.error-model', 'api.idempotency', 'api.operations']
  },
  {
    id: 'graphql-clients',
    title: 'Harici istemcili GraphQL API',
    idea: 'Harici mobil istemcilerin OAuth token ile kullandığı GraphQL backend API.',
    expectedQuestions: ['api.contract', 'api.error-model', 'api.authentication', 'api.operations'],
    expectedChecks: ['api.contract', 'api.error-model', 'api.authentication', 'api.operations']
  },
  {
    id: 'rate-sensitive-api',
    title: 'Kapasite sınırı olan API',
    idea: 'Saniyede yüksek sayıda istek alan ve istemci bazlı rate limit uygulayan REST API.',
    expectedQuestions: ['api.contract', 'api.error-model', 'api.rate-boundary', 'api.operations'],
    expectedChecks: ['api.contract', 'api.error-model', 'api.rate-boundary', 'api.operations']
  }
];

function evaluate(scenario: Scenario) {
  const project = analyzeIdea(scenario.idea);
  const preview = previewModuleActivation(project, ['software.backend-api']);
  const applied = applyModuleActivation(project, preview, { approved: true });
  if (!applied.success) throw new Error(`${scenario.id}: paket etkinleştirilemedi: ${applied.reason}`);
  const assessment = assessBackendApiPack(applied.project);
  const questions = assessment.discoveryQuestions.map(item => item.id);
  const checks = assessment.checks.map(item => item.id);
  const assertions = [
    { label: 'Paket uygulanabilir', passed: assessment.applicable },
    { label: 'Paket kullanıcı onayıyla aktif', passed: assessment.active },
    { label: 'Olgunluk beta', passed: assessment.maturity === 'beta' },
    ...scenario.expectedQuestions.map(id => ({ label: `Soru var: ${id}`, passed: questions.includes(id) })),
    ...scenario.expectedChecks.map(id => ({ label: `Kontrol var: ${id}`, passed: checks.includes(id) })),
    ...(scenario.absentChecks || []).map(id => ({ label: `Koşulsuz kontrol yok: ${id}`, passed: !checks.includes(id) }))
  ];
  return {
    id: scenario.id,
    title: scenario.title,
    passed: assertions.every(item => item.passed),
    assertions,
    detectedQuestions: questions,
    detectedChecks: checks
  };
}

const results = scenarios.map(evaluate);
const report = {
  benchmarkVersion: '1.0.0',
  capabilityId: 'backend-api-domain-pack',
  completed: results.length,
  passed: results.filter(item => item.passed).length,
  passRate: results.filter(item => item.passed).length / results.length,
  results
};
const jsonPath = resolve('benchmarks/domain-packs/backend-api/latest-report.json');
const markdownPath = resolve('docs/product/BACKEND_API_PACK_REPORT.md');
const evidencePath = resolve('src/v4/product/generated-backend-api-evidence.ts');
const json = `${JSON.stringify(report, null, 2)}\n`;
const markdown = [
  '# Backend/API Domain Pack Benchmark',
  '',
  `Sonuç: **${report.passed}/${report.completed}** senaryo geçti.`,
  '',
  '| Senaryo | Sonuç | Soru | Kontrol |',
  '|---|---:|---:|---:|',
  ...results.map(item => `| ${item.title} | ${item.passed ? 'Geçti' : 'Kaldı'} | ${item.detectedQuestions.length} | ${item.detectedChecks.length} |`),
  '',
  'Bu benchmark kural paketinin koşullu davranışını ölçer; gerçek API güvenliği, performansı veya kullanıcı sonucu garantisi değildir.',
  ''
].join('\n');
const evidence = [
  '// Bu dosya scripts/backend-api-pack-benchmark.ts tarafından üretilir.',
  'export const BACKEND_API_BENCHMARK_EVIDENCE = Object.freeze({',
  `  completed: ${report.completed},`,
  `  passed: ${report.passed},`,
  `  source: 'docs/product/BACKEND_API_PACK_REPORT.md'`,
  '});',
  ''
].join('\n');

const checkOnly = process.argv.includes('--check');
if (checkOnly) {
  const stale = [[jsonPath, json], [markdownPath, markdown], [evidencePath, evidence]].filter(([path, expected]) => {
    try {
      return readFileSync(path, 'utf8').replaceAll('\r\n', '\n') !== expected.replaceAll('\r\n', '\n');
    } catch {
      return true;
    }
  });
  if (stale.length) {
    console.error(`Backend/API benchmark kanıtı güncel değil: ${stale.map(([path]) => path).join(', ')}`);
    process.exit(1);
  }
} else {
  for (const path of [jsonPath, markdownPath, evidencePath]) mkdirSync(dirname(path), { recursive: true });
  writeFileSync(jsonPath, json);
  writeFileSync(markdownPath, markdown);
  writeFileSync(evidencePath, evidence);
}
console.log(`Backend/API pack benchmark: ${report.passed}/${report.completed}`);
if (report.passed !== report.completed) process.exit(1);
