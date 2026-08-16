import { useRef, useState } from 'react';
import {
  Archive,
  ArrowRight,
  Check,
  ChevronRight,
  FileUp,
  FolderOpen,
  LoaderCircle,
  Plus,
  RotateCcw,
  Settings2,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';
import { getProviderMeta } from '../../v4/provider-settings.js';
import { isDesktopProjectImportAvailable, selectDesktopProjectFolder } from '../../v4/desktop-project-import.js';
import { ProjectInventoryModal } from './ProjectInventoryModal.js';
import { PackageImportDialog } from './PackageImportDialog.js';
import { ProjectDeleteDialog } from './ProjectDeleteDialog.js';
import { providerGateOpen, type ProviderReadinessResult } from '../../v4/application/provider-readiness-service.js';
import { getProductCopy } from '../../v4/product/product-contract.js';
import type { ProjectDocumentV5 } from '../../v4/contracts.js';
import type { PromtgenPackageInspection } from '../../v4/exporter.js';
import type { RecoveryPreview } from '../../v4/application/recovery-service.js';
import type { ProviderSettings } from '../../v4/provider-settings.js';
import type { ProjectInventoryReport } from '../../v4/project-analyzer.js';
import { useI18n } from '../providers/I18nProvider.js';

type Project = ProjectDocumentV5;
type OutputLanguage = ProjectDocumentV5['identity']['outputLanguage'];

interface StartScreenProps {
  onCreate: (idea: string, language: OutputLanguage, files: File[], nativeInventory?: ProjectInventoryReport) => Promise<void>;
  onImport: (inspection: PromtgenPackageInspection, mode: 'new' | 'recovery', preview?: RecoveryPreview) => Promise<boolean>;
  projects: Project[];
  onOpen: (id: string) => void;
  onArchive: (id: string) => Promise<boolean>;
  onRestore: (id: string) => Promise<boolean>;
  onPurge: (id: string) => Promise<boolean>;
  providerSettings: ProviderSettings;
  onOpenSettings: () => void;
  readiness: ProviderReadinessResult | null;
  checkingProvider: boolean;
  onRecheckProvider: () => void;
}

// Örnekler ürün sözleşmesinin `candidate-stable` alanlarından seçilir
// (web-app, internal-tool). Oyun örneği bilerek kaldırıldı: product-contract
// game-3d ve multiplayer-game'i `unsupported`, game-2d'yi `experimental`
// sayıyor — onboarding'in en görünür metni ürünün en zayıf alanına
// yönlendirmemeli.
const STARTERS = [
  'Yeni bir web uygulaması fikrim var',
  'Mevcut projeme özellik eklemek istiyorum',
  'İç ekibimiz için bir operasyon aracı yapmak istiyorum'
];

export function StartScreen({
  onCreate,
  onImport,
  projects,
  onOpen,
  onArchive,
  onRestore,
  onPurge,
  providerSettings,
  onOpenSettings,
  readiness,
  checkingProvider,
  onRecheckProvider
}: StartScreenProps) {
  const { locale, setLocale } = useI18n();
  const [idea, setIdea] = useState('');
  const [language, setLanguage] = useState<OutputLanguage>(locale === 'en-US' ? 'en' : 'tr');
  const [files, setFiles] = useState<File[]>([]);
  const [nativeInventory, setNativeInventory] = useState<ProjectInventoryReport | null>(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [selectingFolder, setSelectingFolder] = useState(false);
  const [creating, setCreating] = useState(false);
  const [packageInspection, setPackageInspection] = useState<PromtgenPackageInspection | null>(null);
  const [packageError, setPackageError] = useState('');
  const [inspectingPackage, setInspectingPackage] = useState(false);
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const packageRef = useRef<HTMLInputElement>(null);
  const ideaRef = useRef<HTMLTextAreaElement>(null);

  const appendFiles = (incoming: FileList | null) => {
    setNativeInventory(null);
    setFiles(current => [...current, ...Array.from(incoming || [])]);
  };
  const chooseDesktopFolder = async () => {
    setSelectingFolder(true);
    try {
      const report = await selectDesktopProjectFolder();
      if (report) { setFiles([]); setNativeInventory(report); setInventoryOpen(true); }
    } finally { setSelectingFolder(false); }
  };
  const aiReady = Boolean(readiness && providerGateOpen(readiness));
  const builtInAiNeedsKey = readiness?.state === 'needs-credential' && readiness.providerId === 'nvidia';
  const productCopy = getProductCopy(locale);
  const handleCreate = async () => {
    if (idea.trim().length < 10 || creating) return;
    setCreating(true);
    try { await onCreate(idea, language, files, nativeInventory ?? undefined); }
    finally { setCreating(false); }
  };
  const inspectPackage = async (file: File | undefined) => {
    if (!file) return;
    setInspectingPackage(true);
    setPackageError('');
    try {
      const { inspectPromtgenPackage } = await import('../../v4/exporter.js');
      setPackageInspection(await inspectPromtgenPackage(file));
    } catch (error) {
      setPackageError(error instanceof Error ? error.message : 'Paket güvenli biçimde açılamadı.');
    } finally {
      setInspectingPackage(false);
      if (packageRef.current) packageRef.current.value = '';
    }
  };

  return <main id="main-content" className="pg-onboarding-shell">
    <a className="skip-link" href="#idea-input">Ana içeriğe geç</a>
    <aside className="pg-onboarding-sidebar" aria-label="Kayıtlı çalışmalar">
      <div className="pg-onboarding-brand"><span><Sparkles size={18}/></span><b>PromtGen</b></div>
      <button type="button" className="pg-sidebar-new" onClick={() => { setIdea(''); ideaRef.current?.focus(); }}><Plus size={17}/> Yeni fikir</button>
      <div className="pg-onboarding-projects">
        <span>SON ÇALIŞMALAR</span>
        {projects.length === 0 && <p>İlk fikrin burada saklanacak.</p>}
        {projects.slice(0, 8).map(item => <article key={item.id} className={item.lifecycle.status === 'archived' ? 'is-archived' : ''}>
          <button type="button" className="portfolio-project-open" onClick={() => onOpen(item.id)}>
            <i>{(item.identity.name || 'F').slice(0, 1).toLocaleUpperCase('tr-TR')}</i>
            <span><b>{item.identity.name || 'İsimsiz fikir'}</b><small>r{item.canonicalRevision} · {item.lifecycle.status === 'archived' ? 'arşiv' : 'yerel'}</small></span>
          </button>
          <div>
            <button type="button" disabled={busyProjectId === item.id} aria-label={`${item.identity.name} projesini ${item.lifecycle.status === 'archived' ? 'arşivden çıkar' : 'arşivle'}`} onClick={async () => {
              setBusyProjectId(item.id);
              try { await (item.lifecycle.status === 'archived' ? onRestore(item.id) : onArchive(item.id)); }
              finally { setBusyProjectId(null); }
            }}>{item.lifecycle.status === 'archived' ? <RotateCcw size={14}/> : <Archive size={14}/>}</button>
            <button type="button" aria-label={`${item.identity.name} projesini kalıcı sil`} onClick={() => setDeleteProject(item)}><Trash2 size={14}/></button>
          </div>
        </article>)}
      </div>
      <button type="button" className="pg-onboarding-settings" aria-label="AI ayarları" onClick={onOpenSettings}><Settings2 size={17}/><span><b>Çalışma biçimi</b><small>{aiReady ? getProviderMeta(providerSettings.providerId).label : 'Yerel mod kullanılabilir'}</small></span></button>
    </aside>

    <section className="pg-onboarding-main">
      <header className="pg-onboarding-topbar">
        <div className={`pg-runtime-pill ${aiReady ? 'is-ai' : 'is-local'}`} role="status"><i/>{checkingProvider ? 'Bağlantı kontrol ediliyor' : aiReady ? `${getProviderMeta(providerSettings.providerId).label} hazır` : 'Yerel fikir motoru'}</div>
        <button type="button" onClick={() => {
          const next = language === 'tr' ? 'en' : 'tr';
          setLanguage(next);
          setLocale(next === 'en' ? 'en-US' : 'tr-TR');
        }}>{language.toUpperCase()}</button>
      </header>

      <div className="pg-onboarding-center">
        <div className="pg-onboarding-copy">
          <span>FİKİR STÜDYOSU</span>
          <h1>{locale === 'en-US' ? 'Start with the idea, not the form.' : 'Form doldurma. Fikrini anlat.'}</h1>
          <p>{productCopy.promise}</p>
        </div>

        <div className="pg-start-composer">
          <label htmlFor="idea-input">{locale === 'en-US' ? 'What is on your mind?' : 'Aklında ne var?'}</label>
          <textarea
            ref={ideaRef}
            id="idea-input"
            aria-label={locale === 'en-US' ? 'What do you want to build?' : 'Ne yapmak istiyorsun?'}
            value={idea}
            rows={5}
            autoFocus
            onChange={event => setIdea(event.target.value)}
            onKeyDown={event => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                void handleCreate();
              }
            }}
            placeholder="Örneğin: küçük ekiplerin fatura takibini kolaylaştıran bir araç yapmak istiyorum…"
          />
          <div className="pg-start-composer-footer">
            <div>
              <label title="Dosya veya belge ekle"><FolderOpen size={17}/><span>Bağlam ekle</span><input type="file" multiple hidden onChange={event => appendFiles(event.target.files)}/></label>
              {(files.length > 0 || nativeInventory) && <button type="button" className="pg-context-count" onClick={() => setInventoryOpen(true)}><Check size={14}/>{nativeInventory ? nativeInventory.totals.included : files.length} dosya</button>}
            </div>
            <button type="button" className="pg-start-submit" disabled={idea.trim().length < 10 || creating} onClick={() => void handleCreate()}>{creating ? <LoaderCircle className="spin" size={19}/> : <ArrowRight size={19}/>}<span>{creating ? 'Fikir alanı hazırlanıyor' : 'Fikri geliştir'}</span></button>
          </div>
        </div>

        <div className="pg-starter-prompts" aria-label="Örnek başlangıçlar">
          {STARTERS.map(starter => <button type="button" key={starter} onClick={() => { setIdea(starter); ideaRef.current?.focus(); }}>{starter}<ChevronRight size={15}/></button>)}
        </div>

        {!aiReady && readiness && <div className="pg-local-mode-note" role="note">
          <Sparkles size={17}/><span><b>{builtInAiNeedsKey ? 'Yerleşik GLM-5.2 etkinleştirilmeyi bekliyor.' : 'AI bağlantısı olmadan da başlayabilirsin.'}</b><small>{builtInAiNeedsKey ? 'NVIDIA anahtarını yalnız bir kez ekle; masaüstü uygulaması sonraki açılışlarda güvenli kasadan otomatik kullanır.' : 'Yerel motor sorular ve yapılandırılmış seçenekler üretir. İstersen daha sonra bir AI sağlayıcısı bağlayabilirsin.'}</small></span><button type="button" onClick={onOpenSettings}>{builtInAiNeedsKey ? 'GLM-5.2’yi etkinleştir' : 'AI bağla'}</button><button type="button" onClick={onRecheckProvider} disabled={checkingProvider}>Kontrol et</button>
        </div>}

        <details className="pg-import-options">
          <summary>Mevcut bir çalışmayla başla <ChevronRight size={16}/></summary>
          <div>
            {isDesktopProjectImportAvailable()
              ? <button type="button" disabled={selectingFolder} onClick={chooseDesktopFolder}>{selectingFolder ? <LoaderCircle className="spin" size={17}/> : <FolderOpen size={17}/>}<span><b>Proje klasörü</b><small>Yerel envanter çıkarılır; hassas dosyalar filtrelenir</small></span></button>
              : <label><FolderOpen size={17}/><span><b>Proje klasörü</b><small>Yerel envanter çıkarılır; hassas dosyalar filtrelenir</small></span><input ref={element => { if (element) { element.setAttribute('webkitdirectory', ''); element.setAttribute('directory', ''); } }} type="file" multiple hidden onChange={event => appendFiles(event.target.files)}/></label>}
            <button type="button" disabled={inspectingPackage} onClick={() => packageRef.current?.click()}><FileUp size={17}/><span><b>PromtGen paketi</b><small>Önceki bir çalışmayı aç</small></span></button>
          </div>
        </details>
        <input ref={packageRef} hidden type="file" accept=".promtgen" onChange={event => void inspectPackage(event.target.files?.[0])}/>
        {packageError && <div className="package-import-error" role="alert"><X size={15}/>{packageError}</div>}
      </div>

      <footer className="pg-onboarding-footer"><span>Local-first</span><span>Otomatik plan değişikliği yok</span><span>Hesap gerektirmez</span></footer>
    </section>

    <ProjectInventoryModal open={inventoryOpen} nativeInventory={nativeInventory} onClose={() => setInventoryOpen(false)}/>
    {packageInspection && <PackageImportDialog inspection={packageInspection} existingProject={projects.find(project => project.id === packageInspection.project.id)} onConfirm={(mode, preview) => onImport(packageInspection, mode, preview)} onClose={() => setPackageInspection(null)}/>}
    {deleteProject && <ProjectDeleteDialog
      projectName={deleteProject.identity.name}
      onClose={() => setDeleteProject(null)}
      onConfirm={async () => {
        const deleted = await onPurge(deleteProject.id);
        if (deleted) setDeleteProject(null);
        return deleted;
      }}
    />}
  </main>;
}
