import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createProjectDocument } from '../../../src/v4/project-document.js';
import { buildIdeaStateView } from '../../../src/v4/application/idea-state-view.js';
import type { ConceptSummary, ConcernDecision, GenerationProvenance, ProjectDocumentV5, SuggestionBundle } from '../../../src/v4/contracts.js';

function baseProject(): ProjectDocumentV5 {
  return createProjectDocument({ idea: 'Şehir içi bisiklet rotası öneren bir mobil uygulama' });
}

const CONCEPT: ConceptSummary = {
  summary: 'Bisikletçiler için güvenli rota önerileri.',
  targetUser: 'Şehir içi bisikletçiler',
  problemStatement: 'Mevcut haritalar bisiklet güvenliğini hesaba katmıyor.',
  currentAlternative: 'Genel harita uygulamaları',
  desiredOutcome: 'Daha güvenli ve hızlı rotalar',
  interpretationConfidence: 0.8,
  confidenceRationale: [],
  confirmedFeatures: [],
  outOfScope: [],
  technicalApproaches: [],
  openQuestions: [],
  knownRisks: [],
  mvpTarget: 'Tek şehir için rota önerisi',
  userConfirmed: false
};

const PROVENANCE: GenerationProvenance = {
  runId: 'run-1',
  mode: 'local-ai',
  providerId: null,
  model: null,
  promptVersion: 'v1',
  requestedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  latencyMs: 10,
  retryCount: 0,
  fallbackReason: null,
  schemaId: 'concept-summary',
  schemaVersion: 1,
  inputHash: 'hash'
};

function expansionBundle(id: string): SuggestionBundle {
  return {
    id: `bundle-idea-expansion-${id}`,
    title: 'Keşiften eklenenler',
    phase: 'IDEA_EXPANSION',
    status: 'open',
    createdAt: new Date().toISOString(),
    items: [],
    openQuestions: [],
    source: { type: 'local', providerId: 'idea-expansion' }
  };
}

function concernDecision(overrides: Partial<ConcernDecision>): ConcernDecision {
  return {
    id: 'concern-decision-1',
    concernId: 'concern-1',
    chosenOptionId: null,
    answer: '',
    excluded: [],
    scopeSplit: 'legacy-unsplit',
    rationale: 'Çünkü öyle',
    decidedAtRevision: 1,
    decisionId: 'decision-1',
    ...overrides
  };
}

describe('buildIdeaStateView', () => {
  it('boş proje için dürüst bir boş görünüm üretir, fırlatmaz', () => {
    const view = buildIdeaStateView(baseProject());
    assert.equal(view.isEmpty, true);
    assert.equal(view.foundation.hasContent, false);
    assert.equal(view.foundation.isUnreviewedDraft, false);
    assert.deepEqual(view.acceptedCards, []);
    assert.deepEqual(view.pendingCards, []);
    assert.deepEqual(view.included, []);
    assert.deepEqual(view.excluded, []);
  });

  it('yalnız temel özet doluysa onu yansıtır ve boş sayılmaz', () => {
    const project = structuredClone(baseProject());
    project.ideaLabSession = { ...project.ideaLabSession!, conceptSummary: { ...CONCEPT, userConfirmed: true } };
    const view = buildIdeaStateView(project);
    assert.equal(view.isEmpty, false);
    assert.equal(view.foundation.hasContent, true);
    assert.equal(view.foundation.isUnreviewedDraft, false);
    assert.equal(view.foundation.summary, CONCEPT.summary);
    assert.equal(view.foundation.mvpTarget, CONCEPT.mvpTarget);
  });

  it('provenance set ve onaylanmamışsa taslak olarak işaretler', () => {
    const project = structuredClone(baseProject());
    project.ideaLabSession = {
      ...project.ideaLabSession!,
      conceptSummary: { ...CONCEPT, userConfirmed: false },
      conceptSummaryProvenance: PROVENANCE
    };
    const view = buildIdeaStateView(project);
    assert.equal(view.foundation.isUnreviewedDraft, true);
  });

  it('kullanıcı onayladıysa provenance olsa bile taslak sayılmaz', () => {
    const project = structuredClone(baseProject());
    project.ideaLabSession = {
      ...project.ideaLabSession!,
      conceptSummary: { ...CONCEPT, userConfirmed: true },
      conceptSummaryProvenance: PROVENANCE
    };
    const view = buildIdeaStateView(project);
    assert.equal(view.foundation.isUnreviewedDraft, false);
  });

  it('kabul edilmiş bir kartı "kabul edilenler" listesine koyar', () => {
    const project = structuredClone(baseProject());
    const bundle = expansionBundle('1');
    bundle.items.push({
      id: 'suggestion-1',
      fingerprint: 'expansion:test:kabul edilen kart',
      kind: 'feature',
      title: 'Kabul edilen kart',
      description: 'Açıklama',
      pros: [],
      cons: [],
      effort: 'low',
      impact: 'high',
      recommended: false,
      recommendationReason: '',
      affectedSections: ['scope'],
      dependencies: [],
      status: 'accepted'
    });
    project.proposalStore.bundles.push(bundle);
    const view = buildIdeaStateView(project);
    assert.equal(view.isEmpty, false);
    assert.equal(view.acceptedCards.length, 1);
    assert.equal(view.acceptedCards[0].title, 'Kabul edilen kart');
    assert.equal(view.acceptedCards[0].status, 'accepted');
    assert.equal(view.pendingCards.length, 0);
  });

  it('reddedilen bir kart hiçbir listede görünmez', () => {
    const project = structuredClone(baseProject());
    const bundle = expansionBundle('1');
    bundle.items.push({
      id: 'suggestion-rejected',
      fingerprint: 'expansion:test:reddedilen kart',
      kind: 'feature',
      title: 'Reddedilen kart',
      description: 'Açıklama',
      pros: [],
      cons: [],
      effort: 'low',
      impact: 'high',
      recommended: false,
      recommendationReason: '',
      affectedSections: ['scope'],
      dependencies: [],
      status: 'rejected'
    });
    project.proposalStore.bundles.push(bundle);
    const view = buildIdeaStateView(project);
    assert.equal(view.acceptedCards.length, 0);
    assert.equal(view.pendingCards.length, 0);
    assert.equal(view.isEmpty, true);
  });

  it('bekleyen bir kart "karar bekleyenler" listesinde, açıkça bekliyor olarak görünür — sessizlik yok', () => {
    const project = structuredClone(baseProject());
    const bundle = expansionBundle('1');
    bundle.items.push({
      id: 'suggestion-pending',
      fingerprint: 'expansion:test:bekleyen',
      kind: 'feature',
      title: 'Bekleyen kart',
      description: '',
      pros: [],
      cons: [],
      effort: 'low',
      impact: 'low',
      recommended: false,
      recommendationReason: '',
      affectedSections: [],
      dependencies: [],
      status: 'pending'
    });
    project.proposalStore.bundles.push(bundle);
    const view = buildIdeaStateView(project);
    // Eklenen kart HİÇBİR ŞEKİLDE sessizce yok olmaz: kullanıcı "Fikre ekle"ye
    // bastığı an bunu görmeli. Ama kabul edilmiş gibi de SUNULMAZ — ayrı liste.
    assert.equal(view.acceptedCards.length, 0);
    assert.equal(view.pendingCards.length, 1);
    assert.equal(view.pendingCards[0].title, 'Bekleyen kart');
    assert.equal(view.pendingCards[0].status, 'pending');
    assert.equal(view.isEmpty, false, 'yalnızca bekleyen bir kart eklenmiş bir proje boş SAYILMAZ');
  });

  it('ertelenen bir kart da "karar bekleyenler" listesinde görünür, kendi durumuyla', () => {
    const project = structuredClone(baseProject());
    const bundle = expansionBundle('1');
    bundle.items.push({
      id: 'suggestion-deferred',
      fingerprint: 'expansion:test:ertelenen',
      kind: 'feature',
      title: 'Ertelenen kart',
      description: '',
      pros: [],
      cons: [],
      effort: 'low',
      impact: 'low',
      recommended: false,
      recommendationReason: '',
      affectedSections: [],
      dependencies: [],
      status: 'deferred'
    });
    project.proposalStore.bundles.push(bundle);
    const view = buildIdeaStateView(project);
    assert.equal(view.acceptedCards.length, 0);
    assert.equal(view.pendingCards.length, 1);
    assert.equal(view.pendingCards[0].title, 'Ertelenen kart');
    assert.equal(view.pendingCards[0].status, 'deferred');
    assert.equal(view.isEmpty, false);
  });

  it('kabul edilen ve bekleyen kartlar farklı listelerde durur, aynı listede karışmaz', () => {
    const project = structuredClone(baseProject());
    const bundle = expansionBundle('1');
    bundle.items.push(
      {
        id: 'suggestion-accepted',
        fingerprint: 'expansion:test:kabul',
        kind: 'feature',
        title: 'Kabul edilen',
        description: '',
        pros: [],
        cons: [],
        effort: 'low',
        impact: 'low',
        recommended: false,
        recommendationReason: '',
        affectedSections: [],
        dependencies: [],
        status: 'accepted'
      },
      {
        id: 'suggestion-pending-2',
        fingerprint: 'expansion:test:bekleyen-2',
        kind: 'feature',
        title: 'Bekleyen',
        description: '',
        pros: [],
        cons: [],
        effort: 'low',
        impact: 'low',
        recommended: false,
        recommendationReason: '',
        affectedSections: [],
        dependencies: [],
        status: 'pending'
      },
      {
        id: 'suggestion-rejected-2',
        fingerprint: 'expansion:test:reddedilen-2',
        kind: 'feature',
        title: 'Reddedilen',
        description: '',
        pros: [],
        cons: [],
        effort: 'low',
        impact: 'low',
        recommended: false,
        recommendationReason: '',
        affectedSections: [],
        dependencies: [],
        status: 'rejected'
      }
    );
    project.proposalStore.bundles.push(bundle);
    const view = buildIdeaStateView(project);
    assert.deepEqual(view.acceptedCards.map(card => card.title), ['Kabul edilen']);
    assert.deepEqual(view.pendingCards.map(card => card.title), ['Bekleyen']);
  });

  it('confirmed karar hem yapılacaklar hem yapılmayacaklar listesi üretir', () => {
    const project = structuredClone(baseProject());
    project.ideaDesign.concerns.push({
      id: 'concern-1',
      title: 'Bildirim kanalı',
      description: '',
      category: 'Genel',
      importance: 'important',
      status: 'decided',
      whyItMatters: '',
      questions: [],
      options: [],
      dependsOn: [],
      relatedConcerns: [],
      decisionRequired: true,
      uncertainty: 0.5,
      downstreamImpact: 0.5
    });
    project.ideaDesign.concernDecisions.push(concernDecision({
      answer: 'Hatırlatmayı e-posta ile göndereceğiz.',
      excluded: ['SMS bildirimi göndermeyeceğiz.'],
      scopeSplit: 'confirmed'
    }));
    const view = buildIdeaStateView(project);
    assert.equal(view.included.length, 1);
    assert.equal(view.included[0].text, 'Hatırlatmayı e-posta ile göndereceğiz.');
    assert.equal(view.included[0].concernTitle, 'Bildirim kanalı');
    assert.equal(view.excluded.length, 1);
    assert.equal(view.excluded[0].text, 'SMS bildirimi göndermeyeceğiz.');
  });

  it('legacy-unsplit karar yalnız yapılacaklar listesine gider; hiçbir ayrım çıkarılmaz', () => {
    const project = structuredClone(baseProject());
    project.ideaDesign.concernDecisions.push(concernDecision({
      answer: 'Hatırlatma e-posta ile; SMS yok.',
      excluded: [],
      scopeSplit: 'legacy-unsplit'
    }));
    const view = buildIdeaStateView(project);
    assert.equal(view.included.length, 1);
    assert.equal(view.included[0].text, 'Hatırlatma e-posta ile; SMS yok.');
    assert.equal(view.excluded.length, 0);
  });

  it('legacy-unsplit kayıtta excluded dolu olsa bile yok sayılır (savunmacı)', () => {
    const project = structuredClone(baseProject());
    project.ideaDesign.concernDecisions.push(concernDecision({
      answer: 'Hatırlatma e-posta ile.',
      excluded: ['Bu asla ayrı bir madde olmamalı'],
      scopeSplit: 'legacy-unsplit'
    }));
    const view = buildIdeaStateView(project);
    assert.equal(view.excluded.length, 0);
  });

  it('foundationGrounding varsa her alanın kaynağını (idea/assumption) view a taşır', () => {
    const project = structuredClone(baseProject());
    project.ideaLabSession = {
      ...project.ideaLabSession!,
      conceptSummary: {
        ...CONCEPT,
        currentAlternative: '',
        userConfirmed: false,
        foundationGrounding: {
          summary: { source: 'idea' },
          problemStatement: { source: 'assumption' },
          targetUser: { source: 'idea' },
          currentAlternative: { source: 'unknown', reason: 'Fikirde bugünkü çözüm yöntemi belirtilmemiş.' },
          desiredOutcome: { source: 'assumption' },
          mvpTarget: { source: 'idea' }
        }
      }
    };
    const view = buildIdeaStateView(project);
    assert.equal(view.foundation.fields.summary.source, 'idea');
    assert.equal(view.foundation.fields.problemStatement.source, 'assumption');
    assert.equal(view.foundation.fields.targetUser.source, 'idea');
    assert.equal(view.foundation.fields.desiredOutcome.source, 'assumption');
    assert.equal(view.foundation.fields.mvpTarget.source, 'idea');
  });

  it('foundationGrounding yoksa (eski belge) hiçbir alan idea-grounded İDDİA EDİLMEZ', () => {
    const project = structuredClone(baseProject());
    project.ideaLabSession = { ...project.ideaLabSession!, conceptSummary: { ...CONCEPT, userConfirmed: true } };
    const view = buildIdeaStateView(project);
    assert.equal(view.foundation.fields.summary.source, 'unspecified');
    assert.notEqual(view.foundation.fields.summary.source, 'idea');
  });

  it('enjeksiyon nedeniyle deterministik değere düşen alan idea-grounded İŞARETLENEMEZ', () => {
    const project = structuredClone(baseProject());
    project.ideaLabSession = {
      ...project.ideaLabSession!,
      conceptSummary: {
        ...CONCEPT,
        userConfirmed: false,
        foundationGrounding: {
          summary: { source: 'fallback' },
          problemStatement: { source: 'idea' },
          targetUser: { source: 'idea' },
          currentAlternative: { source: 'idea' },
          desiredOutcome: { source: 'idea' },
          mvpTarget: { source: 'idea' }
        }
      }
    };
    const view = buildIdeaStateView(project);
    assert.equal(view.foundation.fields.summary.source, 'fallback');
    assert.notEqual(view.foundation.fields.summary.source, 'idea');
  });

  it('unknown alan metni boş olsa bile gerekçesini taşır ve içerik boş SAYILMAZ', () => {
    const project = structuredClone(baseProject());
    project.ideaLabSession = {
      ...project.ideaLabSession!,
      conceptSummary: {
        ...CONCEPT,
        summary: '',
        problemStatement: '',
        targetUser: '',
        currentAlternative: '',
        desiredOutcome: '',
        mvpTarget: '',
        userConfirmed: false,
        foundationGrounding: {
          summary: { source: 'unknown', reason: 'Fikir çok kısa, özet çıkarılamadı.' },
          problemStatement: { source: 'unknown', reason: 'Problem hiç belirtilmemiş.' },
          targetUser: { source: 'unknown', reason: 'Hedef kullanıcı belirtilmemiş.' },
          currentAlternative: { source: 'unknown', reason: 'Belirtilmemiş.' },
          desiredOutcome: { source: 'unknown', reason: 'Belirtilmemiş.' },
          mvpTarget: { source: 'unknown', reason: 'Belirtilmemiş.' }
        }
      }
    };
    const view = buildIdeaStateView(project);
    assert.equal(view.foundation.hasContent, true, 'gerekçeli unknown alanlar GERÇEK içeriktir, boş sayılmaz');
    assert.equal(view.foundation.fields.summary.reason, 'Fikir çok kısa, özet çıkarılamadı.');
    assert.equal(view.foundation.fields.summary.text, '');
  });
});
