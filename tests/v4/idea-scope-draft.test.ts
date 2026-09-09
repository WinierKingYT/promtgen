import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createProjectDocument } from '../../src/v4/project-document.js';
import { createInitialConceptInterpretation } from '../../src/v4/application/idea-discussion-service.js';
import { addExpansionCardAsSuggestion } from '../../src/v4/application/idea-expansion-intake.js';
import { resolveConceptScopeDraft } from '../../src/v4/application/idea-scope-draft.js';
import { SCOPE_NARROWING_CATEGORY_LABEL } from '../../src/v4/idea-expansion/categories.js';
import { ConceptAgreementEditor } from '../../src/react/components/ConceptAgreementEditor.js';
import type { ConceptSummary, ProjectDocumentV5 } from '../../src/v4/contracts.js';

const IDEA = 'unityde bir at sistemi yapmak istiyorum multiplayer olucak';

function card(id: string, title: string, kind = 'feature') {
  return { id, title, description: `${title} aciklamasi`, kind, origin: 'local-seed' as const };
}

function baseProject(summary: Partial<ConceptSummary> = {}): ProjectDocumentV5 {
  const project = createProjectDocument({ idea: IDEA }) as ProjectDocumentV5;
  const session = project.ideaLabSession || {};
  session.conceptSummary = {
    ...createInitialConceptInterpretation(project),
    summary: 'Cok oyunculu at sistemi.',
    targetUser: 'Unity gelistiricisi',
    problemStatement: 'At mekanigi yok.',
    currentAlternative: 'Elle yazilmis prototip.',
    desiredOutcome: 'Calisan at sistemi.',
    firstReleaseTarget: 'Tek at, tek sahne.',
    confirmedFeatures: [],
    outOfScope: [],
    openQuestions: [],
    ...summary
  };
  project.ideaLabSession = session;
  return project;
}

/** Panodaki "Fikre ekle" ile GERCEK alim yolundan iki kart kabul eder. */
function withAcceptedCards(project: ProjectDocumentV5): ProjectDocumentV5 {
  let next = addExpansionCardAsSuggestion(
    project,
    card('seed-core-depth-0', 'Ana akışı tek ekrana indir'),
    'Ana akışı derinleştir',
    { status: 'accepted' }
  ).project;
  next = addExpansionCardAsSuggestion(
    next,
    card('seed-narrow-0', 'İkincil kullanıcı grubunu ilk sürümden çıkar'),
    SCOPE_NARROWING_CATEGORY_LABEL,
    { status: 'accepted' }
  ).project;
  return next;
}

function summaryOf(project: ProjectDocumentV5): ConceptSummary {
  const summary = project.ideaLabSession?.conceptSummary;
  if (!summary) throw new Error('Test kurulumu konsept özeti üretmedi.');
  return summary;
}

describe('fikir aşamasından türetilen kapsam taslağı', () => {
  it('kabul edilen kartlar boş kapsam kutularına taslak olarak düşer', () => {
    const project = withAcceptedCards(baseProject());

    const draft = resolveConceptScopeDraft(project, summaryOf(project));

    assert.deepEqual(draft.confirmedFeatures, ['Ana akışı tek ekrana indir']);
    assert.deepEqual(draft.outOfScope, ['İkincil kullanıcı grubunu ilk sürümden çıkar']);
    assert.deepEqual(draft.derived.confirmedFeatures, ['Ana akışı tek ekrana indir']);
    assert.deepEqual(draft.derived.outOfScope, ['İkincil kullanıcı grubunu ilk sürümden çıkar']);
  });

  it('KULLANICININ KENDİ İŞİ KAZANIR: dolu alan türetmeyle EZİLMEZ', () => {
    const project = withAcceptedCards(baseProject({ confirmedFeatures: ['Kendi yazdığım özellik'] }));

    const draft = resolveConceptScopeDraft(project, summaryOf(project));

    assert.deepEqual(draft.confirmedFeatures, ['Kendi yazdığım özellik']);
    assert.deepEqual(draft.derived.confirmedFeatures, []);
    // Boş kalan diğer alan yine de doldurulur; alanlar birbirini kilitlemez.
    assert.deepEqual(draft.outOfScope, ['İkincil kullanıcı grubunu ilk sürümden çıkar']);
  });

  it('aynı madde iki listede birden ya da aynı listede iki kez görünmez', () => {
    let project = baseProject({ confirmedFeatures: ['İkincil kullanıcı grubunu ilk sürümden çıkar'] });
    project = withAcceptedCards(project);

    const draft = resolveConceptScopeDraft(project, summaryOf(project));

    assert.deepEqual(draft.outOfScope, []);
    assert.deepEqual(draft.confirmedFeatures, ['İkincil kullanıcı grubunu ilk sürümden çıkar']);
  });

  it('karar bekleyen (pending) kart taslağa GİRMEZ', () => {
    const project = addExpansionCardAsSuggestion(
      baseProject(),
      card('seed-core-depth-0', 'Ana akışı tek ekrana indir'),
      'Ana akışı derinleştir'
    ).project;

    const draft = resolveConceptScopeDraft(project, summaryOf(project));

    assert.deepEqual(draft.confirmedFeatures, []);
    assert.deepEqual(draft.outOfScope, []);
  });

  it('soru ve risk kartları kapsam kutularına GİRMEZ', () => {
    let project = baseProject();
    project = addExpansionCardAsSuggestion(project, card('c-q', 'Hangi platform önce?', 'question'), 'Ana akışı derinleştir', { status: 'accepted' }).project;
    project = addExpansionCardAsSuggestion(project, card('c-r', 'Ağ gecikmesi oyunu bozabilir', 'risk'), 'Ana akışı derinleştir', { status: 'accepted' }).project;

    const draft = resolveConceptScopeDraft(project, summaryOf(project));

    assert.deepEqual(draft.confirmedFeatures, []);
    assert.deepEqual(draft.outOfScope, []);
  });

  it('AŞAMA MODELİ YOLUNA DOKUNMAZ: o yol açıkken türetme hiç çalışmaz', () => {
    const project = withAcceptedCards(baseProject());
    const design = project.ideaDesign;
    if (!design) throw new Error('Test kurulumu fikir aşamasını üretmedi.');
    design.approval.status = 'approved';

    const draft = resolveConceptScopeDraft(project, summaryOf(project));

    assert.deepEqual(draft.confirmedFeatures, []);
    assert.deepEqual(draft.outOfScope, []);
    assert.deepEqual(draft.derived.confirmedFeatures, []);
  });

  it('SAF: belgeyi değiştirmez', () => {
    const project = withAcceptedCards(baseProject());
    const before = JSON.stringify(project);

    resolveConceptScopeDraft(project, summaryOf(project));

    assert.equal(JSON.stringify(project), before);
  });
});

describe('türetilen kapsam taslağı arayüzde', () => {
  const render = (project: ProjectDocumentV5) =>
    renderToStaticMarkup(React.createElement(ConceptAgreementEditor, { project, onCommit: () => {} }));

  /** Satırın KUTUNUN İÇİNDE olduğunu kanıtlar; "sayfanın bir yerinde" yetmez. */
  const textareaOf = (markup: string, label: string) => {
    const start = markup.indexOf('<textarea', markup.indexOf(label));
    const open = markup.indexOf('>', start) + 1;
    return markup.slice(open, markup.indexOf('</textarea>', open));
  };

  it('kutular kabul edilen kartlarla dolu gelir', () => {
    const markup = render(withAcceptedCards(baseProject()));

    assert.equal(textareaOf(markup, 'Kapsam içinde'), 'Ana akışı tek ekrana indir');
    assert.equal(textareaOf(markup, 'Kapsam dışında'), 'İkincil kullanıcı grubunu ilk sürümden çıkar');
  });

  it('kullanıcının kendi satırları kutuda AYNEN kalır', () => {
    const markup = render(withAcceptedCards(baseProject({
      confirmedFeatures: ['Kendi yazdığım özellik'],
      outOfScope: ['Kendi yazdığım kapsam dışı madde']
    })));

    assert.equal(textareaOf(markup, 'Kapsam içinde'), 'Kendi yazdığım özellik');
    assert.equal(textareaOf(markup, 'Kapsam dışında'), 'Kendi yazdığım kapsam dışı madde');
  });

  it('KÖKEN GÖRÜNÜR: satırların fikir aşamasından geldiği ve taslak olduğu yazar', () => {
    const markup = render(withAcceptedCards(baseProject()));

    assert.match(markup, /derived-scope-notice/);
    assert.match(markup, /Fikir aşamasında kabul ettiğin kartlardan geldi/);
    assert.match(markup, /derived-scope-confirmedFeatures/);
    assert.match(markup, /derived-scope-outOfScope/);
  });

  it('kullanıcının kendi doldurduğu alanda köken bildirimi YOKTUR', () => {
    const project = withAcceptedCards(baseProject({
      confirmedFeatures: ['Kendi yazdığım özellik'],
      outOfScope: ['Kendi yazdığım kapsam dışı madde']
    }));

    const markup = render(project);

    assert.doesNotMatch(markup, /derived-scope-notice/);
  });

  it('GÖSTERİM ÖZELLİĞİDİR: belgeye hiçbir yazma olmaz', () => {
    const project = withAcceptedCards(baseProject());
    const before = JSON.stringify(project);
    let committed = 0;

    renderToStaticMarkup(
      React.createElement(ConceptAgreementEditor, { project, onCommit: () => { committed += 1; } })
    );

    assert.equal(JSON.stringify(project), before, 'Taslak belgeyi değiştirdi');
    assert.equal(committed, 0, 'Taslak kullanıcı tıklaması olmadan kayıt tetikledi');
  });
});
