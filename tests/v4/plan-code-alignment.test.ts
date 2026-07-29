import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument } from '../../src/v4/project-document.js';
import { analyzePlanCodeAlignment } from '../../src/v4/application/plan-code-alignment.js';
import type { ProjectDocumentV5 } from '../../src/v4/contracts.js';

function projectFixture(): ProjectDocumentV5 {
  const project = createProjectDocument({ idea: 'Yerel görev planlama uygulaması' }) as ProjectDocumentV5;
  project.requirements = [{
    id: 'req-1',
    title: 'Görev oluşturma',
    statement: 'Kullanıcı görev oluşturabilmeli.',
    kind: 'functional',
    priority: 'must',
    acceptanceCriteria: ['Görev kaydedilir.'],
    sourceObjectiveIds: [],
    sourceSuggestionIds: [],
    status: 'accepted'
  }];
  project.tasks = [{
    id: 'task-1',
    title: 'Görev formunu uygula',
    description: 'Görev formu ve doğrulaması',
    status: 'ready',
    priority: 'must',
    effort: 'medium',
    dependencies: [],
    requirementIds: ['req-1'],
    acceptanceCriteria: ['Form geçerli girdiyi kaydeder.'],
    verificationIds: ['test-1'],
    contract: {
      version: 2,
      objective: 'Görev formunu uygula',
      inScope: ['Görev formu'],
      outOfScope: ['Bildirimler'],
      filePolicy: {
        status: 'confirmed',
        allowedPaths: ['src/**', 'tests/**'],
        forbiddenPaths: ['.env*']
      },
      verification: {
        testCaseIds: ['test-1'],
        commands: ['npm test'],
        requiresCommandDiscovery: false
      },
      expectedOutputs: ['Görev formu'],
      completionEvidence: ['Test çıktısı'],
      rollbackPlan: 'Görev patchini geri al.'
    }
  }];
  project.testCases = [{
    id: 'test-1',
    title: 'Görev oluşturma kabul testi',
    kind: 'acceptance',
    preconditions: [],
    steps: ['Formu doldur.'],
    expectedResult: 'Görev kaydedilir.',
    requirementIds: ['req-1'],
    status: 'ready'
  }];
  return project;
}

describe('Plan–code alignment read-only analysis', () => {
  it('reports missing inventory without changing the project or claiming implementation', () => {
    const project = projectFixture();
    const before = structuredClone(project);
    const report = analyzePlanCodeAlignment(project);

    assert.deepEqual(project, before);
    assert.equal(report.mode, 'read_only');
    assert.equal(report.tasks[0].status, 'not_analyzed');
    assert.match(report.limitations.join(' '), /tek başına kanıtlamaz/);
    assert.equal(report.summary.evidencedTasks, 0);
  });

  it('links only safe inventory paths, canonical tests and verification commands', () => {
    const project = projectFixture();
    project.profile.projectInventory = {
      version: 1,
      analyzedAt: '2026-07-29T11:00:00.000Z',
      source: 'browser-selection',
      totals: { selected: 4, included: 4, excluded: 0, bytes: 400 },
      languages: [{ name: 'TypeScript', files: 4 }],
      frameworks: ['react'],
      manifests: ['Node.js'],
      scriptNames: ['test'],
      security: { secretFiles: ['src/private.ts'], injectionFiles: ['tests/injected.test.ts'] },
      inventory: [
        { path: 'src/task-form.tsx', secretDetected: false, injectionDetected: false },
        { path: 'tests/task-form.test.ts', secretDetected: false, injectionDetected: false },
        { path: 'src/private.ts', secretDetected: true, injectionDetected: false },
        { path: 'tests/injected.test.ts', secretDetected: false, injectionDetected: true }
      ],
      excluded: []
    };

    const report = analyzePlanCodeAlignment(project);

    assert.equal(report.tasks[0].status, 'partially_evidenced');
    assert.deepEqual(report.tasks[0].matchedPaths, ['src/task-form.tsx', 'tests/task-form.test.ts']);
    assert.deepEqual(report.tasks[0].linkedTestCaseIds, ['test-1']);
    assert.deepEqual(report.tasks[0].verificationCommands, ['npm test']);
    assert.deepEqual(report.tasks[0].evidencePackageIds, []);
    assert.equal(report.requirements[0].status, 'evidence_gap');
    assert.equal(report.summary.inventoryFiles, 2);
  });

  it('claims evidenced scope only when the user accepted an implementation evidence package', () => {
    const project = projectFixture();
    project.implementationEvidencePackages.push({
      id: 'evidence-1',
      taskId: 'task-1',
      baseCanonicalRevision: 1,
      source: 'manual',
      summary: 'Görev kullanıcı tarafından kanıtlandı.',
      changedFiles: [{ path: 'src/task-form.tsx', changeType: 'modified', note: '' }],
      testRuns: [{ command: 'npm test', status: 'passed', outputSummary: 'Test geçti.' }],
      acceptanceEvidence: [{ criterion: 'Form geçerli girdiyi kaydeder.', status: 'met', evidence: 'Kabul testi.' }],
      remainingIssues: [],
      rollbackNotes: 'Patch geri alınır.',
      review: { outcome: 'ready_for_approval', findings: [], reviewedAt: '2026-07-29T12:00:00.000Z', reviewerNote: 'Onaylandı.' },
      status: 'accepted',
      createdAt: '2026-07-29T12:00:00.000Z',
      resolvedAt: '2026-07-29T12:01:00.000Z'
    });

    const report = analyzePlanCodeAlignment(project);
    assert.equal(report.tasks[0].status, 'evidenced');
    assert.deepEqual(report.tasks[0].evidencePackageIds, ['evidence-1']);
  });

  it('keeps a file-scope match as partial evidence when tests are missing', () => {
    const project = projectFixture();
    project.testCases = [];
    project.tasks[0].verificationIds = [];
    project.tasks[0].contract.verification.testCaseIds = [];
    project.profile.projectInventory = {
      version: 1,
      analyzedAt: '2026-07-29T11:00:00.000Z',
      source: 'browser-selection',
      totals: { selected: 1, included: 1, excluded: 0, bytes: 100 },
      languages: [], frameworks: [], manifests: [], scriptNames: [],
      security: { secretFiles: [], injectionFiles: [] },
      inventory: [{ path: 'src/task-form.tsx', secretDetected: false, injectionDetected: false }],
      excluded: []
    };

    const report = analyzePlanCodeAlignment(project);
    assert.equal(report.tasks[0].status, 'partially_evidenced');
    assert.match(report.tasks[0].findings.join(' '), /Bağlı test/);
    assert.equal(report.requirements[0].status, 'planned');
  });
});
