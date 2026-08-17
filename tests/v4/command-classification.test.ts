import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  CANONICAL_CHANGE_COMMANDS,
  DOCUMENT_ONLY_COMMANDS,
  isClassifiedCommand
} from '../../src/v4/application/command-policy.js';

/**
 * Her komut türü **açıkça** sınıflandırılmış olmalı.
 *
 * `isCanonicalChangeCommand` bilinmeyen komutu güvenli tarafta sayıyor
 * (canonical) ve bu doğru bir çalışma zamanı varsayılanı. Ama güvenli
 * varsayılan, sınıflandırmanın yerine geçerse yeni komutlar sessizce canonical
 * olur: canonical revision hiç olmayan bir plan değişikliği için artar ve
 * commandLog'a gerçekleşmemiş bir değişiklik yazılır.
 *
 * Bu tam olarak yaşandı: Ürün Modeli V3 ile on yeni komut eklendi, hiçbiri
 * sınıflandırılmadı ve beşi yanlış tarafta kaldı. `command-policy.ts`'nin
 * başındaki uyarı bunu önceden tarif ediyordu ama hiçbir şey zorlamıyordu.
 */

const UI_ROOT = path.resolve('src', 'react');

/** `persistCandidate(...)` / `commit(...)` çağrılarındaki komut türü metinleri. */
function collectCommandTypes(directory: string): Map<string, string> {
  const found = new Map<string, string>();

  const walk = (current: string) => {
    for (const entry of readdirSync(current)) {
      const full = path.join(current, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry)) continue;
      const source = readFileSync(full, 'utf8');
      // Komut türü her zaman çağrının SON metin argümanı olarak geçiliyor.
      for (const match of source.matchAll(/'([A-Z][A-Za-z]+)'\s*\)/g)) {
        const candidate = match[1];
        if (isClassifiedCommand(candidate) && !found.has(candidate)) {
          found.set(candidate, path.relative('.', full));
        }
      }
      for (const match of source.matchAll(/,\s*'([A-Z][A-Za-z]+)'\s*\)/g)) {
        if (!found.has(match[1])) found.set(match[1], path.relative('.', full));
      }
    }
  };

  walk(directory);
  return found;
}

describe('Komut sınıflandırması eksiksiz', () => {
  const used = collectCommandTypes(UI_ROOT);

  it('arayuzde kullanilan her komut turu SINIFLANDIRILMIS', () => {
    const unclassified = [...used.entries()].filter(([command]) => !isClassifiedCommand(command));

    assert.deepEqual(
      unclassified.map(([command, file]) => `${command} (${file})`),
      [],
      'Bu komutlar ne DOCUMENT_ONLY_COMMANDS ne CANONICAL_CHANGE_COMMANDS içinde; '
      + 'güvenli varsayılan onları sessizce canonical sayar.'
    );
  });

  it('tarama gercekten komut buluyor - bos liste yesil vermez', () => {
    // Regex bozulup hiçbir şey bulmasa üstteki test boş listeyle geçerdi.
    assert.ok(used.size >= 8, `yalnız ${used.size} komut bulundu; tarama bozulmuş olabilir`);
    assert.ok(used.has('RunSolutionDiscovery'), 'V3 komutları taranmıyor');
  });

  it('hicbir komut IKI listede birden olamaz', () => {
    const both = [...DOCUMENT_ONLY_COMMANDS].filter(command => CANONICAL_CHANGE_COMMANDS.has(command));

    assert.deepEqual(both, [], 'aynı komut hem belge-içi hem canonical sayılamaz');
  });

  it('oneri ureten komutlar canonical SAYILMAZ', () => {
    // `RunSolutionDiscovery`, `AddDiscoveryTurn`'ün teknik karşılığı: ikisi de
    // öneri üretir, ikisi de karar üretmez. Farklı sınıflandırmak aynı eylemi
    // iki farklı şey saymak olurdu.
    for (const command of ['AddDiscoveryTurn', 'RunSolutionDiscovery']) {
      assert.ok(DOCUMENT_ONLY_COMMANDS.has(command), command);
    }
  });

  it('canonical KARAR ureten komutlar canonical sayilir', () => {
    for (const command of ['AnswerConcern', 'AcceptTechnologyCandidate']) {
      assert.ok(CANONICAL_CHANGE_COMMANDS.has(command), command);
    }
  });
});
