import { useEffect, useRef, useState } from 'react';
import { Bot, Check, CircleAlert, Database, FolderSearch, Gauge, GitBranch, Info, LoaderCircle, RefreshCw, RotateCcw, Terminal, Wifi, X } from 'lucide-react';
import { buildRuntimeHealthReport } from '../../v4/runtime-health.js';
import { testProviderConnection } from '../../v4/ai-discovery.js';
import { getProviderMeta } from '../../v4/provider-settings.js';
import { getDesktopStorageHealth, isDesktopStorageAvailable } from '../../v4/tauri-storage.js';
import { clearCodexCli, getExecutionCapabilities, nativeExecutionAvailable, selectCodexCli } from '../../v4/desktop-execution.js';
import { IconButton } from './WorkspaceChrome';

const icons: Record<string, any> = { storage: Database, git: GitBranch, codex: Terminal, ollama: Wifi, provider: Bot, desktop: Info };

async function probeOllama() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 1800);
  try {
    return await testProviderConnection({ providerId: 'ollama', model: 'llama3.2', baseUrl: 'http://127.0.0.1:11434' }, '', controller.signal);
  } finally { window.clearTimeout(timeout); }
}

export function RuntimeHealthDialog({ open, settings, credential, onClose }: any) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [report, setReport] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [testingProvider, setTestingProvider] = useState(false);
  const [executionCapabilities, setExecutionCapabilities] = useState<any>(null);
  const [nativeError, setNativeError] = useState('');
  const desktop = nativeExecutionAvailable();
  const provider = getProviderMeta(settings.providerId);

  const scan = async (providerConnection: any = null) => {
    setBusy(true);
    try {
      const [storage, execution, ollama] = await Promise.all([
        isDesktopStorageAvailable() ? getDesktopStorageHealth().catch(() => null) : Promise.resolve(null),
        desktop ? getExecutionCapabilities().catch(() => null) : Promise.resolve(null),
        probeOllama().catch(() => null)
      ]);
      setExecutionCapabilities(execution);
      setReport(buildRuntimeHealthReport({
        desktop,
        indexedDbAvailable: typeof indexedDB !== 'undefined',
        storage,
        execution,
        ollama,
        providerSettings: settings,
        hasProviderCredential: Boolean(credential),
        providerConnection: providerConnection as any
      }));
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (!open) return;
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
    scan();
  }, [open, settings.providerId, settings.model, settings.baseUrl, credential]);

  const close = () => { dialogRef.current?.close(); onClose(); };
  const testSelectedProvider = async () => {
    setTestingProvider(true);
    try { await scan(await testProviderConnection(settings, credential)); }
    finally { setTestingProvider(false); }
  };
  const chooseCodex = async () => {
    setBusy(true); setNativeError('');
    try {
      const selected = await selectCodexCli();
      if (selected) {
        window.dispatchEvent(new Event('promtgen:execution-settings-changed'));
        await scan();
      }
    } catch (value) { setNativeError(value instanceof Error ? value.message : String(value)); }
    finally { setBusy(false); }
  };
  const usePathCodex = async () => {
    setBusy(true); setNativeError('');
    try {
      await clearCodexCli();
      window.dispatchEvent(new Event('promtgen:execution-settings-changed'));
      await scan();
    } catch (value) { setNativeError(value instanceof Error ? value.message : String(value)); }
    finally { setBusy(false); }
  };

  return <dialog ref={dialogRef} className="runtime-health-dialog" aria-labelledby="runtime-health-title" onCancel={close} onClose={onClose}>
    <div className="dialog-head"><div className="dialog-icon"><Gauge size={20}/></div><div><span className="meta">LOCAL-FIRST SİSTEM DOKTORU</span><h2 id="runtime-health-title">Çalışma ortamı sağlığı</h2></div><IconButton label="Sistem doktorunu kapat" onClick={close}><X size={18}/></IconButton></div>
    <p className="dialog-lead">Yerel depolama ve araçları tek yerde kontrol eder. İlk tarama yalnız cihazındaki loopback servislerine erişir; bulut sağlayıcısı ayrıca onayladığında test edilir.</p>
    <div className="runtime-health-summary" aria-live="polite">
      {busy && !report ? <><LoaderCircle className="spin" size={20}/><span><b>Sistem kontrol ediliyor</b><small>Yerel servisler ve depolama okunuyor…</small></span></> : report && <><span className={report.summary.readyForPlanning ? 'ready' : 'blocked'}>{report.summary.readyForPlanning ? <Check size={20}/> : <CircleAlert size={20}/>}</span><span><b>{report.summary.readyForPlanning ? 'Planlama için hazır' : 'Müdahale gereken alanlar var'}</b><small>{report.summary.errors} hata · {report.summary.warnings} uyarı · Native ajan {report.summary.readyForNativeExecution ? 'hazır' : 'opsiyonel/kapalı'}</small></span></>}
    </div>
    <div className="runtime-health-list">{report?.checks.map((item: any) => {
      const Icon = icons[item.id] || Info;
      return <article key={item.id} className={`runtime-check ${item.status}`}><span className="runtime-check-icon"><Icon size={17}/></span><span><b>{item.label}</b><small>{item.detail}</small>{item.recommendation && <em>{item.recommendation}</em>}</span><i>{item.status === 'ok' ? <Check size={15}/> : item.status === 'error' || item.status === 'warning' ? <CircleAlert size={15}/> : <Info size={15}/>}</i></article>;
    })}</div>
    {desktop && <div className="codex-cli-config"><span><Terminal size={17}/><span><b>Codex CLI kaynağı</b><small>{executionCapabilities?.customCodexConfigured ? 'Doğrulanmış kullanıcı seçimi kullanılıyor.' : 'Varsayılan PATH algılaması kullanılıyor.'}</small></span></span><div><button type="button" disabled={busy} onClick={chooseCodex}><FolderSearch size={15}/> {executionCapabilities?.customCodexConfigured ? 'Seçimi değiştir' : 'Codex CLI seç'}</button>{executionCapabilities?.customCodexConfigured && <button type="button" disabled={busy} onClick={usePathCodex}><RotateCcw size={15}/> PATH’e dön</button>}</div></div>}
    {nativeError && <p className="execution-error runtime-native-error" role="alert"><CircleAlert size={14}/>{nativeError}</p>}
    <div className="dialog-actions runtime-health-actions">
      <button type="button" disabled={busy} onClick={() => scan()}>{busy ? <LoaderCircle className="spin" size={16}/> : <RefreshCw size={16}/>} Yeniden tara</button>
      {!['offline', 'ollama'].includes(provider.id) && <button type="button" className="primary" disabled={busy || testingProvider || (provider.credentialRequired && !credential)} onClick={testSelectedProvider}>{testingProvider ? <LoaderCircle className="spin" size={16}/> : <Wifi size={16}/>} {provider.label} bağlantısını test et</button>}
    </div>
  </dialog>;
}
