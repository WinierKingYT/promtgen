import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument } from '../../src/v4/project-document.js';
import {
  analyzePlanCodeAlignment,
  createPlanCodeAlignmentSuggestion
} from '../../src/v4/application/plan-code-alignment.js';
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

function acceptedEvidence(project: ProjectDocumentV5) {
  return {
    id: 'evidence-1',
    taskId: 'task-1',
    baseCanonicalRevision: project.canonicalRevision,
    source: 'manual' as const,
    summary: 'Görev kullanıcı tarafından kanıtlandı.',
    changedFiles: [{ path: 'src/task-form.tsx', changeType: 'modified' as const, note: '' }],
    testRuns: [{ command: 'npm test', status: 'passed' as const, outputSummary: 'Test geçti.' }],
    acceptanceEvidence: [{ criterion: 'Form geçerli girdiyi kaydeder.', status: 'met' as const, evidence: 'Kabul testi.' }],
    remainingIssues: [],
    rollbackNotes: 'Patch geri alınır.',
    review: { outcome: 'ready_for_approval' as const, findings: [], reviewedAt: '2026-07-29T12:00:00.000Z', reviewerNote: 'Onaylandı.' },
    status: 'accepted' as const,
    createdAt: '2026-07-29T12:00:00.000Z',
    resolvedAt: '2026-07-29T12:01:00.000Z'
  };
}

describe('Plan–code alignment advisory analysis', () => {
  it('reports missing inventory without changing the project or claiming implementation', () => {
    const project = projectFixture();
    const before = structuredClone(project);
    const report = analyzePlanCodeAlignment(project);

    assert.deepEqual(project, before);
    assert.equal(report.version, 2);
    assert.equal(report.mode, 'advisory');
    assert.equal(report.tasks[0].status, 'not_analyzed');
    assert.match(report.limitations.join(' '), /tek başına kanıtlamaz/);
    assert.equal(report.summary.alignedTasks, 0);
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
    project.implementationEvidencePackages.push(acceptedEvidence(project));

    const report = analyzePlanCodeAlignment(project);
    assert.equal(report.tasks[0].status, 'aligned');
    assert.deepEqual(report.tasks[0].evidencePackageIds, ['evidence-1']);
    assert.deepEqual(report.tasks[0].changedPaths, ['src/task-form.tsx']);
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

  it('blocks an accepted package that reports files outside the TaskContract scope', () => {
    const project = projectFixture();
    const evidence = acceptedEvidence(project);
    evidence.changedFiles.push({ path: 'package.json', changeType: 'modified', note: 'Kapsam dışı değişiklik.' });
    project.implementationEvidencePackages.push(evidence);

    const report = analyzePlanCodeAlignment(project);

    assert.equal(report.tasks[0].status, 'out_of_scope');
    assert.deepEqual(report.tasks[0].outOfScopePaths, ['package.json']);
    assert.equal(report.tasks[0].recommendedAction, 'accept_deviation');
    assert.equal(report.requirements[0].status, 'suspicious');
  });

  it('marks evidence for an older canonical revision as suspicious', () => {
    const project = projectFixture();
    const evidence = acceptedEvidence(project);
    evidence.baseCanonicalRevision = project.canonicalRevision - 1;
    project.implementationEvidencePackages.push(evidence);

    const report = analyzePlanCodeAlignment(project);

    assert.equal(report.tasks[0].status, 'suspicious');
    assert.equal(report.tasks[0].recommendedAction, 'rollback_guidance');
    assert.match(report.tasks[0].findings.join(' '), /güncel canonical revision/);
  });

  it('creates a document-only resolution suggestion without changing the canonical revision', () => {
    const project = projectFixture();
    const beforeRevision = project.canonicalRevision;
    const result = createPlanCodeAlignmentSuggestion(project, 'task-1', 'update_plan');

    assert.equal(result.created, true);
    assert.equal(project.proposalStore.bundles.length, 0, 'source project remains unchanged');
    assert.equal(result.project.canonicalRevision, beforeRevision);
    assert.equal(result.project.proposalStore.bundles.length, 1);
    assert.equal(result.project.proposalStore.bundles[0].source?.providerId, 'plan-code-alignment-v2');
    assert.equal(result.project.proposalStore.bundles[0].items[0].status, 'pending');

    const duplicate = createPlanCodeAlignmentSuggestion(result.project, 'task-1', 'update_plan');
    assert.equal(duplicate.created, false);
    assert.match(duplicate.reason, /zaten mevcut/);
  });

  it('does not create a resolution suggestion for an aligned task', () => {
    const project = projectFixture();
    project.implementationEvidencePackages.push(acceptedEvidence(project));

    const result = createPlanCodeAlignmentSuggestion(project, 'task-1', 'update_plan');

    assert.equal(result.created, false);
    assert.equal(result.project, project);
    assert.match(result.reason, /zaten plan/);
  });
});
