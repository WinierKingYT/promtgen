import 'fake-indexeddb/auto';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  IndexedDbProjectRepository,
  listWebProjectCheckpoints,
  listWebQuarantinedProjects,
  loadWebProjectCheckpoint,
  restoreCheckpointAsNewRevision
} from '../../src/v4/storage.js';
import { createProjectDocument } from '../../src/v4/project-document.js';
import { computeSha256 } from '../../src/v4/infrastructure/storage/integrity.ts';
import { resetIndexedDbFixture, putRawRecord } from './support/indexed-db-fixture.ts';

/**
 * Serbest fonksiyonlar `listWebProjectCheckpoints`, `listWebQuarantinedProjects`,
 * `loadWebProjectCheckpoint` (storage.js:407-430) — hiçbir doğrudan testi
 * yoktu. İzolasyon notu için bkz. support/indexed-db-fixture.ts.
 */

describe('listWebProjectCheckpoints()', () => {
  beforeEach(resetIndexedDbFixture);

  it('bir projeye kayıtlı checkpoint listesini repository.listCheckpoints() ile aynı şekilde döndürür', async () => {
    const repository = new IndexedDbProjectRepository();
    const project = createProjectDocument({ idea: 'Web checkpoint listesi testi' });
    const saved = await repository.save(project, { createOnly: true });

    const viaFreeFunction = await listWebProjectCheckpoints(project.id);
    const viaRepository = await repository.listCheckpoints(project.id);

    assert.equal(viaFreeFunction.length, 1);
    assert.deepEqual(viaFreeFunction, viaRepository);
    assert.equal(viaFreeFunction[0].projectId, project.id);
    assert.equal(viaFreeFunction[0].revision, saved.documentRevision);
  });

  it('kayıtlı checkpoint yoksa boş dizi döner', async () => {
    const listed = await listWebProjectCheckpoints('no-such-project');
    assert.deepEqual(listed, []);
  });
});

describe('listWebQuarantinedProjects()', () => {
  beforeEach(resetIndexedDbFixture);

  it('karantina kaydı yokken boş dizi döner', async () => {
    const listed = await listWebQuarantinedProjects();
    assert.deepEqual(listed, []);
  });

  it('bütünlük ihlaliyle oluşan karantina kaydını listeler', async () => {
    const repository = new IndexedDbProjectRepository();
    const project = createProjectDocument({ idea: 'Web karantina listesi testi' });
    const saved = await repository.save(project, { createOnly: true });
    const corrupted = structuredClone(saved);
    corrupted.identity.name = 'BOZUK';
    await putRawRecord('projects', corrupted);
    await repository.get(project.id); // karantinayı tetikler

    const listed = await listWebQuarantinedProjects();

    assert.equal(listed.length, 1);
    assert.equal(listed[0].projectId, project.id);
    assert.equal(listed[0].reason, 'SHA-256 integrity mismatch');
  });
});

describe('loadWebProjectCheckpoint() — mutlu yol ve boş/eksik durumlar', () => {
  beforeEach(resetIndexedDbFixture);

  it('geçerli bir checkpoint kimliği ile doğrulanmış proje anlık görüntüsünü döndürür', async () => {
    const repository = new IndexedDbProjectRepository();
    const project = createProjectDocument({ idea: 'loadWebProjectCheckpoint mutlu yol' });
    const saved = await repository.save(project, { createOnly: true });
    const [checkpoint] = await listWebProjectCheckpoints(project.id);

    const restored = await loadWebProjectCheckpoint(saved, checkpoint.id);

    assert.equal(restored.id, saved.id);
    assert.equal(restored.identity.originalIdea, 'loadWebProjectCheckpoint mutlu yol');
  });

  it('var olmayan checkpoint kimliği "Checkpoint bulunamadı" ile reddedilir', async () => {
    const repository = new IndexedDbProjectRepository();
    const project = createProjectDocument({ idea: 'Eksik checkpoint testi' });
    const saved = await repository.save(project, { createOnly: true });

    await assert.rejects(
      loadWebProjectCheckpoint(saved, 'no-such-checkpoint'),
      /Checkpoint bulunamadı/
    );
  });

  it('başka bir projeye ait checkpoint kimliği de "Checkpoint bulunamadı" ile reddedilir', async () => {
    // storage.js:422'deki `checkpoint.projectId !== currentProject.id` kontrolü
    // bu çağrı yolundan ULAŞILAMAZ: listWebProjectCheckpoints(currentProject.id)
    // zaten yalnızca projectId === currentProject.id olan kayıtları döndürür
    // (listProjectCheckpoints, storage.js:120-128), bu yüzden `checkpoints.find`
    // ile bulunan hiçbir kayıt asla farklı bir projectId taşıyamaz. Gözlemlenen
    // gerçek davranış budur: yabancı bir checkpointId "bulunamadı" hatasını
    // tetikler, "başka bir projeye ait" hatasını değil.
    const repository = new IndexedDbProjectRepository();
    const projectA = createProjectDocument({ idea: 'Proje A' });
    const projectB = createProjectDocument({ idea: 'Proje B' });
    const savedA = await repository.save(projectA, { createOnly: true });
    const savedB = await repository.save(projectB, { createOnly: true });
    const [checkpointA] = await listWebProjectCheckpoints(savedA.id);

    await assert.rejects(
      loadWebProjectCheckpoint(savedB, checkpointA.id),
      /Checkpoint bulunamadı/
    );
  });

  it('checksum uyuşmayan checkpoint "bütünlük doğrulamasını geçemedi" ile reddedilir', async () => {
    const repository = new IndexedDbProjectRepository();
    const project = createProjectDocument({ idea: 'Checkpoint bütünlük testi' });
    const saved = await repository.save(project, { createOnly: true });
    const [checkpoint] = await listWebProjectCheckpoints(project.id);

    const corruptedCheckpoint = structuredClone(checkpoint);
    corruptedCheckpoint.projectSnapshot.identity.name = 'ÇALINMIŞ İÇERİK';
    // checksumHash kasıtlı olarak GÜNCELLENMEDİ: doğrulama hash/veri
    // uyuşmazlığını tespit etmeli.
    await putRawRecord('checkpoints', corruptedCheckpoint);

    await assert.rejects(
      loadWebProjectCheckpoint(saved, checkpoint.id),
      /bütünlük doğrulamasını geçemedi/
    );
  });

  it('checksum ile eşleşen ama şema doğrulamasını geçemeyen checkpoint "şeması geçersiz" ile reddedilir', async () => {
    const repository = new IndexedDbProjectRepository();
    const project = createProjectDocument({ idea: 'Checkpoint şema testi' });
    const saved = await repository.save(project, { createOnly: true });
    const [checkpoint] = await listWebProjectCheckpoints(project.id);

    const invalidSnapshot = structuredClone(checkpoint.projectSnapshot);
    invalidSnapshot.identity.originalIdea = ''; // validateProjectDocument: "Başlangıç fikri eksik."
    const invalidChecksum = await computeSha256(invalidSnapshot);
    const corruptedCheckpoint = structuredClone(checkpoint);
    corruptedCheckpoint.projectSnapshot = invalidSnapshot;
    corruptedCheckpoint.checksumHash = invalidChecksum; // checksum'ı da güncelledik: bu bir şema hatası testi, bütünlük hatası değil.
    await putRawRecord('checkpoints', corruptedCheckpoint);

    await assert.rejects(
      loadWebProjectCheckpoint(saved, checkpoint.id),
      /Checkpoint şeması geçersiz/
    );
  });
});

describe('restoreCheckpointAsNewRevision() — revizyon artışı ve metadata damgası (storage.js:372-405)', () => {
  it('checkpoint içeriğini yeni bir revizyon olarak damgalar; documentRevision ve canonicalRevision +1 artar', () => {
    const current = createProjectDocument({ idea: 'Güncel proje' });
    current.documentRevision = 4;
    current.canonicalRevision = 3;
    const checkpoint = structuredClone(current);
    checkpoint.documentRevision = 2;
    checkpoint.canonicalRevision = 2;
    checkpoint.sections.vision.content = 'Eski checkpoint içeriği';

    const restored = restoreCheckpointAsNewRevision(current, checkpoint);

    assert.equal(restored.documentRevision, current.documentRevision + 1);
    assert.equal(restored.canonicalRevision, current.canonicalRevision + 1);
    assert.equal(restored.sections.vision.content, 'Eski checkpoint içeriği');
    assert.equal(restored.lifecycle.status, 'active');
    assert.equal(restored.lifecycle.finalizedAt, null);
    assert.deepEqual(restored.metadata.restoredFromCheckpoint, {
      sourceRevision: checkpoint.canonicalRevision,
      restoredAt: restored.lifecycle.updatedAt
    });
    assert.equal(restored.revisions.at(-1)?.number, restored.canonicalRevision);
  });

  it('farklı proje kimliğine ait checkpoint reddedilir', () => {
    const current = createProjectDocument({ idea: 'Proje X' });
    const foreignCheckpoint = createProjectDocument({ idea: 'Proje Y' });

    assert.throws(
      () => restoreCheckpointAsNewRevision(current, foreignCheckpoint),
      /Checkpoint başka bir projeye ait/
    );
  });
});
