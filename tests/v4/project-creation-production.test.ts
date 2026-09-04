import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import { prepareInitialProject } from '../../src/v4/application/project-creation-service.js';

const SHORT_IDEA = 'At yarışı oyunu yapmak istiyorum';
const RICH_IDEA = 'Web SaaS admin paneli, kullanıcı rolleri, ödeme API entegrasyonu ve çevrimdışı mobil kullanım';

/**
 * Bu paket eskiden fikir uzunluğuna göre kurulmuş bir ÇATALI doğruluyordu:
 * 50 karakterin altındaki fikir `IDEA_EXPANSION`da kalır, üstündeki fikir
 * proje oluşturulur oluşturulmaz Fikir Laboratuvarı'nı çalıştırırdı. Çatal
 * kaldırıldı; şimdi ölçülen şey onun YOKLUĞU.
 */
describe('Production project creation routing', () => {
  it('fikir uzunluğu başlangıç fazını değiştirmez', () => {
    const short = analyzeIdea(SHORT_IDEA);
    const rich = analyzeIdea(RICH_IDEA);

    assert.ok(SHORT_IDEA.length < 50 && RICH_IDEA.length >= 50, 'iki fikir eski eşiğin iki yanında olmalı');
    assert.equal(short.lifecycle.activePhase, 'DISCOVERY');
    assert.equal(rich.lifecycle.activePhase, 'DISCOVERY');
  });

  it('proje oluşturma mimari üretmez ve fazı ilerletmez', () => {
    for (const idea of [SHORT_IDEA, RICH_IDEA]) {
      const result = prepareInitialProject({ project: analyzeIdea(idea) });

      assert.equal(result.project.lifecycle.activePhase, 'DISCOVERY', idea);
      assert.equal(
        result.project.ideaLabSession?.approaches?.length ?? 0,
        0,
        'Mimari alternatifler çözüm aşamasında istenir; proje açılışında değil'
      );
      assert.equal(
        result.project.ideaLabSession?.conceptSummary,
        undefined,
        'Kullanıcı konuşmadan fikir özeti üretilmemeli'
      );
    }
  });

  it('ilk revizyonu kaydeder', () => {
    const result = prepareInitialProject({ project: analyzeIdea(RICH_IDEA) });
    assert.ok(result.project.revisions.length > 0, 'proje açılışı bir revizyon bırakmalı');
  });
});
