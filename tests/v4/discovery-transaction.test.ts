import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { prepareDiscoveryTurnProject } from '../../src/v4/application/discovery-service.js';
import { createProjectDocument } from '../../src/v4/project-document.js';

describe('Discovery turn transaction preparation', () => {
  it('resolves the cloned bundle without mutating the committed project', () => {
    const project = createProjectDocument({
      idea: 'Yerel çalışan ayrıntılı bir proje planlama sistemi kurmak istiyorum.',
      name: 'Discovery transaction'
    });
    project.proposalStore.bundles.push({
      id: 'bundle-open',
      title: 'Karar turu',
      status: 'open',
      createdAt: new Date().toISOString(),
      items: [{
        id: 'suggestion-pending',
        title: 'Bir seçenek',
        description: 'Açıklama',
        status: 'pending',
        pros: [],
        cons: [],
        effort: 'low',
        affectedSections: ['scope'],
        dependencies: [],
        recommendation: 'consider'
      }]
    });

    const candidate = prepareDiscoveryTurnProject(project, 'bundle-open');

    assert.equal(candidate.proposalStore.bundles[0].status, 'resolved');
    assert.equal(candidate.proposalStore.bundles[0].items[0].status, 'deferred');
    assert.equal(project.proposalStore.bundles[0].status, 'open');
    assert.equal(project.proposalStore.bundles[0].items[0].status, 'pending');
  });
});
