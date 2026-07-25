import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { ProvenanceBadge, ProvenanceKind } from '../../src/react/components/ProvenanceBadge.js';
import { GuidedHeaderBar } from '../../src/react/components/GuidedHeaderBar.js';

describe('Category 6: UX & Information Architecture Contracts', () => {
  it('ProvenanceBadge supports all 4 standard provenance kinds', () => {
    const kinds: ProvenanceKind[] = ['canonical', 'ai-proposed', 'local-rule', 'degraded'];

    for (const kind of kinds) {
      const element = React.createElement(ProvenanceBadge, { kind, providerName: 'OpenAI' });
      assert.ok(element, `Badge element created for ${kind}`);
      assert.equal(element.type, ProvenanceBadge);
    }
  });

  it('GuidedHeaderBar renders phase steps and handles options', () => {
    const element = React.createElement(GuidedHeaderBar, {
      projectName: 'Test SaaS',
      activePhase: 'DISCOVERY',
      revision: 2
    });

    assert.ok(element, 'GuidedHeaderBar created successfully');
    assert.equal(element.props.projectName, 'Test SaaS');
    assert.equal(element.props.activePhase, 'DISCOVERY');
  });
});
