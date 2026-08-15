import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hasProjectInventory, hasTraceabilityLinks } from '../../../src/v4/application/plan-panel-visibility.js';
import { createProjectDocument } from '../../../src/v4/project-document.js';

function baseProject() {
  // createProjectDocument seçenek nesnesi alır, konumlu argüman değil.
  return createProjectDocument({ idea: 'Test fikri' });
}

describe('plan paneli görünürlük koşulları', () => {
  it('yeni projede izlenebilirlik bağlantısı yoktur', () => {
    assert.equal(hasTraceabilityLinks(baseProject()), false);
  });

  it('kanonik kayıtlar arasında bağlantı oluşunca izlenebilirlik görünür', () => {
    const project = baseProject();
    // Decision ve Requirement kontratları (src/v4/contracts.ts) birbirine
    // doğrudan referans alanıyla bağlanmıyor; bağlantı traceLinks üzerinden
    // kurulur ve buildTraceabilityView kenarları oradan üretir.
    project.decisions.push({
      id: 'dec-1',
      title: 'Karar',
      decision: 'Test kararı alındı',
      rationale: 'Test gerekçesi',
      alternatives: [],
      consequences: [],
      status: 'accepted',
      sourceSuggestionId: '',
      affectedSectionIds: []
    } as never);
    project.requirements.push({
      id: 'req-1',
      title: 'Gereksinim',
      statement: 'Test gereksinimi',
      kind: 'functional',
      priority: 'must',
      acceptanceCriteria: [],
      sourceObjectiveIds: [],
      sourceSuggestionIds: [],
      status: 'accepted'
    } as never);
    project.traceLinks.push({
      id: 'link-1',
      fromType: 'decision',
      fromId: 'dec-1',
      toType: 'requirement',
      toId: 'req-1',
      relation: 'derives'
    } as never);

    assert.equal(hasTraceabilityLinks(project), true);
  });

  it('envanter yokken kod hizalaması görünmez', () => {
    assert.equal(hasProjectInventory(baseProject()), false);
  });

  it('envanter boş dizi olsa bile taranmış sayılır', () => {
    const project = baseProject();
    project.profile.projectInventory = { inventory: [] } as never;

    assert.equal(hasProjectInventory(project), true);
  });

  it('envanter dizi değilse görünmez', () => {
    const project = baseProject();
    project.profile.projectInventory = { inventory: null } as never;

    assert.equal(hasProjectInventory(project), false);
  });
});
