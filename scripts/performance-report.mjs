import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = fileURLToPath(new URL('../dist/', import.meta.url));

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

console.log('Production asset size report (informational, no limits)');
for (const [key, value] of Object.entries(measurements)) console.log(`- ${key}: ${value} bytes`);
console.log(`- chunks: ${js.map(file => relative(distDir, file)).join(', ')}`);
