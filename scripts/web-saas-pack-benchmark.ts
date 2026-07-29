import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assessWebSaasPack } from '../src/v4/domain-packs/web-saas.js';
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
    id: 'small-saas-workspaces',
    title: 'Çalışma alanlı küçük SaaS',
    idea: 'Küçük ekiplerin hesap açıp çalışma alanlarında müşteri kayıtları yönettiği SaaS web paneli.',
    expectedQuestions: ['web.account-boundary', 'web.data-lifecycle', 'web.tenant-isolation'],
    expectedChecks: ['web.authorization', 'web.data-lifecycle', 'web.tenant-isolation']
  },
  {
    id: 'admin-panel',
    title: 'Rol tabanlı yönetim paneli',
    idea: 'Yöneticilerin giriş yapıp içerik kayıtlarını düzenlediği rol tabanlı web yönetim paneli.',
    expectedQuestions: ['web.account-boundary', 'web.data-lifecycle'],
    expectedChecks: ['web.authorization', 'web.data-lifecycle'],
    absentChecks: ['web.tenant-isolation', 'web.payment-safety']
  },
  {
    id: 'backend-api',
    title: 'Veri saklayan backend API',
    idea: 'API anahtarıyla yetkilendirilen istemcilerin veritabanında sipariş kaydı tuttuğu backend API.',
    expectedQuestions: ['web.account-boundary', 'web.data-lifecycle'],
    expectedChecks: ['web.authorization', 'web.data-lifecycle']
  },
  {
    id: 'subscription-payments',
    title: 'Abonelik ödemeli SaaS',
    idea: 'Kullanıcı hesabı, Stripe aboneliği ve webhook ile ödeme durumu saklayan küçük SaaS uygulaması.',
    expectedQuestions: ['web.account-boundary', 'web.data-lifecycle', 'web.payment-lifecycle'],
    expectedChecks: ['web.authorization', 'web.data-lifecycle', 'web.payment-safety']
  },
  {
    id: 'public-web-tool',
    title: 'Hesapsız web aracı',
    idea: 'Kullanıcının metni tarayıcıda biçimlendirip sonucu indirdiği hesapsız ve veri saklamayan basit web aracı.',
    expectedQuestions: ['web.core-flow', 'web.delivery'],
    expectedChecks: ['web.core-flow', 'web.accessibility', 'web.delivery'],
    absentChecks: ['web.authorization', 'web.tenant-isolation', 'web.payment-safety']
  }
];

function evaluate(scenario: Scenario) {
  const project = analyzeIdea(scenario.idea);
  const preview = previewModuleActivation(project, ['software.web']);
  const applied = applyModuleActivation(project, preview, { approved: true });
  if (!applied.success) throw new Error(`${scenario.id}: paket etkinleştirilemedi: ${applied.reason}`);
  const assessment = assessWebSaasPack(applied.project);
  const questions = assessment.discoveryQuestions.map(item => item.id);
  const checks = assessment.checks.map(item => item.id);
  const assertions = [
    { label: 'Paket uygulanabilir', passed: assessment.applicable },
    { label: 'Paket kullanıcı onayıyla aktif', passed: assessment.active },
    { label: 'Olgunluk stable değil', passed: assessment.maturity === 'candidate-stable' },
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
  capabilityId: 'web-saas-domain-pack',
  completed: results.length,
  passed: results.filter(item => item.passed).length,
  passRate: results.filter(item => item.passed).length / results.length,
  results
};

const jsonPath = resolve('benchmarks/domain-packs/web-saas/latest-report.json');
const markdownPath = resolve('docs/product/WEB_SAAS_PACK_REPORT.md');
const evidencePath = resolve('src/v4/product/generated-web-saas-evidence.ts');
const json = `${JSON.stringify(report, null, 2)}\n`;
const markdown = [
  '# Web/SaaS Domain Pack Benchmark',
  '',
  `Sonuç: **${report.passed}/${report.completed}** senaryo geçti.`,
  '',
  '| Senaryo | Sonuç | Soru | Kontrol |',
  '|---|---:|---:|---:|',
  ...results.map(item => `| ${item.title} | ${item.passed ? 'Geçti' : 'Kaldı'} | ${item.detectedQuestions.length} | ${item.detectedChecks.length} |`),
  '',
  'Bu benchmark kural paketinin koşullu davranışını ölçer; gerçek kullanıcı sonucu veya güvenlik garantisi değildir.',
  ''
].join('\n');
const evidence = [
  '// Bu dosya scripts/web-saas-pack-benchmark.ts tarafından üretilir.',
  'export const WEB_SAAS_BENCHMARK_EVIDENCE = Object.freeze({',
  `  completed: ${report.completed},`,
  `  passed: ${report.passed},`,
  `  source: 'docs/product/WEB_SAAS_PACK_REPORT.md'`,
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
    console.error(`Web/SaaS benchmark kanıtı güncel değil: ${stale.map(([path]) => path).join(', ')}`);
    process.exit(1);
  }
} else {
  for (const path of [jsonPath, markdownPath, evidencePath]) mkdirSync(dirname(path), { recursive: true });
  writeFileSync(jsonPath, json);
  writeFileSync(markdownPath, markdown);
  writeFileSync(evidencePath, evidence);
}

console.log(`Web/SaaS pack benchmark: ${report.passed}/${report.completed}`);
if (report.passed !== report.completed) process.exit(1);
