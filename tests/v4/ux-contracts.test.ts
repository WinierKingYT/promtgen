import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { ProvenanceBadge, ProvenanceKind } from '../../src/react/components/ProvenanceBadge.js';
import { GuidedHeaderBar, getPhaseGuidance } from '../../src/react/components/GuidedHeaderBar.js';
import { PlanCodeAlignmentPanel } from '../../src/react/components/PlanCodeAlignmentPanel.js';

describe('Category 6: UX & Information Architecture Contracts', () => {
  it('ProvenanceBadge supports all 4 standard provenance kinds', () => {
    const kinds: ProvenanceKind[] = ['canonical', 'ai-proposed', 'local-rule', 'degraded'];

    for (const kind of kinds) {
      const element = React.createElement(ProvenanceBadge, { kind, providerName: 'OpenAI' });
      assert.ok(element, `Badge element created for ${kind}`);
      assert.equal(element.type, ProvenanceBadge);
    }
  });

  it('GuidedHeaderBar uses the canonical phase registry and exposes one next action', () => {
    const element = React.createElement(GuidedHeaderBar, {
      projectName: 'Test SaaS',
      activePhase: 'DISCOVERY',
      revision: 2
    });
    const guidance = getPhaseGuidance('DISCOVERY');

    assert.ok(element, 'GuidedHeaderBar created successfully');
    assert.equal(element.props.projectName, 'Test SaaS');
    assert.equal(element.props.activePhase, 'DISCOVERY');
    assert.equal(guidance.label, 'Fikri Al');
    assert.match(guidance.next, /Kritik soruları/);
    assert.ok(guidance.step > 0 && guidance.total >= guidance.step);
  });

  it('exposes plan–code alignment through the controlled production commit boundary', () => {
    const onCommit = () => {};
    const element = React.createElement(PlanCodeAlignmentPanel, { project: {} as never, onCommit });
    assert.equal(element.type, PlanCodeAlignmentPanel);
    assert.equal(element.props.onCommit, onCommit, 'Alignment suggestions use the application commit boundary');
  });
});
