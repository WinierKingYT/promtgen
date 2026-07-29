import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const testDirectory = resolve(process.cwd(), 'tests', 'v4');
const testFiles = readdirSync(testDirectory)
  .filter(file => file.endsWith('.test.js') || file.endsWith('.test.ts'))
  .sort()
  .map(file => resolve(testDirectory, file));

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
