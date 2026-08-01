import { useRef, useState } from 'react';
import { ArrowRight, FolderOpen, LoaderCircle, Settings2, Sparkles, X } from 'lucide-react';
import { getProviderMeta } from '../../v4/provider-settings.js';
import { isDesktopProjectImportAvailable, selectDesktopProjectFolder } from '../../v4/desktop-project-import.js';
import { PortfolioOverview } from './PortfolioOverview.js';
import { ProjectInventoryModal } from './ProjectInventoryModal.js';
import { PackageImportDialog } from './PackageImportDialog.js';
import { ProviderGateNotice } from './ProviderGateNotice.js';
import { providerGateOpen, type ProviderReadinessResult } from '../../v4/application/provider-readiness-service.js';
import type { ProjectDocumentV5 } from '../../v4/contracts.js';
import type { PromtgenPackageInspection } from '../../v4/exporter.js';
import type { RecoveryPreview } from '../../v4/application/recovery-service.js';
import type { ProviderSettings } from '../../v4/provider-settings.js';
import type { ProjectInventoryReport } from '../../v4/project-analyzer.js';
import { useI18n } from '../providers/I18nProvider.js';
import { getProductCopy } from '../../v4/product/product-contract.js';

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
  const { locale, setLocale, t } = useI18n();
  const productCopy = getProductCopy(locale);
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
  const packageRef = useRef<HTMLInputElement>(null);

  const appendFiles = (incoming: FileList | null) => {
    setNativeInventory(null);
    setFiles(current => [...current, ...Array.from(incoming || [])]);
  };

  const chooseDesktopFolder = async () => {
    setSelectingFolder(true);
    try {
      const report = await selectDesktopProjectFolder();
      if (report) { setFiles([]); setNativeInventory(report); }
    } finally { setSelectingFolder(false); }
  };

  const gateOpen = Boolean(readiness && providerGateOpen(readiness));

  const handleCreate = async () => {
    if (!gateOpen) return;
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

  return (
    <main id="main-content" className="start-shell">
      <a className="skip-link" href="#idea-input">{t('start.skip')}</a>
      <div className="start-mark"><Sparkles size={20} /> PROMTGEN / LOCAL-FIRST</div>
      <section className="start-card" aria-labelledby="start-title">
        <div className="eyebrow">{t('start.eyebrow')}</div>
        <h1 id="start-title">{t('start.title')}<br /><span>{t('start.titleAccent')}</span></h1>
        <p className="lead">{productCopy.promise}</p>
        <p className="product-positioning">{locale === 'en-US' ? 'Talk through the idea first. Turn it into a guide or a detailed plan only when you want.' : 'Önce fikrini geliştir. Konuşarak netleştir, sonra istersen anlaşılır bir rehbere ya da ayrıntılı plana dönüştür.'}</p>
        <label className="idea-box">
          <span>{t('start.ideaLabel')}</span>
          <textarea
            id="idea-input"
            value={idea}
            onChange={event => setIdea(event.target.value)}
            onKeyDown={event => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                if (idea.trim().length >= 10 && !creating && gateOpen) {
                  event.preventDefault();
                  handleCreate();
                }
              }
            }}
            rows={5}
            placeholder={t('start.ideaPlaceholder')}
          />
          <div className="idea-footer">
            <span>{t('start.characterCount', { count: String(idea.length) })} {idea.length < 50 ? t('start.amplifierHint') : ''}</span>
            <span style={{ color: idea.trim().length >= 10 ? '#10b981' : '#f59e0b' }}>
              {idea.trim().length < 10 ? t('start.minimum') : t('start.shortcut')}
            </span>
          </div>
        </label>
        <ProviderGateNotice
          readiness={readiness}
          checking={checkingProvider}
          onOpenSettings={onOpenSettings}
          onRecheck={onRecheckProvider}
        />
        <div className="start-actions">
          <button className="primary" disabled={idea.trim().length < 10 || creating || !gateOpen} onClick={handleCreate}>
            {creating ? <><LoaderCircle className="spin" size={18} /> {t('start.analyzing')}</> : <>Fikri geliştir <ArrowRight size={18} /></>}
          </button>
        </div>
        <details className="start-options">
          <summary>Dosya, dil ve AI seçenekleri</summary>
          <div>
            <label className="file-action"><FolderOpen size={17} /> {t('start.files')}<input type="file" multiple hidden onChange={event => appendFiles(event.target.files)} /></label>
            {isDesktopProjectImportAvailable()
              ? <button type="button" className="file-action" disabled={selectingFolder} onClick={chooseDesktopFolder}>{selectingFolder ? <LoaderCircle className="spin" size={17} /> : <FolderOpen size={17} />} Proje klasörü</button>
              : <label className="file-action"><FolderOpen size={17} /> {t('start.folder')}<input
                  ref={element => {
                    if (!element) return;
                    element.setAttribute('webkitdirectory', '');
                    element.setAttribute('directory', '');
                  }}
                  type="file"
                  multiple
                  hidden
                  onChange={event => appendFiles(event.target.files)}
                /></label>}
            <button className="file-action" onClick={onOpenSettings}><Settings2 size={17} /> AI: {getProviderMeta(providerSettings.providerId).label}</button>
            <label>{t('start.outputLanguage')}<select value={language} onChange={event => {
              const next = event.target.value as OutputLanguage;
              setLanguage(next);
              setLocale(next === 'en' ? 'en-US' : 'tr-TR');
            }}><option value="tr">{t('language.turkish')}</option><option value="en">{t('language.english')}</option></select></label>
          </div>
        </details>

        {files.length > 0 && (
          <div className="selected-files">
            <div>
              <span>Eklenen dosyalar ({files.length})</span>
              <button type="button" onClick={() => setFiles([])}>Tümünü temizle</button>
            </div>
            <div>
              {files.map((file, idx) => (
                <span key={`${file.name}-${idx}`}>
                  {file.name}
                  <button aria-label={`${file.name} dosyasını kaldır`} type="button" onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}><X size={12}/></button>
                </span>
              ))}
            </div>
            <p className="context-note">{t('start.inventoryNotice')}</p>
          </div>
        )}
        {nativeInventory && <div className="context-note">{nativeInventory.rootName || 'Seçilen proje'}: {nativeInventory.totals.included} dosya envantere alındı, {nativeInventory.totals.excluded} öğe hassas içerik politikasıyla dışarıda bırakıldı. <button type="button" className="text-button" onClick={() => setInventoryOpen(true)}>Envanteri incele</button></div>}
        <div className="import-row"><span>{t('start.previous')}</span><button className="text-button" disabled={inspectingPackage} onClick={() => packageRef.current?.click()}>{inspectingPackage ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />} {inspectingPackage ? 'Paket doğrulanıyor…' : t('start.openPackage')}</button><input ref={packageRef} hidden type="file" accept=".promtgen" onChange={event => inspectPackage(event.target.files?.[0])} /></div>
        {packageError && <div className="package-import-error" role="alert"><X size={15} /> {packageError}</div>}
        <PortfolioOverview projects={projects} onOpen={onOpen} onArchive={onArchive} onRestore={onRestore} onPurge={onPurge} />
      </section>
      <ProjectInventoryModal open={inventoryOpen} nativeInventory={nativeInventory} onClose={() => setInventoryOpen(false)} />
      {packageInspection && (
        <PackageImportDialog
          inspection={packageInspection}
          existingProject={projects.find(project => project.id === packageInspection.project.id)}
          onConfirm={(mode, preview) => onImport(packageInspection, mode, preview)}
          onClose={() => setPackageInspection(null)}
        />
      )}
      <footer>
        {['offline', 'ollama'].includes(providerSettings.providerId)
          ? 'Hesap yok · Plan cihazında · Bulut AI bağlantısı yok'
          : `Hesap yok · Plan cihazında · Seçili AI sağlayıcısına (${getProviderMeta(providerSettings.providerId).label}) filtrelenmiş bağlam gönderilir`}
      </footer>
    </main>
  );
}
