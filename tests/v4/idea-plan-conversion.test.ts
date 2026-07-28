import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyIdeaPlanConversion,
  previewIdeaPlanConversion
} from '../../src/v4/application/idea-plan-conversion-service.js';
import { createInitialConceptInterpretation } from '../../src/v4/application/idea-discussion-service.js';
import { createProjectDocument, validateProjectDocument } from '../../src/v4/project-document.js';

function convertibleProject() {
  const project = createProjectDocument({
    idea: 'Bireysel geliştiricilerin proje fikirlerini net MVP kapsamına dönüştüren local-first web uygulaması'
  });
  project.ideaLabSession = {
    status: 'concept_ready',
    approaches: [],
    ideaNotes: [],
    candidateDecisions: [],
    candidateRisks: [],
    conceptSummary: {
      ...createInitialConceptInterpretation(project),
      summary: 'Dağınık fikirleri kullanıcı onaylı ve izlenebilir proje kapsamına dönüştüren uygulama.',
      targetUser: 'AI kodlama araçlarıyla çalışan bireysel geliştirici',
      problemStatement: 'Kapsam, karar ve görev sürekliliğinin dağınık kalması.',
      currentAlternative: 'Genel amaçlı sohbetler ve elle tutulan notlar.',
      desiredOutcome: 'Kullanıcı uygulanabilir bir ilk sürüm planına ulaşır.',
      mvpTarget: 'Bir fikri onaylanmış MVP kapsamına ve görev taslaklarına dönüştürmek.',
      confirmedFeatures: ['Fikir belgesi', 'MVP kapsamı'],
      outOfScope: ['Bulut senkronizasyonu'],
      knownRisks: ['Kapsamın gereksiz büyümesi'],
      openQuestions: [],
      userConfirmed: false
    }
  };
  return project;
}

describe('Idea to canonical plan conversion', () => {
  it('previews exact user-visible effects without mutating the project', () => {
    const project = convertibleProject();
    const before = structuredClone(project);
    const preview = previewIdeaPlanConversion(project);

    assert.equal(preview.canConvert, true);
    assert.equal(preview.objectiveCount, 1);
    assert.equal(preview.requirementTitles.length, 2);
    assert.equal(preview.objective, project.ideaLabSession?.conceptSummary?.mvpTarget);
    assert.deepEqual(project, before);
  });

  it('converts the approved idea atomically into an objective and editable requirement drafts', () => {
    const project = convertibleProject();
    const preview = previewIdeaPlanConversion(project);
    const result = applyIdeaPlanConversion(project, preview);

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.project.ideaLabSession?.conceptSummary?.userConfirmed, true);
    assert.equal(result.project.lifecycle.activePhase, 'SHAPING');
    assert.equal(result.project.objectives.filter(item => item.status === 'accepted').length, 1);
    assert.equal(result.project.requirements.length, 2);
    assert.ok(result.project.requirements.every(item => item.status === 'draft'));
    assert.ok(result.project.requirements.every(item => item.sourceObjectiveIds.length === 1));
    assert.equal(result.project.canonicalRevision, project.canonicalRevision + 1);
    assert.equal(validateProjectDocument(result.project).valid, true);
  });

  it('rejects stale previews and incomplete idea documents without partial changes', () => {
    const project = convertibleProject();
    const preview = previewIdeaPlanConversion(project);
    const changed = structuredClone(project);
    changed.documentRevision += 1;
    const stale = applyIdeaPlanConversion(changed, preview);
    assert.equal(stale.success, false);
    assert.deepEqual(stale.project, changed);

    const blockedProject = convertibleProject();
    blockedProject.ideaLabSession!.conceptSummary!.openQuestions = ['Başarı ölçütü nedir?'];
    const blockedPreview = previewIdeaPlanConversion(blockedProject);
    const blocked = applyIdeaPlanConversion(blockedProject, blockedPreview);
    assert.equal(blockedPreview.canConvert, false);
    assert.equal(blocked.success, false);
    assert.equal(blockedProject.objectives.length, 0);
    assert.equal(blockedProject.requirements.length, 0);
  });
});
