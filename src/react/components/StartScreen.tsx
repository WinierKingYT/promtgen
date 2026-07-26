import { useRef, useState } from 'react';
import { ArrowRight, FolderOpen, LoaderCircle, Settings2, Sparkles, X } from 'lucide-react';
import { getProviderMeta } from '../../v4/provider-settings.js';
import { isDesktopProjectImportAvailable, selectDesktopProjectFolder } from '../../v4/desktop-project-import.js';
import { PortfolioOverview } from './PortfolioOverview.js';
import type { ProjectDocumentV5 } from '../../v4/contracts.js';
import type { ProviderSettings } from '../../v4/provider-settings.js';
import { useI18n } from '../providers/I18nProvider.js';

type Project = ProjectDocumentV5;

interface StartScreenProps {
  onCreate: (idea: string, language: string, files: File[], nativeInventory?: any) => Promise<void>;
  onImport: (file: File) => void;
  projects: Project[];
  onOpen: (id: string) => void;
  providerSettings: ProviderSettings;
  onProviderSettings: (settings: ProviderSettings) => void;
  onOpenSettings: () => void;
}

export function StartScreen({ onCreate, onImport, projects, onOpen, providerSettings, onProviderSettings, onOpenSettings }: StartScreenProps) {
  const { locale, setLocale, t } = useI18n();
  const [idea, setIdea] = useState('');
  const [language, setLanguage] = useState(locale === 'en-US' ? 'en' : 'tr');
  const [files, setFiles] = useState<File[]>([]);
  const [nativeInventory, setNativeInventory] = useState<any>(null);
  const [selectingFolder, setSelectingFolder] = useState(false);
  const [creating, setCreating] = useState(false);
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

  const handleCreate = async () => {
    setCreating(true);
    try { await onCreate(idea, language, files, nativeInventory); }
    finally { setCreating(false); }
  };

  return (
    <main id="main-content" className="start-shell">
      <a className="skip-link" href="#idea-input">{t('start.skip')}</a>
      <div className="start-mark"><Sparkles size={20} /> PROMTGEN / LOCAL-FIRST</div>
      <section className="start-card" aria-labelledby="start-title">
        <div className="eyebrow">{t('start.eyebrow')}</div>
        <h1 id="start-title">{t('start.title')}<br /><span>{t('start.titleAccent')}</span></h1>
        <p className="lead">{t('start.lead')}</p>
        <label className="idea-box">
          <span>{t('start.ideaLabel')}</span>
          <textarea
            id="idea-input"
            value={idea}
            onChange={event => setIdea(event.target.value)}
            onKeyDown={event => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                if (idea.trim().length >= 10 && !creating) {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '8px 0 16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>{t('start.examples')}</span>
          <button type="button" onClick={() => setIdea('Yerel çalışan, çevrimdışı destekli ve bildirimli kişisel alışkanlık takip uygulaması yapmak istiyorum.')}
            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: '#ddd6fe', fontSize: '11px', padding: '3px 10px', borderRadius: '12px', cursor: 'pointer' }}>
            📱 Mobil Alışkanlık Takipçisi
          </button>
          <button type="button" onClick={() => setIdea('KOBİ\'ler için sipariş, stok, fatura ve müşteri yönetim paneli tasarlamak istiyorum.')}
            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: '#ddd6fe', fontSize: '11px', padding: '3px 10px', borderRadius: '12px', cursor: 'pointer' }}>
            🌐 E-Ticaret Yönetim Paneli
          </button>
          <button type="button" onClick={() => setIdea('Fizik tabanlı, modüler ve eklenti destekli 2D arcade oyunu geliştirmek istiyorum.')}
            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: '#ddd6fe', fontSize: '11px', padding: '3px 10px', borderRadius: '12px', cursor: 'pointer' }}>
            🎮 2D Arcade Oyun Projesi
          </button>
        </div>

        <div className="start-actions">
          <label className="file-action"><FolderOpen size={17} /> {t('start.files')}<input type="file" multiple hidden onChange={event => appendFiles(event.target.files)} /></label>
          {isDesktopProjectImportAvailable()
            ? <button type="button" className="file-action" disabled={selectingFolder} onClick={chooseDesktopFolder}>{selectingFolder ? <LoaderCircle className="spin" size={17} /> : <FolderOpen size={17} />} Proje klasörü</button>
            : <label className="file-action"><FolderOpen size={17} /> {t('start.folder')}<input type="file" multiple hidden {...({ webkitdirectory: '', directory: '' } as any)} onChange={event => appendFiles(event.target.files)} /></label>}
          <button className="file-action" onClick={onOpenSettings}><Settings2 size={17} /> AI: {getProviderMeta(providerSettings.providerId).label}</button>
          <label>{t('start.outputLanguage')}<select value={language} onChange={event => {
            const next = event.target.value;
            setLanguage(next);
            setLocale(next === 'en' ? 'en-US' : 'tr-TR');
          }}><option value="tr">{t('language.turkish')}</option><option value="en">{t('language.english')}</option></select></label>
          <button className="primary" disabled={idea.trim().length < 10 || creating} onClick={handleCreate}>
            {creating ? <><LoaderCircle className="spin" size={18} /> {t('start.analyzing')}</> : <>{t('start.analyze')} <ArrowRight size={18} /></>}
          </button>
        </div>

        {files.length > 0 && (
          <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#a78bfa', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📁 Eklenen Dosyalar ({files.length}):</span>
              <button type="button" onClick={() => setFiles([])} style={{ background: 'none', border: 'none', color: '#fca5a5', fontSize: '10px', cursor: 'pointer' }}>Tümünü Temizle</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {files.map((file, idx) => (
                <span key={`${file.name}-${idx}`} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#d1d5db', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {file.name}
                  <button type="button" onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                    style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0, fontSize: '12px', lineHeight: 1 }}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <p data-capability-id="project-inventory-analyzer" className="context-note" style={{ margin: '6px 0 0 0' }}>{t('start.inventoryNotice')}</p>
          </div>
        )}
        {nativeInventory && <p className="context-note">{nativeInventory.rootName}: {nativeInventory.totals.included} dosya envantere alındı, {nativeInventory.totals.excluded} öğe güvenlik politikasıyla dışarıda bırakıldı.</p>}
        <div className="import-row"><span>{t('start.previous')}</span><button className="text-button" onClick={() => packageRef.current?.click()}><Sparkles size={16} /> {t('start.openPackage')}</button><input ref={packageRef} hidden type="file" accept=".promtgen" onChange={event => event.target.files?.[0] && onImport(event.target.files[0])} /></div>
        <PortfolioOverview projects={projects} onOpen={onOpen} />
      </section>
      <footer>
        {['offline', 'ollama'].includes(providerSettings.providerId)
          ? 'Hesap yok · Plan cihazında · Bulut AI bağlantısı yok'
          : `Hesap yok · Plan cihazında · Seçili AI sağlayıcısına (${getProviderMeta(providerSettings.providerId).label}) filtrelenmiş bağlam gönderilir`}
      </footer>
    </main>
  );
}
