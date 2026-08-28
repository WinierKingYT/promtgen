import { invoke, isTauri } from '@tauri-apps/api/core';
import { IndexedDbProjectRepository } from './storage.js';
import { validateProjectDocument } from './project-document.js';
import { normalizeProjectDocument } from './canonical-entities.js';
import { tryMigrateOrPassthrough } from './migrations.js';
import type { ProjectDocumentV5, ProjectPurgeResult, ProjectRepository, ProjectSaveOptions } from './contracts.js';

export interface StorageHealthSummary {
    ok: boolean;
    quickCheck: string;
    projectCount: number;
    backupCount: number;
    quarantineCount: number;
    databaseBytes: number;
    journalMode: string;
}

export interface DesktopBackupSummary {
    id: number;
    projectId: string;
    revision: number;
    createdAt: string;
    bytes: number;
}

export interface DesktopQuarantineSummary {
    id: number;
    projectId: string;
    reason: string;
    quarantinedAt: string;
    bytes: number;
}

/**
 * Enjekte edilebilir `invoke` imzası: testlerin gerçek Tauri IPC köprüsüne
 * dokunmadan bu sınıfı çalıştırabilmesi için en küçük dikiş noktası. Gerçek
 * `@tauri-apps/api/core`'un `invoke<T>()`'u jeneriktir ve burada T hiç
 * belirtilmediğinden `unknown`'a çözümlenir -- bu yüzden gerçek `invoke`
 * varsayılan değer olarak bu (jenerik olmayan, dönüşü her zaman `unknown`
 * olan) imzaya sorunsuzca atanabilir; üretim davranışı değişmez.
 */
type InvokeFn = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

/**
 * `tryMigrateOrPassthrough` (src/v4/migrations.js) düz JS'tir ve tip
 * ek açıklaması taşımaz; bu dönüşümün kapsamı dışındadır. `storage.ts`'teki
 * aynı isimli tipin birebir eşi: `project` alanı, `normalizeProjectDocument`
 * çalışana kadar `unknown` olarak dürüstçe işaretlenir -- migrations.js'in
 * kendi parametre tiplerinin (`input`) örtük `any` olması yüzünden aksi
 * halde `any` bu dosyaya sızardı.
 */
interface MigrationOutcome {
    project: unknown;
    migrated: boolean;
    error: string | null;
}

interface MigratedProject {
    project: ProjectDocumentV5;
    migrated: boolean;
}

interface UnreadableDocument {
    id: string | null;
    reason: string;
}

function toRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

/* ------------------------------------------------------------------------ *
 * IPC SINIRI DOĞRULAMASI
 *
 * `as Promise<T>` bir İDDİADIR, kontrol değil. Rust tarafı şeklini
 * değiştirirse ya da beklenmedik bir şey dönerse TypeScript'in bundan haberi
 * olmaz ve bozuk veri arayüze kadar sızar. Aşağıdaki `parse*` fonksiyonları
 * bu dosyanın KENDİ mevcut desenini izler: `validateProjectDocument`
 * (src/v4/project-document.ts) gibi Türkçe hata listesi üretilir, çağrı
 * noktasında `throw new Error(...)` ile yükseltilir -- bkz. `save()` ve
 * `loadDesktopProjectBackup()`. Yeni bir doğrulama yaklaşımı (zod vb.)
 * İCAT EDİLMEZ; `src/v4/ai/schemas/` zod şemaları model çıktısı içindir,
 * depolama sınırı bu dosyada elle yazılmış denetimlerle korunur.
 *
 * BAŞARISIZLIK KARARI: bozuk veride SESSİZCE boş değere (`null`, `[]`)
 * düşülmez, HATA FIRLATILIR. Gerekçe:
 *   1. Bu dört fonksiyonun boş değerleri ZATEN dolu bir anlam taşıyor:
 *      "burası masaüstü değil / kayıt yok". Bozuk veriyi de aynı değere
 *      indirgemek, iki farklı durumu tek kelimeye çökertir -- kullanıcı
 *      "yedeğim yok" sanır, oysa yedekleri okunamamıştır. Bu, bu kod
 *      tabanında açıkça istenmeyen sessiz hata yutmanın ta kendisidir.
 *   2. Dosyanın kendi tercihi de bu: tek belgelik yollarda (`get()`,
 *      `loadDesktopProjectBackup()`) bozuk veri fırlatılır; yalnız `list()`
 *      atlayıp uyarı biriktirir, çünkü orada okunabilen DİĞER projeleri
 *      kurtarmak gerçek bir kazançtır. Buradaki dördünde kurtarılacak
 *      kısmi bir sonuç yok.
 *   3. Her iki çağıran da (src/react/components/StorageHealthPanel.tsx
 *      `refresh()`, src/react/hooks/useProjectState.ts `purgeProject()`)
 *      hatayı yakalayıp kullanıcıya Türkçe mesaj gösterir; fırlatmak
 *      arayüzü kırmaz, görünür kılar.
 * ------------------------------------------------------------------------ */

type RuntimeKind = 'boolean' | 'number' | 'string';

/** Hata mesajlarında "gelen: ..." kısmı için okunabilir tür adı. */
function describeRuntimeValue(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'dizi';
    return typeof value;
}

/**
 * Beklenen ilkel alanları tek tek denetler; boş dizi "geçerli" demektir
 * (`validateProjectDocument` ile aynı sözleşme). Fazladan alanlar
 * DOKUNULMADAN geçer: amaç Rust'ın sözleşmeyi taşıdığını doğrulamak, onu
 * daraltmak değil -- bu yüzden mutlu yolda dönen nesne birebir aynı kalır.
 * Sayılarda `Number.isFinite` şart: NaN/Infinity bu köprüden geçebilir ve
 * arayüzde "NaN yedek" gibi görünür.
 */
function collectShapeErrors(value: unknown, fields: Readonly<Record<string, RuntimeKind>>, label: string): string[] {
    const record = toRecord(value);
    if (!record || Array.isArray(value)) return [`${label} bir nesne değil (gelen: ${describeRuntimeValue(value)}).`];
    const errors: string[] = [];
    for (const [field, kind] of Object.entries(fields)) {
        const actual = record[field];
        const ok = kind === 'number' ? typeof actual === 'number' && Number.isFinite(actual) : typeof actual === kind;
        if (!ok) errors.push(`${label}.${field} alanı ${kind} olmalı (gelen: ${describeRuntimeValue(actual)}).`);
    }
    return errors;
}

function collectListErrors(value: unknown, fields: Readonly<Record<string, RuntimeKind>>, label: string): string[] {
    if (!Array.isArray(value)) return [`${label} bir dizi değil (gelen: ${describeRuntimeValue(value)}).`];
    return value.flatMap((item, index) => collectShapeErrors(item, fields, `${label}[${index}]`));
}

const PURGE_RESULT_FIELDS: Readonly<Record<string, RuntimeKind>> = Object.freeze({
    projectDeleted: 'boolean', checkpointsDeleted: 'number', commandLogEntriesDeleted: 'number',
    quarantineEntriesDeleted: 'number', backupsDeleted: 'number'
});

const STORAGE_HEALTH_FIELDS: Readonly<Record<string, RuntimeKind>> = Object.freeze({
    ok: 'boolean', quickCheck: 'string', projectCount: 'number', backupCount: 'number',
    quarantineCount: 'number', databaseBytes: 'number', journalMode: 'string'
});

const BACKUP_SUMMARY_FIELDS: Readonly<Record<string, RuntimeKind>> = Object.freeze({
    id: 'number', projectId: 'string', revision: 'number', createdAt: 'string', bytes: 'number'
});

const QUARANTINE_SUMMARY_FIELDS: Readonly<Record<string, RuntimeKind>> = Object.freeze({
    id: 'number', projectId: 'string', reason: 'string', quarantinedAt: 'string', bytes: 'number'
});

/**
 * `purge_project` sonucunu doğrular. Silme Rust tarafında ZATEN çalıştı;
 * buradan fırlatmak silmeyi geri almaz -- bu yüzden mesaj sonucun
 * bilinemediğini açıkça söyler, "silinemedi" demez.
 */
export function parseProjectPurgeResult(value: unknown, id: string): ProjectPurgeResult {
    const errors = collectShapeErrors(value, PURGE_RESULT_FIELDS, 'purge_project sonucu');
    if (errors.length > 0) throw new Error(`Silme sonucu okunamadı (${id}): ${errors.join(' ')} Silme işlemi yerel veritabanında uygulanmış olabilir; proje listesini yenileyip durumu doğrulayın.`);
    return value as ProjectPurgeResult;
}

/**
 * `storage_health` sonucunu doğrular. `null` kabul edilir çünkü dönüş tipi
 * onu zaten "rapor yok" olarak taşıyor; `undefined` KABUL EDİLMEZ -- JSON
 * köprüsü undefined üretmez, göründüğünde bu bir arıza işaretidir.
 */
export function parseStorageHealthSummary(value: unknown): StorageHealthSummary | null {
    if (value === null) return null;
    const errors = collectShapeErrors(value, STORAGE_HEALTH_FIELDS, 'storage_health sonucu');
    if (errors.length > 0) throw new Error(`Depolama sağlık raporu okunamadı: ${errors.join(' ')} Verileriniz silinmedi; yerel veritabanında duruyor.`);
    return value as StorageHealthSummary;
}

export function parseDesktopBackupSummaries(value: unknown): DesktopBackupSummary[] {
    const errors = collectListErrors(value, BACKUP_SUMMARY_FIELDS, 'list_project_backups sonucu');
    if (errors.length > 0) throw new Error(`Yerel yedek listesi okunamadı: ${errors.join(' ')} Yedekleriniz silinmedi; yerel veritabanında duruyor.`);
    return value as DesktopBackupSummary[];
}

export function parseDesktopQuarantineSummaries(value: unknown): DesktopQuarantineSummary[] {
    const errors = collectListErrors(value, QUARANTINE_SUMMARY_FIELDS, 'list_quarantined_projects sonucu');
    if (errors.length > 0) throw new Error(`Karantina listesi okunamadı: ${errors.join(' ')} Karantinadaki kayıtlar silinmedi; yerel veritabanında duruyor.`);
    return value as DesktopQuarantineSummary[];
}

// DÜZELTME (eski adı: BULUNAN KUSUR, bkz. tests/v4/tauri-storage-characterization.test.js
// "DÜZELTME (eski adı: MİMARİ SONUÇ)..." testleri): bu modül önceden list()
// sonucu atlanan proje uyarısını MODÜL kapsamında (tüm
// TauriSqliteProjectRepository örnekleri arasında PAYLAŞILAN, tek bir
// mutable slot olarak) tutuyordu -- iki ayrı örneğin uyarıları birbirine
// sızabiliyordu (bkz. src/v4/storage.ts IndexedDbProjectRepository'nin
// instance-scoped `#lastListWarning` alanı, ki o hep DOĞRU tasarımdı).
// Uyarı durumu artık her örneğin kendi `#lastListWarning` özel alanında
// tutulur (aşağıda) ve yalnız `takeListWarning()` ile okunur. Geriye dönük
// uyumluluk için tutulan deprecated `takeDesktopProjectListWarning()` serbest
// fonksiyonu ve onu destekleyen modül-seviyesi `mostRecentListCaller`/
// `recordMostRecentListCaller` -- ki bunlar da modül kapsamında paylaşılan,
// aynı kusur ailesinden bir durumdu -- artık hiçbir üretim kodu ya da test
// tarafından kullanılmadığından TAMAMEN KALDIRILDI (bkz.
// src/react/hooks/useProjectState.ts, tests/v4/tauri-storage-quarantine.test.js
// ve tests/v4/tauri-storage-characterization.test.js -- hepsi artık doğrudan
// `repository.takeListWarning()`'i kullanıyor).

export class TauriSqliteProjectRepository implements ProjectRepository {
    // `invokeFn` enjeksiyonu: testlerin gerçek Tauri IPC köprüsüne dokunmadan
    // bu sınıfı çalıştırabilmesi için en küçük dikiş noktası. Varsayılan değer
    // gerçek `invoke` olduğundan üretim davranışı değişmez.
    invoke: InvokeFn;
    // Son list() çağrısında atlanan (okunamayan) proje varsa kullanıcıya
    // gösterilecek Türkçe uyarı BU ÖRNEĞE ÖZEL olarak burada tutulur --
    // web (IndexedDB) tarafındaki IndexedDbProjectRepository.#lastListWarning
    // ile birebir aynı tasarım (bkz. src/v4/storage.ts). Bir örneğin uyarısı
    // yapısal olarak başka bir örneğe sızamaz.
    #lastListWarning: string | null = null;
    constructor(invokeFn: InvokeFn = invoke) {
        this.invoke = invokeFn;
    }
    async list(): Promise<ProjectDocumentV5[]> {
        // Rust `list_projects` komutu her zaman bir JSON string dizisi
        // döndürür (bkz. parseStoredDocument()'ın her elemanı JSON.parse
        // ile ayrıştırması); IPC sınırında bunun ÇALIŞMA ZAMANI garantisi
        // yoktur -- burada TEK bir noktada `string[]`e daraltılır. Biçimsiz
        // bir eleman zaten aşağıdaki try/catch tarafından "okunamayan proje"
        // olarak ele alınır, veri kaybı yaşanmaz.
        const rawDocuments = (await this.invoke('list_projects')) as string[];
        const projects: ProjectDocumentV5[] = [];
        const unreadable: UnreadableDocument[] = [];
        for (const raw of rawDocuments) {
            try {
                const migration = migrateStoredDocument(parseStoredDocument(raw));
                if (migration.migrated) await this.save(migration.project);
                projects.push(migration.project);
            } catch (error) {
                unreadable.push(describeUnreadableDocument(raw, error));
            }
        }
        this.#lastListWarning = unreadable.length > 0 ? buildUnreadableProjectsWarning(unreadable) : null;
        return projects;
    }
    /**
     * Son `list()` çağrısında atlanan proje varsa Türkçe bir uyarı metni
     * döndürür ve durumu tüketir (bir sonraki çağrıda aynı uyarı tekrar
     * dönmez). Atlanan kayıt yoksa `null` döner. Web (IndexedDB) eşdeğeri:
     * `IndexedDbProjectRepository.takeListWarning()` (src/v4/storage.ts).
     */
    takeListWarning(): string | null {
        const warning = this.#lastListWarning;
        this.#lastListWarning = null;
        return warning;
    }
    async get(id: string): Promise<ProjectDocumentV5 | null> {
        // Rust `load_project` komutu var olan bir belge için JSON string,
        // yoksa null/undefined döndürür; aynı doğrulanmamış-IPC-sınırı
        // gerekçesiyle burada `string | null`a daraltılır.
        const document = (await this.invoke('load_project', { id })) as string | null;
        if (!document) return null;
        try {
            const migration = migrateStoredDocument(parseStoredDocument(document));
            if (migration.migrated) await this.save(migration.project);
            return migration.project;
        } catch (error) {
            throw new Error(describeCorruptSingleDocument(id, error));
        }
    }
    async save(project: ProjectDocumentV5, options: ProjectSaveOptions = {}): Promise<ProjectDocumentV5> {
        const normalized = normalizeProjectDocument(project);
        const validation = validateProjectDocument(normalized);
        if (!validation.valid) throw new Error(validation.errors.join(' '));
        await this.invoke('save_project', {
            id: normalized.id,
            document: JSON.stringify(normalized),
            updatedAt: normalized.lifecycle.updatedAt,
            expectedDocumentRevision: options.expectedDocumentRevision,
            expectedCanonicalRevision: options.expectedCanonicalRevision,
            createOnly: options.createOnly === true
        });
        return normalized;
    }
    async archive(id: string): Promise<boolean> {
        const project = await this.get(id);
        if (!project) return false;
        if (project.lifecycle.status === 'archived') return true;
        const expectedDocumentRevision = project.documentRevision;
        const expectedCanonicalRevision = project.canonicalRevision;
        project.lifecycle.status = 'archived';
        project.lifecycle.updatedAt = new Date().toISOString();
        project.documentRevision += 1;
        await this.save(project, { expectedDocumentRevision, expectedCanonicalRevision });
        return true;
    }
    async restore(id: string): Promise<boolean> {
        const project = await this.get(id);
        if (!project) return false;
        if (project.lifecycle.status !== 'archived') return true;
        const expectedDocumentRevision = project.documentRevision;
        const expectedCanonicalRevision = project.canonicalRevision;
        project.lifecycle.status = 'active';
        project.lifecycle.updatedAt = new Date().toISOString();
        project.documentRevision += 1;
        await this.save(project, { expectedDocumentRevision, expectedCanonicalRevision });
        return true;
    }
    async purge(id: string): Promise<ProjectPurgeResult> {
        // DÜZELTME (eski adı: DOĞRULANMAMIŞ DÖNÜŞ): `purge_project` sonucu
        // artık `as Promise<ProjectPurgeResult>` İDDİASIYLA değil,
        // `parseProjectPurgeResult` ile çalışma zamanında denetlenerek
        // kabul ediliyor (gerekçe için o fonksiyonun üstündeki "IPC SINIRI
        // DOĞRULAMASI" bloğuna bakın). Sözleşmeye uyan bir yanıt HİÇBİR
        // değişikliğe uğramadan, aynı nesne olarak döner -- mutlu yol
        // çıktısı birebir aynıdır.
        return parseProjectPurgeResult(await this.invoke('purge_project', { id }), id);
    }
}

function parseStoredDocument(document: string): unknown {
    try {
        return JSON.parse(document);
    } catch (error) {
        throw new Error(`Geçersiz JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function describeUnreadableDocument(raw: string, error: unknown): UnreadableDocument {
    let id: string | null = null;
    try {
        const parsed = toRecord(JSON.parse(raw));
        id = parsed && typeof parsed.id === 'string' ? parsed.id : null;
    } catch {
        id = null;
    }
    return { id, reason: error instanceof Error ? error.message : String(error) };
}

function buildUnreadableProjectsWarning(unreadable: UnreadableDocument[]): string {
    return `${unreadable.length} proje okunamadı ve listede gösterilemedi; bu projelerin verileri silinmedi, yerel veritabanında güvende duruyor. Okunabilen diğer projeleriniz aşağıda listelendi.`;
}

function describeCorruptSingleDocument(id: string, error: unknown): string {
    const reason = error instanceof Error ? error.message : String(error);
    return `Proje belgesi okunamadı (${id}): ${reason}. Veriler silinmedi; yerel veritabanında duruyor.`;
}

export function restoreStorageBackupAsNewRevision(currentProject: ProjectDocumentV5, backupProject: ProjectDocumentV5): ProjectDocumentV5 {
    const current = normalizeProjectDocument(currentProject);
    const backup = normalizeProjectDocument(backupProject);
    if (current.id !== backup.id) throw new Error('Yedek başka bir projeye ait.');
    const restoredAt = new Date().toISOString();
    const next = structuredClone(backup);
    next.documentRevision = current.documentRevision + 1;
    next.canonicalRevision = current.canonicalRevision + 1;
    next.lifecycle.status = 'active';
    next.lifecycle.updatedAt = restoredAt;
    next.lifecycle.finalizedAt = '';
    next.revisions = structuredClone(current.revisions || []);
    next.exports = structuredClone(current.exports || []);
    next.executionSessions = structuredClone(current.executionSessions || []);
    next.commandLog = structuredClone(current.commandLog || []);
    next.metadata = { ...next.metadata, restoredFromStorageBackup: { sourceRevision: backup.canonicalRevision, restoredAt } };
    // DÜZELTME (eski adı: BULUNAN KUSUR, bkz. tests/v4/tauri-storage-characterization.test.js
    // "DÜZELTME (eski adı: BULUNAN KUSUR src/v4/tauri-storage.js:152)"): doğrulama
    // artık `next.sections`e erişen HERHANGİ bir satırdan (Object.keys(next.sections)
    // dahil) ÖNCE çalışır. `backup.sections` çalışma zamanında eksik/null olursa
    // (örn. bozuk bir yedek), kullanıcı artık ham bir TypeError yerine
    // `validateProjectDocument`'ın kendi "Plan bölümleri eksik." mesajını taşıyan
    // dostça "Yedek geri yükleme sonucu geçersiz: ..." hatasını görür. Bunu bir
    // `?`, `!` veya `?? {}` ile susturmak YANLIŞ olurdu: gerçekten eksik bir
    // `sections` için sessizce boş bir `affectedSections` üretir -- bu, ham
    // TypeError'dan daha kötü bir sonuçtur (sorunu gizler). `revisions` alanı
    // `validateProjectDocument` (src/v4/project-document.ts,
    // validateTopLevelCollections) tarafından yalnızca dizi olup olmadığı
    // yönünden denetlenir -- girdi elemanlarının şekli/içeriği hiç
    // denetlenmez -- bu yüzden doğrulamayı yeni revision girdisini eklemeden
    // ÖNCE çalıştırmak, geçerli girdiler için doğrulanan içeriği DEĞİŞTİRMEZ.
    const validation = validateProjectDocument(next);
    if (!validation.valid) throw new Error(`Yedek geri yükleme sonucu geçersiz: ${validation.errors.join(' ')}`);
    const snapshot = structuredClone(next);
    snapshot.revisions = [];
    next.revisions.push({
        id: `revision-storage-${Date.now()}`, number: next.canonicalRevision, createdAt: restoredAt,
        summary: `Yerel yedek r${backup.canonicalRevision} yeni revision olarak geri yüklendi`,
        acceptedSuggestionIds: [], affectedSections: Object.keys(next.sections), snapshot
    });
    return next;
}

export function isDesktopStorageAvailable(): boolean { return isTauri(); }

// Aşağıdaki üç fonksiyonda `isTauri()` false yolu (null / boş dizi) HİÇ
// DEĞİŞMEDİ: doğrulama yalnız masaüstünde, gerçekten IPC'den veri geldiğinde
// çalışır. "Masaüstü değil" ile "veri bozuk" bu yüzden hâlâ ayırt edilebilir
// -- birincisi boş değer, ikincisi hata.

export async function getDesktopStorageHealth(): Promise<StorageHealthSummary | null> {
    // DÜZELTME (eski adı: DOĞRULANMAMIŞ DÖNÜŞ): `storage_health` sonucu artık
    // `parseStorageHealthSummary` ile denetlenir; gerekçe için "IPC SINIRI
    // DOĞRULAMASI" bloğuna bakın.
    return isTauri() ? parseStorageHealthSummary(await invoke('storage_health')) : null;
}

export async function listDesktopProjectBackups(projectId: string): Promise<DesktopBackupSummary[]> {
    // DÜZELTME (eski adı: DOĞRULANMAMIŞ DÖNÜŞ): bkz. getDesktopStorageHealth()
    // üstündeki not -- aynı gerekçe `list_project_backups` için de geçerli.
    return isTauri() ? parseDesktopBackupSummaries(await invoke('list_project_backups', { projectId })) : [];
}

export async function listDesktopQuarantinedProjects(): Promise<DesktopQuarantineSummary[]> {
    // DÜZELTME (eski adı: DOĞRULANMAMIŞ DÖNÜŞ): bkz. getDesktopStorageHealth()
    // üstündeki not -- aynı gerekçe `list_quarantined_projects` için de geçerli.
    return isTauri() ? parseDesktopQuarantineSummaries(await invoke('list_quarantined_projects')) : [];
}

export async function loadDesktopProjectBackup(currentProject: ProjectDocumentV5, backupId: number): Promise<ProjectDocumentV5> {
    if (!isTauri()) throw new Error('Yerel SQLite yedekleri yalnız masaüstünde kullanılabilir.');
    // Yukarıdaki dört fonksiyonun aksine burada dönüş değeri KÖRÜ KÖRÜNE
    // güvenilmiyor: `read_project_backup` bir JSON string veya (yedek yoksa)
    // null/undefined döndürür -- bu daraltma yalnız string/null ayrımı
    // içindir. Sonucun gerçekten ProjectDocumentV5 şemasına uyup uymadığı,
    // iki satır aşağıdaki validateProjectDocument() tarafından GERÇEKTEN
    // denetlenir; bu yüzden bu fonksiyonun dönüş tipi -- yukarıdaki dördünün
    // aksine -- kazanılmıştır.
    const document = (await invoke('read_project_backup', { projectId: currentProject.id, backupId })) as string | null;
    if (!document) throw new Error('Yerel yedek bulunamadı.');
    const candidate = normalizeProjectDocument(JSON.parse(document));
    if (candidate.id !== currentProject.id) throw new Error('Yedek başka bir projeye ait.');
    const validation = validateProjectDocument(candidate);
    if (!validation.valid) throw new Error(`Yerel yedek şeması geçersiz: ${validation.errors.join(' ')}`);
    return candidate;
}

export function createPlatformRepository(): ProjectRepository { return isTauri() ? new TauriSqliteProjectRepository() : new IndexedDbProjectRepository(); }

function migrateStoredDocument(document: unknown): MigratedProject {
    const migration: MigrationOutcome = tryMigrateOrPassthrough(document);
    if (migration.error) throw new Error(`Migration failure: ${migration.error}`);
    return { project: normalizeProjectDocument(migration.project), migrated: migration.migrated };
}
