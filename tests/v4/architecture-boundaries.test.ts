import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ok, err, createDomainError } from '../../src/v4/domain/common/result.js';
import { SystemClock, CryptoIdGenerator } from '../../src/v4/domain/ports/ports.js';

describe('Category 5: Code Architecture & Maintainability Boundaries', () => {
  it('Domain layer files do NOT import React or DOM APIs', () => {
    const domainDir = path.resolve(process.cwd(), 'src/v4/domain');
    
    function checkDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkDir(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
          const content = fs.readFileSync(fullPath, 'utf8');
          assert.ok(
            !/from ['"]react['"]/.test(content),
            `Domain file ${entry.name} must not import 'react'`
          );
          assert.ok(
            !/from ['"]react-dom['"]/.test(content),
            `Domain file ${entry.name} must not import 'react-dom'`
          );
          assert.ok(
            !/indexedDB/.test(content),
            `Domain file ${entry.name} must not reference 'indexedDB'`
          );
        }
      }
    }

    checkDir(domainDir);
  });

  it('Result<T, E> helper functions correctly format Ok and Err objects', () => {
    const success = ok({ id: 'proj-1', name: 'PromtGen' });
    assert.equal(success.ok, true);
    if (success.ok) {
      assert.equal(success.value.name, 'PromtGen');
    }

    const domainErr = createDomainError('ENTITY_NOT_FOUND', 'Proje bulunamadı', { id: '123' });
    const failure = err(domainErr);
    assert.equal(failure.ok, false);
    if (!failure.ok) {
      assert.equal(failure.error.code, 'ENTITY_NOT_FOUND');
      assert.equal(failure.error.message, 'Proje bulunamadı');
    }
  });

  it('SystemClock and CryptoIdGenerator ports produce valid outputs', () => {
    const clock = new SystemClock();
    const idGen = new CryptoIdGenerator();

    assert.ok(clock.nowIso().length > 10);
    assert.ok(clock.nowTimestamp() > 0);
    assert.ok(idGen.nextId('test').startsWith('test-'));
  });
});
