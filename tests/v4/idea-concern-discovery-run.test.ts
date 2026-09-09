import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createProjectDocument } from '../../src/v4/project-document.js';
import { stageWorkAvailable } from '../../src/v4/application/conversion-v2.js';
import { mapDiscoveryOutput, createDiscoveryFallback } from '../../src/v4/application/deterministic-idea-planning.js';
import { applyConcernDiscoveryResult } from '../../src/v4/application/idea-concern-discovery-run.js';
import type { DiscoveryBundleResult } from '../../src/v4/application/discovery-generation-service.js';

const now = '2026-01-01T00:00:00.000Z';

const provenance = {
  runId: 'run-1', mode: 'provider', providerId: 'gemini', model: 'g',
  promptVersion: '1.0.0', requestedAt: now, completedAt: now, latencyMs: 5,
  retryCount: 0, fallbackReason: null, schemaId: 'discovery-v1', schemaVersion: 1, inputHash: 'x'
} as never;

const option = (title: string) => ({
  kind: 'decision',
  title,
  description: `${title} kararı fikrin sınırını belirliyor.`,
  pros: ['açık'],
  cons: ['maliyet'],
  effort: 'medium',
  impact: 'high',
  recommended: true,
  affectedSections: ['scope']
});

const freshProject = () => createProjectDocument({
  idea: 'Bireysel geliştiriciler için yerel proje planlama aracı'
});

/** Gerçek sağlayıcı eşlemesinden geçmiş paket: `source.type === 'ai'`. */
function aiResult(project = freshProject()): DiscoveryBundleResult {
  const bundle = mapDiscoveryOutput(
    project,
    {
      summary: 'Tur',
      reply: 'Anladım.',
      analysisNote: '',
      options: [
        option('Veri nerede saklanacak?'),
        option('Kimlik doğrulama nasıl olacak?'),
        option('Çevrimdışı mod olacak mı?')
      ],
      openQuestions: [],
      uncertainty: [],
      optionalPaths: [],
      nextQuestionText: ''
    } as never,
    'gemini',
    provenance
  )!;
  return { bundle, usedFallback: false, error: null };
}

/** Sağlayıcı BAĞLI DEĞİL: servis yerel yedeği döndürür, hata YOKTUR. */
function providerAbsentResult(project = freshProject()): DiscoveryBundleResult {
  return {
    bundle: createDiscoveryFallback(project, 'fikrim'),
    usedFallback: true,
    error: null
  };
}

/** Sağlayıcı BAĞLI ama çağrı DÜŞTÜ: yerel yedek + hata. */
function providerFailedResult(project = freshProject()): DiscoveryBundleResult {
  return {
    bundle: createDiscoveryFallback(project, 'fikrim', 'Failed to fetch'),
    usedFallback: true,
    error: 'Failed to fetch'
  };
}

describe('runIdeaConcernDiscovery — fikir konularını üreten ikinci giriş kapısı', () => {
  it('sağlayıcı paketinden konu çıkarır ve aşama panelini AÇILABİLİR hâle getirir', () => {
    const project = freshProject();
    assert.equal(stageWorkAvailable(project), false, 'taze projede aşama işi olmamalı');
    assert.equal(project.ideaDesign.concerns.length, 0);

    const result = applyConcernDiscoveryResult(project, aiResult(project), 'Gemini');

    assert.equal(result.error, null);
    assert.ok(result.addedConcerns > 0, 'sağlayıcı paketinden konu çıkmalı');
    assert.equal(result.project.ideaDesign.concerns.length, result.addedConcerns);
    assert.equal(stageWorkAvailable(result.project), true, 'panel artık açılabilir olmalı');
    assert.match(result.notice, /konu/i);
  });

  it('SAĞLAYICI YOKKEN sessiz kalmaz: yerleşik sağlayıcı-yokluğu cümlesini döndürür', () => {
    const project = freshProject();
    const result = applyConcernDiscoveryResult(project, providerAbsentResult(project), 'Yerel kural motoru');

    assert.equal(result.addedConcerns, 0);
    assert.equal(result.project, project, 'belge değişmemeli');
    assert.ok(result.error, 'sessizlik yasak: kullanıcıya bir cümle dönmeli');
    assert.match(result.error!, /AI sağlayıcısı bağlaman gerekiyor/);
    assert.equal(stageWorkAvailable(result.project), false);
  });

  it('SAĞLAYICI DÜŞTÜĞÜNDE bunu yokluktan AYIRIR ve ham nedeni saklamaz', () => {
    const project = freshProject();
    const result = applyConcernDiscoveryResult(project, providerFailedResult(project), 'Gemini');

    assert.equal(result.addedConcerns, 0);
    assert.ok(result.error);
    assert.match(result.error!, /Gemini yanıt vermedi/);
    assert.match(result.error!, /Failed to fetch/, 'orijinal neden silinmemeli');
    assert.doesNotMatch(result.error!, /bağlaman gerekiyor/, 'yokluk ile düşüş aynı cümle olamaz');
  });

  it('sağlayıcı çalışıp YENİ konu çıkmadığında da sessiz kalmaz', () => {
    const project = freshProject();
    const empty = aiResult(project);
    // Bütün öneriler kapatılmış: OPEN_STATUSES elemesi hepsini düşürür.
    for (const item of empty.bundle.items) item.status = 'rejected';

    const result = applyConcernDiscoveryResult(project, empty, 'Gemini');

    assert.equal(result.error, null, 'bu bir hata değil');
    assert.equal(result.addedConcerns, 0);
    assert.equal(result.project, project, 'belge değişmemeli');
    assert.ok(result.notice.length > 0, 'sessizlik yasak: durum bir cümleyle söylenmeli');
  });

  it('ikinci koşu karara bağlanmış konuyu DİRİLTMEZ', () => {
    const project = freshProject();
    const first = applyConcernDiscoveryResult(project, aiResult(project), 'Gemini');
    const decided = {
      ...first.project,
      ideaDesign: {
        ...first.project.ideaDesign,
        concerns: first.project.ideaDesign.concerns.map((concern, index) =>
          index === 0 ? { ...concern, status: 'decided' as const } : concern)
      }
    };

    const second = applyConcernDiscoveryResult(decided, aiResult(project), 'Gemini');

    assert.equal(second.addedConcerns, 0, 'aynı paket ikinci kez konu eklememeli');
    assert.equal(
      second.project.ideaDesign.concerns.filter(concern => concern.status === 'decided').length,
      1,
      'karara bağlanmış konu açık hâle dönmemeli'
    );
  });
});
