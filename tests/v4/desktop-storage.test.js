import assert from 'node:assert/strict';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import { restoreStorageBackupAsNewRevision } from '../../src/v4/tauri-storage.js';

const current = analyzeIdea('Yerel yedekleri olan bir proje planlama uygulaması geliştir.');
current.revision = 8;
current.exports = [{ id: 'export-current', format: 'promtgen', revision: 8, createdAt: 'now' }];
current.executionSessions = [{ id: 'execution-1', adapterId: 'generic', sourceRevision: 8, status: 'external', worktreeLabel: '', steps: [], createdAt: 'now', updatedAt: 'now' }];
const backup = structuredClone(current);
backup.revision = 3;
backup.identity.summary = 'Yedekten gelen içerik';
backup.exports = [];
backup.executionSessions = [];

const restored = restoreStorageBackupAsNewRevision(current, backup);
assert.equal(restored.revision, 9);
assert.equal(restored.identity.summary, 'Yedekten gelen içerik');
assert.equal(restored.lifecycle.status, 'active');
assert.equal(restored.exports[0].id, 'export-current');
assert.equal(restored.executionSessions[0].id, 'execution-1');
assert.equal(restored.metadata.restoredFromStorageBackup.sourceRevision, 3);
assert.equal(restored.revisions.at(-1).number, 9);
assert.equal(current.revision, 8, 'Güncel proje mutate edilmemeli');
assert.throws(() => restoreStorageBackupAsNewRevision(current, { ...backup, id: 'other-project' }), /başka bir projeye ait/);

console.log('✓ V4 desktop storage backup restore semantics');
