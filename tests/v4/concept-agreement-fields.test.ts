import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  closeOpenQuestion,
  describeConceptAgreementBlockers,
  getConceptAgreementBlockers,
  isConceptAgreementValid,
  lines,
  type ConceptAgreementDraftText
} from '../../src/v4/application/concept-agreement-fields.js';

const fullDraft = (overrides: Partial<ConceptAgreementDraftText> = {}): ConceptAgreementDraftText => ({
  summary: 'Özet',
  targetUser: 'Kullanıcı',
  problemStatement: 'Problem',
  currentAlternative: 'Bugünkü çözüm',
  desiredOutcome: 'Sonuç',
  firstReleaseTarget: 'İlk sürüm',
  confirmedFeatures: 'Özellik 1',
  outOfScope: 'Kapsam dışı 1',
  openQuestions: '',
  ...overrides
});

describe('getConceptAgreementBlockers / isConceptAgreementValid', () => {
  it('her şey doluyken hiçbir engel bildirmez ve geçerlidir', () => {
    const blockers = getConceptAgreementBlockers(fullDraft());
    assert.deepEqual(blockers.emptyTextFields, []);
    assert.deepEqual(blockers.emptyScopeLists, []);
    assert.equal(blockers.openQuestionCount, 0);
    assert.equal(isConceptAgreementValid(blockers), true);
  });

  it('boş yorum alanlarını TEK TEK bildirir', () => {
    const blockers = getConceptAgreementBlockers(fullDraft({ summary: '  ', targetUser: '' }));
    assert.deepEqual(blockers.emptyTextFields, ['summary', 'targetUser']);
    assert.equal(isConceptAgreementValid(blockers), false);
  });

  it('boş kapsam listelerini bildirir', () => {
    const blockers = getConceptAgreementBlockers(fullDraft({ confirmedFeatures: '', outOfScope: '   \n  ' }));
    assert.deepEqual(blockers.emptyScopeLists, ['confirmedFeatures', 'outOfScope']);
    assert.equal(isConceptAgreementValid(blockers), false);
  });

  it('açık soru sayısını verir; sıfır olmadıkça geçersizdir', () => {
    const blockers = getConceptAgreementBlockers(fullDraft({ openQuestions: 'Soru 1\nSoru 2' }));
    assert.equal(blockers.openQuestionCount, 2);
    assert.equal(isConceptAgreementValid(blockers), false);
  });

  it('gate kuralını TEKRARLAMAZ: yalnız taslağın kendi altı yorum alanı + iki kapsam listesi + açık soru sayısını okur', () => {
    // technicalApproaches / knownRisks taslakta hiç yok -- bu fonksiyon onları bilmez.
    const blockers = getConceptAgreementBlockers(fullDraft());
    assert.deepEqual(Object.keys(blockers), ['emptyTextFields', 'emptyScopeLists', 'openQuestionCount']);
  });
});

describe('describeConceptAgreementBlockers', () => {
  it('boş alan yoksa boş dizi döner', () => {
    assert.deepEqual(describeConceptAgreementBlockers(getConceptAgreementBlockers(fullDraft())), []);
  });

  it('eksik alanları KULLANICIYA görünen adlarıyla listeler', () => {
    const blockers = getConceptAgreementBlockers(fullDraft({ summary: '', confirmedFeatures: '' }));
    const described = describeConceptAgreementBlockers(blockers);
    assert.ok(described.includes('Sistem yorumu'));
    assert.ok(described.includes('Kapsam içinde'));
  });

  it('açık soru sayısını ayrı bir ifadeyle ekler (CONCEPT_FIELD_LABELS\'a girmeden)', () => {
    const blockers = getConceptAgreementBlockers(fullDraft({ openQuestions: 'S1\nS2\nS3' }));
    const described = describeConceptAgreementBlockers(blockers);
    assert.ok(described.some(label => label.includes('3')), 'sayı metinde geçmeli');
  });
});

describe('closeOpenQuestion', () => {
  it('yalnız verilen indeksteki satırı kaldırır, diğerlerinin sırasını korur', () => {
    const result = closeOpenQuestion(['Soru A', 'Soru B', 'Soru C'], 1);
    assert.deepEqual(result, ['Soru A', 'Soru C']);
  });

  it('girdi dizisini MUTASYONA UĞRATMAZ', () => {
    const input = ['Soru A', 'Soru B'];
    const snapshot = [...input];
    closeOpenQuestion(input, 0);
    assert.deepEqual(input, snapshot);
  });

  it('tek soru kapatılınca boş dizi döner', () => {
    assert.deepEqual(closeOpenQuestion(['Tek soru'], 0), []);
  });
});

describe('lines', () => {
  it('boş satırları ve baş/son boşlukları eler', () => {
    assert.deepEqual(lines('  a  \n\n b\n   \nc'), ['a', 'b', 'c']);
  });

  it('boş metinde boş dizi döner', () => {
    assert.deepEqual(lines(''), []);
    assert.deepEqual(lines('   \n  '), []);
  });
});
