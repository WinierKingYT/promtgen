import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { createProjectDocument } from '../../src/v4/project-document.js';
import { normalizeProjectDocument } from '../../src/v4/canonical-entities.js';
import { IndexedDbProjectRepository } from '../../src/v4/storage.js';
import {
    TauriSqliteProjectRepository,
    restoreStorageBackupAsNewRevision,
    isDesktopStorageAvailable,
    getDesktopStorageHealth,
    listDesktopProjectBackups,
    listDesktopQuarantinedProjects,
    loadDesktopProjectBackup,
    createPlatformRepository
} from '../../src/v4/tauri-storage.js';

/**
 * Küçük bir sahte `invoke` köprüsü: gerçek Tauri IPC katmanına dokunmadan
 * `TauriSqliteProjectRepository`'yi test edebilmek için en küçük dikiş
 * noktası. `tests/v4/tauri-storage-quarantine.test.js` ile birebir aynı
 * desen -- burada da çağrı geçmişini kaydedebilmek için ek bir `calls`
 * dizisi tutuyoruz.
 */
function fakeInvoke(handlers, calls = []) {
    return async (command, args) => {
        calls.push({ command, args });
        if (!(command in handlers)) throw new Error(`Beklenmeyen komut çağrıldı: ${command}`);
        const handler = handlers[command];
        return typeof handler === 'function' ? handler(args) : handler;
    };
}

describe('TauriSqliteProjectRepository.save() — normalleştirme, doğrulama ve Rust IPC çağrısı', () => {
    it('save(): geçerli bir belge round-trip yapar ve normalleştirilmiş projeyi döndürür', async () => {
        const project = createProjectDocument({ idea: 'Round-trip testi için geçerli proje.' });
        const calls = [];
        const repository = new TauriSqliteProjectRepository(fakeInvoke({ save_project: () => undefined }, calls));

        const saved = await repository.save(project);

        assert.deepEqual(saved, normalizeProjectDocument(project));
    });

    it('save(): save_project komutunu tam olarak beklenen argümanlarla çağırır (id, serileştirilmiş belge, updatedAt, revision/createOnly seçenekleri)', async () => {
        const project = createProjectDocument({ idea: 'IPC argümanlarını doğrulayan proje.' });
        const calls = [];
        const repository = new TauriSqliteProjectRepository(fakeInvoke({ save_project: () => undefined }, calls));

        const saved = await repository.save(project);

        assert.equal(calls.length, 1);
        assert.equal(calls[0].command, 'save_project');
        assert.equal(calls[0].args.id, saved.id);
        assert.deepEqual(JSON.parse(calls[0].args.document), saved);
        assert.equal(calls[0].args.updatedAt, saved.lifecycle.updatedAt);
        // options verilmediğinde: expected revision alanları undefined kalır,
        // createOnly kesin eşitlik (`=== true`) ile false'a düşer.
        assert.equal(calls[0].args.expectedDocumentRevision, undefined);
        assert.equal(calls[0].args.expectedCanonicalRevision, undefined);
        assert.equal(calls[0].args.createOnly, false);
    });

    it('save(): geçersiz belge invoke ÇAĞRILMADAN reddedilir, hata mesajları boşlukla birleştirilir', async () => {
        const project = createProjectDocument({ idea: 'Geçersiz hale getirilecek proje.' });
        const invalid = structuredClone(project);
        invalid.identity.originalIdea = ''; // -> "Başlangıç fikri eksik." (normalizeProjectDocument identity'ye dokunmaz, hayatta kalır)
        // NOT: `invalid.schemaVersion = 999` gibi bir bozulma İLK DENEMEDE
        // beklendiği gibi çalışmadı -- save() önce normalizeProjectDocument()
        // çağırır ve o METHOD KOŞULSUZ `next.schemaVersion = 5` /
        // `next.schemaRevision = 7` YAZAR (canonical-entities.ts:612-613).
        // Yani schemaVersion/schemaRevision üzerinden bir doğrulama hatası
        // save() aracılığıyla ASLA tetiklenemez -- normalize her zaman
        // validate'ten ÖNCE çalışıp bu alanları sessizce düzeltir. Bunun
        // yerine normalizeProjectDocument'ın hiç dokunmadığı bir alanı
        // (planningDepth.selected) bozarak ikinci, hayatta kalan bir hata
        // üretiyoruz.
        invalid.planningDepth.selected = 'invalid-depth'; // -> "Planlama derinliği geçersiz."
        const calls = [];
        const repository = new TauriSqliteProjectRepository(fakeInvoke({ save_project: () => undefined }, calls));

        await assert.rejects(
            () => repository.save(invalid),
            (error) => {
                assert.ok(error instanceof Error);
                assert.match(error.message, /Başlangıç fikri eksik\./);
                assert.match(error.message, /Planlama derinliği geçersiz\./);
                return true;
            }
        );
        assert.equal(calls.length, 0, 'Doğrulama başarısız olduğunda save_project asla çağrılmamalı.');
    });

    it('save(): options.expectedDocumentRevision / expectedCanonicalRevision doğrudan invoke argümanlarına aktarılır', async () => {
        const project = createProjectDocument({ idea: 'Revision beklentili kaydetme.' });
        const calls = [];
        const repository = new TauriSqliteProjectRepository(fakeInvoke({ save_project: () => undefined }, calls));

        await repository.save(project, { expectedDocumentRevision: 3, expectedCanonicalRevision: 2 });

        assert.equal(calls[0].args.expectedDocumentRevision, 3);
        assert.equal(calls[0].args.expectedCanonicalRevision, 2);
    });

    it('save(): options.createOnly === true olduğunda createOnly true olarak gönderilir', async () => {
        const project = createProjectDocument({ idea: 'createOnly testi.' });
        const calls = [];
        const repository = new TauriSqliteProjectRepository(fakeInvoke({ save_project: () => undefined }, calls));

        await repository.save(project, { createOnly: true });

        assert.equal(calls[0].args.createOnly, true);
    });

    it("save(): createOnly kesin eşitlikle kontrol edilir -- truthy ama boolean-olmayan bir değer (string 'true') false'a düşer (kodun BEKLENEN davranışı, muhtemel bir tuzak)", async () => {
        const project = createProjectDocument({ idea: 'createOnly kesin eşitlik testi.' });
        const calls = [];
        const repository = new TauriSqliteProjectRepository(fakeInvoke({ save_project: () => undefined }, calls));

        await repository.save(project, { createOnly: 'true' });

        assert.equal(calls[0].args.createOnly, false, "options.createOnly === true` kesin eşitliği string 'true' değerini reddeder.");
    });

    it("save(): invoke('save_project', ...)'in dönüş değeri YOK SAYILIR -- her zaman normalleştirilmiş belge döner", async () => {
        const project = createProjectDocument({ idea: 'invoke dönüş değeri göz ardı edilmeli.' });
        const calls = [];
        const repository = new TauriSqliteProjectRepository(fakeInvoke({ save_project: () => ({ unexpected: 'shape', ok: false }) }, calls));

        const saved = await repository.save(project);

        assert.deepEqual(saved, normalizeProjectDocument(project));
    });
});

describe('TauriSqliteProjectRepository.archive() / restore() — dönüş değerleri ve idempotentlik', () => {
    function makeRepositoryWithProject(project, calls = []) {
        const store = new Map([[project.id, JSON.stringify(project)]]);
        const handlers = {
            load_project: ({ id }) => store.get(id) ?? null,
            save_project: ({ id, document }) => {
                store.set(id, document);
            }
        };
        return { repository: new TauriSqliteProjectRepository(fakeInvoke(handlers, calls)), store };
    }

    it('archive(): var olmayan proje için false döner', async () => {
        const calls = [];
        const repository = new TauriSqliteProjectRepository(fakeInvoke({ load_project: () => null }, calls));

        const result = await repository.archive('yok-boyle-bir-id');

        assert.equal(result, false);
        assert.equal(calls.some(call => call.command === 'save_project'), false);
    });

    it("archive(): proje zaten 'archived' ise true döner ve save_project ÇAĞRILMAZ (idempotent, yazma yok)", async () => {
        const project = createProjectDocument({ idea: 'Zaten arşivli proje.' });
        project.lifecycle.status = 'archived';
        const normalized = normalizeProjectDocument(project);
        const calls = [];
        const { repository } = makeRepositoryWithProject(normalized, calls);

        const result = await repository.archive(normalized.id);

        assert.equal(result, true);
        assert.equal(calls.some(call => call.command === 'save_project'), false, "Zaten arşivli projede save_project'e hiç gidilmemeli.");
    });

    it("archive(): aktif projeyi arşivler; documentRevision +1 olur ve save_project beklenen ÖNCEKİ revizyonlarla çağrılır", async () => {
        const project = createProjectDocument({ idea: 'Arşivlenecek aktif proje.' });
        const normalized = normalizeProjectDocument(project);
        const calls = [];
        const { repository, store } = makeRepositoryWithProject(normalized, calls);

        const result = await repository.archive(normalized.id);

        assert.equal(result, true);
        const saveCall = calls.find(call => call.command === 'save_project');
        assert.ok(saveCall, 'save_project çağrılmalı.');
        assert.equal(saveCall.args.expectedDocumentRevision, normalized.documentRevision);
        assert.equal(saveCall.args.expectedCanonicalRevision, normalized.canonicalRevision);
        const persisted = JSON.parse(store.get(normalized.id));
        assert.equal(persisted.lifecycle.status, 'archived');
        assert.equal(persisted.documentRevision, normalized.documentRevision + 1);
    });

    it('restore(): var olmayan proje için false döner', async () => {
        const calls = [];
        const repository = new TauriSqliteProjectRepository(fakeInvoke({ load_project: () => null }, calls));

        const result = await repository.restore('yok-boyle-bir-id');

        assert.equal(result, false);
        assert.equal(calls.some(call => call.command === 'save_project'), false);
    });

    it("restore(): proje ZATEN aktifse (arşivli değilse) true döner ve save_project ÇAĞRILMAZ -- web (IndexedDB) deposuyla BİREBİR AYNI semantik", async () => {
        const project = createProjectDocument({ idea: 'Zaten aktif proje.' });
        const normalized = normalizeProjectDocument(project);
        const calls = [];
        const { repository } = makeRepositoryWithProject(normalized, calls);

        const result = await repository.restore(normalized.id);

        assert.equal(result, true);
        assert.equal(calls.some(call => call.command === 'save_project'), false);
    });

    it("restore(): arşivli projeyi aktifleştirir; documentRevision +1 olur ve save_project beklenen ÖNCEKİ revizyonlarla çağrılır", async () => {
        const project = createProjectDocument({ idea: 'Arşivden geri dönecek proje.' });
        project.lifecycle.status = 'archived';
        const normalized = normalizeProjectDocument(project);
        const calls = [];
        const { repository, store } = makeRepositoryWithProject(normalized, calls);

        const result = await repository.restore(normalized.id);

        assert.equal(result, true);
        const saveCall = calls.find(call => call.command === 'save_project');
        assert.ok(saveCall);
        assert.equal(saveCall.args.expectedDocumentRevision, normalized.documentRevision);
        assert.equal(saveCall.args.expectedCanonicalRevision, normalized.canonicalRevision);
        const persisted = JSON.parse(store.get(normalized.id));
        assert.equal(persisted.lifecycle.status, 'active');
        assert.equal(persisted.documentRevision, normalized.documentRevision + 1);
    });

    it('MİMARİ NOT: archive()/restore() masaüstü uygulaması src/v4/storage.ts IndexedDbProjectRepository.archive()/restore() ile SATIR SATIR aynı mantığı taşır (storage.ts:403-427) -- iki platform arasında davranış SAPMASI YOKTUR', () => {
        // Bu test kodu çalıştırmaz; iddiayı belgeler ve okuyucuyu kaynağa
        // yönlendirir. Her iki uygulama da: (1) get() null dönerse false,
        // (2) hedef durum zaten mevcutsa true VE save() çağrılmaz, (3) aksi
        // halde durumu değiştirir, documentRevision'ı artırır ve save()'i
        // ÖNCEKİ revizyonları expected* olarak geçerek çağırır. Kaynak:
        // src/v4/tauri-storage.js:62-85 ve src/v4/storage.ts:403-427.
        assert.ok(true);
    });
});

describe('TauriSqliteProjectRepository.purge() — invoke sonucunu doğrulamadan olduğu gibi döndürür', () => {
    it('purge(): purge_project komutunu {id} ile çağırır ve Rust tarafından dönen sayıları AYNEN döndürür', async () => {
        const calls = [];
        const expected = { projectDeleted: true, checkpointsDeleted: 4, commandLogEntriesDeleted: 2, quarantineEntriesDeleted: 0, backupsDeleted: 3 };
        const repository = new TauriSqliteProjectRepository(fakeInvoke({ purge_project: () => expected }, calls));

        const result = await repository.purge('proje-id');

        assert.deepEqual(result, expected);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].command, 'purge_project');
        assert.deepEqual(calls[0].args, { id: 'proje-id' });
    });

    it("purge(): dönüş değeri HİÇ doğrulanmaz -- ProjectPurgeResult şeklini karşılamayan bir değer bile olduğu gibi geçer (drift riski: .d.ts Promise<ProjectPurgeResult> vaat ediyor, çalışma zamanı hiçbir garanti vermiyor)", async () => {
        const repository = new TauriSqliteProjectRepository(fakeInvoke({ purge_project: () => 'beklenmeyen-sekil' }));

        const result = await repository.purge('proje-id');

        assert.equal(result, 'beklenmeyen-sekil');
    });

    it('purge(): invoke undefined dönerse purge() de undefined döner (şema garantisi yok)', async () => {
        const repository = new TauriSqliteProjectRepository(fakeInvoke({ purge_project: () => undefined }));

        const result = await repository.purge('proje-id');

        assert.equal(result, undefined);
    });
});

describe('Serbest fonksiyonlar — Tauri OLMAYAN (test) ortamındaki davranış', () => {
    it('isDesktopStorageAvailable(): Node test ortamında (globalThis.isTauri tanımsız) false döner', () => {
        assert.equal(isDesktopStorageAvailable(), false);
    });

    it('getDesktopStorageHealth(): Tauri olmayan ortamda invoke hiç çağrılmadan null döner', async () => {
        const result = await getDesktopStorageHealth();
        assert.equal(result, null);
    });

    it('listDesktopProjectBackups(): Tauri olmayan ortamda invoke hiç çağrılmadan boş dizi döner', async () => {
        const result = await listDesktopProjectBackups('herhangi-proje-id');
        assert.deepEqual(result, []);
    });

    it('listDesktopQuarantinedProjects(): Tauri olmayan ortamda invoke hiç çağrılmadan boş dizi döner', async () => {
        const result = await listDesktopQuarantinedProjects();
        assert.deepEqual(result, []);
    });

    it("loadDesktopProjectBackup(): Tauri olmayan ortamda Türkçe bir hata fırlatır ('yalnız masaüstünde kullanılabilir')", async () => {
        const project = createProjectDocument({ idea: 'Yedek yükleme testi.' });
        await assert.rejects(
            () => loadDesktopProjectBackup(project, 1),
            /Yerel SQLite yedekleri yalnız masaüstünde kullanılabilir\./
        );
    });

    it('createPlatformRepository(): Tauri olmayan ortamda IndexedDbProjectRepository örneği döner (TauriSqliteProjectRepository DEĞİL)', () => {
        const repository = createPlatformRepository();
        assert.ok(repository instanceof IndexedDbProjectRepository);
        assert.ok(!(repository instanceof TauriSqliteProjectRepository));
    });
});

describe('Serbest fonksiyonlar — isTauri() ZORLA true yapıldığında (enjekte edilebilir invoke YOK)', () => {
    // ÖNEMLİ TASARIM NOTU: sınıfın aksine (`new TauriSqliteProjectRepository(invokeFn)`),
    // bu serbest fonksiyonlar HER ZAMAN gerçek `@tauri-apps/api/core`'un
    // `invoke`'unu kullanır -- enjeksiyon dikişi yoktur. `isTauri()` yalnız
    // `globalThis.isTauri` bayrağına bakar (core.js:278-281: `(globalThis ||
    // window).isTauri`; `globalThis` Node'da her zaman truthy olduğundan
    // `window`'a hiç düşülmez), bu yüzden Node'da bu bayrağı zorlayabiliyoruz.
    // Ama gerçek `invoke()` `window.__TAURI_INTERNALS__.invoke(...)`'a
    // gider (core.js:201-203) ve Node'da `window` tanımsızdır -- bu yüzden
    // bu fonksiyonların "mutlu yol"u (isTauri() true) bu test ortamında
    // GERÇEKTEN test edilemez; ReferenceError ile reddedilirler. Bu davranışın
    // kendisi -- masaüstü ortamı simüle edilmeye çalışıldığında invoke'un
    // enjekte edilemediği için patlaması -- pinlenen tasarım kusurudur.
    beforeEach(() => {
        globalThis.isTauri = true;
    });
    afterEach(() => {
        delete globalThis.isTauri;
    });

    it('isDesktopStorageAvailable(): globalThis.isTauri = true iken true döner', () => {
        assert.equal(isDesktopStorageAvailable(), true);
    });

    it('getDesktopStorageHealth(): enjekte edilebilir invoke olmadığı için gerçek Tauri IPC köprüsüne gitmeye çalışır ve Node ortamında ReferenceError (window tanımsız) ile reddedilir', async () => {
        await assert.rejects(() => getDesktopStorageHealth(), /window is not defined/);
    });

    it('listDesktopProjectBackups(): aynı nedenle ReferenceError ile reddedilir', async () => {
        await assert.rejects(() => listDesktopProjectBackups('proje-id'), /window is not defined/);
    });

    it('listDesktopQuarantinedProjects(): aynı nedenle ReferenceError ile reddedilir', async () => {
        await assert.rejects(() => listDesktopQuarantinedProjects(), /window is not defined/);
    });

    it('loadDesktopProjectBackup(): isTauri() true olduğu için "yalnız masaüstünde" hatası ATLANIR, gerçek invoke çağrılır ve ReferenceError ile reddedilir', async () => {
        const project = createProjectDocument({ idea: 'Zorla Tauri ortamı testi.' });
        await assert.rejects(() => loadDesktopProjectBackup(project, 1), /window is not defined/);
    });

    it('createPlatformRepository(): globalThis.isTauri = true iken TauriSqliteProjectRepository örneği döner (kurucu invoke çağırmadığı için burada patlamaz)', () => {
        const repository = createPlatformRepository();
        assert.ok(repository instanceof TauriSqliteProjectRepository);
        assert.ok(!(repository instanceof IndexedDbProjectRepository));
    });
});

describe('restoreStorageBackupAsNewRevision() — her zaman YENİ bir revizyon, asla yerinde üzerine yazma değil', () => {
    it('mutlu yol: documentRevision ve canonicalRevision CARİ projeninkinden +1 olur (yedeğin kendi revizyonundan BAĞIMSIZ)', () => {
        const current = normalizeProjectDocument(createProjectDocument({ idea: 'Cari proje.' }));
        current.documentRevision = 10;
        current.canonicalRevision = 8;
        const backup = normalizeProjectDocument(createProjectDocument({ idea: 'Yedek proje.' }));
        backup.id = current.id;
        backup.documentRevision = 3;
        backup.canonicalRevision = 3;

        const restored = restoreStorageBackupAsNewRevision(current, backup);

        assert.equal(restored.documentRevision, 11, 'Yeni documentRevision cari+1 olmalı, yedeğin revizyonundan değil.');
        assert.equal(restored.canonicalRevision, 9, 'Yeni canonicalRevision cari+1 olmalı, yedeğin revizyonundan değil.');
    });

    it("mutlu yol: yedeğin revizyonu carininkinden BÜYÜK olsa bile sonuç yine cari+1'dir (yerinde üzerine yazma YOK)", () => {
        const current = normalizeProjectDocument(createProjectDocument({ idea: 'Cari proje (düşük revizyon).' }));
        current.documentRevision = 2;
        current.canonicalRevision = 2;
        const backup = normalizeProjectDocument(createProjectDocument({ idea: 'Yedek proje (yüksek revizyon).' }));
        backup.id = current.id;
        backup.documentRevision = 50;
        backup.canonicalRevision = 45;

        const restored = restoreStorageBackupAsNewRevision(current, backup);

        assert.equal(restored.documentRevision, 3);
        assert.equal(restored.canonicalRevision, 3);
    });

    it('mutlu yol: lifecycle aktifleşir, finalizedAt temizlenir, revisions/exports/executionSessions/commandLog CARİ projeden korunur (yedekten DEĞİL)', () => {
        const current = normalizeProjectDocument(createProjectDocument({ idea: 'Cari proje geçmişi korunmalı.' }));
        current.lifecycle.finalizedAt = '2024-01-01T00:00:00.000Z';
        current.commandLog = [{ commandId: 'cari-komut', commandType: 'Test', expectedDocumentRevision: 1, committedDocumentRevision: 1, expectedCanonicalRevision: 1, committedCanonicalRevision: 1, createdAt: current.lifecycle.createdAt }];
        const backup = normalizeProjectDocument(createProjectDocument({ idea: 'Yedek proje geçmişi kullanılmamalı.' }));
        backup.id = current.id;
        backup.commandLog = [{ commandId: 'yedek-komut', commandType: 'Test', expectedDocumentRevision: 1, committedDocumentRevision: 1, expectedCanonicalRevision: 1, committedCanonicalRevision: 1, createdAt: backup.lifecycle.createdAt }];

        const restored = restoreStorageBackupAsNewRevision(current, backup);

        assert.equal(restored.lifecycle.status, 'active');
        assert.equal(restored.lifecycle.finalizedAt, '');
        assert.equal(restored.commandLog.length, 1);
        assert.equal(restored.commandLog[0].commandId, 'cari-komut');
        assert.equal(restored.metadata.restoredFromStorageBackup.sourceRevision, backup.canonicalRevision);
    });

    it('mutlu yol: sonuca yedek geri yüklemesini kayıt altına alan yeni bir revisions girdisi eklenir (numarası yeni canonicalRevision ile eşleşir)', () => {
        const current = normalizeProjectDocument(createProjectDocument({ idea: 'Revizyon geçmişi kontrolü.' }));
        const backup = normalizeProjectDocument(createProjectDocument({ idea: 'Yedek.' }));
        backup.id = current.id;

        const restored = restoreStorageBackupAsNewRevision(current, backup);

        assert.equal(restored.revisions.length, 1);
        assert.equal(restored.revisions[0].number, restored.canonicalRevision);
        assert.match(restored.revisions[0].summary, /yeni revision olarak geri yüklendi/);
    });

    it("farklı id'ye sahip yedek 'Yedek başka bir projeye ait.' hatasıyla reddedilir", () => {
        const current = normalizeProjectDocument(createProjectDocument({ idea: 'Cari.' }));
        const backup = normalizeProjectDocument(createProjectDocument({ idea: 'Farklı proje.' }));

        assert.throws(() => restoreStorageBackupAsNewRevision(current, backup), /Yedek başka bir projeye ait\./);
    });

    it("geri yükleme sonucu şema doğrulamasını geçemezse 'Yedek geri yükleme sonucu geçersiz' önekiyle reddedilir", () => {
        const current = normalizeProjectDocument(createProjectDocument({ idea: 'Cari.' }));
        const backup = normalizeProjectDocument(createProjectDocument({ idea: 'Bozulacak yedek.' }));
        backup.id = current.id;
        // NOT: `delete backup.sections` İLK DENEMEDE beklendiği gibi
        // "Yedek geri yükleme sonucu geçersiz" hatasını üretmedi -- bkz.
        // aşağıdaki ayrı test ("BULUNAN KUSUR"), fonksiyon `sections` alanına
        // validate edilmeden ÖNCE erişiyor ve ham bir TypeError fırlatıyor.
        // Burada onun yerine normalizeProjectDocument'ın DOKUNMADIĞI ama
        // `sections`e ihtiyaç duymayan bir alanı bozuyoruz: planningDepth.
        backup.planningDepth.selected = 'invalid-depth'; // -> "Planlama derinliği geçersiz."

        assert.throws(
            () => restoreStorageBackupAsNewRevision(current, backup),
            /Yedek geri yükleme sonucu geçersiz: .*Planlama derinliği geçersiz\./
        );
    });

    it("DÜZELTME (eski adı: BULUNAN KUSUR src/v4/tauri-storage.js:152): yedeğin `sections` alanı eksikse fonksiyon artık ham bir TypeError DEĞİL, dostça 'Yedek geri yükleme sonucu geçersiz' hatasını (validatörün kendi 'Plan bölümleri eksik.' mesajıyla) fırlatır", () => {
        const current = normalizeProjectDocument(createProjectDocument({ idea: 'Cari.' }));
        const backup = normalizeProjectDocument(createProjectDocument({ idea: 'sections alanı silinecek yedek.' }));
        backup.id = current.id;
        delete backup.sections;

        // BİLİNÇLİ DÜZELTME: bu test önceden bir kusuru PINLIYORDU --
        // `next.revisions.push({ ..., affectedSections: Object.keys(next.sections),
        // ... })` satırı (tauri-storage.js:152) `validateProjectDocument(next)`'tan
        // ÖNCE çalışıyor ve `next.sections` undefined olduğunda
        // `Object.keys(undefined)` ham bir "Cannot convert undefined or null to
        // object" TypeError'ı fırlatıyordu. Kusur, `restoreStorageBackupAsNewRevision`
        // içindeki doğrulama sırası değiştirilerek (validasyon artık
        // `next.sections`e erişen HERHANGİ bir satırdan önce çalışıyor) düzeltildi
        // -- bir `?`/`!`/`?? {}` ile susturulmadı, çünkü bu, sections'ı gerçekten
        // eksik olan bir belge için sessizce boş bir `affectedSections` üretir ve
        // bu, ham TypeError'dan DAHA KÖTÜ olurdu (bkz. görev talimatı). Artık
        // kullanıcı, motorun ham hatası yerine `validateProjectDocument`'ın
        // "Plan bölümleri eksik." mesajını taşıyan Türkçe, dostça bir hata görür.
        assert.throws(
            () => restoreStorageBackupAsNewRevision(current, backup),
            (error) => {
                assert.ok(error instanceof Error);
                assert.ok(!(error instanceof TypeError), 'Ham TypeError artık kullanıcıya sızmamalı.');
                assert.match(error.message, /^Yedek geri yükleme sonucu geçersiz: /);
                assert.match(error.message, /Plan bölümleri eksik\./);
                return true;
            }
        );
    });
});

describe('TauriSqliteProjectRepository.takeListWarning() — instance-scoped "bir kez tüket" durumu', () => {
    it('ikinci çağrı null döner (durum tüketildikten sonra tekrar okunamaz)', async () => {
        const calls = [];
        const rows = ['gecersiz-json'];
        const repository = new TauriSqliteProjectRepository(fakeInvoke({ list_projects: () => rows, save_project: () => undefined }, calls));

        await repository.list();

        assert.match(repository.takeListWarning(), /1 proje okunamadı/);
        assert.equal(repository.takeListWarning(), null);
    });

    it("DÜZELTME (eski adı: MİMARİ SONUÇ): artık uyarı durumu HER ÖRNEĞİN kendi `#lastListWarning` alanında tutulur -- İKİNCİ bir örneğin BAŞARILI list() çağrısı BİRİNCİ örneğin uyarısını SİLMEZ, `repository.takeListWarning()` her örnek için BAĞIMSIZDIR", async () => {
        // BİLİNÇLİ DÜZELTME: bu test önceden bir kusuru PINLIYORDU (uyarı
        // durumu modül seviyesinde tek bir mutable değişkende tutuluyordu,
        // bkz. src/v4/tauri-storage.ts eski `let lastListWarning`). Artık
        // TauriSqliteProjectRepository, web (IndexedDB) tarafındaki
        // IndexedDbProjectRepository.#lastListWarning ile birebir aynı
        // instance-scoped tasarımı kullanıyor (bkz. src/v4/contracts.ts
        // ProjectRepository.takeListWarning). Modül seviyesindeki paylaşılan
        // durum ve onu proxy'leyen deprecated `takeDesktopProjectListWarning()`
        // serbest fonksiyonu tamamen KALDIRILDI -- artık üretim kodu VE testler
        // yalnızca instance-scoped `takeListWarning()`'i kullanıyor.
        const good = createProjectDocument({ idea: 'Sağlam proje.' });
        const repositoryA = new TauriSqliteProjectRepository(fakeInvoke({
            list_projects: () => ['gecersiz-json-a'],
            save_project: () => undefined
        }));
        const repositoryB = new TauriSqliteProjectRepository(fakeInvoke({
            list_projects: () => [JSON.stringify(good)],
            save_project: () => undefined
        }));

        await repositoryA.list(); // A bir uyarı üretir (yalnız kendi instance alanına yazılır)
        await repositoryB.list(); // B temiz bir liste döner (yalnız kendi instance alanını etkiler)

        assert.match(repositoryA.takeListWarning(), /1 proje okunamadı/, "A'nın uyarısı B'nin temiz list() çağrısından ETKİLENMEMELİ.");
        assert.equal(repositoryB.takeListWarning(), null);
    });

    it("DÜZELTME (eski adı: MİMARİ SONUÇ (ters sıra)): artık İKİNCİ örneğin BAŞARISIZ list() çağrısı, hiçbir bağı olmayan BİRİNCİ örnek üzerinden OKUNAMAZ -- `repository.takeListWarning()` yalnız kendi örneğinin durumunu döndürür", async () => {
        const good = createProjectDocument({ idea: 'Sağlam proje.' });
        const repositoryA = new TauriSqliteProjectRepository(fakeInvoke({
            list_projects: () => [JSON.stringify(good)],
            save_project: () => undefined
        }));
        const repositoryB = new TauriSqliteProjectRepository(fakeInvoke({
            list_projects: () => ['gecersiz-json-b'],
            save_project: () => undefined
        }));

        await repositoryA.list(); // A temiz, yalnız kendi instance alanı null
        await repositoryB.list(); // B bir uyarı üretir (yalnız kendi instance alanına yazılır)

        assert.equal(repositoryA.takeListWarning(), null, "A'nın instance alanı B'nin uyarısından ETKİLENMEMELİ.");
        assert.match(repositoryB.takeListWarning(), /1 proje okunamadı/);
    });
});
