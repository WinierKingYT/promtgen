import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    TauriSqliteProjectRepository,
    parseProjectPurgeResult,
    parseStorageHealthSummary,
    parseDesktopBackupSummaries,
    parseDesktopQuarantineSummaries,
    getDesktopStorageHealth,
    listDesktopProjectBackups,
    listDesktopQuarantinedProjects
} from '../../src/v4/tauri-storage.js';

/**
 * IPC SINIRI DOĞRULAMASI
 *
 * Bu dosya, Rust tarafından dönen dört değerin (purge_project, storage_health,
 * list_project_backups, list_quarantined_projects) artık `as Promise<T>`
 * İDDİASIYLA değil, çalışma zamanı denetimiyle kabul edildiğini sabitler.
 *
 * KARAR: bozuk/eksik veri SESSİZCE boş değere düşmez, HATA FIRLATIR. Gerekçe
 * kaynak dosyadaki `parse*` yorumlarında; testler o kararın gözlemlenebilir
 * karşılığıdır. `isTauri()` false yolunun (null / boş dizi) değişmediği de
 * burada ayrıca sabitlenir -- doğrulama o yolu HİÇ değiştirmemelidir.
 */

const validPurgeResult = Object.freeze({
    projectDeleted: true,
    checkpointsDeleted: 4,
    commandLogEntriesDeleted: 2,
    quarantineEntriesDeleted: 0,
    backupsDeleted: 3
});

const validHealth = Object.freeze({
    ok: true,
    quickCheck: 'ok',
    projectCount: 3,
    backupCount: 12,
    quarantineCount: 0,
    databaseBytes: 4096,
    journalMode: 'wal'
});

const validBackup = Object.freeze({ id: 7, projectId: 'proje-1', revision: 4, createdAt: '2026-01-01T00:00:00.000Z', bytes: 2048 });
const validQuarantine = Object.freeze({ id: 9, projectId: 'proje-1', reason: 'checksum uyusmadi', quarantinedAt: '2026-01-01T00:00:00.000Z', bytes: 512 });

describe('purge() — geçerli Rust yanıtı AYNEN geçer (mutlu yol değişmedi)', () => {
    it('geçerli ProjectPurgeResult şekli hiçbir değişikliğe uğramadan döner', async () => {
        const calls: Array<{ command: string; args?: Record<string, unknown> }> = [];
        const repository = new TauriSqliteProjectRepository(async (command, args) => {
            calls.push({ command, args });
            return { ...validPurgeResult };
        });

        const result = await repository.purge('proje-id');

        assert.deepEqual(result, validPurgeResult);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].command, 'purge_project');
        assert.deepEqual(calls[0].args, { id: 'proje-id' });
    });
});

describe('purge() — bozuk Rust yanıtı SESSİZCE geçmez, hata fırlatır', () => {
    it('şekli hiç tutmayan bir değer (string) reddedilir', async () => {
        const repository = new TauriSqliteProjectRepository(async () => 'beklenmeyen-sekil');

        await assert.rejects(() => repository.purge('proje-id'), /Silme sonucu okunamadı/);
    });

    it('undefined dönerse reddedilir -- eskiden undefined olduğu gibi geçiyordu', async () => {
        const repository = new TauriSqliteProjectRepository(async () => undefined);

        await assert.rejects(() => repository.purge('proje-id'), /Silme sonucu okunamadı/);
    });

    it('tek bir alan eksikse reddedilir ve hata o alanı adıyla söyler', async () => {
        const eksik: Record<string, unknown> = { ...validPurgeResult };
        delete eksik.backupsDeleted;
        const repository = new TauriSqliteProjectRepository(async () => eksik);

        await assert.rejects(() => repository.purge('proje-id'), /backupsDeleted/);
    });

    it('sayı alanı NaN gelirse reddedilir (JSON köprüsünden geçebilir, arayüzde NaN kayıt olarak görünürdü)', async () => {
        const repository = new TauriSqliteProjectRepository(async () => ({ ...validPurgeResult, checkpointsDeleted: Number.NaN }));

        await assert.rejects(() => repository.purge('proje-id'), /checkpointsDeleted/);
    });

    it('hata mesajı proje kimliğini taşır', async () => {
        const repository = new TauriSqliteProjectRepository(async () => null);

        await assert.rejects(() => repository.purge('proje-42'), (error: unknown) => {
            assert.ok(error instanceof Error);
            assert.match(error.message, /proje-42/);
            return true;
        });
    });
});

describe('parseProjectPurgeResult — doğrudan birim testi', () => {
    it('geçerli şekli aynı referansla döndürür', () => {
        const input = { ...validPurgeResult };
        assert.equal(parseProjectPurgeResult(input, 'proje-1'), input);
    });

    it('boolean beklenen alan sayı gelirse reddeder', () => {
        assert.throws(() => parseProjectPurgeResult({ ...validPurgeResult, projectDeleted: 1 }, 'proje-1'), /projectDeleted/);
    });
});

describe('parseStorageHealthSummary — storage_health dönüşü', () => {
    it('geçerli özet aynı referansla geçer', () => {
        const input = { ...validHealth };
        assert.equal(parseStorageHealthSummary(input), input);
    });

    it('null "veri yok" demektir ve null olarak geçer', () => {
        assert.equal(parseStorageHealthSummary(null), null);
    });

    it('undefined reddedilir -- JSON köprüsü undefined üretmez, bu bir arıza işaretidir', () => {
        assert.throws(() => parseStorageHealthSummary(undefined), /Depolama sağlık raporu okunamadı/);
    });

    it('eksik alan reddedilir', () => {
        assert.throws(() => parseStorageHealthSummary({ ...validHealth, journalMode: undefined }), /journalMode/);
    });

    it('dizi reddedilir', () => {
        assert.throws(() => parseStorageHealthSummary([]), /Depolama sağlık raporu okunamadı/);
    });
});

describe('parseDesktopBackupSummaries — list_project_backups dönüşü', () => {
    it('geçerli dizi aynı referansla geçer', () => {
        const input = [{ ...validBackup }];
        assert.equal(parseDesktopBackupSummaries(input), input);
    });

    it('boş dizi geçerlidir', () => {
        const input: unknown[] = [];
        assert.equal(parseDesktopBackupSummaries(input), input);
    });

    it('dizi olmayan değer reddedilir', () => {
        assert.throws(() => parseDesktopBackupSummaries({ length: 0 }), /Yerel yedek listesi okunamadı/);
    });

    it('bozuk eleman reddedilir ve hata elemanın sırasını söyler', () => {
        assert.throws(
            () => parseDesktopBackupSummaries([{ ...validBackup }, { ...validBackup, revision: 'dort' }]),
            /\[1\]\.revision/
        );
    });
});

describe('parseDesktopQuarantineSummaries — list_quarantined_projects dönüşü', () => {
    it('geçerli dizi aynı referansla geçer', () => {
        const input = [{ ...validQuarantine }];
        assert.equal(parseDesktopQuarantineSummaries(input), input);
    });

    it('dizi olmayan değer reddedilir', () => {
        assert.throws(() => parseDesktopQuarantineSummaries(null), /Karantina listesi okunamadı/);
    });

    it('bozuk eleman reddedilir', () => {
        assert.throws(() => parseDesktopQuarantineSummaries([{ ...validQuarantine, reason: 42 }]), /\[0\]\.reason/);
    });
});

describe('isTauri() false yolu DEĞİŞMEDİ — doğrulama bu yola hiç dokunmaz', () => {
    it('getDesktopStorageHealth(): masaüstü olmayan ortamda null döner', async () => {
        assert.equal(await getDesktopStorageHealth(), null);
    });

    it('listDesktopProjectBackups(): masaüstü olmayan ortamda boş dizi döner', async () => {
        assert.deepEqual(await listDesktopProjectBackups('herhangi-proje'), []);
    });

    it('listDesktopQuarantinedProjects(): masaüstü olmayan ortamda boş dizi döner', async () => {
        assert.deepEqual(await listDesktopQuarantinedProjects(), []);
    });
});
