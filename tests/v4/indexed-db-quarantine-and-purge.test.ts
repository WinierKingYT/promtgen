import 'fake-indexeddb/auto';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { IndexedDbProjectRepository } from '../../src/v4/storage.js';
import { createProjectDocument } from '../../src/v4/project-document.js';
import { resetIndexedDbFixture, putRawRecord, getAllRawRecords } from './support/indexed-db-fixture.ts';

/**
 * `IndexedDbProjectRepository` — bütünlük ihlali, migration hatası ve
 * `purge()` yolları (storage.js:154-178, 272-292).
 *
 * İzolasyon notu için bkz. support/indexed-db-fixture.ts.
 */

describe('IndexedDbProjectRepository — bütünlük ihlali karantinası (storage.js:158-161)', () => {
  beforeEach(resetIndexedDbFixture);

  it('checkpoint checksum ile eşleşmeyen kayıt karantinaya alınır ve get() null döner', async () => {
    const repository = new IndexedDbProjectRepository();
    const project = createProjectDocument({ idea: 'Bütünlük ihlali testi' });
    const saved = await repository.save(project, { createOnly: true });

    // Aynı documentRevision'a sahip checkpoint hâlâ orijinal içeriğin
    // hash'ini taşıyor; "projects" store'undaki ham kaydı doğrudan bozarak
    // checksum uyuşmazlığı üretiyoruz — repository API'si asla bozuk veri
    // yazmadığı için başka yolu yok.
    const corrupted = structuredClone(saved);
    corrupted.identity.name = 'DOĞRUDAN BOZULMUŞ KAYIT';
    await putRawRecord('projects', corrupted);

    const fetched = await repository.get(project.id);
    assert.equal(fetched, null, 'Checksum uyuşmazlığında get() bozuk belgeyi DEĞİL, null döndürmeli');

    const quarantined = await repository.listQuarantined();
    const match = quarantined.find(record => record.projectId === project.id);
    assert.ok(match, 'Bozuk kayıt karantina deposuna düşmeli');
    assert.equal(match.reason, 'SHA-256 integrity mismatch');

    const rawPayload: unknown = match.rawPayload;
    assert.ok(rawPayload !== null && typeof rawPayload === 'object', 'karantina ham verisi obje olmalı');
    assert.ok('identity' in rawPayload, 'ham veri identity alanı taşımalı');
    const identity: unknown = rawPayload.identity;
    assert.ok(identity !== null && typeof identity === 'object', 'identity obje olmalı');
    assert.ok('name' in identity, 'identity name alanı taşımalı');
    assert.equal(identity.name, 'DOĞRUDAN BOZULMUŞ KAYIT', 'Karantina kaydı orijinal bozuk veriyi saklamalı');
  });
});

describe('IndexedDbProjectRepository — migration hatası karantinası (storage.js:163-166)', () => {
  beforeEach(resetIndexedDbFixture);

  it('şema/migration doğrulamasını geçemeyen kayıt karantinaya alınır ve get() null döner', async () => {
    const repository = new IndexedDbProjectRepository();
    const invalid = createProjectDocument({ idea: 'Geçici fikir' });
    // schemaVersion/schemaRevision zaten LATEST olduğu için tryMigrateOrPassthrough
    // migrations.js:98-104 dalına girer: normalizeProjectDocument + validateProjectDocument.
    // originalIdea boşaltılınca "Başlangıç fikri eksik." hatasıyla migration.error dolar.
    invalid.identity.originalIdea = '';
    // Bu kayıt hiçbir zaman repository.save() ile yazılmadığı için eşleşen bir
    // checkpoint yok; #loadStored bu yüzden önce bütünlük kontrolünü atlar
    // (storage.js:157 "matching" undefined) ve doğrudan migration dalına girer.
    await putRawRecord('projects', invalid);

    const fetched = await repository.get(invalid.id);
    assert.equal(fetched, null, 'Migration hatasında get() null döndürmeli');

    const quarantined = await repository.listQuarantined();
    const match = quarantined.find(record => record.projectId === invalid.id);
    assert.ok(match, 'Migration hatası veren kayıt karantina deposuna düşmeli');
    assert.match(match?.reason ?? '', /^Migration failure: /);
    assert.match(match?.reason ?? '', /Başlangıç fikri eksik/);
  });

  it('list() de aynı bozuk kaydı listeye eklemez, sağlam projeler yine de görünür', async () => {
    const repository = new IndexedDbProjectRepository();
    const good = createProjectDocument({ idea: 'Sağlam proje' });
    await repository.save(good, { createOnly: true });

    const invalid = createProjectDocument({ idea: 'Geçici fikir' });
    invalid.identity.originalIdea = '';
    await putRawRecord('projects', invalid);

    const listed = await repository.list();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, good.id);
  });
});

describe('IndexedDbProjectRepository — list() atlanan proje uyarısı (web/masaüstü tutarlılığı)', () => {
  beforeEach(resetIndexedDbFixture);

  it('list() bozuk kaydı atlar, sağlam projeleri döner VE takeListWarning() kullanıcıya Türkçe uyarı verir (bir kez)', async () => {
    const repository = new IndexedDbProjectRepository();
    const good = createProjectDocument({ idea: 'Sağlam görünür proje' });
    await repository.save(good, { createOnly: true });

    const invalid = createProjectDocument({ idea: 'Bozuk proje' });
    invalid.identity.originalIdea = '';
    await putRawRecord('projects', invalid);

    const listed = await repository.list();
    assert.equal(listed.length, 1, 'sağlam proje listelenmeli, bozuk kayıt sessizce yok olmamalı ama listede de görünmemeli');
    assert.equal(listed[0].id, good.id);

    const warning = repository.takeListWarning();
    assert.ok(warning, 'atlanan kayıt varken masaüstündeki gibi bir uyarı dönmeli (desktop ile tutarlılık)');
    assert.match(warning ?? '', /1 proje okunamadı/, 'kaç projenin atlandığı belirtilmeli');
    assert.match(warning ?? '', /silinmedi/, 'verilerin silinmediği açıkça belirtilmeli');

    const consumedAgain = repository.takeListWarning();
    assert.equal(consumedAgain, null, 'uyarı bir kez tüketildikten sonra tekrar aynı uyarıyı döndürmemeli');
  });

  it('atlanan kayıt yoksa takeListWarning() null döner', async () => {
    const repository = new IndexedDbProjectRepository();
    const good = createProjectDocument({ idea: 'Tek başına sağlam proje' });
    await repository.save(good, { createOnly: true });

    await repository.list();

    assert.equal(repository.takeListWarning(), null, 'atlanan kayıt yokken uyarı üretilmemeli');
  });
});

describe('IndexedDbProjectRepository — purge() (storage.js:272-292)', () => {
  beforeEach(resetIndexedDbFixture);

  it('purge(): checkpoint, commandLog ve quarantine sayıları tam olarak silinenle eşleşir, backupsDeleted DAİMA 0 döner', async () => {
    const repository = new IndexedDbProjectRepository();
    const project = createProjectDocument({ idea: 'Purge sayım testi' });
    project.commandLog.push(
      {
        commandId: 'cmd-1', commandType: 'AddDiscoveryTurn',
        expectedDocumentRevision: 1, committedDocumentRevision: 1,
        expectedCanonicalRevision: 1, committedCanonicalRevision: 1,
        createdAt: '2026-08-01T00:00:00.000Z'
      },
      {
        commandId: 'cmd-2', commandType: 'AddDiscoveryTurn',
        expectedDocumentRevision: 1, committedDocumentRevision: 1,
        expectedCanonicalRevision: 1, committedCanonicalRevision: 1,
        createdAt: '2026-08-01T00:00:01.000Z'
      }
    );
    const firstSave = await repository.save(project, { createOnly: true }); // checkpoint #1, commandLog x2

    const secondCandidate = structuredClone(firstSave);
    secondCandidate.documentRevision += 1;
    secondCandidate.commandLog.push({
      commandId: 'cmd-3', commandType: 'AddDiscoveryTurn',
      expectedDocumentRevision: 1, committedDocumentRevision: 2,
      expectedCanonicalRevision: 1, committedCanonicalRevision: 1,
      createdAt: '2026-08-01T00:00:02.000Z'
    });
    const secondSave = await repository.save(secondCandidate, {
      expectedDocumentRevision: firstSave.documentRevision,
      expectedCanonicalRevision: firstSave.canonicalRevision
    }); // checkpoint #2, commandLog now 3 distinct rows total

    // Bir karantina kaydı üret: aynı projectId için bütünlük ihlali.
    const corrupted = structuredClone(secondSave);
    corrupted.identity.name = 'BOZUK';
    await putRawRecord('projects', corrupted);
    const quarantineTrigger = await repository.get(project.id);
    assert.equal(quarantineTrigger, null, 'ön koşul: bu get() karantina kaydı üretmeli');

    const checkpointsBefore = await repository.listCheckpoints(project.id);
    assert.equal(checkpointsBefore.length, 2, 'ön koşul: 2 checkpoint birikmiş olmalı');
    const commandLogBefore = await getAllRawRecords('commandLog');
    assert.equal(commandLogBefore.length, 3, 'ön koşul: 3 ayrı commandLog kaydı olmalı');
    const quarantineBefore = await repository.listQuarantined();
    assert.equal(quarantineBefore.length, 1, 'ön koşul: 1 karantina kaydı olmalı');

    const result = await repository.purge(project.id);

    assert.deepEqual(result, {
      projectDeleted: true,
      checkpointsDeleted: 2,
      commandLogEntriesDeleted: 3,
      quarantineEntriesDeleted: 1,
      backupsDeleted: 0
    }, 'IndexedDbProjectRepository.purge() migration yedeklerini checkpoint deposuna gömdüğü için backupsDeleted HER ZAMAN 0 döner (storage.js:290)');

    const checkpointsAfter = await repository.listCheckpoints(project.id);
    assert.equal(checkpointsAfter.length, 0);
    const quarantineAfter = await repository.listQuarantined();
    assert.equal(quarantineAfter.some(record => record.projectId === project.id), false);
  });

  it('purge(): var olmayan proje için projectDeleted false, sayaçlar 0 döner', async () => {
    const repository = new IndexedDbProjectRepository();
    const result = await repository.purge('no-such-project');
    assert.deepEqual(result, {
      projectDeleted: false,
      checkpointsDeleted: 0,
      commandLogEntriesDeleted: 0,
      quarantineEntriesDeleted: 0,
      backupsDeleted: 0
    });
  });
});
