import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = fileURLToPath(new URL('../dist/', import.meta.url));
const limits = {
  totalJavaScriptBytes: 900 * 1024,
  largestJavaScriptChunkBytes: 400 * 1024,
  totalCssBytes: 90 * 1024
};

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

const files = filesUnder(distDir);
const js = files.filter(file => file.endsWith('.js') && !file.endsWith('sw.js'));
const css = files.filter(file => file.endsWith('.css'));
const total = list => list.reduce((sum, file) => sum + statSync(file).size, 0);
const largest = list => Math.max(0, ...list.map(file => statSync(file).size));
const measurements = {
  totalJavaScriptBytes: total(js),
  largestJavaScriptChunkBytes: largest(js),
  totalCssBytes: total(css)
};
const failures = Object.entries(limits)
  .filter(([key, limit]) => measurements[key] > limit)
  .map(([key, limit]) => `${key}: ${measurements[key]} > ${limit}`);

console.log('Production performance budget');
for (const [key, value] of Object.entries(measurements)) console.log(`- ${key}: ${value} bytes (limit ${limits[key]})`);
console.log(`- chunks: ${js.map(file => relative(distDir, file)).join(', ')}`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
