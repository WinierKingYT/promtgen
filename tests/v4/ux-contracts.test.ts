import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { ProvenanceBadge, ProvenanceKind } from '../../src/react/components/ProvenanceBadge.js';
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

  // Aşama modeli tek kaynaktan türer: IdeaStudioView.
  // PHASE_REGISTRY (9 faz) alan modelinde yaşamaya devam eder ve
  // planning-engine tarafından yazılır, ama hiçbir React bileşeni onu
  // okumaz — gezinme onun üzerinden kurulmaz. Alt Proje C kararı.
  it('hiçbir React bileşeni PHASE_REGISTRY okumaz', async () => {
    const { readdir, readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');

    async function sourceFiles(dir: string): Promise<string[]> {
      const entries = await readdir(dir, { withFileTypes: true });
      const nested = await Promise.all(entries.map(async entry => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(full);
        return /\.tsx?$/.test(entry.name) ? [full] : [];
      }));
      return nested.flat();
    }

    const files = await sourceFiles('src/react');
    const offenders: string[] = [];
    for (const file of files) {
      if ((await readFile(file, 'utf8')).includes('PHASE_REGISTRY')) offenders.push(file);
    }

    assert.deepEqual(offenders, [], `PHASE_REGISTRY React katmanında okunuyor: ${offenders.join(', ')}`);
  });

  it('exposes plan–code alignment through the controlled production commit boundary', () => {
    const onCommit = () => {};
    const element = React.createElement(PlanCodeAlignmentPanel, { project: {} as never, onCommit });
    assert.equal(element.type, PlanCodeAlignmentPanel);
    assert.equal(element.props.onCommit, onCommit, 'Alignment suggestions use the application commit boundary');
  });
});
