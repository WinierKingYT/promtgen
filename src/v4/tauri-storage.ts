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
        // DOĞRULANMAMIŞ DÖNÜŞ (CEO kararı 1): `purge_project` komutunun
        // sonucu burada HİÇBİR ŞEKİLDE çalışma zamanında doğrulanmaz --
        // `ProjectPurgeResult` yalnızca Rust tarafının uyması BEKLENEN
        // sözleşmedir, gerçekten uyduğunun garantisi yoktur (bkz.
        // tests/v4/tauri-storage-characterization.test.js: "dönüş değeri
        // HİÇ doğrulanmaz" -- `invoke` bir string bile dönse `purge()` onu
        // aynen döndürür). Çalışma zamanı doğrulaması eklemek davranış
        // değişikliği olacağından ayrı bir takip işi olarak bırakılmıştır;
        // burada yalnızca tip beyanı eklenmiştir.
        return this.invoke('purge_project', { id }) as Promise<ProjectPurgeResult>;
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

export async function getDesktopStorageHealth(): Promise<StorageHealthSummary | null> {
    // DOĞRULANMAMIŞ DÖNÜŞ (CEO kararı 1): `storage_health` komutunun sonucu
    // burada hiçbir şekilde çalışma zamanında doğrulanmaz; `StorageHealthSummary`
    // yalnızca Rust tarafının uyması BEKLENEN sözleşmedir. Çalışma zamanı
    // doğrulaması ayrı bir takip işidir; burada yalnızca tip beyanı eklenmiştir.
    return isTauri() ? (invoke('storage_health') as Promise<StorageHealthSummary | null>) : null;
}

export async function listDesktopProjectBackups(projectId: string): Promise<DesktopBackupSummary[]> {
    // DOĞRULANMAMIŞ DÖNÜŞ (CEO kararı 1): bkz. getDesktopStorageHealth()
    // üstündeki not -- aynı gerekçe `list_project_backups` için de geçerli.
    return isTauri() ? (invoke('list_project_backups', { projectId }) as Promise<DesktopBackupSummary[]>) : [];
}

export async function listDesktopQuarantinedProjects(): Promise<DesktopQuarantineSummary[]> {
    // DOĞRULANMAMIŞ DÖNÜŞ (CEO kararı 1): bkz. getDesktopStorageHealth()
    // üstündeki not -- aynı gerekçe `list_quarantined_projects` için de geçerli.
    return isTauri() ? (invoke('list_quarantined_projects') as Promise<DesktopQuarantineSummary[]>) : [];
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
