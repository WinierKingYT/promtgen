import { useEffect, useState } from 'react';
import { ArchiveRestore, Check, ChevronDown, CircleAlert, Database, LoaderCircle, ShieldCheck } from 'lucide-react';
import { getDesktopStorageHealth, isDesktopStorageAvailable, listDesktopProjectBackups, listDesktopQuarantinedProjects, restoreDesktopProjectBackup } from '../../v4/tauri-storage.js';
import { listWebProjectCheckpoints, listWebQuarantinedProjects, restoreWebProjectCheckpoint } from '../../v4/storage.js';

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
    try {
      const [nextHealth, nextBackups, nextQuarantine] = (desktop
        ? await Promise.all([getDesktopStorageHealth(), listDesktopProjectBackups(project.id), listDesktopQuarantinedProjects()])
        : await Promise.all([
            Promise.resolve({ ok: true, projectCount: 1, backupCount: 0, quarantineCount: 0, quickCheck: 'sha-256', journalMode: 'indexeddb', databaseBytes: 0 }),
            listWebProjectCheckpoints(project.id),
            listWebQuarantinedProjects()
          ])) as [any, any[], any[]];
      if (!desktop) {
        nextHealth.backupCount = nextBackups.length;
        nextHealth.quarantineCount = nextQuarantine.length;
      }
      setHealth(nextHealth); setBackups(nextBackups); setQuarantine(nextQuarantine); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Depolama sağlığı okunamadı.'); }
  };
  useEffect(() => { refresh(); }, [desktop, project.id, project.documentRevision]);

  const restore = async (backupId: string) => {
    setBusy(true); setError('');
    try {
      const restored = desktop
        ? await restoreDesktopProjectBackup(project, backupId)
        : await restoreWebProjectCheckpoint(project, backupId);
      if (restored) onCommit(restored, `Yerel yedek yeni r${restored.canonicalRevision} canonical revision'ı olarak geri yüklendi.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Yedek geri yüklenemedi.'); }
    finally { setBusy(false); }
  };

  return <section className="storage-health-panel">
    <button type="button" className="panel-summary" aria-expanded={open} onClick={() => setOpen(value => !value)}><Database size={16}/><span><b>Yerel veri sağlığı</b><small>{health ? `${health.projectCount} proje · ${health.backupCount} yedek${health.quarantineCount ? ` · ${health.quarantineCount} karantina` : ''}` : 'Kontrol ediliyor'}</small></span>{health?.ok ? <Check className="health-ok" size={15}/> : <CircleAlert className="health-bad" size={15}/>}<ChevronDown className={open ? 'open' : ''} size={15}/></button>
    {open && <div className="storage-health-body">
      {health && <div className="storage-health-grid"><span><ShieldCheck size={14}/><b>{health.quickCheck === 'ok' ? 'SQLite bütünlüğü sağlam' : health.quickCheck === 'sha-256' ? 'SHA-256 checkpoint doğrulaması' : health.quickCheck}</b></span><span>{desktop ? `WAL: ${String(health.journalMode).toUpperCase()}` : 'IndexedDB kalıcı store'}</span>{desktop && <span>Veritabanı: {formatBytes(health.databaseBytes)}</span>}</div>}
      {quarantine.length > 0 && <p className="quarantine-notice"><CircleAlert size={14}/><span><b>{quarantine.length} bozuk kayıt izole edildi</b><small>Ham içerik uygulamaya yüklenmedi; yerel karantina tablosunda korunuyor.</small></span></p>}
      <div className="backup-list"><span className="meta">SON CHECKPOINTLER</span>{backups.length ? backups.slice(0, 5).map(backup => <div key={backup.id}><span><b>r{backup.revision}</b><small>{backup.createdAt}{backup.bytes ? ` · ${formatBytes(backup.bytes)}` : ` · ${backup.checksumAlgorithm}`}</small></span><button type="button" disabled={busy} onClick={() => restore(backup.id)}>{busy ? <LoaderCircle className="spin" size={13}/> : <ArchiveRestore size={13}/>} Yeni revision olarak yükle</button></div>) : <small>İlk kayıtla birlikte kalıcı checkpoint oluşturulur.</small>}</div>
      {error && <p className="storage-health-error" role="alert">{error}</p>}
    </div>}
  </section>;
}
