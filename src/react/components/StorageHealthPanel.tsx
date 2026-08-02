import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, CircleAlert, Database, Eye, LoaderCircle, RotateCcw, ShieldCheck, X } from 'lucide-react';
import type { ProjectDocumentV5 } from '../../v4/contracts.js';
import {
  getDesktopStorageHealth,
  isDesktopStorageAvailable,
  listDesktopProjectBackups,
  listDesktopQuarantinedProjects,
  loadDesktopProjectBackup,
  restoreStorageBackupAsNewRevision,
  type DesktopBackupSummary,
  type DesktopQuarantineSummary,
  type StorageHealthSummary
} from '../../v4/tauri-storage.js';
import {
  listWebProjectCheckpoints,
  listWebQuarantinedProjects,
  loadWebProjectCheckpoint,
  restoreCheckpointAsNewRevision
} from '../../v4/storage.js';
import {
  assertRecoveryPreviewFresh,
  buildRecoveryPreview,
  type RecoveryPreview
} from '../../v4/application/recovery-service.js';

type WebBackupSummary = Awaited<ReturnType<typeof listWebProjectCheckpoints>>[number];
type WebQuarantineSummary = Awaited<ReturnType<typeof listWebQuarantinedProjects>>[number];
type BackupSummary = DesktopBackupSummary | WebBackupSummary;
type QuarantineSummary = DesktopQuarantineSummary | WebQuarantineSummary;

interface StorageHealthPanelProps {
  project: ProjectDocumentV5;
  onCommit: (project: ProjectDocumentV5, message?: string, commandType?: string) => Promise<boolean | void> | boolean | void;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function backupBytes(backup: BackupSummary): number | null {
  return 'bytes' in backup ? backup.bytes : null;
}

function backupAlgorithm(backup: BackupSummary): string {
  return 'checksumAlgorithm' in backup ? backup.checksumAlgorithm : 'SQLite doğrulaması';
}

export function StorageHealthPanel({ project, onCommit }: StorageHealthPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<StorageHealthSummary | null>(null);
  const [backups, setBackups] = useState<BackupSummary[]>([]);
  const [quarantine, setQuarantine] = useState<QuarantineSummary[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [candidate, setCandidate] = useState<ProjectDocumentV5 | null>(null);
  const [preview, setPreview] = useState<RecoveryPreview | null>(null);
  const desktop = isDesktopStorageAvailable();

  const refresh = async () => {
    try {
      if (desktop) {
        const [nextHealth, nextBackups, nextQuarantine] = await Promise.all([
          getDesktopStorageHealth(),
          listDesktopProjectBackups(project.id),
          listDesktopQuarantinedProjects()
        ]);
        setHealth(nextHealth);
        setBackups(nextBackups);
        setQuarantine(nextQuarantine.filter(record => record.projectId === project.id));
      } else {
        const [nextBackups, nextQuarantine] = await Promise.all([
          listWebProjectCheckpoints(project.id),
          listWebQuarantinedProjects()
        ]);
        const projectQuarantine = nextQuarantine.filter(record => record.projectId === project.id);
        setHealth({
          ok: true,
          projectCount: 1,
          backupCount: nextBackups.length,
          quarantineCount: projectQuarantine.length,
          quickCheck: 'sha-256',
          journalMode: 'indexeddb',
          databaseBytes: 0
        });
        setBackups(nextBackups);
        setQuarantine(projectQuarantine);
      }
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Yerel kurtarma kayıtları okunamadı.');
    }
  };

  useEffect(() => { void refresh(); }, [desktop, project.id, project.documentRevision]);
  useEffect(() => {
    if (preview && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [preview]);

  const closePreview = () => {
    if (dialogRef.current?.open) dialogRef.current.close();
    else {
      setPreview(null);
      setCandidate(null);
    }
  };

  const inspect = async (backup: BackupSummary) => {
    const backupId = String(backup.id);
    setBusyId(backupId);
    setError('');
    try {
      const nextCandidate = desktop
        ? await loadDesktopProjectBackup(project, Number(backup.id))
        : await loadWebProjectCheckpoint(project, backupId);
      const nextPreview = buildRecoveryPreview(
        project,
        nextCandidate,
        desktop ? 'desktop-backup' : 'web-checkpoint',
        desktop ? 'validated' : 'verified'
      );
      setCandidate(nextCandidate);
      setPreview(nextPreview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kurtarma kaydı incelenemedi.');
    } finally {
      setBusyId(null);
    }
  };

  const restore = async () => {
    if (!candidate || !preview) return;
    setBusyId('restore');
    setError('');
    try {
      assertRecoveryPreviewFresh(project, preview);
      const restored = desktop
        ? restoreStorageBackupAsNewRevision(project, candidate)
        : restoreCheckpointAsNewRevision(project, candidate);
      const persisted = await onCommit(
        restored,
        `Yedek, yeni plan sürümü r${restored.canonicalRevision} olarak geri yüklendi; önceki sürümler korunuyor.`,
        'RestoreCheckpoint'
      );
      if (persisted === false) throw new Error('Geri yüklenen revision kaydedilemedi; güncel proje değiştirilmedi.');
      closePreview();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kurtarma kaydı geri yüklenemedi.');
    } finally {
      setBusyId(null);
    }
  };

  return <>
    <section className="storage-health-panel" aria-label="Kurtarma Merkezi">
      <button type="button" className="panel-summary" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <Database size={16}/>
        <span><b>Kurtarma Merkezi</b><small>{health ? `${health.backupCount} checkpoint${health.quarantineCount ? ` · ${health.quarantineCount} karantina` : ''}` : 'Yerel kayıtlar kontrol ediliyor'}</small></span>
        {health?.ok ? <Check className="health-ok" size={15}/> : <CircleAlert className="health-bad" size={15}/>}
        <ChevronDown className={open ? 'open' : ''} size={15}/>
      </button>
      {open && <div className="storage-health-body">
        <p className="recovery-intro">Bir kaydı önce doğrula ve farklarını incele. Onay verirsen güncel proje korunur; sonuç yeni revision olarak kaydedilir.</p>
        {health && <div className="storage-health-grid">
          <span><ShieldCheck size={14}/><b>{health.quickCheck === 'ok' ? 'SQLite bütünlüğü sağlam' : health.quickCheck === 'sha-256' ? 'SHA-256 checkpoint doğrulaması' : health.quickCheck}</b></span>
          <span>{desktop ? `WAL: ${String(health.journalMode).toUpperCase()}` : 'IndexedDB kalıcı store'}</span>
          {desktop && <span>Veritabanı: {formatBytes(health.databaseBytes)}</span>}
        </div>}
        {quarantine.length > 0 && <div className="quarantine-list">
          <p className="quarantine-notice"><CircleAlert size={14}/><span><b>{quarantine.length} bozuk kayıt izole edildi</b><small>Ham içerik yüklenmedi; yalnız güvenli metadata gösteriliyor.</small></span></p>
          {quarantine.slice(0, 3).map(record => <div key={record.id}><span>{record.reason}</span><small>{new Date(record.quarantinedAt).toLocaleString()}{'bytes' in record ? ` · ${formatBytes(record.bytes)}` : ''}</small></div>)}
        </div>}
        <div className="backup-list"><span className="meta">SON CHECKPOINTLER</span>
          {backups.length ? backups.slice(0, 5).map(backup => {
            const id = String(backup.id);
            const bytes = backupBytes(backup);
            return <div key={id}>
              <span><b>Belge r{backup.revision}</b><small>{new Date(backup.createdAt).toLocaleString()} · {bytes === null ? backupAlgorithm(backup) : formatBytes(bytes)}</small></span>
              <button type="button" disabled={busyId !== null} onClick={() => void inspect(backup)}>{busyId === id ? <LoaderCircle className="spin" size={13}/> : <Eye size={13}/>} Farkı incele</button>
            </div>;
          }) : <small>İlk kayıtla birlikte kalıcı checkpoint oluşturulur.</small>}
        </div>
        {error && <p className="storage-health-error" role="alert">{error}</p>}
      </div>}
    </section>

    {preview && <dialog
      ref={dialogRef}
      className="recovery-dialog"
      aria-labelledby="recovery-dialog-title"
      aria-describedby="recovery-dialog-description"
      onCancel={event => { event.preventDefault(); if (!busyId) closePreview(); }}
      onClose={() => { setPreview(null); setCandidate(null); }}
    >
      <div className="dialog-head"><div className="dialog-icon"><RotateCcw size={20}/></div><div><span className="meta">KURTARMA ÖNİZLEMESİ</span><h2 id="recovery-dialog-title">r{preview.sourceCanonicalRevision} kaydını incele</h2></div><button type="button" className="icon-button" aria-label="Kurtarma önizlemesini kapat" disabled={busyId === 'restore'} onClick={closePreview}><X size={18}/></button></div>
      <div className="recovery-dialog-body">
        <p id="recovery-dialog-description">Bu işlem güncel r{preview.expectedCanonicalRevision} planının üzerine yazmaz. Onaydan sonra r{preview.nextCanonicalRevision} oluşturulur; mevcut export ve yürütme geçmişi korunur.</p>
        <div className="recovery-verification"><ShieldCheck size={17}/><span><b>{preview.integrity === 'verified' ? 'SHA-256 bütünlüğü doğrulandı' : 'SQLite kaydı ve proje şeması doğrulandı'}</b><small>{preview.source === 'web-checkpoint' ? 'Web checkpoint' : 'Masaüstü SQLite yedeği'} · belge r{preview.sourceDocumentRevision}</small></span></div>
        {!preview.canRestore && <p className="storage-health-error" role="alert">{preview.reason}</p>}
        {preview.documentChanges.length > 0 && <section className="recovery-change-group"><h3>Belge değişiklikleri</h3><ul>{preview.documentChanges.map(label => <li key={label}>{label}</li>)}</ul></section>}
        {preview.sections.length > 0 && <section className="recovery-change-group"><h3>Plan bölümleri</h3><div>{preview.sections.map(section => <article key={section.sectionId}><b>{section.title}</b><small>+{section.addedLines + section.addedItems} · −{section.removedLines + section.removedItems}{section.statusChanged ? ' · durum değişecek' : ''}</small></article>)}</div></section>}
        {preview.entities.length > 0 && <section className="recovery-change-group"><h3>Plan kayıtları</h3><div>{preview.entities.map(entity => <article key={entity.key}><b>{entity.label}</b><small>{entity.beforeCount} → {entity.afterCount} · +{entity.added} −{entity.removed} ~{entity.changed}</small></article>)}</div></section>}
        {error && <p className="storage-health-error" role="alert">{error}</p>}
      </div>
      <div className="dialog-actions"><button type="button" disabled={busyId === 'restore'} onClick={closePreview}>Vazgeç</button><button type="button" className="primary" disabled={!preview.canRestore || busyId === 'restore'} onClick={() => void restore()}>{busyId === 'restore' ? <LoaderCircle className="spin" size={15}/> : <RotateCcw size={15}/>} Yeni revision olarak geri yükle</button></div>
    </dialog>}
  </>;
}
