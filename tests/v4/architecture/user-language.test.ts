import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * İç sistem sözlüğü ile kullanıcı dili ayrı tutulur.
 *
 * `canonicalRevision`, `proposalBundle` gibi adlar KODDA doğrudur ve kalmalıdır.
 * Yasak olan, bu terimlerin kullanıcıya gösterilen metinlere sızmasıdır:
 * fikir geliştiren biri için "canonical r4 oluşturulacak" anlamsızdır.
 *
 * Kullanıcı diline çeviriler:
 *   canonical plan      -> plan / onaylı plan
 *   canonical revision  -> plan sürümü
 *   canonical rN        -> plan sürümü rN
 */

const REACT_ROOT = path.resolve(process.cwd(), 'src/react');

/** Kullanıcıya gösterilen metinler: JSX metni ve tırnak içi diziler. */
const USER_TEXT_PATTERNS = [
  /'[^'\n]*canonical[^'\n]*'/gi,
  /"[^"\n]*canonical[^"\n]*"/gi,
  /`[^`\n]*canonical[^`\n]*`/gi,
  />[^<>{}\n]*canonical[^<>{}\n]*</gi
];

/** Kod kimlikleri metin değildir; bunlar eşleşse de ihlal sayılmaz. Boşluk barındırmaz — birden çok kelime her zaman kullanıcı metnidir. */
const CODE_IDENTIFIER = /^[A-Za-z0-9_$.[\]'"`]*$/;
const ALLOWED_SNIPPETS = [
  // ProvenanceKind birleşim tipi ve karşılaştırmaları: kullanıcıya görünmez.
  "'canonical'",
  '"canonical"',
  'canonicalRevision',
  'baseCanonicalRevision',
  'nextCanonicalRevision',
  'sourceCanonicalRevision',
  'calculatedAtRevision'
];

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) { found.push(...sourceFiles(full)); continue; }
    if (/\.(ts|tsx)$/.test(entry.name)) found.push(full);
  }
  return found;
}

function violationsIn(source: string): string[] {
  const hits: string[] = [];
  for (const pattern of USER_TEXT_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      const text = match[0];
      if (ALLOWED_SNIPPETS.some(allowed => text.includes(allowed))) continue;
      if (CODE_IDENTIFIER.test(text.slice(1, -1))) continue;
      hits.push(text.trim().slice(0, 120));
    }
  }
  return hits;
}

describe('User-facing language boundary', () => {
  it('React arayüzünde kullanıcıya "canonical" terimi gösterilmez', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(REACT_ROOT)) {
      for (const hit of violationsIn(readFileSync(file, 'utf8'))) {
        offenders.push(`${path.relative(process.cwd(), file)} :: ${hit}`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `Kullanıcıya gösterilen metinlerde iç terminoloji bulundu:\n  ${offenders.join('\n  ')}\n` +
      'Kod içinde canonicalRevision gibi adlar serbesttir; yalnız kullanıcı metni sade dilde olmalıdır.'
    );
  });

  it('kural kendi ihlalini yakalar', () => {
    // Koruma testi: kalıp gerçekten calisiyor mu?
    assert.equal(violationsIn(`<p>canonical r4 olusturulacak</p>`).length, 1);
    assert.equal(violationsIn(`const x = 'Canonical plan dogrulandi';`).length, 1);
    // Kod kimlikleri ve izinli parcalar ihlal sayilmaz.
    assert.equal(violationsIn(`project.canonicalRevision + 1`).length, 0);
    assert.equal(violationsIn(`kind === 'canonical'`).length, 0);
  });
});
