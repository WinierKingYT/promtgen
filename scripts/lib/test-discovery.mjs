import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const TEST_FILE_PATTERN = /\.test\.(?:js|ts)$/;

export function discoverTestFiles(directory) {
  const root = resolve(directory);
  const discovered = [];

  function visit(currentDirectory) {
    for (const entry of readdirSync(currentDirectory, { withFileTypes: true })) {
      const entryPath = join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile() && TEST_FILE_PATTERN.test(entry.name)) {
        discovered.push(entryPath);
      }
    }
  }

  visit(root);
  return discovered.sort((left, right) => left.localeCompare(right, 'en'));
}
