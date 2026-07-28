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
});
