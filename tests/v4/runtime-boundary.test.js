import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const entry = resolve(root, 'src/react/main.tsx');
const visited = new Set();
const forbidden = ['src/main.js', 'src/exporters/', 'src/state/', 'src/presentation/', 'src/ai/'];

function resolveImport(importer, specifier) {
    if (!specifier.startsWith('.')) return null;
    const base = resolve(dirname(importer), specifier);
    const candidates = extname(base) ? [base, ...(base.endsWith('.js') ? [base.slice(0, -3) + '.ts', base.slice(0, -3) + '.tsx'] : [])] : [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, resolve(base, 'index.ts'), resolve(base, 'index.tsx'), resolve(base, 'index.js')];
    return candidates.find(existsSync) || null;
}

function walk(file) {
    if (visited.has(file) || !/\.(js|ts|tsx)$/.test(file)) return;
    visited.add(file);
    const source = readFileSync(file, 'utf8');
    const imports = [...source.matchAll(/(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g)].map(match => match[1]);
    for (const specifier of imports) {
        const target = resolveImport(file, specifier);
        if (target) walk(target);
    }
}

walk(entry);
const runtimeFiles = [...visited].map(file => relative(root, file).replaceAll('\\', '/'));
for (const prefix of forbidden) assert.ok(!runtimeFiles.some(file => file === prefix || file.startsWith(prefix)), `Legacy runtime yolu production graph'ına girdi: ${prefix}`);
assert.ok(runtimeFiles.includes('src/react/App.tsx'));
assert.ok(runtimeFiles.includes('src/v4/project-state-v4.js'));
assert.ok(runtimeFiles.includes('src/v4/exporter.js'));

console.log(`✓ V4 production runtime boundary (${runtimeFiles.length} local module)`);
