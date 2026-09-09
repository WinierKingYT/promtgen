import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CONCEPT_FIELD_LABELS,
  conceptFieldLabel
} from '../../../src/v4/application/concept-field-labels.js';
import { getConceptAgreementGate } from '../../../src/v4/application/idea-discussion-service.js';
import { previewIdeaPlanConversion } from '../../../src/v4/application/idea-plan-conversion-service.js';
import { normalizeConcern } from '../../../src/v4/application/concerns.js';
import { createProjectDocument } from '../../../src/v4/project-document.js';
import type { ProjectDocumentV5 } from '../../../src/v4/contracts.js';

const APPROVED = {
  status: 'approved' as const,
  approvedAtRevision: 3,
  approvedAt: '2026-08-16T00:00:00.000Z',
  reopenedReason: null
};

function legacyProject(): ProjectDocumentV5 {
  return createProjectDocument({ idea: 'Saha envanter uygulaması' }) as ProjectDocumentV5;
}

/** Aşama modeline girmiş ama hiçbir konusu karara bağlanmamış belge. */
function deferredStageProject(): ProjectDocumentV5 {
  const document = legacyProject();
  document.ideaDesign.concerns = [normalizeConcern({ id: 'c1', title: 'Fatura kaydı', status: 'deferred' }, 0)];
  document.ideaDesign.concernDecisions = [];
  document.ideaDesign.approval = { ...APPROVED };
  document.solutionDesign.approval = { ...APPROVED };
  return document;
}

/**
 * A2 — KULLANICIYA HAM TypeScript ALAN ADI GÖSTERİLİYORDU.
 *
 * ÖLÇÜM (bu paketten önce): boş bir eski belgenin dönüşüm engelleri sekiz
 * satırın sekizinde de ham anahtar taşıyordu — "summary alanı tamamlanmalı.",
 * "confirmedFeatures listesi en az bir madde içermeli." Kullanıcının ekranında
 * o kutuların adı "Sistem yorumu" ve "Kapsam içinde"dir; hata mesajı baktığı
 * kutunun adını söylemiyordu.
 *
 * Etiketler `ConceptAgreementEditor` ile AYNI sabitten okunur; ikisi ayrı
 * yerlerde yazılsaydı biri değişince diğeri sessizce yalan söylerdi
 * (`16abc11`in dersi).
 */
describe('Fikir belgesi alan etiketleri', () => {
  it('etiketler kullanıcının gördüğü kutu adlarıdır', () => {
    assert.deepEqual({ ...CONCEPT_FIELD_LABELS }, {
      summary: 'Sistem yorumu',
      targetUser: 'Birincil kullanıcı',
      problemStatement: 'Ana problem',
      currentAlternative: 'Bugünkü çözüm',
      desiredOutcome: 'Beklenen ana sonuç',
      firstReleaseTarget: 'İlk sürüm hedefi',
      confirmedFeatures: 'Kapsam içinde',
      outOfScope: 'Kapsam dışında'
    });
  });

  it('kapının üretebildiği HER anahtarın etiketi vardır', () => {
    const gate = getConceptAgreementGate(legacyProject());
    const stageGate = getConceptAgreementGate(deferredStageProject());
    const keys = [
      ...gate.missingInterpretationFields,
      ...gate.missingScopeLists,
      ...stageGate.missingInterpretationFields,
      ...stageGate.missingScopeLists
    ];
    assert.ok(keys.length > 0, 'ölçüm boş küme üzerinden yapılmamalı');
    for (const key of keys) assert.ok(conceptFieldLabel(key), key);
  });

  it('etiketi olmayan anahtar SESSİZCE ham adıyla geçmez', () => {
    assert.throws(
      () => conceptFieldLabel('technicalApproaches'),
      /technicalApproaches/,
      'eksik etiket ham anahtarla maskelenmemeli'
    );
  });
});

describe('Dönüşüm engelleri ham alan adı sızdırmaz', () => {
  const RAW_KEYS = [
    'summary', 'targetUser', 'problemStatement', 'currentAlternative',
    'desiredOutcome', 'firstReleaseTarget', 'confirmedFeatures', 'outOfScope'
  ];

  it('eski belgede sekiz engelin sekizi de Türkçe kutu adı taşır', () => {
    const blockers = previewIdeaPlanConversion(legacyProject()).blockers;
    for (const label of Object.values(CONCEPT_FIELD_LABELS)) {
      assert.ok(blockers.some(blocker => blocker.includes(label)), `${label} engelde yok: ${JSON.stringify(blockers)}`);
    }
    for (const key of RAW_KEYS) {
      assert.ok(!blockers.some(blocker => blocker.includes(key)), `ham anahtar sızdı: ${key}`);
    }
  });

  it('aşama modelinde tek engel de Türkçe kutu adı taşır', () => {
    const blockers = previewIdeaPlanConversion(deferredStageProject()).blockers;
    assert.ok(blockers.some(blocker => blocker.includes('Kapsam içinde')), JSON.stringify(blockers));
    for (const key of RAW_KEYS) {
      assert.ok(!blockers.some(blocker => blocker.includes(key)), `ham anahtar sızdı: ${key}`);
    }
  });
});
