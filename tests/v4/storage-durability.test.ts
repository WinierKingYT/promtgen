import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createQuarantineRecord } from '../../src/v4/storage/quarantine.js';
import { createCheckpoint, computeDataChecksum, verifyDataIntegrity } from '../../src/v4/storage/backup-manager.js';
import { createCanonicalProjectInstance } from '../../src/v4/domain/services/project-creation.js';

describe('Category 8: Data Storage & Durability Protection', () => {
  it('creates a serializable quarantine record without a process-global store', () => {
    const badPayload = { corrupted: true, json: '{invalid}' };

    const record = createQuarantineRecord(badPayload, 'Schema validation failed');
    assert.ok(record.id.startsWith('quarantine-'));
    assert.equal(record.reason, 'Schema validation failed');
    assert.deepEqual(record.rawPayload, badPayload);
  });

  it('createCheckpoint stores rolling checkpoints and checksum hash', () => {
    const proj = createCanonicalProjectInstance({ ideaText: 'Oyun projesi' });
    const chk1 = createCheckpoint(proj);

    assert.ok(chk1.id.startsWith('chk-'));
    assert.ok(chk1.checksumHash.startsWith('fnv1a32-'));
    assert.equal(chk1.checksumAlgorithm, 'fnv1a32');
  });

  it('verifyDataIntegrity detects data corruption', () => {
    const proj = createCanonicalProjectInstance({ ideaText: 'Test Projesi' });
    const hash = computeDataChecksum(proj);

    assert.ok(verifyDataIntegrity(proj, hash), 'Integrity valid for original data');

    // Mutate data artificially to simulate disk corruption
    const corruptedProj = structuredClone(proj);
    corruptedProj.identity.name = 'Bozuk İsim';

    assert.ok(!verifyDataIntegrity(corruptedProj, hash), 'Detects data corruption correctly');
  });

  it('production IndexedDB repository declares durable stores and SHA-256 integrity', () => {
    const storageSource = readFileSync(new URL('../../src/v4/storage.js', import.meta.url), 'utf8');
    for (const store of ['projects', 'checkpoints', 'quarantine', 'commandLog', 'metadata']) {
      assert.match(storageSource, new RegExp(`${store}: '${store}'`));
    }
    assert.match(storageSource, /computeSha256/);
    assert.doesNotMatch(storageSource, /checkpointsStore|quarantineMemoryStore|crc32-/);
  });
});
