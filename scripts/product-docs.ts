import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { renderProductDocuments } from '../src/v4/product/product-documentation.js';

const checkOnly = process.argv.includes('--check');
const docsDirectory = path.resolve('docs', 'product');
const normalize = (content: string) => `${content.replace(/\r\n/g, '\n').trimEnd()}\n`;
const mismatches: string[] = [];

for (const [fileName, content] of Object.entries(renderProductDocuments())) {
  const filePath = path.join(docsDirectory, fileName);
  const expected = normalize(content);
  if (checkOnly) {
    try {
      const actual = normalize(await readFile(filePath, 'utf8'));
      if (actual !== expected) mismatches.push(fileName);
    } catch {
      mismatches.push(fileName);
    }
    continue;
  }
  await writeFile(filePath, expected, 'utf8');
}

if (mismatches.length) {
  console.error(`Ürün belgeleri canonical registry ile eşleşmiyor: ${mismatches.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(checkOnly ? 'Ürün belgeleri canonical registry ile eşleşiyor.' : 'Ürün belgeleri güncellendi.');
}
