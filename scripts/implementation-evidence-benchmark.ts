import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createProjectDocument } from '../src/v4/project-document.js';
import {
  buildImplementationEvidenceTemplate,
  parseImplementationEvidenceText,
  type ImplementationEvidenceEnvelope
} from '../src/v4/application/implementation-evidence-format.js';
import type { ProjectDocumentV5 } from '../src/v4/contracts.js';

type ExpectedOutcome = 'ready_for_approval' | 'needs_changes' | 'blocked';
interface Scenario {
  id: string;
  title: string;
  expected: ExpectedOutcome;
  mutate: (envelope: ImplementationEvidenceEnvelope) => void;
}

function projectFixture() {
  const project = createProjectDocument({ idea: 'Bireysel geliştirici için görev yönetimi web uygulaması' }) as ProjectDocumentV5;
  project.requirements = [{
    id: 'req-1', title: 'Görev oluşturma', statement: 'Kullanıcı görev oluşturabilmeli.',
    kind: 'functional', priority: 'must', acceptanceCriteria: ['Görev kaydedilir.'],
    sourceObjectiveIds: [], sourceSuggestionIds: [], status: 'accepted'
  }];
  project.tasks = [{
    id: 'task-1', title: 'Görev formunu uygula', description: 'Form ve doğrulama',
    status: 'ready', priority: 'must', effort: 'medium', dependencies: [], requirementIds: ['req-1'],
    acceptanceCriteria: ['Geçerli form görevi kaydeder.'], verificationIds: ['test-1'],
    contract: {
      version: 2, objective: 'Görev formunu uygula', inScope: ['Görev formu'], outOfScope: ['Bildirimler'],
      filePolicy: { status: 'confirmed', allowedPaths: ['src/**', 'tests/**'], forbiddenPaths: ['.env*'] },
      verification: { testCaseIds: ['test-1'], commands: ['npm test'], requiresCommandDiscovery: false },
      expectedOutputs: ['Görev formu'], completionEvidence: ['Test özeti'], rollbackPlan: 'Form patchini geri al.'
    }
  }];
  project.testCases = [{
    id: 'test-1', title: 'Görev formu kabul testi', kind: 'acceptance', preconditions: [],
    steps: ['Formu doldur.'], expectedResult: 'Görev kaydedilir.', requirementIds: ['req-1'], status: 'ready'
  }];
  return project;
}

function completeEnvelope(project: ProjectDocumentV5) {
  const envelope = buildImplementationEvidenceTemplate(project, 'task-1', 'codex', '2026-07-29T12:00:00.000Z');
  envelope.summary = 'Görev formu ve doğrulaması tamamlandı.';
  envelope.changedFiles = [
    { path: 'src/task-form.tsx', changeType: 'modified', note: 'Form uygulandı.' },
    { path: 'tests/task-form.test.ts', changeType: 'added', note: 'Kabul testi eklendi.' }
  ];
  envelope.testRuns = [{ command: 'npm test', status: 'passed', outputSummary: '42 test geçti.' }];
  envelope.acceptanceEvidence = [{ criterion: 'Geçerli form görevi kaydeder.', status: 'met', evidence: 'Kabul testi geçti.' }];
  return envelope;
}

const scenarios: Scenario[] = [
  { id: 'complete-evidence', title: 'Eksiksiz teslim kanıtı', expected: 'ready_for_approval', mutate: () => {} },
  {
    id: 'out-of-scope-file', title: 'TaskContract dışı dosya', expected: 'blocked',
    mutate: envelope => { envelope.changedFiles.push({ path: 'package.json', changeType: 'modified', note: 'Kapsam dışı.' }); }
  },
  {
    id: 'failed-required-test', title: 'Başarısız zorunlu test', expected: 'blocked',
    mutate: envelope => { envelope.testRuns[0].status = 'failed'; }
  },
  {
    id: 'missing-acceptance-proof', title: 'Eksik kabul kriteri kanıtı', expected: 'needs_changes',
    mutate: envelope => { envelope.acceptanceEvidence = []; }
  },
  {
    id: 'stale-canonical-revision', title: 'Eski canonical revision', expected: 'blocked',
    mutate: envelope => { envelope.baseCanonicalRevision += 1; }
  }
];

const results = scenarios.map(scenario => {
  const project = projectFixture();
  const envelope = completeEnvelope(project);
  envelope.packageId = `evidence:${scenario.id}`;
  scenario.mutate(envelope);
  const parsed = parseImplementationEvidenceText(project, JSON.stringify(envelope));
  const actual = parsed.success ? parsed.review.review.outcome : 'parse_error';
  return {
    id: scenario.id,
    title: scenario.title,
    expected: scenario.expected,
    actual,
    passed: actual === scenario.expected,
    findings: parsed.success ? parsed.review.review.findings : parsed.errors
  };
});

const report = {
  benchmarkVersion: '1.0.0',
  capabilityId: 'implementation-evidence-review',
  completed: results.length,
  passed: results.filter(item => item.passed).length,
  passRate: results.filter(item => item.passed).length / results.length,
  results
};

const jsonPath = resolve('benchmarks/implementation-evidence/latest-report.json');
const markdownPath = resolve('docs/product/IMPLEMENTATION_EVIDENCE_REPORT.md');
const evidencePath = resolve('src/v4/product/generated-implementation-evidence.ts');
const json = `${JSON.stringify(report, null, 2)}\n`;
const markdown = [
  '# Görev Teslim Kanıtı Benchmark',
  '',
  `Sonuç: **${report.passed}/${report.completed}** senaryo geçti.`,
  '',
  '| Senaryo | Beklenen | Gerçek | Sonuç |',
  '|---|---|---|---:|',
  ...results.map(item => `| ${item.title} | ${item.expected} | ${item.actual} | ${item.passed ? 'Geçti' : 'Kaldı'} |`),
  '',
  'Bu benchmark deterministik kapsam ve kanıt sınıflandırmasını ölçer; dış aracın gerçekten doğru kod yazdığını garanti etmez.',
  ''
].join('\n');
const evidence = [
  '// Bu dosya scripts/implementation-evidence-benchmark.ts tarafından üretilir.',
  'export const IMPLEMENTATION_EVIDENCE_BENCHMARK = Object.freeze({',
  `  completed: ${report.completed},`,
  `  passed: ${report.passed},`,
  `  source: 'docs/product/IMPLEMENTATION_EVIDENCE_REPORT.md'`,
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
    console.error(`Görev teslim benchmark kanıtı güncel değil: ${stale.map(([path]) => path).join(', ')}`);
    process.exit(1);
  }
} else {
  for (const path of [jsonPath, markdownPath, evidencePath]) mkdirSync(dirname(path), { recursive: true });
  writeFileSync(jsonPath, json);
  writeFileSync(markdownPath, markdown);
  writeFileSync(evidencePath, evidence);
}

console.log(`Görev teslim kanıtı benchmark: ${report.passed}/${report.completed}`);
if (report.passed !== report.completed) process.exit(1);
