import { useEffect, useState } from 'react';
import { ArchiveRestore, Check, ChevronDown, CircleAlert, Database, LoaderCircle, ShieldCheck } from 'lucide-react';
import { getDesktopStorageHealth, isDesktopStorageAvailable, listDesktopProjectBackups, listDesktopQuarantinedProjects, restoreDesktopProjectBackup } from '../../v4/tauri-storage.js';

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function StorageHealthPanel({ project, onCommit }: any) {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [quarantine, setQuarantine] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const desktop = isDesktopStorageAvailable();

  const refresh = async () => {
    if (!desktop) return;
    try {
      const [nextHealth, nextBackups, nextQuarantine] = await Promise.all([getDesktopStorageHealth(), listDesktopProjectBackups(project.id), listDesktopQuarantinedProjects()]);
      setHealth(nextHealth); setBackups(nextBackups); setQuarantine(nextQuarantine); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Depolama sağlığı okunamadı.'); }
  };
  useEffect(() => { refresh(); }, [desktop, project.id, project.revision]);

  if (!desktop) return null;
  const restore = async (backupId: number) => {
    setBusy(true); setError('');
    try {
      const restored = await restoreDesktopProjectBackup(project, backupId);
      if (restored) onCommit(restored, `Yerel yedek yeni r${restored.revision} revision'ı olarak geri yüklendi.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Yedek geri yüklenemedi.'); }
    finally { setBusy(false); }
  };

  return <section className="storage-health-panel">
    <button type="button" className="panel-summary" aria-expanded={open} onClick={() => setOpen(value => !value)}><Database size={16}/><span><b>Yerel veri sağlığı</b><small>{health ? `${health.projectCount} proje · ${health.backupCount} yedek${health.quarantineCount ? ` · ${health.quarantineCount} karantina` : ''}` : 'Kontrol ediliyor'}</small></span>{health?.ok ? <Check className="health-ok" size={15}/> : <CircleAlert className="health-bad" size={15}/>}<ChevronDown className={open ? 'open' : ''} size={15}/></button>
    {open && <div className="storage-health-body">
      {health && <div className="storage-health-grid"><span><ShieldCheck size={14}/><b>{health.quickCheck === 'ok' ? 'SQLite bütünlüğü sağlam' : health.quickCheck}</b></span><span>WAL: {String(health.journalMode).toUpperCase()}</span><span>Veritabanı: {formatBytes(health.databaseBytes)}</span></div>}
      {quarantine.length > 0 && <p className="quarantine-notice"><CircleAlert size={14}/><span><b>{quarantine.length} bozuk kayıt izole edildi</b><small>Ham içerik uygulamaya yüklenmedi; yerel karantina tablosunda korunuyor.</small></span></p>}
      <div className="backup-list"><span className="meta">SON YEDEKLER</span>{backups.length ? backups.slice(0, 5).map(backup => <div key={backup.id}><span><b>r{backup.revision}</b><small>{backup.createdAt} · {formatBytes(backup.bytes)}</small></span><button type="button" disabled={busy} onClick={() => restore(backup.id)}>{busy ? <LoaderCircle className="spin" size={13}/> : <ArchiveRestore size={13}/>} Geri yükle</button></div>) : <small>İkinci kayıttan itibaren önceki belge otomatik yedeklenir.</small>}</div>
      {error && <p className="storage-health-error" role="alert">{error}</p>}
    </div>}
  </section>;
}
