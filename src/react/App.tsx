import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowRight, Bot, Check, ChevronDown, CircleAlert, Code2, Download, Eye, EyeOff, FolderOpen, Gauge, History, KeyRound, Lightbulb, LoaderCircle, Menu, MessageCircle, RotateCcw, Save, Send, Settings2, ShieldCheck, Sparkles, Wifi, X } from 'lucide-react';
import { analyzeIdea, applyApprovedChanges, captureCurrentRevision, comparePlanRevisions, finalizePlan, overridePlanningDepth, previewApprovedChanges, recalculateReadiness, reopenPlan, restorePlanRevision, updatePlanSection, updateSuggestionStatus } from '../v4/planning-engine.js';
import { PHASE_REGISTRY } from '../v4/project-state-v4.js';
import { createPlatformRepository } from '../v4/tauri-storage.js';
import { createPromtgenPackage, downloadBlob, exportCanonicalMarkdown, readPromtgenPackage } from '../v4/exporter.js';
import { createCredentialVault } from '../v4/credential-vault.js';
import { generateDiscoveryBundle, runConversationalDiscoveryTurn, testProviderConnection } from '../v4/ai-discovery.js';
import { getProviderMeta, loadProviderSettings, PROVIDER_CATALOG, saveProviderSettings } from '../v4/provider-settings.js';
import { validateProviderSettings } from '../v4/provider-url-policy.js';
import { applyCompiledTaskPlan, compileTaskPlan } from '../v4/task-compiler.js';
import { analyzeSelectedFiles, projectInventoryContext } from '../v4/project-analyzer.js';
import { isDesktopProjectImportAvailable, selectDesktopProjectFolder } from '../v4/desktop-project-import.js';
import { IconButton, ProjectRail, SuggestionCard } from './components/WorkspaceChrome';
import { ResearchPanel } from './components/ResearchPanel';
import { ReviewPanel } from './components/ReviewPanel';
import { ModulePanel } from './components/ModulePanel';
import { ExecutionPanel } from './components/ExecutionPanel';
import { IdeExportDialog } from './components/IdeExportDialog';
import { StorageHealthPanel } from './components/StorageHealthPanel';
import { buildLocalPlanningMemory } from '../v4/planning-memory.js';
import { PortfolioOverview } from './components/PortfolioOverview';

type Project = any;
const repository = createPlatformRepository();
const credentialVault = createCredentialVault();
const depths = [
  { id: 'quick', label: 'Quick', detail: 'Fikir → kapsam → görevler' },
  { id: 'standard', label: 'Standard', detail: 'Dengeli ürün ve teknik plan' },
  { id: 'advanced', label: 'Advanced', detail: 'Güvenlik ve dağıtım dahil' },
  { id: 'enterprise', label: 'Enterprise', detail: 'Tam operasyonel mimari' }
];

function StartScreen({ onCreate, onImport, projects, onOpen, providerSettings, onProviderSettings }: { onCreate: (idea: string, language: string, files: File[], nativeInventory?: any) => Promise<void>; onImport: (file: File) => void; projects: Project[]; onOpen: (id: string) => void; providerSettings: any; onProviderSettings: (settings: any) => void }) {
  const [idea, setIdea] = useState('');
  const [language, setLanguage] = useState('tr');
  const [files, setFiles] = useState<File[]>([]);
  const [nativeInventory, setNativeInventory] = useState<any>(null);
  const [selectingFolder, setSelectingFolder] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const packageRef = useRef<HTMLInputElement>(null);
  const appendFiles = (incoming: FileList | null) => { setNativeInventory(null); setFiles(current => [...current, ...Array.from(incoming || [])]); };
  const chooseDesktopFolder = async () => {
    setSelectingFolder(true);
    try { const report = await selectDesktopProjectFolder(); if (report) { setFiles([]); setNativeInventory(report); } }
    finally { setSelectingFolder(false); }
  };
  return <main className="start-shell">
    <div className="start-mark"><Sparkles size={20} /> PROMTGEN / LOCAL-FIRST</div>
    <section className="start-card" aria-labelledby="start-title">
      <div className="eyebrow">YAŞAYAN PROJE MİMARI · V4</div>
      <h1 id="start-title">Fikrini söyle.<br/><span>Planı birlikte büyütelim.</span></h1>
      <p className="lead">Kısa bir düşünceden, kararları sana ait olan uygulanabilir bir proje planına. Teknolojiyi baştan bilmen gerekmiyor.</p>
      <label className="idea-box">
        <span>Ne yapmak istiyorsun?</span>
        <textarea value={idea} onChange={event => setIdea(event.target.value)} rows={5} placeholder="Örn. Yerel çalışan, kısa bir fikri adım adım geliştirip kodlama ajanları için plana dönüştüren bir uygulama..." autoFocus />
        <div className="idea-footer"><span>{idea.length} karakter</span><span>Ctrl + Enter ile başlat</span></div>
      </label>
      <div className="start-actions">
        <label className="file-action"><FolderOpen size={17}/> Proje dosyaları<input type="file" multiple hidden onChange={event => appendFiles(event.target.files)}/></label>
        {isDesktopProjectImportAvailable() ? <button type="button" className="file-action" disabled={selectingFolder} onClick={chooseDesktopFolder}>{selectingFolder ? <LoaderCircle className="spin" size={17}/> : <FolderOpen size={17}/>} Proje klasörü</button> : <label className="file-action"><FolderOpen size={17}/> Proje klasörü<input type="file" multiple hidden {...({ webkitdirectory: '', directory: '' } as any)} onChange={event => appendFiles(event.target.files)}/></label>}
        <button className="file-action" onClick={() => setSettingsOpen(true)}><Settings2 size={17}/> AI: {getProviderMeta(providerSettings.providerId).label}</button>
        <label>Çıktı dili<select value={language} onChange={event => setLanguage(event.target.value)}><option value="tr">Türkçe</option><option value="en">English</option></select></label>
        <button className="primary" disabled={idea.trim().length < 10 || creating} onClick={async () => { setCreating(true); try { await onCreate(idea, language, files, nativeInventory); } finally { setCreating(false); } }}>{creating ? <><LoaderCircle className="spin" size={18}/> Fikir analiz ediliyor</> : <>Fikri analiz et <ArrowRight size={18}/></>}</button>
      </div>
      {files.length > 0 && <p className="context-note">{files.length} dosya cihazda güvenlik taramasından geçirilecek. Ham içerik saklanmaz veya sağlayıcıya gönderilmez; yalnız güvenli envanter özeti kullanılır.</p>}
      {nativeInventory && <p className="context-note">{nativeInventory.rootName}: {nativeInventory.totals.included} dosya envantere alındı, {nativeInventory.totals.excluded} öğe güvenlik politikasıyla dışarıda bırakıldı.</p>}
      <div className="import-row"><span>Daha önce başladın mı?</span><button className="text-button" onClick={() => packageRef.current?.click()}><Download size={16}/> .promtgen paketi aç</button><input ref={packageRef} hidden type="file" accept=".promtgen" onChange={event => event.target.files?.[0] && onImport(event.target.files[0])}/></div>
      <PortfolioOverview projects={projects} onOpen={onOpen}/>
    </section>
    <footer>Hesap yok · Bulut yok · Projelerin cihazında</footer>
    <ProviderSettingsDialog open={settingsOpen} settings={providerSettings} onSave={onProviderSettings} onClose={() => setSettingsOpen(false)}/>
  </main>;
}

function ProviderSettingsDialog({ open, settings, onSave, onClose }: any) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draftSettings, setDraftSettings] = useState(settings);
  const [credential, setCredential] = useState('');
  const [showCredential, setShowCredential] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const provider = getProviderMeta(draftSettings.providerId);

  useEffect(() => {
    if (!open) return;
    setDraftSettings(settings);
    setResult(null);
    credentialVault.get(settings.providerId).then((value: string | null) => setCredential(value || ''));
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }, [open, settings]);

  const chooseProvider = async (providerId: string) => {
    const meta = getProviderMeta(providerId);
    setDraftSettings((current: any) => ({ ...current, providerId, model: meta.defaultModel, baseUrl: meta.defaultBaseUrl || '' }));
    setCredential(await credentialVault.get(providerId) || '');
    setResult(null);
  };
  const test = async () => {
    if (provider.credentialRequired && !credential.trim()) { setResult({ ok: false, message: 'Bu sağlayıcı için API anahtarı gerekli.' }); return; }
    const validation = validateProviderSettings(draftSettings, provider);
    if (!validation.valid) { setResult({ ok: false, message: validation.error, providerId: draftSettings.providerId, latencyMs: 0, errorCode: 'configuration' }); return; }
    setTesting(true); setResult(null);
    try { setResult(await testProviderConnection(draftSettings, credential.trim())); }
    finally { setTesting(false); }
  };
  const save = async () => {
    const validation = validateProviderSettings(draftSettings, provider);
    if (!validation.valid) { setResult({ ok: false, message: validation.error, providerId: draftSettings.providerId, latencyMs: 0, errorCode: 'configuration' }); return; }
    if (credential.trim()) await credentialVault.set(draftSettings.providerId, credential.trim());
    else await credentialVault.remove(draftSettings.providerId);
    onSave(saveProviderSettings(draftSettings));
    dialogRef.current?.close(); onClose();
  };

  return <dialog ref={dialogRef} className="provider-dialog" aria-labelledby="provider-dialog-title" onCancel={onClose} onClose={onClose}>
    <div className="dialog-head"><div className="dialog-icon"><Bot size={20}/></div><div><span className="meta">AI YAPILANDIRMASI</span><h2 id="provider-dialog-title">Planlama motoru</h2></div><IconButton label="Ayarları kapat" onClick={() => { dialogRef.current?.close(); onClose(); }}><X size={18}/></IconButton></div>
    <p className="dialog-lead">AI yalnızca filtrelenmiş canonical plan bağlamını görür. Ürettiği hiçbir değişiklik sen onaylamadan plana uygulanmaz.</p>
    <fieldset className="provider-options"><legend>Sağlayıcı</legend>{PROVIDER_CATALOG.map(item => <label key={item.id} className={draftSettings.providerId === item.id ? 'active' : ''}><input type="radio" name="provider" value={item.id} checked={draftSettings.providerId === item.id} onChange={() => chooseProvider(item.id)}/><span className="provider-radio"/><span><b>{item.label}</b><small>{item.description}</small></span>{item.id === 'offline' && <em>Varsayılan</em>}</label>)}</fieldset>
    <div className="provider-fields">
      <label htmlFor="provider-model">Model<input id="provider-model" value={draftSettings.model} onChange={event => setDraftSettings({ ...draftSettings, model: event.target.value })} disabled={draftSettings.providerId === 'offline'}/></label>
      {draftSettings.providerId === 'ollama' && <label htmlFor="provider-url">Yerel Ollama adresi<input id="provider-url" type="url" value={draftSettings.baseUrl} onChange={event => setDraftSettings({ ...draftSettings, baseUrl: event.target.value.replace(/\/$/, '') })}/><small>Yalnız localhost veya loopback adresleri kabul edilir.</small></label>}
      {['openai', 'nvidia'].includes(draftSettings.providerId) && <label htmlFor="provider-url">Sabit API adresi<input id="provider-url" type="url" value={draftSettings.baseUrl} readOnly aria-readonly="true"/></label>}
      {provider.credentialRequired && <label htmlFor="provider-credential">API anahtarı<div className="secret-input"><KeyRound size={16}/><input id="provider-credential" type={showCredential ? 'text' : 'password'} value={credential} autoComplete="off" onChange={event => setCredential(event.target.value)} placeholder="Yalnızca bu oturumda saklanır"/><IconButton label={showCredential ? 'Anahtarı gizle' : 'Anahtarı göster'} onClick={() => setShowCredential(value => !value)}>{showCredential ? <EyeOff size={16}/> : <Eye size={16}/>}</IconButton></div></label>}
    </div>
    <label className="memory-toggle"><input type="checkbox" checked={draftSettings.useLocalMemory === true} onChange={event => setDraftSettings({ ...draftSettings, useLocalMemory: event.target.checked })}/><span><b>Yerel proje tercihlerimi kullan</b><small>Geçmiş projelerin ham metni paylaşılmaz. Yalnız toplulaştırılmış plan derinliği, karar türü, bölüm ve modül eğilimleri yeni AI turlarına eklenir.</small></span></label>
    <div className="privacy-callout"><ShieldCheck size={18}/><span><b>{draftSettings.providerId === 'ollama' || draftSettings.providerId === 'offline' ? 'Bağlam cihazda kalır' : 'Kontrollü bağlam paylaşımı'}</b><small>{provider.credentialRequired ? 'Web anahtarı oturum belleğinde; masaüstü anahtarı işletim sistemi kasasında tutulur.' : 'API anahtarı veya bulut bağlantısı gerektirmez.'}</small></span></div>
    {result && <div className={`connection-result ${result.ok ? 'ok' : 'error'}`} role="status">{result.ok ? <Check size={16}/> : <CircleAlert size={16}/>}<span>{result.message}<small>{result.providerId} · {result.latencyMs} ms{result.errorCode ? ` · ${result.errorCode}` : ''}</small></span></div>}
    <div className="dialog-actions"><button onClick={test} disabled={testing}>{testing ? <LoaderCircle className="spin" size={16}/> : <Wifi size={16}/>} Bağlantıyı test et</button><button className="primary" onClick={save}><Save size={16}/> Ayarları kaydet</button></div>
  </dialog>;
}

function RevisionHistoryDialog({ open, project, onRestore, onClose }: any) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const revisions = useMemo(() => [...project.revisions].filter((revision: any) => revision.snapshot).sort((a: any, b: any) => b.number - a.number), [project.revisions]);
  const defaultFrom = revisions.find((revision: any) => revision.number < project.revision)?.id || revisions[0]?.id || 'current';
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState('current');
  const [confirmRestore, setConfirmRestore] = useState(false);
  const comparison = useMemo(() => comparePlanRevisions(project, from, to), [project, from, to]);
  const selectedRevision = revisions.find((revision: any) => revision.id === from);

  useEffect(() => {
    if (!open) return;
    const nextFrom = revisions.find((revision: any) => revision.number < project.revision)?.id || revisions[0]?.id || 'current';
    setFrom(nextFrom); setTo('current'); setConfirmRestore(false);
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }, [open, project.id, project.revision]);

  const close = () => { dialogRef.current?.close(); onClose(); };
  return <dialog ref={dialogRef} className="revision-dialog" aria-labelledby="revision-dialog-title" onCancel={close} onClose={onClose}>
    <div className="dialog-head"><div className="dialog-icon"><History size={20}/></div><div><span className="meta">SÜRÜM GEÇMİŞİ</span><h2 id="revision-dialog-title">Plan revision’larını karşılaştır</h2></div><IconButton label="Geçmişi kapat" onClick={close}><X size={18}/></IconButton></div>
    <div className="revision-body">
      {revisions.length === 0 ? <div className="empty-history"><History size={25}/><b>Henüz karşılaştırılabilir snapshot yok</b><p>İlk plan değişikliğinden sonra revision geçmişi burada görünecek.</p></div> : <>
        <div className="revision-selectors">
          <label htmlFor="revision-from">Eski sürüm<select id="revision-from" value={from} onChange={event => { setFrom(event.target.value); setConfirmRestore(false); }}>{revisions.map((revision: any) => <option key={revision.id} value={revision.id}>r{revision.number} — {revision.summary}</option>)}</select></label>
          <ArrowRight size={18}/>
          <label htmlFor="revision-to">Yeni sürüm<select id="revision-to" value={to} onChange={event => setTo(event.target.value)}><option value="current">r{project.revision} — Güncel plan</option>{revisions.map((revision: any) => <option key={revision.id} value={revision.id}>r{revision.number} — {revision.summary}</option>)}</select></label>
        </div>
        {comparison.valid && <div className="revision-summary" role="status" aria-live="polite"><span><b>{comparison.summary.changedSections}</b> bölüm</span><span className="added"><b>+{comparison.summary.addedLines + comparison.summary.addedItems}</b> ekleme</span><span className="removed"><b>−{comparison.summary.removedLines + comparison.summary.removedItems}</b> kaldırma</span></div>}
        <div className="revision-diffs">
          {comparison.valid && comparison.sections.length === 0 && <p className="no-diff">Seçilen revision’lar arasında canonical plan farkı yok.</p>}
          {comparison.sections.map((section: any) => <details key={section.sectionId} open><summary><span><b>{section.title}</b><small>{section.beforeStatus} → {section.afterStatus}</small></span><ChevronDown size={15}/></summary><div className="line-diff" aria-label={`${section.title} satır farkları`}>{section.content.map((line: any, index: number) => <div key={`${line.type}-${index}`} className={line.type}><span>{line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}</span><code>{line.text || ' '}</code></div>)}</div>{(section.addedItems.length > 0 || section.removedItems.length > 0) && <div className="item-diff">{section.removedItems.map((item: string) => <p className="removed" key={`removed-${item}`}>− {item}</p>)}{section.addedItems.map((item: string) => <p className="added" key={`added-${item}`}>+ {item}</p>)}</div>}</details>)}
        </div>
      </>}
    </div>
    {revisions.length > 0 && <div className="revision-actions">{confirmRestore ? <div className="restore-confirm" role="alert"><span><b>r{selectedRevision?.number} planı geri yüklensin mi?</b><small>Mevcut geçmiş ve exportlar korunacak; sonuç r{project.revision + 1} olarak kaydedilecek.</small></span><button onClick={() => { onRestore(from); close(); }}>Evet, yeni revision oluştur</button><button onClick={() => setConfirmRestore(false)}>Vazgeç</button></div> : <><span>Geri yükleme mevcut planın üzerine yazmaz.</span><button disabled={!selectedRevision || selectedRevision.number === project.revision} onClick={() => setConfirmRestore(true)}><RotateCcw size={15}/> Seçili sürümü geri yükle</button></>}</div>}
  </dialog>;
}

function FinalizePlanDialog({ blockers, onConfirm, onClose }: { blockers: string[]; onConfirm: () => void; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const open = blockers.length > 0;

  useEffect(() => {
    if (open && !dialogRef.current?.open) dialogRef.current?.showModal();
    if (!open && dialogRef.current?.open) dialogRef.current.close();
  }, [open]);

  const close = () => { dialogRef.current?.close(); onClose(); };
  return <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby="finalize-dialog-title" aria-describedby="finalize-dialog-description" onCancel={close} onClose={onClose}>
    <div className="dialog-head"><div className="dialog-icon warning"><CircleAlert size={20}/></div><div><span className="meta">HAZIRLIK UYARISI</span><h2 id="finalize-dialog-title">Plan henüz tamamen hazır değil</h2></div><IconButton label="Finalizasyon uyarısını kapat" onClick={close}><X size={18}/></IconButton></div>
    <div className="confirm-body">
      <p id="finalize-dialog-description">{blockers.length} eksik veya geçersiz bölüm var. Planı şimdi finalleştirebilirsin; uyarılar revision geçmişinde korunur.</p>
      <ul>{blockers.slice(0, 8).map(blocker => <li key={blocker}>{blocker}</li>)}</ul>
      {blockers.length > 8 && <small>+{blockers.length - 8} ek uyarı</small>}
    </div>
    <div className="dialog-actions"><button type="button" onClick={close}>Planı geliştirmeye devam et</button><button type="button" className="primary danger" onClick={() => { onConfirm(); close(); }}><Check size={16}/> Uyarılarla finalleştir</button></div>
  </dialog>;
}

function Workspace({ project, projects, onProject, onNew, onPersist, providerSettings, onProviderSettings }: any) {
  const [railOpen, setRailOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('vision');
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [ideExportOpen, setIdeExportOpen] = useState(false);
  const [finalizationBlockers, setFinalizationBlockers] = useState<string[]>([]);
  const [taskCompilation, setTaskCompilation] = useState<any>(null);
  const [direction, setDirection] = useState('');
  const [focusedQuestion, setFocusedQuestion] = useState('');
  const [generating, setGenerating] = useState(false);
  const currentBundle = [...project.suggestionBundles].reverse().find((bundle: any) => bundle.status === 'open') || project.suggestionBundles.at(-1);
  const changePreview = useMemo(() => currentBundle ? previewApprovedChanges(project, currentBundle.id) : null, [project, currentBundle?.id]);
  const impactedSections = useMemo(() => new Set((changePreview?.sections || []).map((section: any) => section.sectionId)), [changePreview]);
  const active = project.sections[activeSection];
  useEffect(() => setDraft(active?.content || ''), [activeSection, project.id, active?.content]);
  const commit = (next: Project, message?: string) => { onPersist(next); if (message) { setNotice(message); window.setTimeout(() => setNotice(''), 2800); } };
  const status = (suggestionId: string, nextStatus: string, edited = '') => commit(updateSuggestionStatus(project, currentBundle.id, suggestionId, nextStatus, edited));
  const apply = () => commit(applyApprovedChanges(project, currentBundle.id), 'Kabul edilen değişiklikler plana işlendi.');
  const addBundle = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const message = direction.trim();
    if (!bundleResolved || generating || !message) return;
    setGenerating(true);
    try {
      const credential = await credentialVault.get(providerSettings.providerId) || '';
      const memory = providerSettings.useLocalMemory ? buildLocalPlanningMemory(projects, project.id) : null;
      const result = await runConversationalDiscoveryTurn(project, { settings: providerSettings, credential, message, focusedQuestion, memory } as any);
      setDirection('');
      setFocusedQuestion('');
      commit(result.project, result.usedFallback && result.error ? `AI erişilemedi; local motor kullanıldı: ${result.error}` : `${getProviderMeta(providerSettings.providerId).label} yeni karar turunu hazırladı.`);
    } finally { setGenerating(false); }
  };
  const saveSection = () => commit(updatePlanSection(project, activeSection, { content: draft }), `${active.title} kaydedildi.`);
  const exportPackage = async () => {
    const result = await createPromtgenPackage(project);
    downloadBlob(result.blob, result.filename);
    const next = structuredClone(project);
    next.exports = [...(next.exports || []), result.record];
    next.lifecycle.updatedAt = new Date().toISOString();
    commit(next, `r${result.record.revision} export kaydı korundu.`);
  };
  const exportMarkdown = () => downloadBlob(new Blob([exportCanonicalMarkdown(project)], { type: 'text/markdown' }), `${project.identity.name}.md`);
  const finish = () => {
    const result = finalizePlan(project, false);
    if (result.success) commit(result.project, 'Plan finalleştirildi.');
    else setFinalizationBlockers(result.blockers);
  };
  const forceFinish = () => {
    const result = finalizePlan(project, true);
    if (result.success) commit(result.project, 'Plan uyarılarla finalleştirildi.');
    else setNotice(result.blockers?.join(' · ') || 'Plan finalleştirilemedi.');
  };
  const restoreRevision = (reference: string) => { const result = restorePlanRevision(project, reference); if (result.success) commit(result.project, `r${result.restoredFromRevision} planı yeni revision olarak geri yüklendi.`); else setNotice(result.reason); };
  const approveTaskPlan = () => {
    const result = applyCompiledTaskPlan(project, taskCompilation, { approved: true });
    if (!result.success) { setNotice(result.reason); setTaskCompilation(null); return; }
    commit(result.project, `${result.project.tasks.length} görev ve ajan zinciri plana uygulandı.`);
    setTaskCompilation(null);
  };
  const bundleResolved = currentBundle?.status === 'resolved';
  const accepted = bundleResolved ? 0 : currentBundle?.items.filter((x: any) => ['accepted', 'edited'].includes(x.status)).length || 0;
  const pendingCount = bundleResolved ? 0 : currentBundle?.items.filter((x: any) => x.status === 'pending').length || 0;
  const decisionComplete = !bundleResolved && pendingCount === 0;
  const bundleSource = currentBundle?.source?.type === 'ai' ? getProviderMeta(currentBundle.source.providerId).label : 'Yerel motor';
  const openQuestions = [...new Set((project.openQuestions || []).filter(Boolean))] as string[];

  return <div className="app-shell">
    <ProjectRail projects={projects} activeId={project.id} onSelect={onProject} onNew={onNew} open={railOpen} onClose={() => setRailOpen(false)}/>
    <main className="workspace">
      <header className="topbar"><IconButton label="Projeleri aç" onClick={() => setRailOpen(true)}><Menu size={20}/></IconButton><div className="title-block"><span>{project.identity.name}</span><small><span className="live-dot"/> r{project.revision} · {project.lifecycle.status === 'finalized' ? 'Final plan' : 'Canlı plan'}</small></div><div className="phase-strip">{PHASE_REGISTRY.map((phase: any) => <span key={phase.id} className={phase.id === project.lifecycle.activePhase ? 'active' : ''}>{phase.label}</span>)}</div><div className="top-actions"><button onClick={() => setSettingsOpen(true)}><Settings2 size={16}/> {getProviderMeta(providerSettings.providerId).label}</button><button onClick={() => setIdeExportOpen(true)}><Code2 size={16}/> IDE</button><button onClick={exportMarkdown}><Download size={16}/> Markdown</button><button onClick={exportPackage}><Archive size={16}/> Paket</button>{project.lifecycle.status === 'finalized' ? <button className="primary compact" onClick={() => commit(reopenPlan(project), 'Yeni bir plan sürümü açıldı.')}><RotateCcw size={15}/> Yeniden aç</button> : <button className="primary compact" onClick={finish}><Check size={15}/> Finalleştir</button>}</div></header>
      <div className="workspace-grid">
        <section className="conversation" aria-label="Planlama sohbeti">
          <div className="idea-summary"><div className="ai-avatar"><Sparkles size={18}/></div><div><div className="meta">FİKİR ANALİZİ</div><p>{project.identity.originalIdea}</p></div></div>
          <div className="depth-panel"><div><span className="meta">ÖNERİLEN PLAN DERİNLİĞİ</span><h2>{project.planningDepth.recommended.toUpperCase()} <span>{project.planningDepth.signals.score}/100 karmaşıklık</span></h2><p>{project.planningDepth.rationale}</p></div><label>Derinliği değiştir<select value={project.planningDepth.selected} onChange={event => commit(overridePlanningDepth(project, event.target.value))}>{depths.map(depth => <option key={depth.id} value={depth.id}>{depth.label} — {depth.detail}</option>)}</select></label></div>
          <section className="discovery-chat" aria-labelledby="discovery-chat-title">
            <div className="chat-head"><div><span className="meta">ETKİLEŞİMLİ KEŞİF</span><h2 id="discovery-chat-title"><MessageCircle size={18}/> Projeyi konuşarak şekillendir</h2></div><small>Mesajların yeni seçenek üretir; planı doğrudan değiştirmez.</small></div>
            <div className="message-log" role="log" aria-live="polite" aria-label="Keşif konuşması">{project.messages.slice(-8).map((message: any) => <div key={message.id} className={`chat-message ${message.role}`}><span>{message.role === 'user' ? 'Sen' : 'PromtGen'}</span><p>{message.content}</p></div>)}</div>
            {bundleResolved ? <>
              {openQuestions.length > 0 && <div className="open-question-list"><span>Yanıtlanabilecek açık sorular</span>{openQuestions.slice(0, 4).map(question => <button type="button" className={focusedQuestion === question ? 'active' : ''} key={question} onClick={() => { setFocusedQuestion(question); setDirection(''); }}>{question}</button>)}</div>}
              <form className="discovery-composer" onSubmit={addBundle}>
                <label htmlFor="discovery-direction"><Sparkles size={16}/><span><b>{focusedQuestion || 'Sıradaki turda neye odaklanalım?'}</b><small>{focusedQuestion ? 'Yanıtın yeni karar seçeneklerine dönüştürülecek.' : 'Bir hedef, kısıt, tercih veya endişe yaz.'}</small></span></label>
                <div className="composer-row"><textarea id="discovery-direction" rows={2} value={direction} onChange={event => setDirection(event.target.value)} placeholder={focusedQuestion ? 'Bu soruya yanıtını yaz…' : "Örn. MVP'yi tek kullanıcıya indir ve çevrimdışı çalışmayı önceliklendir…"}/><button className="primary" type="submit" disabled={!direction.trim() || generating}>{generating ? <LoaderCircle className="spin" size={17}/> : <Send size={17}/>}<span>{generating ? 'Hazırlanıyor' : 'Gönder'}</span></button></div>
              </form>
            </> : <p className="chat-lock"><CircleAlert size={15}/> Sohbete devam etmek için önce mevcut seçeneklerin her biri hakkında karar ver.</p>}
          </section>
          <div className="conversation-heading"><div><span className="meta">KARAR TURU · {bundleSource.toUpperCase()}</span><h2>{currentBundle?.title || 'Planı geliştir'}</h2><p>Yalnızca kabul ettiğin değişiklikler yaşayan plana uygulanır.</p></div><Lightbulb size={23}/></div>
          <div className="suggestions">{currentBundle?.items.map((item: any) => <SuggestionCard key={item.id} item={item} onSection={setActiveSection} onStatus={(nextStatus: string, edited = '') => status(item.id, nextStatus, edited)}/>)}</div>
          {!bundleResolved && changePreview && changePreview.acceptedCount > 0 && <section className="change-preview" aria-labelledby="change-preview-title" aria-live="polite">
            <div className="preview-head"><div className="preview-icon"><Eye size={17}/></div><div><span className="meta">UYGULAMA ÖNCESİ ÖNİZLEME</span><h3 id="change-preview-title">r{project.revision} → r{changePreview.nextRevision}</h3></div><div className="preview-count"><b>{changePreview.acceptedCount}</b><span>kabul</span></div></div>
            <p>{changePreview.canApply ? 'Uyguladığında aşağıdaki canonical plan bölümleri güncellenecek.' : changePreview.reason}</p>
            <div className="preview-sections">{changePreview.sections.map((section: any) => <button type="button" key={section.sectionId} onClick={() => setActiveSection(section.sectionId)}><span><b>{section.title}</b><small>{section.additions.length} yeni öğe{section.unchanged.length ? ` · ${section.unchanged.length} zaten mevcut` : ''}</small></span><ArrowRight size={15}/></button>)}</div>
            {(changePreview.records.decisions > 0 || changePreview.records.risks > 0) && <div className="preview-records">{changePreview.records.decisions > 0 && <span>+{changePreview.records.decisions} karar kaydı</span>}{changePreview.records.risks > 0 && <span>+{changePreview.records.risks} risk kaydı</span>}</div>}
          </section>}
          <div className="bundle-actions"><span>{bundleResolved ? 'Bu karar turu plana işlendi; yukarıdan konuşmaya devam edebilirsin.' : pendingCount ? `${pendingCount} seçenek karar bekliyor · ${accepted} kabul` : `${accepted} seçenek plana uygulanacak`}</span><button disabled={!decisionComplete} className="primary" onClick={apply}>{accepted ? 'Seçimleri plana uygula' : 'Turu tamamla'} <ArrowRight size={17}/></button></div>
        </section>
        <aside className="plan-panel" aria-label="Yaşayan plan">
          <div className="readiness"><div className="score-ring" style={{ '--score': `${project.readiness.score * 3.6}deg` } as any}><span>{project.readiness.score}</span></div><div><span className="meta">HAZIRLIK SKORU</span><b>{project.readiness.score >= 80 ? 'Uygulamaya yakın' : project.readiness.score >= 50 ? 'Gelişiyor' : 'Şekilleniyor'}</b><small>{project.readiness.blockers.length} eksik · {project.readiness.warnings.length} uyarı</small></div><Gauge size={19}/></div>
          <div className="section-tabs">{Object.values(project.sections).filter((section: any) => section.required || section.content || section.items.length || impactedSections.has(section.id)).map((section: any) => <button key={section.id} aria-current={activeSection === section.id ? 'true' : undefined} className={`${activeSection === section.id ? 'active' : ''} ${impactedSections.has(section.id) ? 'impacted' : ''}`} onClick={() => setActiveSection(section.id)}><span className={`section-state ${section.status}`}/><span>{section.title}<small>{impactedSections.has(section.id) ? 'Uygulanınca değişecek' : section.items.length ? `${section.items.length} karar/öğe` : section.required ? 'Gerekli' : 'İsteğe bağlı'}</small></span></button>)}</div>
          {active && <div className="section-editor"><div className="editor-head"><div><span className="meta">PLAN BÖLÜMÜ</span><h2>{active.title}</h2></div><span>r{active.updatedAtRevision}</span></div><p className="section-description">{active.description}</p><textarea aria-label={`${active.title} canonical içeriği`} value={draft} onChange={event => setDraft(event.target.value)} rows={8} placeholder="Bu bölümün canonical içeriğini yaz..."/>{active.items.length > 0 && <ul>{active.items.map((item: string) => <li key={item}>{item}</li>)}</ul>}<button type="button" className="save-button" disabled={draft === active.content} onClick={saveSection}><Save size={16}/> Bölümü kaydet</button>{activeSection === 'tasks' && <div className="task-compiler"><button type="button" onClick={() => setTaskCompilation(compileTaskPlan(project))}><Sparkles size={15}/> Gereksinimlerden görev taslağı üret</button>{taskCompilation && <div className="task-compilation" role="region" aria-label="Görev planı önizlemesi"><b>{taskCompilation.tasks.length} görev · {taskCompilation.testCases.length} test · {taskCompilation.agentPrompts.length} ajan adımı</b>{taskCompilation.tasks.slice(0, 5).map((task: any) => <span key={task.id}>{task.title}<small>{task.priority} · {task.status}</small></span>)}{taskCompilation.warnings.map((warning: string) => <p key={warning}><CircleAlert size={13}/>{warning}</p>)}<div><button type="button" onClick={() => setTaskCompilation(null)}>Vazgeç</button><button type="button" className="primary" disabled={!taskCompilation.tasks.length} onClick={approveTaskPlan}><Check size={14}/> Taslağı onayla</button></div></div>}</div>}</div>}
          <details className="readiness-detail"><summary><CircleAlert size={16}/> Kalite uyarıları</summary>{[...project.readiness.blockers, ...project.readiness.warnings].map((item: string) => <p key={item}>{item}</p>)}</details>
          <ReviewPanel project={project} onCommit={commit}/>
          <ModulePanel project={project} onCommit={commit}/>
          <ExecutionPanel project={project} onCommit={commit}/>
          <StorageHealthPanel project={project} onCommit={commit}/>
          <ResearchPanel project={project} onCommit={commit}/>
          <button className="history-line" onClick={() => setHistoryOpen(true)}><History size={15}/><span>{project.revisions.length} kayıtlı değişiklik · Son sürüm r{project.revision}</span><ArrowRight size={14}/></button>
        </aside>
      </div>
    </main>
    <ProviderSettingsDialog open={settingsOpen} settings={providerSettings} onSave={onProviderSettings} onClose={() => setSettingsOpen(false)}/>
    <RevisionHistoryDialog open={historyOpen} project={project} onRestore={restoreRevision} onClose={() => setHistoryOpen(false)}/>
    <IdeExportDialog open={ideExportOpen} project={project} onCommit={commit} onClose={() => setIdeExportOpen(false)}/>
    <FinalizePlanDialog blockers={finalizationBlockers} onConfirm={forceFinish} onClose={() => setFinalizationBlockers([])}/>
    {notice && <div className="toast" role="status"><Check size={17}/>{notice}</div>}
  </div>;
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [appError, setAppError] = useState('');
  const [providerSettings, setProviderSettings] = useState(loadProviderSettings);
  const activeProject = useMemo(() => projects.find(project => project.id === activeId), [projects, activeId]);
  useEffect(() => { repository.list().then((items: Project[]) => { setProjects(items.filter(item => item.lifecycle.status !== 'archived')); setActiveId(null); }).finally(() => setLoading(false)); }, []);
  const persist = async (project: Project) => { const next = recalculateReadiness(project); await repository.save(next); setProjects(current => [next, ...current.filter(item => item.id !== next.id)]); setActiveId(next.id); };
  const create = async (idea: string, outputLanguage: string, files: File[], nativeInventory?: any) => {
    const inventory = nativeInventory || await analyzeSelectedFiles(files);
    const importedContext = projectInventoryContext(inventory);
    const project = analyzeIdea(idea, { outputLanguage, importedContext });
    project.profile.projectInventory = inventory;
    project.metadata.projectAnalysis = { version: inventory.version, analyzedAt: inventory.analyzedAt, includedFiles: inventory.totals.included, excludedFiles: inventory.totals.excluded };
    project.suggestionBundles = [];
    const credential = await credentialVault.get(providerSettings.providerId) || '';
    const discovery = await generateDiscoveryBundle(project, { settings: providerSettings, credential } as any);
    project.suggestionBundles.push(discovery.bundle);
    project.messages.push({ id: `msg-${Date.now()}`, role: 'assistant', content: discovery.bundle.title, createdAt: new Date().toISOString() });
    for (const question of discovery.bundle.openQuestions || []) if (!project.openQuestions.includes(question)) project.openQuestions.push(question);
    project.metadata.lastDiscoveryProvider = discovery.bundle.source;
    await persist(captureCurrentRevision(project));
  };
  const importPackage = async (file: File) => {
    try { await persist(await readPromtgenPackage(file)); }
    catch (error) {
      setAppError(error instanceof Error ? error.message : 'Paket açılamadı.');
      window.setTimeout(() => setAppError(''), 4200);
    }
  };
  if (loading) return <div className="loading"><Sparkles/> PromtGen hazırlanıyor…</div>;
  if (!activeProject) return <><StartScreen onCreate={create} onImport={importPackage} projects={projects} onOpen={setActiveId} providerSettings={providerSettings} onProviderSettings={setProviderSettings}/>{appError && <div className="toast error" role="alert"><CircleAlert size={17}/>{appError}</div>}</>;
  return <Workspace project={activeProject} projects={projects} onProject={setActiveId} onNew={() => setActiveId(null)} onPersist={persist} providerSettings={providerSettings} onProviderSettings={setProviderSettings}/>;
}
