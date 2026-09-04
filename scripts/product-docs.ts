import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { renderProductDocuments, renderRepoRootDocuments } from '../src/v4/product/product-documentation.js';

const checkOnly = process.argv.includes('--check');
const repoRoot = path.resolve('.');
const normalize = (content: string) => `${content.replace(/\r\n/g, '\n').trimEnd()}\n`;
const mismatches: string[] = [];

/**
 * İki hedef dizin.
 *
 * `AGENTS.md` ve `CLAUDE.md` `docs/product/` altında duramaz: ikisi de ancak
 * depo kökünde anlam taşıyan gelenek dosyalarıdır — Codex ve Claude Code onları
 * kökte arar. Çözüm üreticiye mutlak yol bilgisi vermek değil, ayrımı burada
 * tutmaktır: üretici `dosya adı → içerik` döndürür, dizini çağıran seçer.
 * Yazma ve denetleme aynı listeyi dolaştığı için bir dosyanın kapı kapsamı
 * dışında kalması mümkün değildir.
 */
const targets: ReadonlyArray<{ directory: string; documents: Record<string, string> }> = [
  { directory: path.join(repoRoot, 'docs', 'product'), documents: renderProductDocuments() },
  { directory: repoRoot, documents: renderRepoRootDocuments() }
];

for (const { directory, documents } of targets) {
  for (const [fileName, content] of Object.entries(documents)) {
    const filePath = path.join(directory, fileName);
    const label = path.relative(repoRoot, filePath).replace(/\\/g, '/');
    const expected = normalize(content);
    if (checkOnly) {
      try {
        const actual = normalize(await readFile(filePath, 'utf8'));
        if (actual !== expected) mismatches.push(label);
      } catch {
        mismatches.push(label);
      }
      continue;
    }
    await writeFile(filePath, expected, 'utf8');
  }
}

if (mismatches.length) {
  console.error(`Ürün belgeleri canonical registry ile eşleşmiyor: ${mismatches.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(checkOnly ? 'Ürün belgeleri canonical registry ile eşleşiyor.' : 'Ürün belgeleri güncellendi.');
}
