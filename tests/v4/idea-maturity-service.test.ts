import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assessIdeaMaturity } from '../../src/v4/application/idea-maturity-service.js';
import { createInitialConceptInterpretation } from '../../src/v4/application/idea-discussion-service.js';
import { createProjectDocument } from '../../src/v4/project-document.js';

describe('idea maturity recommendation', () => {
  it('recommends discussion for an unclear idea', () => {
    const project = createProjectDocument({ idea: 'Bir uygulama yapmak istiyorum' });
    assert.equal(assessIdeaMaturity(project).recommended, 'develop');
  });

  it('recommends a guide while a shaped idea still needs approval', () => {
    const project = createProjectDocument({ idea: 'Bireysel geliştiriciler için local-first planlama uygulaması' });
    const summary = createInitialConceptInterpretation(project);
    Object.assign(summary, {
      targetUser: 'AI araçları kullanan bireysel geliştirici',
      problemStatement: 'Proje kapsamı ve kararlar dağınık kalıyor.',
      desiredOutcome: 'Onaylanmış ve izlenebilir proje planı.',
      confirmedFeatures: ['Fikir belgesi'],
      outOfScope: ['Bulut senkronizasyonu'],
      mvpTarget: 'Fikri onaylı MVP sınırına dönüştürmek.',
      openQuestions: [],
      userConfirmed: false
    });
    project.ideaLabSession!.conceptSummary = summary;
    assert.equal(assessIdeaMaturity(project).recommended, 'guide');
  });

  it('recommends detailed planning only after complete user confirmation', () => {
    const project = createProjectDocument({ idea: 'Bireysel geliştiriciler için local-first planlama uygulaması' });
    const summary = createInitialConceptInterpretation(project);
    Object.assign(summary, {
      targetUser: 'AI araçları kullanan bireysel geliştirici',
      problemStatement: 'Proje kapsamı ve kararlar dağınık kalıyor.',
      desiredOutcome: 'Onaylanmış ve izlenebilir proje planı.',
      confirmedFeatures: ['Fikir belgesi'],
      outOfScope: ['Bulut senkronizasyonu'],
      mvpTarget: 'Fikri onaylı MVP sınırına dönüştürmek.',
      openQuestions: [],
      userConfirmed: true
    });
    project.ideaLabSession!.conceptSummary = summary;
    assert.equal(assessIdeaMaturity(project).recommended, 'plan');
  });
});
