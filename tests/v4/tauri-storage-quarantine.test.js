import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createProjectDocument } from '../../src/v4/project-document.js';
import { TauriSqliteProjectRepository } from '../../src/v4/tauri-storage.js';

/**
 * Küçük bir sahte `invoke` köprüsü: gerçek Tauri IPC katmanına dokunmadan
 * `TauriSqliteProjectRepository`'yi test edebilmek için en küçük dikiş noktası.
 * `command -> handler` eşlemesi verilir; handler bir fonksiyonsa çağrılır,
 * değilse doğrudan değer olarak döner.
 */
function fakeInvoke(handlers) {
    return async (command, args) => {
        if (!(command in handlers)) throw new Error(`Beklenmeyen komut çağrıldı: ${command}`);
        const handler = handlers[command];
        return typeof handler === 'function' ? handler(args) : handler;
    };
}

describe('TauriSqliteProjectRepository — bozuk kayıt karşısında liste görünürlüğü', () => {
    // NOT: önceden burada, testler arası sızıntıyı önlemek için paylaşılan
    // (modül seviyesindeki) uyarı durumunu temizleyen bir `beforeEach` vardı.
    // Uyarı durumu artık her `TauriSqliteProjectRepository` örneğinin kendi
    // `#lastListWarning` özel alanında tutulduğundan (bkz. src/v4/tauri-storage.ts
    // `takeListWarning()`), testler arasında paylaşılan hiçbir durum kalmadı --
    // her test kendi repository örneğini yaratıyor, temizlenecek bir şey yok.

    it('list(): bir satır ayrıştırılamayan JSON olsa bile okunabilen projeleri döndürür', async () => {
        const good = createProjectDocument({ idea: 'Bozuk kayıt yanında yaşayan geçerli proje.' });
        const rows = [JSON.stringify(good), '{bu gecerli JSON degil'];
        const repository = new TauriSqliteProjectRepository(fakeInvoke({
            list_projects: () => rows,
            save_project: () => undefined
        }));

        const projects = await repository.list();

        assert.equal(projects.length, 1, 'Yalnızca okunabilen proje listede kalmalı.');
        assert.equal(projects[0].id, good.id);
    });

    it('list(): JSON olarak ayrıştırılan ama şema/migration doğrulamasını geçemeyen belge atlanır, diğerleri listelenir', async () => {
        const good = createProjectDocument({ idea: 'Sağlam proje.' });
        const invalid = structuredClone(good);
        invalid.id = 'invalid-project-schema';
        invalid.identity.originalIdea = ''; // validateProjectDocument: "Başlangıç fikri eksik."
        const rows = [JSON.stringify(good), JSON.stringify(invalid)];
        const repository = new TauriSqliteProjectRepository(fakeInvoke({
            list_projects: () => rows,
            save_project: () => undefined
        }));

        const projects = await repository.list();

        assert.equal(projects.length, 1, 'Şema doğrulamasını geçemeyen belge listeye girmemeli.');
        assert.equal(projects[0].id, good.id);
        assert.equal(projects.some(project => project.id === 'invalid-project-schema'), false);
    });

    it('list(): atlanan kayıt sayısını, veri kaybı olmadığını belirten Türkçe bir uyarı olarak bildirir', async () => {
        const good = createProjectDocument({ idea: 'Sağlam proje.' });
        const rows = [JSON.stringify(good), 'gecersiz-json', 'gecersiz-json-2'];
        const repository = new TauriSqliteProjectRepository(fakeInvoke({
            list_projects: () => rows,
            save_project: () => undefined
        }));

        await repository.list();
        const warning = repository.takeListWarning();

        assert.match(warning, /2 proje okunamadı/);
        assert.match(warning, /silinmedi/);
        assert.equal(repository.takeListWarning(), null, 'Uyarı bir kez okunduktan sonra tüketilmeli.');
    });

    it('list(): tüm satırlar okunabiliyorsa uyarı üretmez', async () => {
        const good = createProjectDocument({ idea: 'Tek başına sağlam proje.' });
        const repository = new TauriSqliteProjectRepository(fakeInvoke({
            list_projects: () => [JSON.stringify(good)],
            save_project: () => undefined
        }));

        await repository.list();

        assert.equal(repository.takeListWarning(), null);
    });

    it('get(): bozuk tek belge için veri kaybı olmadığını belirten gerçek bir hata fırlatır (sessiz reddedilme değil)', async () => {
        const repository = new TauriSqliteProjectRepository(fakeInvoke({
            load_project: () => 'bu-belge-gecerli-json-degil'
        }));

        await assert.rejects(
            () => repository.get('broken-id'),
            (error) => {
                assert.ok(error instanceof Error);
                assert.match(error.message, /broken-id/);
                assert.match(error.message, /silinmedi/);
                return true;
            }
        );
    });
});
