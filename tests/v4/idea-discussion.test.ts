import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildIdeaDiscussionContext,
  captureDiscussionBundle,
  getConceptAgreementGate,
  setIdeaDiscussionMode,
  updateConceptAgreement,
  updateIdeaRecord,
  updateIdeaRecordStatus
} from '../../src/v4/application/idea-discussion-service.js';
import { buildBudgetedContext } from '../../src/v4/ai/context/context-builder.js';
import type { SuggestionBundle, SuggestionItem } from '../../src/v4/contracts.js';
import { confirmConceptSummary } from '../../src/v4/planning-engine.js';
import { createProjectDocument, validateProjectDocument } from '../../src/v4/project-document.js';
import { tryMigrateOrPassthrough } from '../../src/v4/migrations.js';

function suggestion(id: string, kind: SuggestionItem['kind'], title: string): SuggestionItem {
  return {
    id,
    fingerprint: `${kind}:${title}`,
    kind,
    title,
    description: title,
    pros: [],
    cons: [],
    effort: 'medium',
    impact: 'medium',
    recommended: false,
    recommendationReason: '',
    affectedSections: [],
    dependencies: [],
    status: 'pending'
  };
}

function discussionBundle(): SuggestionBundle {
  return {
    id: 'bundle-discussion-1',
    title: 'At sistemi tartışması',
    phase: 'DISCOVERY',
    status: 'open',
    createdAt: '2026-07-26T10:00:00.000Z',
    items: [
      suggestion('suggestion-decision', 'decision', 'Sunucu otoriteli hareket kullanılmalı'),
      suggestion('suggestion-risk', 'risk', 'Yüksek gecikme sürüş hissini bozabilir'),
      suggestion('suggestion-hypothesis', 'feature', 'Oyuncular farklı at türleri ister')
    ],
    openQuestions: ['Binekler savaşta kullanılacak mı?']
  };
}

describe('fikir tartışması ve mutabakat kapısı', () => {
  it('tartışma modunu ve bundle kayıtlarını canonical proje üzerinde saklar', () => {
    const initial = createProjectDocument({ idea: 'S&box oyun motorunda at sistemi' });
    const compared = setIdeaDiscussionMode(initial, 'compare');
    const captured = captureDiscussionBundle(compared, discussionBundle(), 'message-1');
    const duplicate = captureDiscussionBundle(captured, discussionBundle(), 'message-2');

    assert.equal(duplicate.ideaDiscussion.mode, 'compare');
    assert.equal(duplicate.ideaDiscussion.records.length, 4);
    assert.deepEqual(
      duplicate.ideaDiscussion.records.map(record => record.kind),
      ['decision', 'risk', 'hypothesis', 'question']
    );
    assert.equal(getConceptAgreementGate(duplicate).ready, false);
    assert.equal(validateProjectDocument(duplicate).valid, true);
  });

  it('bekleyen fikir kayıtları çözülmeden konsept onayını engeller', () => {
    const initial = createProjectDocument({ idea: 'S&box oyun motorunda at sistemi' });
    const project = captureDiscussionBundle(initial, discussionBundle());
    project.ideaLabSession.conceptSummary = {
      summary: 'Sunucu otoriteli, genişletilebilir bir binek sistemi.',
      confirmedFeatures: ['Temel binme ve inme'],
      outOfScope: [],
      technicalApproaches: ['Sunucu otoriteli hareket'],
      knownRisks: [],
      openQuestions: [],
      mvpTarget: 'Tek at ile güvenilir sürüş',
      userConfirmed: false
    };

    assert.throws(
      () => confirmConceptSummary(project),
      /4 fikir kaydı henüz tamamlanmadı/
    );
  });

  it('açık soruyu cevaplar, metin değişikliğini geçmişe alır ve sonra kabul eder', () => {
    const initial = createProjectDocument({ idea: 'S&box oyun motorunda at sistemi' });
    let project = captureDiscussionBundle(initial, discussionBundle());
    const question = project.ideaDiscussion.records.find(record => record.kind === 'question')!;

    assert.throws(
      () => updateIdeaRecordStatus(project, question.id, 'accepted'),
      /Açık soru kabul edilmeden önce cevaplanmalı/
    );
    project = updateIdeaRecord(project, question.id, {
      text: 'Binekler aktif savaşta kullanılacak mı?',
      answer: 'İlk sürümde savaş dışında kullanılacak.',
      note: 'Savaş animasyonları daha sonraki sürüme bırakıldı.'
    });
    project = updateIdeaRecordStatus(project, question.id, 'accepted');
    const updated = project.ideaDiscussion.records.find(record => record.id === question.id)!;

    assert.equal(updated.history.length, 1);
    assert.equal(updated.history[0].text, 'Binekler savaşta kullanılacak mı?');
    assert.equal(updated.answer, 'İlk sürümde savaş dışında kullanılacak.');
    assert.equal(updated.status, 'accepted');
  });

  it('kabul ve ret geçmişini budgeted AI contextine taşır', () => {
    const initial = createProjectDocument({ idea: 'S&box oyun motorunda at sistemi' });
    let project = captureDiscussionBundle(initial, discussionBundle());
    project = updateIdeaRecord(project, project.ideaDiscussion.records[0].id, {
      rationale: 'Hile ve desync riskini azaltır.'
    });
    project = updateIdeaRecordStatus(project, project.ideaDiscussion.records[0].id, 'accepted');
    project = updateIdeaRecordStatus(project, project.ideaDiscussion.records[1].id, 'rejected');

    const discussion = buildIdeaDiscussionContext(project);
    const budgeted = buildBudgetedContext(project, 4000).contextData.ideaDiscussion as typeof discussion;

    assert.equal(discussion.accepted[0].rationale, 'Hile ve desync riskini azaltır.');
    assert.equal(discussion.rejected[0].text, 'Yüksek gecikme sürüş hissini bozabilir');
    assert.deepEqual(budgeted, discussion);
  });

  it('konsept mutabakatının bütün düzenlenebilir alanlarını günceller', () => {
    const project = createProjectDocument({ idea: 'Yerel planlama uygulaması' });
    project.ideaLabSession.conceptSummary = {
      summary: 'İlk özet',
      confirmedFeatures: [],
      outOfScope: [],
      technicalApproaches: [],
      knownRisks: [],
      openQuestions: [],
      mvpTarget: 'İlk MVP',
      userConfirmed: false
    };
    const updated = updateConceptAgreement(project, {
      summary: 'Düzenlenmiş özet',
      mvpTarget: 'Yerel kayıtlı çalışan MVP',
      confirmedFeatures: ['Fikir tartışması', 'Fikir tartışması', 'Canonical plan'],
      outOfScope: ['Bulut senkronizasyonu'],
      technicalApproaches: ['IndexedDB'],
      knownRisks: ['Provider kesintisi'],
      openQuestions: ['Ollama varsayılan mı?']
    });

    assert.equal(updated.ideaLabSession.conceptSummary?.summary, 'Düzenlenmiş özet');
    assert.deepEqual(updated.ideaLabSession.conceptSummary?.confirmedFeatures, ['Fikir tartışması', 'Canonical plan']);
    assert.equal(updated.ideaLabSession.conceptSummary?.mvpTarget, 'Yerel kayıtlı çalışan MVP');
  });

  it('kabul edilen karar, risk ve varsayımı plana taşır; ertelenen soruyu saklar', () => {
    const initial = createProjectDocument({ idea: 'S&box oyun motorunda at sistemi' });
    let project = captureDiscussionBundle(initial, discussionBundle());
    for (const record of project.ideaDiscussion.records) {
      project = updateIdeaRecordStatus(
        project,
        record.id,
        record.kind === 'question' ? 'deferred' : 'accepted'
      );
    }
    project.ideaLabSession.conceptSummary = {
      summary: 'Sunucu otoriteli, genişletilebilir bir binek sistemi.',
      confirmedFeatures: ['Temel binme ve inme'],
      outOfScope: [],
      technicalApproaches: ['Sunucu otoriteli hareket'],
      knownRisks: [],
      openQuestions: [],
      mvpTarget: 'Tek at ile güvenilir sürüş',
      userConfirmed: false
    };

    assert.equal(getConceptAgreementGate(project).ready, true);
    const confirmed = confirmConceptSummary(project);

    assert.equal(confirmed.lifecycle.activePhase, 'SHAPING');
    assert.ok(confirmed.decisions.some(item => item.decision === 'Sunucu otoriteli hareket kullanılmalı'));
    assert.ok(confirmed.risks.some(item => item.title === 'Yüksek gecikme sürüş hissini bozabilir'));
    assert.ok(confirmed.assumptions.some(item => item.statement === 'Oyuncular farklı at türleri ister'));
    assert.equal(getConceptAgreementGate(confirmed).deferred.length, 1);
  });

  it('geçersiz tartışma kayıtlarını validator reddeder', () => {
    const project = createProjectDocument({ idea: 'Doğrulama testi' });
    project.ideaDiscussion.mode = 'invalid' as never;
    assert.match(validateProjectDocument(project).errors.join(' '), /Fikir tartışma modu geçersiz/);
  });

  it('eski V5 fikir kayıtlarını yeni düzenleme alanlarıyla kayıpsız normalleştirir', () => {
    const project = createProjectDocument({ idea: 'Migration testi' });
    project.ideaDiscussion.records = [{
      id: 'legacy-record',
      kind: 'decision',
      text: 'Yerel veri kullanılmalı',
      status: 'accepted',
      sourceBundleId: 'legacy-bundle',
      sourceMessageId: '',
      createdAt: '2026-01-01T00:00:00.000Z'
    }] as never;

    const migrated = tryMigrateOrPassthrough(project);
    const record = migrated.project.ideaDiscussion.records[0];
    assert.equal(migrated.error, null);
    assert.equal(record.originalText, 'Yerel veri kullanılmalı');
    assert.equal(record.note, '');
    assert.deepEqual(record.history, []);
  });
});
