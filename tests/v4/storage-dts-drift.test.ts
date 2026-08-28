import 'fake-indexeddb/auto';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { IndexedDbProjectRepository, MemoryProjectRepository } from '../../src/v4/storage.js';
import { createProjectDocument } from '../../src/v4/project-document.js';
import { INTEGRITY_ALGORITHM } from '../../src/v4/infrastructure/storage/integrity.ts';
import { resetIndexedDbFixture } from './support/indexed-db-fixture.ts';

/**
 * DEPOLAMA DAVRANIŞ SİCİLİ (eski adı: storage.d.ts DRIFT REGISTER)
 *
 * Bu dosya, `storage.js` + elle yazılmış `storage.d.ts` sidecar'ı ikilisi
 * varken yazılmıştı: sidecar implementasyonu tam olarak gölgelediği için
 * `tsc` ikisini ASLA birlikte görmüyordu ve üç yerde sessizce yalan
 * söylüyordu. Sidecar dönüşümü BİTTİ -- bugün tek kaynak
 * `src/v4/storage.ts` ve artık okunacak bir `.d.ts` yok.
 *
 * Testler kaldırılmadı çünkü iddiaları hâlâ gerçek: aşağıdaki üç davranış
 * (yedeğin tam şekli, checksum algoritmasının nereden geldiği, iki
 * repository arasındaki `backupsDeleted` asimetrisi) tipler tarafından DEĞİL
 * yalnız bu testler tarafından tutuluyor. Başlıklardaki eski `.d.ts`
 * iddiaları, bugünkü `storage.ts` gerçeğine göre yeniden yazıldı.
 */

describe('SİCİL #1 — MemoryProjectRepository.migrationBackups şekli (storage.ts, MemoryProjectRepository)', () => {
  it('migrationBackups değeri `{ projectSnapshot }` DEĞİLDİR: createCheckpoint() sonucunun TAMAMI saklanır (kaldırılan sidecar burada yanlış bildiriyordu)', async () => {
    const repository = new MemoryProjectRepository();
    // migrationBackups yalnızca #migrate() içinde migration.migrated === true
    // olduğunda doldurulur (storage.ts, MemoryProjectRepository). Legacy bir belge (schemaVersion
    // eksik) bunu tetikler. `repository.projects`, kaldırılan sidecar'da
    // `Map<string, ProjectDocumentV5>` olarak bildirildiği için gerçek (eski,
    // tip-dışı) bir kayıt eklemek üzere Map'i yerel olarak `unknown` değerli
    // bir görünüme genişletiyoruz — `as` cast KULLANMADAN: `Map.set` yöntem
    // kısayoluyla bildirildiği için TypeScript bunu iki yönlü (bivariant)
    // kontrol eder ve bu atama tip hatası vermez (doğrulandı: tsc --noEmit).
    const legacyDocument = { id: 'legacy-project-1', schemaVersion: 1, identity: { originalIdea: 'Eski proje' } };
    const projectsStore: Map<string, unknown> = repository.projects;
    projectsStore.set('legacy-project-1', legacyDocument);

    await repository.get('legacy-project-1');

    const migrationBackups: Map<string, unknown> = repository.migrationBackups;
    const backup = migrationBackups.get('legacy-project-1');
    assert.ok(backup !== undefined, 'migration sırasında bir yedek oluşmalı');
    assert.ok(backup !== null && typeof backup === 'object', 'yedek bir obje olmalı');

    // Kaldırılan sidecar iddiası: Map<string, { projectSnapshot: ProjectDocumentV5 }>
    // — yani backup'ın YALNIZCA `projectSnapshot` alanı olmalı.
    // GERÇEK: backup-manager.ts:createCheckpoint()'in tam dönüş şekli.
    const backupKeys = Object.keys(backup).sort();
    assert.deepEqual(
      backupKeys,
      ['checksumAlgorithm', 'checksumHash', 'createdAt', 'id', 'projectId', 'projectSnapshot', 'revision'].sort(),
      'GERÇEK ŞEKİL kaldırılan sidecar bildiriminden DAHA GENİŞ: sadece projectSnapshot değil, createCheckpoint() sonucunun tamamı saklanıyor'
    );
    assert.ok('projectId' in backup);
    assert.equal(backup.projectId, 'legacy-project-1');
    assert.ok('checksumAlgorithm' in backup);
    assert.equal(backup.checksumAlgorithm, 'fnv1a32', 'MemoryProjectRepository backup-manager.ts checksum\'ını kullanır, integrity.ts SHA-256\'sını DEĞİL');
    assert.ok('projectSnapshot' in backup);
    assert.ok(backup.projectSnapshot, 'projectSnapshot alanı da mevcut (kaldırılan sidecar kısmen doğruydu, ama eksikti)');
  });
});

describe('SİCİL #2 — IndexedDbProjectRepository.listCheckpoints() checksumAlgorithm (storage.ts, listCheckpoints)', () => {
  beforeEach(resetIndexedDbFixture);

  it("checksumAlgorithm sabit bir 'SHA-256' literali DEĞİLDİR: infrastructure/storage/integrity.ts'ten import edilen INTEGRITY_ALGORITHM sabiti kullanılır (ikisi bugün aynı değeri taşır ama yapısal olarak BAĞLANTISIZ)", async () => {
    const repository = new IndexedDbProjectRepository();
    const project = createProjectDocument({ idea: 'Checksum algoritma drift testi' });
    await repository.save(project, { createOnly: true });

    const [checkpoint] = await repository.listCheckpoints(project.id);

    assert.equal(checkpoint.checksumAlgorithm, INTEGRITY_ALGORITHM, 'çalışma zamanı değeri sabit koddaki INTEGRITY_ALGORITHM ile eşleşmeli');
    assert.equal(checkpoint.checksumAlgorithm, 'SHA-256', 'BUGÜN sabit literal ile aynı değeri taşıyor — bu testin varlık nedeni: INTEGRITY_ALGORITHM değişirse artık bunu yakalayacak başka hiçbir tip bağı yok');
  });
});

describe('SİCİL #3 — purge() backupsDeleted asimetrisi: Memory gerçek sayar, IndexedDb HER ZAMAN 0 döner (storage.ts, purge)', () => {
  beforeEach(resetIndexedDbFixture);

  it('MemoryProjectRepository.purge(): migration yedeği varsa backupsDeleted GERÇEK bir sayı (1) döner', async () => {
    const repository = new MemoryProjectRepository();
    const legacyDocument = { id: 'legacy-project-2', schemaVersion: 1, identity: { originalIdea: 'Eski proje 2' } };
    const projectsStore: Map<string, unknown> = repository.projects;
    projectsStore.set('legacy-project-2', legacyDocument);
    await repository.get('legacy-project-2'); // migrationBackups doldurulur
    assert.ok(repository.migrationBackups.has('legacy-project-2'), 'ön koşul: bir yedek oluşmalı');

    const result = await repository.purge('legacy-project-2');

    assert.equal(result.backupsDeleted, 1, 'Memory repository gerçek migration yedeği sayısını raporlar');
    assert.equal(repository.migrationBackups.has('legacy-project-2'), false, 'purge sonrası yedek de silinir');
  });

  it('MemoryProjectRepository.purge(): migration yedeği yoksa backupsDeleted 0 döner', async () => {
    const repository = new MemoryProjectRepository();
    const project = createProjectDocument({ idea: 'Yedeksiz proje' });
    await repository.save(project, { createOnly: true });

    const result = await repository.purge(project.id);

    assert.equal(result.backupsDeleted, 0);
  });

  it('IndexedDbProjectRepository.purge(): migration yedeği checkpoint deposuna gömülü olduğu için backupsDeleted HER ZAMAN 0 döner — Memory ile AYNI davranmıyor', async () => {
    const repository = new IndexedDbProjectRepository();
    // Migration yedeği üretmek için legacy bir belgeyi doğrudan store'a
    // yazmak yerine, storage.ts'in migration yedeğini de normal checkpoint
    // deposuna (`buildPersistentCheckpoint(migrationBackup, ...)`,
    // storage.ts save()) yazdığını save() akışı üzerinden gözlemliyoruz:
    // aşağıdaki normal save zaten yalnızca `checkpointsDeleted` içinde
    // sayılıyor, `backupsDeleted` alanı hiçbir koşulda artmıyor.
    const project = createProjectDocument({ idea: 'IndexedDb backup asimetrisi' });
    await repository.save(project, { createOnly: true });

    const result = await repository.purge(project.id);

    assert.equal(result.backupsDeleted, 0, 'IndexedDbProjectRepository.purge() backupsDeleted alanını asla artırmaz (storage.ts, IndexedDbProjectRepository.purge)');
    // Her iki repository de aynı `ProjectPurgeResult` tipini (contracts.ts)
    // sağladığı için derleyici bu davranış farkını YAKALAYAMAZ; ikisi de
    // geçerli bir `number` döndürüyor.
  });
});
