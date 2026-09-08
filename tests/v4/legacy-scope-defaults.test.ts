import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  REMOVED_SCOPE_DEFAULTS,
  findRemovedScopeDefaults,
  isRemovedScopeDefault
} from '../../src/v4/application/legacy-scope-defaults.js';
import { ConceptAgreementEditor } from '../../src/react/components/ConceptAgreementEditor.js';
import { createInitialConceptInterpretation } from '../../src/v4/application/idea-discussion-service.js';
import { createProjectDocument } from '../../src/v4/project-document.js';
import type { ProjectDocumentV5 } from '../../src/v4/contracts.js';

/**
 * ÖLÇÜLMÜŞ ZARARIN İKİNCİ YARISI.
 *
 * `38bc893` ve `06d2541` uydurulmuş kapsam varsayılanlarını KAYNAKTAN kaldırdı;
 * yeni projeler artık temiz doğuyor. Ama o commitlerden ÖNCE oluşturulmuş
 * belgeler uydurmayı hâlâ taşıyor: kullanıcının belgesinde "MVP dışında"
 * alanında `Bulut senkronizasyonu ve çok kullanıcılı işbirliği` yazıyor —
 * kullanıcı "multiplayer olucak" demişken.
 *
 * Belgeyi sessizce düzeltmiyoruz (kullanıcının belgesi). Ama yalanı biz
 * koyduk; haber vermemek onu sürdürmek olurdu. Bu yüzden tespit + uyarı.
 */
describe('kaldırılmış kapsam varsayılanı tespiti', () => {
  it('ÖLÇÜLEN VAKA: "Bulut senkronizasyonu ve çok kullanıcılı işbirliği" tespit edilir', () => {
    assert.equal(isRemovedScopeDefault('Bulut senkronizasyonu ve çok kullanıcılı işbirliği'), true);
    assert.deepEqual(
      findRemovedScopeDefaults([
        'Bulut senkronizasyonu ve çok kullanıcılı işbirliği',
        'İleri seviye raporlama ve optimizasyon'
      ]),
      ['Bulut senkronizasyonu ve çok kullanıcılı işbirliği', 'İleri seviye raporlama ve optimizasyon']
    );
  });

  it('kullanıcının kendi yazdığı satır tespit EDİLMEZ', () => {
    // En kritik yanlış-pozitif testi: kullanıcıya "bunu sen yazmadın" demek,
    // yazdığı bir satır için, uydurmanın aynadaki hâli olurdu.
    for (const line of [
      'Çok oyunculu at yarışı modu',
      'Bulut kaydı olmayacak',
      'Temel oynanış',
      'Yerel veri saklama katmanı'
    ]) {
      assert.equal(isRemovedScopeDefault(line), false, `Kullanıcının satırı yanlışlıkla işaretlendi: ${line}`);
    }
  });

  it('kısmi eşleşme tespit EDİLMEZ', () => {
    // Daha kısa parça:
    assert.equal(isRemovedScopeDefault('Bulut senkronizasyonu'), false);
    // Varsayılanı İÇİNDE geçiren daha uzun cümle:
    assert.equal(
      isRemovedScopeDefault('Bulut senkronizasyonu ve çok kullanıcılı işbirliği ilk sürümde olacak'),
      false
    );
    assert.equal(isRemovedScopeDefault('Gelişmiş analitik ve raporlama'), false);
  });

  it('boş liste sorunsuz', () => {
    assert.deepEqual(findRemovedScopeDefaults([]), []);
    assert.equal(isRemovedScopeDefault(''), false);
  });

  it('SAF: girdi mutasyona uğramaz, çıktı yeni dizidir', () => {
    const input = ['Gelişmiş analitik', 'Kullanıcının kendi maddesi'];
    const snapshot = [...input];
    const result = findRemovedScopeDefaults(input);

    assert.deepEqual(input, snapshot);
    assert.notEqual(result, input);
    assert.deepEqual(result, ['Gelişmiş analitik']);
  });

  it('dondurulmuş tarihsel liste 30 maddedir ve her maddesi tespit edilir', () => {
    // Bu sayı bir SÖZLEŞMEDİR. Liste yalnız küçülebilir; yeni bir varsayılan
    // eklemek gerekiyorsa sorun varsayılanın kendisidir, bu liste değil.
    assert.equal(REMOVED_SCOPE_DEFAULTS.length, 30);
    assert.ok(Object.isFrozen(REMOVED_SCOPE_DEFAULTS));
    assert.equal(new Set(REMOVED_SCOPE_DEFAULTS).size, 30);
    for (const entry of REMOVED_SCOPE_DEFAULTS) {
      assert.equal(isRemovedScopeDefault(entry), true, `Listedeki madde tespit edilmedi: ${entry}`);
    }
  });
});

function ideaProject(outOfScope: string[], confirmedFeatures: string[]): ProjectDocumentV5 {
  const project = createProjectDocument({ idea: 'unityde bir at sistemi yapmak istiyorum multiplayer olucak' }) as ProjectDocumentV5;
  project.ideaLabSession!.conceptSummary = {
    ...createInitialConceptInterpretation(project),
    summary: 'Çok oyunculu at sistemi.',
    targetUser: 'Unity geliştiricisi',
    problemStatement: 'At mekaniği yok.',
    currentAlternative: 'Elle yazılmış prototip.',
    desiredOutcome: 'Çalışan at sistemi.',
    firstReleaseTarget: 'Tek at, tek sahne.',
    confirmedFeatures,
    outOfScope,
    openQuestions: [],
    userConfirmed: false
  };
  return project;
}

function render(project: ProjectDocumentV5): string {
  return renderToStaticMarkup(React.createElement(ConceptAgreementEditor, { project, onCommit: () => {} }));
}

describe('kapsam alanı uyarısı arayüzde', () => {
  it('eşleşme varken uyarı görünür ve satırı gösterir', () => {
    const markup = render(ideaProject(['Bulut senkronizasyonu ve çok kullanıcılı işbirliği'], ['Fikir belgesi']));

    assert.match(markup, /legacy-scope-notice/);
    assert.match(markup, /Bunu sen yazmadın/);
    assert.match(markup, /Bulut senkronizasyonu ve çok kullanıcılı işbirliği/);
  });

  it('uyarı ilgili alanla erişilebilir biçimde ilişkilendirilir', () => {
    const markup = render(ideaProject(['Gelişmiş analitik'], ['Fikir belgesi']));

    assert.match(markup, /aria-describedby="legacy-scope-outOfScope"/);
    assert.match(markup, /id="legacy-scope-outOfScope"/);
  });

  it('satır düzeltilince uyarı KAYBOLUR - ayrı bir kapatma durumu yoktur', () => {
    const markup = render(ideaProject(['Bulut senkronizasyonu ilk sürümde yok'], ['Fikir belgesi']));

    assert.doesNotMatch(markup, /legacy-scope-notice/);
    assert.doesNotMatch(markup, /Bunu sen yazmadın/);
  });

  it('temiz belgede hiç uyarı yoktur', () => {
    const markup = render(ideaProject(['Kendi yazdığım kapsam dışı madde'], ['Kendi yazdığım özellik']));

    assert.doesNotMatch(markup, /legacy-scope-notice/);
  });

  it('MVP içinde alanı da denetlenir', () => {
    const markup = render(ideaProject(['Kendi maddem'], ['Temel oynanış döngüsü']));

    assert.match(markup, /aria-describedby="legacy-scope-confirmedFeatures"/);
    assert.match(markup, /Temel oynanış döngüsü/);
  });

  it('GÖSTERİM ÖZELLİĞİDİR: belgeye hiçbir yazma olmaz', () => {
    const project = ideaProject(['Bulut senkronizasyonu ve çok kullanıcılı işbirliği'], ['Temel oynanış döngüsü']);
    const before = JSON.stringify(project);
    let committed = 0;

    renderToStaticMarkup(
      React.createElement(ConceptAgreementEditor, { project, onCommit: () => { committed += 1; } })
    );

    assert.equal(JSON.stringify(project), before, 'Uyarı belgeyi değiştirdi');
    assert.equal(committed, 0, 'Uyarı kullanıcı tıklaması olmadan kayıt tetikledi');
  });
});
