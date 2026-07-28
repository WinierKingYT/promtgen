import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createProjectDocument } from '../../src/v4/project-document.js';
import {
  buildAnonymousStudySession,
  buildIdeaGuide,
  ideaGuideToMarkdown
} from '../../src/v4/application/idea-guide-service.js';

describe('Idea guide and local evidence projection', () => {
  it('builds a useful guide without changing the canonical document', () => {
    const project = createProjectDocument({ idea: 'Bireysel geliştiriciler için yerel görev uygulaması' });
    const before = JSON.stringify(project);
    project.ideaLabSession = {
      status: 'concept_ready',
      approaches: [],
      ideaNotes: [],
      candidateDecisions: [],
      candidateRisks: [],
      conceptSummary: {
        summary: 'Yerel çalışan sade bir günlük görev uygulaması.',
        targetUser: 'Bireysel geliştirici',
        problemStatement: 'Dağınık günlük işleri tek yerde görmek.',
        currentAlternative: 'Metin dosyaları',
        desiredOutcome: 'Bugünün işlerini hızlıca seçmek.',
        interpretationConfidence: 80,
        confidenceRationale: [],
        confirmedFeatures: ['Görev ekleme', 'Günlük öncelik'],
        outOfScope: ['Takım sohbeti'],
        technicalApproaches: [],
        openQuestions: ['Çevrimdışı yedek gerekli mi?'],
        knownRisks: ['Kapsamın büyümesi'],
        mvpTarget: 'Tek kullanıcılı yerel sürüm',
        userConfirmed: false
      }
    };
    const snapshot = JSON.stringify(project);
    const guide = buildIdeaGuide(project);

    assert.equal(guide.targetUser, 'Bireysel geliştirici');
    assert.deepEqual(guide.outOfScope, ['Takım sohbeti']);
    assert.match(ideaGuideToMarkdown(guide), /## Sıradaki adımlar/);
    assert.equal(JSON.stringify(project), snapshot);
    assert.notEqual(snapshot, before);
  });

  it('creates an explicitly consented PII-free anonymous session', () => {
    const project = createProjectDocument({ idea: 'Yerel planlama uygulaması' });
    project.lifecycle.createdAt = '2026-07-29T10:00:00.000Z';
    const session = buildAnonymousStudySession(project, 5, new Date('2026-07-29T10:10:00.000Z'));

    assert.equal(session.consent, true);
    assert.equal(session.durationSeconds, 600);
    assert.equal(session.satisfaction, 5);
    assert.deepEqual(Object.keys(session).sort(), [
      'anonymousSessionId', 'capabilityId', 'completed', 'consent', 'durationSeconds',
      'firstExportReached', 'manualEditCount', 'mvpAcceptedWithMinorEdits', 'satisfaction', 'schemaVersion'
    ].sort());
  });
});
