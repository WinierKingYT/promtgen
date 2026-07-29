import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { discoverTestFiles } from '../../../scripts/lib/test-discovery.mjs';

test('V4 test discovery recursively finds JS and TS tests in nested folders', () => {
  const root = join(tmpdir(), `promtgen-test-discovery-${randomUUID()}`);
  const nested = join(root, 'contracts', 'provider');
  mkdirSync(nested, { recursive: true });
  writeFileSync(join(root, 'root.test.js'), '');
  writeFileSync(join(nested, 'nested.test.ts'), '');
  writeFileSync(join(nested, 'ignored.spec.ts'), '');
  writeFileSync(join(nested, 'notes.md'), '');

  try {
    const relative = discoverTestFiles(root).map(path => path.slice(root.length + 1).replaceAll('\\', '/'));
    assert.deepEqual(relative, ['contracts/provider/nested.test.ts', 'root.test.js']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

