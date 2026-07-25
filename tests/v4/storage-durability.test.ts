import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { quarantineProject, listQuarantinedRecords, clearQuarantine } from '../../src/v4/storage/quarantine.js';
import { createCheckpoint, getLatestCheckpoint, computeDataChecksum, verifyDataIntegrity } from '../../src/v4/storage/backup-manager.js';
import { createCanonicalProjectInstance } from '../../src/v4/domain/services/project-creation.js';

describe('Category 8: Data Storage & Durability Protection', () => {
  it('quarantineProject moves corrupted records to quarantine store', () => {
    clearQuarantine();
    const badPayload = { corrupted: true, json: '{invalid}' };

    const record = quarantineProject(badPayload, 'Schema validation failed');
    assert.ok(record.id.startsWith('quarantine-'));
    assert.equal(record.reason, 'Schema validation failed');

    const list = listQuarantinedRecords();
    assert.equal(list.length, 1);
    assert.equal(list[0].id, record.id);
  });

  it('createCheckpoint stores rolling checkpoints and checksum hash', () => {
    const proj = createCanonicalProjectInstance({ ideaText: 'Oyun projesi' });
    const chk1 = createCheckpoint(proj);

    assert.ok(chk1.id.startsWith('chk-'));
    assert.ok(chk1.checksumHash.startsWith('crc32-'));

    const latest = getLatestCheckpoint(String(proj.id));
    assert.ok(latest);
    assert.equal(latest?.revision, 1);
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
});
