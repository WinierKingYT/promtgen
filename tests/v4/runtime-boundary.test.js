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
    const imports = [
        ...source.matchAll(/(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g),
        ...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)
    ].map(match => match[1]);
    for (const specifier of imports) {
        const target = resolveImport(file, specifier);
        if (target) walk(target);
    }
}

walk(entry);
const runtimeFiles = [...visited].map(file => relative(root, file).replaceAll('\\', '/'));
for (const prefix of forbidden) assert.ok(!runtimeFiles.some(file => file === prefix || file.startsWith(prefix)), `Legacy runtime yolu production graph'ına girdi: ${prefix}`);
assert.ok(runtimeFiles.includes('src/react/App.tsx'));
assert.ok(runtimeFiles.includes('src/v4/project-document.ts'));
// exporter now compiles as TypeScript (src/v4/exporter.ts) per the exporter.js -> .ts
// conversion; the .ts extension here reflects that conversion, not a relaxed guard —
// the fact being asserted is still "exporter is reachable from the production graph".
assert.ok(runtimeFiles.includes('src/v4/exporter.ts'));
// project-state-v4 converted .js -> .ts; the extension here must track that
// conversion, or the assertion below would become vacuous (it would still
// pass — vacuously — because '...v4.js' no longer exists, not because the
// legacy constructor is actually excluded from the graph).
assert.ok(!runtimeFiles.includes('src/v4/project-state-v4.ts'), 'Legacy V4 constructor production import graphına giremez.');
for (const file of runtimeFiles.filter(file => file.startsWith('src/react/'))) {
    const source = readFileSync(resolve(root, file), 'utf8');
    assert.doesNotMatch(source, /type\s+Project\s*=\s*any\b/, `${file} canonical ProjectDocument tipini atlayamaz.`);
}

console.log(`✓ canonical V5 production runtime boundary (${runtimeFiles.length} local module)`);
