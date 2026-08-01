import assert from 'node:assert/strict';
import { createProjectDocument } from '../../src/v4/project-document.js';
import { restoreCheckpointAsNewRevision } from '../../src/v4/storage.js';
import {
  assertRecoveryPreviewFresh,
  buildRecoveryPreview,
  restorePortablePackageAsNewRevision
} from '../../src/v4/application/recovery-service.js';

const checkpoint = createProjectDocument({
  idea: 'Bireysel geliştirici için local-first planlama uygulaması',
  name: 'Kurtarma testi'
});
checkpoint.documentRevision = 2;
checkpoint.canonicalRevision = 2;
checkpoint.sections.vision.content = 'Eski hedef kullanıcı';
checkpoint.sections.vision.items = ['Tek kullanıcı'];
checkpoint.messages.push({
  id: 'message-old',
  role: 'assistant',
  content: 'İlk fikir yorumu',
  createdAt: '2026-01-01T00:00:00.000Z'
});

const current = structuredClone(checkpoint);
current.documentRevision = 6;
current.canonicalRevision = 5;
current.sections.vision.content = 'Bireysel AI destekli geliştirici';
current.sections.vision.items = ['Tek kullanıcı', 'Local-first'];
current.requirements.push({
  id: 'requirement-new',
  title: 'Yerel kayıt',
  statement: 'Proje kullanıcının cihazında saklanmalı.',
  kind: 'constraint',
  priority: 'must',
  acceptanceCriteria: ['Sayfa yenilendiğinde proje yeniden açılır.'],
  sourceObjectiveIds: [],
  sourceSuggestionIds: [],
  status: 'draft'
});
current.messages.push({
  id: 'message-new',
  role: 'user',
  content: 'Hedef kullanıcıyı değiştirelim.',
  createdAt: '2026-01-02T00:00:00.000Z'
});

const beforeCurrent = structuredClone(current);
const beforeCheckpoint = structuredClone(checkpoint);
const preview = buildRecoveryPreview(current, checkpoint, 'web-checkpoint', 'verified');

assert.equal(preview.expectedDocumentRevision, 6);
assert.equal(preview.expectedCanonicalRevision, 5);
assert.equal(preview.nextCanonicalRevision, 6);
assert.equal(preview.integrity, 'verified');
assert.equal(preview.canRestore, true);
assert.ok(preview.sections.some(section => section.sectionId === 'vision' && section.removedItems === 1));
assert.deepEqual(
  preview.entities.find(entity => entity.key === 'requirements'),
  { key: 'requirements', label: 'Gereksinimler', beforeCount: 1, afterCount: 0, added: 0, removed: 1, changed: 0 }
);
assert.ok(preview.documentChanges.includes('Keşif konuşması'));
assert.deepEqual(current, beforeCurrent, 'Önizleme güncel projeyi mutate etmemeli');
assert.deepEqual(checkpoint, beforeCheckpoint, 'Önizleme checkpoint kaydını mutate etmemeli');
assert.doesNotThrow(() => assertRecoveryPreviewFresh(current, preview));

const changedAfterPreview = structuredClone(current);
changedAfterPreview.documentRevision += 1;
assert.throws(
  () => assertRecoveryPreviewFresh(changedAfterPreview, preview),
  /artık güncel değil/
);

const identicalPreview = buildRecoveryPreview(current, structuredClone(current), 'desktop-backup', 'validated');
assert.equal(identicalPreview.canRestore, false);
assert.throws(() => assertRecoveryPreviewFresh(current, identicalPreview), /fark bulunamadı/);

const restored = restoreCheckpointAsNewRevision(current, checkpoint);
assert.equal(restored.documentRevision, 7);
assert.equal(restored.canonicalRevision, 6);
assert.equal(restored.sections.vision.content, 'Eski hedef kullanıcı');
assert.equal(restored.revisions.at(-1)?.number, 6);
assert.equal(current.documentRevision, 6, 'Geri yükleme güncel projeyi mutate etmemeli');

current.exports.push({
  id: 'export-current', format: 'promtgen', canonicalRevision: 5,
  createdAt: '2026-01-02T00:00:00.000Z', canonicalHash: 'a'.repeat(64), adapterIds: [], fileNames: []
});
const packagePreview = buildRecoveryPreview(current, checkpoint, 'portable-package', 'verified');
assert.equal(packagePreview.source, 'portable-package');
const packageRestored = restorePortablePackageAsNewRevision(current, checkpoint);
assert.equal(packageRestored.documentRevision, 7);
assert.equal(packageRestored.canonicalRevision, 6);
assert.equal(packageRestored.sections.vision.content, 'Eski hedef kullanıcı');
assert.ok(packageRestored.exports.some(record => record.id === 'export-current'));
assert.equal(packageRestored.revisions.at(-1)?.summary, 'Taşınabilir paket r2 yeni revision olarak geri yüklendi');
assert.equal(packageRestored.metadata.restoredFromPortablePackage?.sourceCanonicalRevision, 2);
assert.equal(checkpoint.documentRevision, 2, 'Paket kurtarma kaynak projeyi mutate etmemeli');

console.log('✓ Recovery preview, stale lock and new revision semantics');
