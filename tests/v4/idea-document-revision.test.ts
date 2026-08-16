import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  compareIdeaDocumentRevisions,
  ensureIdeaDocumentRevision,
  markCurrentIdeaRevisionConverted,
  restoreIdeaDocumentRevision,
  updateIdeaDocumentWithRevision
} from '../../src/v4/application/idea-document-revision-service.js';
import { createInitialConceptInterpretation } from '../../src/v4/application/idea-discussion-service.js';
import { normalizeProjectDocument } from '../../src/v4/canonical-entities.js';
import { createProjectDocument, validateProjectDocument } from '../../src/v4/project-document.js';
import { applyIdeaPlanConversion, previewIdeaPlanConversion } from '../../src/v4/application/idea-plan-conversion-service.js';
import {
  applyChangeImpact,
  createIdeaAlignmentImpactAnalysis
} from '../../src/v4/application/change-impact-service.js';
import { deferPlanAlignment } from '../../src/v4/domain/idea-plan-alignment.js';
import { calculateReadiness } from '../../src/v4/application/readiness-service.js';
import { finalizePlan } from '../../src/v4/planning-engine.js';
import { createExportBundle } from '../../src/v4/exporter.js';

function ideaProject() {
  const project = createProjectDocument({
    idea: 'Bireysel geliştiriciler için local-first proje fikri planlama uygulaması'
  });
  project.ideaLabSession!.conceptSummary = {
    ...createInitialConceptInterpretation(project),
    summary: 'Dağınık fikirleri yaşayan fikir belgesine dönüştüren uygulama.',
    targetUser: 'AI kodlama aracı kullanan bireysel geliştirici',
    problemStatement: 'Fikir, kapsam ve kararlar dağınık kalıyor.',
    currentAlternative: 'Genel sohbet ve metin notları.',
    desiredOutcome: 'Net ve geliştirilebilir bir fikir belgesi.',
    confirmedFeatures: ['Fikir belgesi'],
    outOfScope: ['Bulut senkronizasyonu'],
    mvpTarget: 'Fikri net bir MVP sınırına dönüştürmek.',
    openQuestions: [],
    userConfirmed: false
  };
  return project;
}

describe('Living idea document revision history', () => {
  it('records immutable baseline and edit revisions without changing canonical data', () => {
    const project = ideaProject();
    const beforeCanonical = project.canonicalRevision;
    const updated = updateIdeaDocumentWithRevision(project, {
      summary: 'Fikirleri onaylı MVP sınırına dönüştüren local-first uygulama.'
    });

    assert.equal(updated.ideaDocumentRevisions.length, 2);
    assert.equal(updated.ideaDocumentRevisions[0].source, 'initial');
    assert.equal(updated.ideaDocumentRevisions[0].status, 'superseded');
    assert.equal(updated.ideaDocumentRevisions[1].source, 'edit');
    assert.equal(updated.canonicalRevision, beforeCanonical);
    assert.equal(project.ideaDocumentRevisions.length, 0);
  });

  it('does not create noise for an unchanged save and exposes field-level comparison', () => {
    const project = ensureIdeaDocumentRevision(ideaProject());
    const unchanged = updateIdeaDocumentWithRevision(project, {
      summary: project.ideaLabSession!.conceptSummary!.summary
    });
    assert.deepEqual(unchanged, project);

    const changed = updateIdeaDocumentWithRevision(project, {
      targetUser: 'Cursor ve Codex kullanan bireysel geliştirici'
    });
    const comparison = compareIdeaDocumentRevisions(
      changed,
      changed.ideaDocumentRevisions[0].id,
      changed.ideaDocumentRevisions[1].id
    );
    assert.equal(comparison.valid, true);
    assert.deepEqual(comparison.changes.map(change => change.field), ['targetUser']);
  });

  it('restores an old idea as a new document revision without overwriting canonical plan', () => {
    const original = ensureIdeaDocumentRevision(ideaProject());
    const changed = updateIdeaDocumentWithRevision(original, {
      mvpTarget: 'İkinci ve daha geniş MVP hedefi.'
    });
    changed.canonicalRevision = 4;
    changed.objectives.push({
      id: 'objective-existing',
      title: 'Mevcut canonical hedef',
      description: 'Korunmalı',
      metric: 'Kayıt',
      target: 'Korunur',
      priority: 'must',
      status: 'accepted',
      sourceSuggestionIds: []
    });

    const result = restoreIdeaDocumentRevision(changed, changed.ideaDocumentRevisions[0].id);
    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.project.ideaLabSession!.conceptSummary!.mvpTarget, original.ideaLabSession!.conceptSummary!.mvpTarget);
    assert.equal(result.project.ideaDocumentRevisions.at(-1)!.source, 'restore');
    assert.equal(result.project.ideaDocumentRevisions.at(-1)!.restoredFromRevision, 1);
    assert.equal(result.project.canonicalRevision, 4);
    assert.equal(result.project.objectives[0].title, 'Mevcut canonical hedef');
    assert.equal(result.canonicalPlanUnchanged, true);
  });

  it('marks the exact idea revision used for conversion and normalizes older documents', () => {
    const project = ensureIdeaDocumentRevision(ideaProject());
    const converted = markCurrentIdeaRevisionConverted(project, 2);
    assert.equal(converted.ideaDocumentRevisions[0].status, 'converted');
    assert.equal(converted.ideaDocumentRevisions[0].convertedCanonicalRevision, 2);
    assert.equal(validateProjectDocument(converted).valid, true);

    const legacy = structuredClone(project) as Partial<typeof project>;
    delete legacy.ideaDocumentRevisions;
    const normalized = normalizeProjectDocument(legacy);
    assert.deepEqual(normalized.ideaDocumentRevisions, []);
    assert.equal(validateProjectDocument(normalized).valid, true);
  });

  it('marks a converted canonical plan stale when target or scope changes', () => {
    const project = ideaProject();
    const converted = applyIdeaPlanConversion(project, previewIdeaPlanConversion(project));
    assert.equal(converted.success, true);
    if (!converted.success) return;

    const changed = updateIdeaDocumentWithRevision(converted.project, {
      targetUser: 'Küçük ajans ekipleri',
      confirmedFeatures: ['Fikir belgesi', 'Takım çalışma alanı']
    });

    assert.equal(changed.canonicalRevision, converted.project.canonicalRevision);
    assert.equal(changed.planAlignment.status, 'stale');
    assert.deepEqual(changed.planAlignment.changedFields, ['targetUser', 'confirmedFeatures']);
    assert.ok(changed.planAlignment.affectedSections.includes('requirements'));
    assert.ok(changed.planAlignment.affectedSections.includes('tasks'));
    assert.equal(changed.planAlignment.sourceIdeaRevisionId, converted.project.ideaDocumentRevisions.at(-1)?.id);
    assert.equal(changed.planAlignment.currentIdeaRevisionId, changed.ideaDocumentRevisions.at(-1)?.id);
    assert.equal(validateProjectDocument(changed).valid, true);
  });

  it('requires review for a non-breaking risk or technical approach change', () => {
    const project = ideaProject();
    const converted = applyIdeaPlanConversion(project, previewIdeaPlanConversion(project));
    assert.equal(converted.success, true);
    if (!converted.success) return;

    const changed = updateIdeaDocumentWithRevision(converted.project, {
      knownRisks: ['Tarayıcı kotası']
    });

    assert.equal(changed.planAlignment.status, 'review_required');
    assert.deepEqual(changed.planAlignment.changedFields, ['knownRisks']);
    assert.deepEqual(changed.planAlignment.affectedSections, ['risks', 'tasks', 'testing']);
  });

  it('migrates a pre-alignment document and derives stale state without losing revisions', () => {
    const project = ideaProject();
    const converted = applyIdeaPlanConversion(project, previewIdeaPlanConversion(project));
    assert.equal(converted.success, true);
    if (!converted.success) return;
    const changed = updateIdeaDocumentWithRevision(converted.project, {
      mvpTarget: 'Takım kullanımını da kapsayan daha geniş hedef'
    });
    const legacy = structuredClone(changed) as Partial<typeof changed> & { schemaRevision: number };
    legacy.schemaRevision = 3;
    delete legacy.sourceIdeaRevisionId;
    delete legacy.sourceIdeaRevisionNumber;
    delete legacy.planAlignment;

    const normalized = normalizeProjectDocument(legacy);
    assert.equal(normalized.schemaRevision, 6);
    assert.equal(normalized.ideaDocumentRevisions.length, changed.ideaDocumentRevisions.length);
    assert.equal(normalized.sourceIdeaRevisionId, converted.project.ideaDocumentRevisions.at(-1)?.id);
    assert.equal(normalized.planAlignment.status, 'stale');
    assert.deepEqual(normalized.planAlignment.changedFields, ['mvpTarget']);
    assert.equal(validateProjectDocument(normalized).valid, true);
  });

  it('previews and atomically applies idea alignment without generic task inflation', () => {
    const project = ideaProject();
    const converted = applyIdeaPlanConversion(project, previewIdeaPlanConversion(project));
    assert.equal(converted.success, true);
    if (!converted.success) return;
    const changed = updateIdeaDocumentWithRevision(converted.project, {
      targetUser: 'Teknik kurucular',
      confirmedFeatures: ['Karar günlüğü']
    });
    const proposed = createIdeaAlignmentImpactAnalysis(changed);

    assert.equal(proposed.project.canonicalRevision, changed.canonicalRevision);
    assert.equal(proposed.impact.sourceKind, 'idea_alignment');
    assert.deepEqual(proposed.impact.affectedSections, changed.planAlignment.affectedSections);
    assert.equal(proposed.project.tasks.length, changed.tasks.length);

    const applied = applyChangeImpact(proposed.project, proposed.impact.id);
    assert.equal(applied.success, true);
    if (!applied.success) return;
    assert.equal(applied.project.canonicalRevision, changed.canonicalRevision + 1);
    assert.equal(applied.project.planAlignment.status, 'aligned');
    assert.equal(applied.project.sourceIdeaRevisionId, changed.ideaDocumentRevisions.at(-1)?.id);
    assert.deepEqual(applied.project.sections.scope.items, ['Karar günlüğü']);
    assert.ok(applied.project.requirements.some(item => item.title === 'Karar günlüğü' && item.status === 'draft'));
    assert.equal(applied.project.tasks.length, changed.tasks.length);
    assert.equal(applied.project.testCases.length, changed.testCases.length);
    assert.equal(validateProjectDocument(applied.project).valid, true);
  });

  it('keeps deferral document-only and rejects an impact after a newer idea revision', () => {
    const project = ideaProject();
    const converted = applyIdeaPlanConversion(project, previewIdeaPlanConversion(project));
    assert.equal(converted.success, true);
    if (!converted.success) return;
    const changed = updateIdeaDocumentWithRevision(converted.project, {
      mvpTarget: 'Yeni MVP hedefi'
    });
    const deferred = deferPlanAlignment(changed);
    assert.equal(deferred.documentRevision, changed.documentRevision + 1);
    assert.equal(deferred.canonicalRevision, changed.canonicalRevision);
    assert.equal(deferred.planAlignment.status, 'stale');
    assert.ok(deferred.planAlignment.deferredAt);

    const proposed = createIdeaAlignmentImpactAnalysis(deferred);
    const newer = updateIdeaDocumentWithRevision(proposed.project, {
      desiredOutcome: 'Daha yeni sonuç hedefi'
    });
    const stale = applyChangeImpact(newer, proposed.impact.id);
    assert.equal(stale.success, false);
    assert.equal(stale.project.canonicalRevision, newer.canonicalRevision);
    assert.equal(stale.project.planAlignment.status, 'stale');
  });

  it('blocks readiness, finalization and current export until alignment is approved', async () => {
    const project = ideaProject();
    const converted = applyIdeaPlanConversion(project, previewIdeaPlanConversion(project));
    assert.equal(converted.success, true);
    if (!converted.success) return;
    const changed = updateIdeaDocumentWithRevision(converted.project, {
      targetUser: 'Bağımsız teknik kurucular'
    });

    const readiness = calculateReadiness(changed).readiness;
    assert.ok(readiness.blockers.some(message => message.includes('Fikir belgesi canonical plandan farklı')));
    const finalized = finalizePlan(changed);
    assert.equal(finalized.success, false);
    await assert.rejects(
      () => createExportBundle(changed),
      /Fikir belgesi canonical plandan farklı/
    );

    const proposed = createIdeaAlignmentImpactAnalysis(changed);
    const applied = applyChangeImpact(proposed.project, proposed.impact.id);
    assert.equal(applied.success, true);
    if (!applied.success) return;
    await assert.doesNotReject(() => createExportBundle(applied.project));
  });
});
