import type { Page } from '@playwright/test';
import { createProjectDocument } from '../../../src/v4/project-document.js';
import { normalizeConcern, normalizeConcernDecision } from '../../../src/v4/application/concerns.js';
import { approveIdeaDesign } from '../../../src/v4/application/idea-approval.js';
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


/**
 * Aşama modeline girmiş bir belge üretir: fikir onaylı, teknik aşama açık.
 *
 * Golden Path'in tarayıcı tarafı bunu kullanır. Onaylar elle kurulmuyor;
 * `approveIdeaDesign` çağrılıyor — fikstür kapıyı atlatarak kurulsaydı, kapı
 * bozulduğunda test yine yeşil kalırdı.
 */
export function buildStageFixture(): ProjectDocumentV5 {
  const project = createProjectDocument({
    idea: 'Unity’de at sistemi yapmak istiyorum',
    name: 'At sistemi'
  }) as ProjectDocumentV5;

  project.ideaDesign.framing = { kind: 'system', domain: 'game', environment: 'Unity', source: 'confirmed' };
  project.ideaDesign.concerns = [
    normalizeConcern({ id: 'ic-sahiplik', title: 'Sahiplik', category: 'Kapsam', importance: 'critical', status: 'decided' }),
    normalizeConcern({ id: 'ic-etiket', title: 'İsim etiketi rengi', category: 'Görsel', importance: 'optional', status: 'open', uncertainty: 0.3, downstreamImpact: 0.1 })
  ];
  project.ideaDesign.concernDecisions = [
    normalizeConcernDecision({ id: 'cd-1', concernId: 'ic-sahiplik', answer: 'Kalıcı karakter', decisionId: null })
  ];

  const approval = approveIdeaDesign(project, { revision: 2, at: '2026-08-16T00:00:00.000Z' });
  if (!approval.approved) throw new Error(`Fikstür kapıdan geçemedi: ${approval.reason}`);
  project.ideaDesign.approval = approval.approval;

  return project;
}


/**
 * Fikir aşamasında, cevap bekleyen bir konusu olan belge.
 *
 * Aşama panelinin gerçekten çalıştığını doğrulamak için gerekiyor: konusu
 * olmayan bir projede panel hiç görünmez ve test yalnız "görünmüyor" yarısını
 * kanıtlayabilirdi.
 */
export function buildOpenConcernFixture(): ProjectDocumentV5 {
  const project = createProjectDocument({
    idea: 'Unity’de at sistemi yapmak istiyorum',
    name: 'At sistemi'
  }) as ProjectDocumentV5;

  project.ideaDesign.framing = { kind: 'system', domain: 'game', environment: 'Unity', source: 'confirmed' };
  project.ideaDesign.concerns = [
    normalizeConcern({
      id: 'ic-sahiplik',
      title: 'Sahiplik',
      category: 'Kapsam',
      importance: 'critical',
      status: 'open',
      whyItMatters: 'Bu karar kayıt, ilerleme ve ölüm sistemini birden belirliyor.',
      questions: ['At kalıcı bir karakter mi, yoksa bir ulaşım aracı mı?'],
      options: [
        { id: 'o-kalici', title: 'Kalıcı karakter', description: '', tradeoffs: ['Kayıt sistemi gerektirir'] },
        { id: 'o-ulasim', title: 'Sadece ulaşım aracı', description: '', tradeoffs: ['Bağ kurma hissi zayıflar'] }
      ],
      uncertainty: 0.9,
      downstreamImpact: 0.9
    })
  ];

  return project;
}


/**
 * Onaylanmış fikir + ona dayanan teknik karar + gereksinim zinciri.
 *
 * Geri dönüşün bedelinin ekranda gerçekten göründüğünü doğrulamak için
 * gerekiyor; zinciri olmayan bir belgede uyarı hiç çıkmaz ve test yalnız
 * "çıkmıyor" yarısını kanıtlardı.
 */
export function buildInvalidationChainFixture(): ProjectDocumentV5 {
  const project = buildStageFixture();

  project.decisions = [
    {
      stage: 'idea', id: 'dec-sahiplik', title: 'Sahiplik', decision: 'At kalıcı bir karakter.',
      rationale: 'Bağ kurulması isteniyor.', alternatives: [], consequences: [],
      status: 'accepted', sourceSuggestionId: '', affectedSectionIds: []
    },
    {
      stage: 'technical', id: 'dec-kayit', title: 'Kayıt modeli', decision: 'JSON dosyası.',
      rationale: 'Sahiplik kararının gereği.', alternatives: [], consequences: [],
      status: 'accepted', sourceSuggestionId: '', affectedSectionIds: [],
      evidence: { ideaDecisionIds: ['dec-sahiplik'], ideaConcernIds: [] },
      rejectedAlternatives: []
    }
  ];
  project.ideaDesign.concernDecisions = [
    normalizeConcernDecision({ id: 'cd-1', concernId: 'ic-sahiplik', answer: 'Kalıcı karakter', decisionId: 'dec-sahiplik' })
  ];
  project.requirements = [{
    id: 'req-kayit', title: 'At durumu saklanır', statement: 'At durumu oturumlar arasında saklanır.',
    kind: 'functional', priority: 'must', acceptanceCriteria: ['Yeniden açılışta at durumu korunur'],
    sourceObjectiveIds: [], sourceSuggestionIds: [], status: 'accepted'
  }];
  project.traceLinks = [{
    id: 'tl-1', fromType: 'decision', fromId: 'dec-kayit',
    toType: 'requirement', toId: 'req-kayit', relation: 'drives'
  }];

  return project;
}
