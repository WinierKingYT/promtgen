import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { analyzePlanCodeAlignment, type AlignmentStatus } from '../src/v4/application/plan-code-alignment.js';
import { createProjectDocument } from '../src/v4/project-document.js';
import type { ImplementationEvidencePackage, ProjectDocumentV5 } from '../src/v4/contracts.js';

interface Scenario {
  id: string;
  title: string;
  expected: AlignmentStatus;
  prepare: (project: ProjectDocumentV5) => void;
}

function projectFixture(): ProjectDocumentV5 {
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

function addInventory(project: ProjectDocumentV5): void {
  project.profile.projectInventory = {
    version: 1,
    analyzedAt: '2026-07-29T12:00:00.000Z',
    source: 'browser-selection',
    totals: { selected: 2, included: 2, excluded: 0, bytes: 200 },
    languages: [{ name: 'TypeScript', files: 2 }],
    frameworks: ['react'],
    manifests: ['Node.js'],
    scriptNames: ['test'],
    security: { secretFiles: [], injectionFiles: [] },
    inventory: [
      { path: 'src/task-form.tsx', secretDetected: false, injectionDetected: false },
      { path: 'tests/task-form.test.ts', secretDetected: false, injectionDetected: false }
    ],
    excluded: []
  };
}

function evidence(project: ProjectDocumentV5): ImplementationEvidencePackage {
  return {
    id: 'evidence-1',
    taskId: 'task-1',
    baseCanonicalRevision: project.canonicalRevision,
    source: 'codex',
    summary: 'Görev formu tamamlandı.',
    changedFiles: [{ path: 'src/task-form.tsx', changeType: 'modified', note: 'Form uygulandı.' }],
    testRuns: [{ command: 'npm test', status: 'passed', outputSummary: 'Testler geçti.' }],
    acceptanceEvidence: [{ criterion: 'Geçerli form görevi kaydeder.', status: 'met', evidence: 'Kabul testi geçti.' }],
    remainingIssues: [],
    rollbackNotes: 'Form patchini geri al.',
    review: {
      outcome: 'ready_for_approval',
      findings: [],
      reviewedAt: '2026-07-29T12:00:00.000Z',
      reviewerNote: 'Kullanıcı onayladı.'
    },
    status: 'accepted',
    createdAt: '2026-07-29T12:00:00.000Z',
    resolvedAt: '2026-07-29T12:01:00.000Z'
  };
}

const scenarios: Scenario[] = [
  { id: 'inventory-missing', title: 'Envanter ve kanıt yok', expected: 'not_analyzed', prepare: () => {} },
  { id: 'inventory-only', title: 'Yalnız güvenli envanter eşleşmesi', expected: 'partially_evidenced', prepare: addInventory },
  {
    id: 'accepted-evidence', title: 'Güncel ve kapsam içi kabul edilmiş kanıt', expected: 'aligned',
    prepare: project => { addInventory(project); project.implementationEvidencePackages.push(evidence(project)); }
  },
  {
    id: 'out-of-scope-change', title: 'TaskContract dışı değişen dosya', expected: 'out_of_scope',
    prepare: project => {
      const item = evidence(project);
      item.changedFiles.push({ path: 'package.json', changeType: 'modified', note: 'Kapsam dışı.' });
      project.implementationEvidencePackages.push(item);
    }
  },
  {
    id: 'stale-evidence', title: 'Eski canonical revision kanıtı', expected: 'suspicious',
    prepare: project => {
      const item = evidence(project);
      item.baseCanonicalRevision -= 1;
      project.implementationEvidencePackages.push(item);
    }
  }
];

const results = scenarios.map(scenario => {
  const project = projectFixture();
  scenario.prepare(project);
  const report = analyzePlanCodeAlignment(project);
  const actual = report.tasks[0]?.status || 'not_analyzed';
  return { id: scenario.id, title: scenario.title, expected: scenario.expected, actual, passed: actual === scenario.expected };
});
const report = {
  benchmarkVersion: '2.0.0',
  capabilityId: 'plan-code-alignment',
  completed: results.length,
  passed: results.filter(item => item.passed).length,
  passRate: results.filter(item => item.passed).length / results.length,
  results
};

const jsonPath = resolve('benchmarks/plan-code-alignment/latest-report.json');
const markdownPath = resolve('docs/product/PLAN_CODE_ALIGNMENT_REPORT.md');
const evidencePath = resolve('src/v4/product/generated-plan-code-alignment-evidence.ts');
const json = `${JSON.stringify(report, null, 2)}\n`;
const markdown = [
  '# Plan–Kod Hizalama V2 Benchmark',
  '',
  `Sonuç: **${report.passed}/${report.completed}** deterministik senaryo geçti.`,
  '',
  '| Senaryo | Beklenen | Gerçek | Sonuç |',
  '|---|---|---|---:|',
  ...results.map(item => `| ${item.title} | ${item.expected} | ${item.actual} | ${item.passed ? 'Geçti' : 'Kaldı'} |`),
  '',
  'Bu benchmark plan, TaskContract ve kullanıcıca sağlanan teslim kanıtının sınıflandırılmasını ölçer. Kodun işlevsel olarak doğru olduğunu veya bir dosyanın gerçekten değiştiğini bağımsız olarak garanti etmez.',
  ''
].join('\n');
const generatedEvidence = [
  '// Bu dosya scripts/plan-code-alignment-benchmark.ts tarafından üretilir.',
  'export const PLAN_CODE_ALIGNMENT_BENCHMARK = Object.freeze({',
  `  completed: ${report.completed},`,
  `  passed: ${report.passed},`,
  `  source: 'docs/product/PLAN_CODE_ALIGNMENT_REPORT.md'`,
  '});',
  ''
].join('\n');

const checkOnly = process.argv.includes('--check');
if (checkOnly) {
  const stale = [[jsonPath, json], [markdownPath, markdown], [evidencePath, generatedEvidence]].filter(([path, expected]) => {
    try {
      return readFileSync(path, 'utf8').replaceAll('\r\n', '\n') !== expected.replaceAll('\r\n', '\n');
    } catch {
      return true;
    }
  });
  if (stale.length) {
    console.error(`Plan–kod benchmark kanıtı güncel değil: ${stale.map(([path]) => path).join(', ')}`);
    process.exit(1);
  }
} else {
  for (const path of [jsonPath, markdownPath, evidencePath]) mkdirSync(dirname(path), { recursive: true });
  writeFileSync(jsonPath, json);
  writeFileSync(markdownPath, markdown);
  writeFileSync(evidencePath, generatedEvidence);
}

console.log(`Plan–kod hizalama benchmark: ${report.passed}/${report.completed}`);
if (report.passed !== report.completed) process.exit(1);
