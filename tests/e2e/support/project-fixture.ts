import type { Page } from '@playwright/test';
import { createProjectDocument } from '../../../src/v4/project-document.js';
import type { ProjectDocumentV5 } from '../../../src/v4/contracts.js';

/**
 * E2E fikstürlerini IndexedDB'ye tohumlar.
 *
 * Neden gerekiyor: uygulamanın fikir→plan dönüşümü `tasks`, `testCases` veya
 * `traceLinks` üretmiyor ve hiçbir E2E adımı proje envanteri taramıyor. Bu
 * yüzden koşullu panellerin (`TraceabilityMap`, `PlanCodeAlignmentPanel`)
 * **göründüğü** durum akış üzerinden hiç kurulamıyordu; testler yalnız
 * "görünmüyor" yarısını kanıtlayabiliyordu. Koşul yanlış olsaydı özellik hata
 * vermez, sessizce hiç görünmezdi — kapatılmak istenen boşluk tam buydu.
 *
 * Belgeler elle JSON yazılarak değil `createProjectDocument` ile üretilir:
 * şema değişirse fikstür de onunla birlikte değişir, sessizce bayatlamaz.
 */

const DB_NAME = 'promtgen-v4';
const DB_VERSION = 2;

/**
 * Depo şeması `src/v4/storage.js` içindeki `openDatabase`'in birebir aynısı
 * olmak zorunda. Uygulama veritabanını aynı sürümle açtığında
 * `onupgradeneeded` çalışmaz; burada eksik bıraktığımız bir depo uygulamada
 * "object store not found" hatasına dönerdi.
 */
const SEED_SCRIPT = ({ dbName, dbVersion, project }: {
  dbName: string;
  dbVersion: number;
  project: unknown;
}) => new Promise<void>((resolve, reject) => {
  const request = indexedDB.open(dbName, dbVersion);

  request.onupgradeneeded = () => {
    const db = request.result;
    const ensure = (
      name: string,
      options: IDBObjectStoreParameters,
      indexes: Array<{ name: string; keyPath: string }> = []
    ) => {
      if (db.objectStoreNames.contains(name)) return;
      const store = db.createObjectStore(name, options);
      for (const index of indexes) store.createIndex(index.name, index.keyPath, { unique: false });
    };

    ensure('projects', { keyPath: 'id' });
    ensure('checkpoints', { keyPath: 'id' }, [
      { name: 'projectId', keyPath: 'projectId' },
      { name: 'createdAt', keyPath: 'createdAt' }
    ]);
    ensure('quarantine', { keyPath: 'id' }, [{ name: 'projectId', keyPath: 'projectId' }]);
    ensure('commandLog', { keyPath: 'id' }, [{ name: 'projectId', keyPath: 'projectId' }]);
    ensure('metadata', { keyPath: 'key' });
  };

  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result;
    const tx = db.transaction('projects', 'readwrite');
    // Yalnız `projects` deposu yazılır, `checkpoints` bilerek boş bırakılır.
    // storage.js:157 bütünlük karşılaştırmasını ancak belgenin revision'ıyla
    // eşleşen bir checkpoint varsa yapıyor; checkpoint yazmak, elle
    // hesaplanmamış bir SHA-256 yüzünden fikstürün karantinaya düşmesine
    // yol açardı.
    tx.objectStore('projects').put(project);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  };
});

/** Sayfa yüklenmeden önce belgeyi IndexedDB'ye yazar. */
export async function seedProject(page: Page, project: ProjectDocumentV5): Promise<void> {
  await page.addInitScript(SEED_SCRIPT, {
    dbName: DB_NAME,
    dbVersion: DB_VERSION,
    project: JSON.parse(JSON.stringify(project)) as unknown
  });
}

interface PlanFixtureOptions {
  /** `hasTraceabilityLinks` true olsun mu — karar→gereksinim bağlantısı ekler. */
  withTraceLink?: boolean;
  /** `hasProjectInventory` true olsun mu — taranmış envanter ekler. */
  withInventory?: boolean;
}

/**
 * Plan aşaması açık bir belge üretir. Kilit koşulu
 * (`sourceIdeaRevisionId || requirements/decisions/tasks`) kanonik kayıtlarla
 * karşılanır, böylece plan görünümü kapı ekranı yerine gerçek planı gösterir.
 */
export function buildPlanFixture(options: PlanFixtureOptions = {}): ProjectDocumentV5 {
  const project = createProjectDocument({
    idea: 'Küçük ekiplerin fatura takibini kolaylaştıran bir araç yapmak istiyorum',
    name: 'Fikstür projesi'
  }) as ProjectDocumentV5;

  project.decisions.push({
    id: 'dec-1',
    title: 'Kimlik doğrulama',
    decision: 'E-posta ve parola ile giriş',
    rationale: 'Ekip küçük, SSO gerekmiyor',
    alternatives: [],
    consequences: [],
    status: 'accepted',
    sourceSuggestionId: '',
    affectedSectionIds: []
  } as never);

  project.requirements.push({
    id: 'req-1',
    title: 'Fatura listesi',
    statement: 'Kullanıcı kendi faturalarını listeleyebilmeli',
    kind: 'functional',
    priority: 'must',
    // Boş bırakılamaz: alan modeli `accepted` bir gereksinimin kabul kriteri
    // taşımasını şart koşuyor ve aksi hâlde belge kaydederken karantinaya
    // düşüyor ("Kabul edilmiş gereksinimin kabul kriteri eksik"). Birim
    // testleri saf fonksiyonu çağırdığı için bu kuralı hiç görmüyor; E2E
    // yolu gerçek depolama doğrulamasından geçtiği için daha katı.
    acceptanceCriteria: ['Giriş yapan kullanıcı yalnız kendi faturalarını görür'],
    sourceObjectiveIds: [],
    sourceSuggestionIds: [],
    status: 'accepted'
  } as never);

  if (options.withTraceLink) {
    // Decision ve Requirement kontratları birbirine doğrudan alanla
    // bağlanmıyor; kenar traceLinks üzerinden kuruluyor
    // (bkz. buildTraceabilityView, traceability-view.ts).
    project.traceLinks.push({
      id: 'link-1',
      fromType: 'decision',
      fromId: 'dec-1',
      toType: 'requirement',
      toId: 'req-1',
      // Geçerli ilişkiler project-document.js:393'te sabit: supports,
      // implements, verifies, validated_by, mitigates, depends_on,
      // derived_from, drives, supersedes. Karar bir gereksinimi 'drives'.
      relation: 'drives'
    } as never);
  }

  if (options.withInventory) {
    project.profile.projectInventory = {
      inventory: [
        { path: 'src/index.ts', secretDetected: false, injectionDetected: false }
      ]
    } as never;
  }

  return project;
}
