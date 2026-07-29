import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { GraphStore as CompatibilityGraphStore } from '../../../src/core/traceability/graph-store.js';
import { TraceabilityEngine as CompatibilityTraceabilityEngine } from '../../../src/core/traceability/traceability-engine.js';
import { GraphStore } from '../../../src/v4/traceability/graph-store.js';
import { TraceabilityEngine } from '../../../src/v4/traceability/traceability-engine.js';

test('legacy traceability imports resolve to the single v4 implementation', () => {
  assert.equal(CompatibilityGraphStore, GraphStore);
  assert.equal(CompatibilityTraceabilityEngine, TraceabilityEngine);
});

test('canonical and v4 traceability production files never import src/core', () => {
  const root = process.cwd();
  const canonicalSource = readFileSync(path.resolve(root, 'src/v4/canonical-graph.js'), 'utf8');
  assert.doesNotMatch(canonicalSource, /core\/traceability/);
  assert.match(canonicalSource, /\.\/traceability\/graph-store\.js/);

  const traceabilityDirectory = path.resolve(root, 'src/v4/traceability');
  for (const entry of readdirSync(traceabilityDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    const source = readFileSync(path.join(traceabilityDirectory, entry.name), 'utf8');
    assert.doesNotMatch(source, /src\/core|core\/traceability|\.\.\/\.\.\/core/);
  }
});

test('compatibility files contain no second traceability implementation', () => {
  const compatibilityDirectory = path.resolve(process.cwd(), 'src/core/traceability');
  for (const entry of readdirSync(compatibilityDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    const source = readFileSync(path.join(compatibilityDirectory, entry.name), 'utf8');
    const executableLines = source
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('//'));
    assert.ok(
      executableLines.every(line => line.startsWith('export ')),
      `${entry.name} yalnız v4 compatibility re-export içermeli.`
    );
  }
});

