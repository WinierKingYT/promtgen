import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument } from '../../src/v4/project-document.js';
import {
  createImplementationEvidenceReview,
  decideImplementationEvidence,
  type ImplementationEvidenceInput
} from '../../src/v4/application/implementation-evidence-service.js';
import {
  buildImplementationEvidenceTemplate,
  parseImplementationEvidenceText
} from '../../src/v4/application/implementation-evidence-format.js';
import { createIdeWorkspaceFiles } from '../../src/v4/exporter.js';
import type { ProjectDocumentV5 } from '../../src/v4/contracts.js';

function fixture(): ProjectDocumentV5 {
  const project = createProjectDocument({ idea: 'Yerel görev planlama uygulaması' }) as ProjectDocumentV5;
  project.requirements = [{
    id: 'req-1', title: 'Görev oluşturma', statement: 'Kullanıcı görev oluşturabilmeli.',
    kind: 'functional', priority: 'must', acceptanceCriteria: ['Görev kaydedilir.'],
    sourceObjectiveIds: [], sourceSuggestionIds: [], status: 'accepted'
  }];
  project.tasks = [{
    id: 'task-1', title: 'Görev formunu uygula', description: 'Görev formu ve doğrulaması',
    status: 'ready', priority: 'must', effort: 'medium', dependencies: [], requirementIds: ['req-1'],
    acceptanceCriteria: ['Form geçerli girdiyi kaydeder.'], verificationIds: ['test-1'],
    contract: {
      version: 2, objective: 'Görev formunu uygula', inScope: ['Görev formu'], outOfScope: ['Bildirimler'],
      filePolicy: { status: 'confirmed', allowedPaths: ['src/**', 'tests/**'], forbiddenPaths: ['.env*'] },
      verification: { testCaseIds: ['test-1'], commands: ['npm test'], requiresCommandDiscovery: false },
      expectedOutputs: ['Görev formu'], completionEvidence: ['Test çıktısı'], rollbackPlan: 'Görev patchini geri al.'
    }
  }];
  project.testCases = [{
    id: 'test-1', title: 'Görev oluşturma kabul testi', kind: 'acceptance', preconditions: [],
    steps: ['Formu doldur.'], expectedResult: 'Görev kaydedilir.', requirementIds: ['req-1'], status: 'ready'
  }];
  return project;
}

function validInput(): ImplementationEvidenceInput {
  return {
    taskId: 'task-1',
    source: 'codex',
    summary: 'Görev formu ve doğrulaması dış araçta tamamlandı.',
    changedFiles: [
      { path: 'src/task-form.tsx', changeType: 'modified', note: 'Form doğrulaması eklendi.' },
      { path: 'tests/task-form.test.ts', changeType: 'added', note: 'Kabul testi eklendi.' }
    ],
    testRuns: [{ command: 'npm test', status: 'passed', outputSummary: '42 test geçti.' }],
    acceptanceEvidence: [{ criterion: 'Form geçerli girdiyi kaydeder.', status: 'met', evidence: 'Kabul testi geçti.' }],
    remainingIssues: [],
    rollbackNotes: 'İki dosyadaki değişiklikleri geri al.'
  };
}

describe('Implementation evidence packages', () => {
  it('reviews evidence without mutating canonical task state', () => {
    const project = fixture();
    const before = structuredClone(project);
    const review = createImplementationEvidenceReview(project, validInput(), {
      id: 'evidence-1', now: '2026-07-29T12:00:00.000Z'
    });
    assert.deepEqual(project, before);
    assert.equal(review.review.outcome, 'ready_for_approval');
    assert.equal(project.tasks[0].status, 'ready');
    assert.equal(project.implementationEvidencePackages.length, 0);
  });

  it('blocks out-of-scope files and failed verification', () => {
    const project = fixture();
    const input = validInput();
    input.changedFiles.push({ path: 'package.json', changeType: 'modified', note: 'Sözleşme dışı değişiklik.' });
    input.testRuns[0].status = 'failed';
    const review = createImplementationEvidenceReview(project, input);
    const result = decideImplementationEvidence(project, review, 'accept');
    assert.equal(review.review.outcome, 'blocked');
    assert.match(review.review.findings.join(' '), /kapsamı dışında/);
    assert.match(review.review.findings.join(' '), /başarılı değil/);
    assert.equal(result.success, false);
    assert.equal(result.project.tasks[0].status, 'ready');
  });

  it('updates task, test and requirement only after explicit acceptance', () => {
    const project = fixture();
    const review = createImplementationEvidenceReview(project, validInput(), {
      id: 'evidence-accepted', now: '2026-07-29T12:00:00.000Z'
    });
    const result = decideImplementationEvidence(project, review, 'accept', 'Kanıtı inceledim.');
    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(project.tasks[0].status, 'ready');
    assert.equal(result.project.tasks[0].status, 'done');
    assert.equal(result.project.testCases[0].status, 'passed');
    assert.equal(result.project.requirements[0].status, 'verified');
    assert.equal(result.project.documentRevision, project.documentRevision + 1);
    assert.equal(result.project.canonicalRevision, project.canonicalRevision + 1);
    assert.equal(result.project.implementationEvidencePackages[0].status, 'accepted');
    assert.equal(result.project.implementationEvidencePackages[0].review.reviewerNote, 'Kanıtı inceledim.');
    assert.equal(result.project.revisions.at(-1)?.number, result.project.canonicalRevision);
  });

  it('rejects stale evidence atomically and keeps rejection document-only', () => {
    const project = fixture();
    const review = createImplementationEvidenceReview(project, validInput(), {
      id: 'evidence-stale', now: '2026-07-29T12:00:00.000Z'
    });
    project.documentRevision += 1;
    project.canonicalRevision += 1;
    const stale = decideImplementationEvidence(project, review, 'accept');
    assert.equal(stale.success, false);
    assert.equal(stale.project.implementationEvidencePackages.length, 0);

    const current = createImplementationEvidenceReview(project, validInput(), { id: 'evidence-rejected' });
    const rejected = decideImplementationEvidence(project, current, 'reject', 'Kanıt yetersiz.');
    assert.equal(rejected.success, true);
    if (!rejected.success) return;
    assert.equal(rejected.project.documentRevision, project.documentRevision + 1);
    assert.equal(rejected.project.canonicalRevision, project.canonicalRevision);
    assert.equal(rejected.project.tasks[0].status, 'ready');
    assert.equal(rejected.project.implementationEvidencePackages[0].status, 'rejected');
  });

  it('imports the strict V2 JSON envelope as preview without mutating the project', () => {
    const project = fixture();
    const template = buildImplementationEvidenceTemplate(project, 'task-1', 'codex', '2026-07-29T12:00:00.000Z');
    template.summary = validInput().summary;
    template.changedFiles = validInput().changedFiles;
    template.testRuns = validInput().testRuns;
    template.acceptanceEvidence = validInput().acceptanceEvidence;
    const before = structuredClone(project);
    const parsed = parseImplementationEvidenceText(project, JSON.stringify(template));

    assert.equal(parsed.success, true);
    assert.deepEqual(project, before);
    if (!parsed.success) return;
    assert.equal(parsed.envelope.formatVersion, 2);
    assert.equal(parsed.review.review.outcome, 'ready_for_approval');
    assert.equal(parsed.review.status, 'review_required');
  });

  it('rejects unknown fields, foreign projects and secret-bearing JSON', () => {
    const project = fixture();
    const template = buildImplementationEvidenceTemplate(project, 'task-1');
    const unknown = parseImplementationEvidenceText(project, JSON.stringify({ ...template, unexpected: true }));
    assert.equal(unknown.success, false);
    if (!unknown.success) assert.match(unknown.errors.join(' '), /Unrecognized key|unexpected/i);

    const foreign = parseImplementationEvidenceText(project, JSON.stringify({ ...template, projectId: 'other-project' }));
    assert.equal(foreign.success, false);
    if (!foreign.success) assert.match(foreign.errors.join(' '), /başka bir projeye/);

    const secret = parseImplementationEvidenceText(project, JSON.stringify({ ...template, summary: `Token sk-${'a'.repeat(24)}` }));
    assert.equal(secret.success, false);
    if (!secret.success) assert.match(secret.errors.join(' '), /secret/);
  });

  it('exports agent-ready evidence templates without claiming automatic completion', () => {
    const project = fixture();
    const workspace = createIdeWorkspaceFiles(project, { adapters: ['codex', 'cursor', 'claude'] });
    const templatePath = '.promtgen/evidence/templates/task-1.json';
    assert.ok(workspace.files[templatePath]);
    const template = JSON.parse(workspace.files[templatePath]);
    assert.equal(template.format, 'promtgen-implementation-evidence');
    assert.equal(template.formatVersion, 2);
    assert.equal(template.testRuns[0].status, 'not_run');
    assert.match(workspace.files['AGENTS.md'], /canonical görev durumunu doğrudan değiştiremezsin/);
    assert.match(workspace.files['.promtgen/evidence/README.md'], /açık onay/);
  });
});
