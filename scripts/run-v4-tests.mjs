import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { discoverTestFiles } from './lib/test-discovery.mjs';

const testDirectory = resolve(process.cwd(), 'tests', 'v4');
const testFiles = discoverTestFiles(testDirectory);

if (testFiles.length === 0) {
  console.error('No V4 test files were discovered.');
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--test', ...testFiles],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: false
  }
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
