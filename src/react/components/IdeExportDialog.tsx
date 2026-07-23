import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Code2, Download, FileCode2, LoaderCircle, ShieldCheck, X } from 'lucide-react';
import { createIdeWorkspaceFiles, createIdeWorkspacePackage, downloadBlob, IDE_ADAPTERS } from '../../v4/exporter.js';
import { IconButton } from './WorkspaceChrome';

export function IdeExportDialog({ open, project, onCommit, onClose }: any) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [revision, setRevision] = useState<any>('current');
  const [adapters, setAdapters] = useState<string[]>(['generic', 'codex', 'cursor', 'claude']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const revisionOptions = useMemo(() => [...(project.revisions || [])].filter((item: any) => item.snapshot).sort((a: any, b: any) => b.number - a.number), [project.revisions]);
  const preview = useMemo(() => createIdeWorkspaceFiles(project, { revision, adapters }), [project, revision, adapters]);

  useEffect(() => {
    if (!open) return;
    setRevision('current'); setError('');
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }, [open, project.id]);

  const close = () => { dialogRef.current?.close(); onClose(); };
  const toggleAdapter = (id: string) => {
    setAdapters(current => current.includes(id) ? (current.length === 1 ? current : current.filter(item => item !== id)) : [...current, id]);
    setError('');
  };
  const download = async () => {
    setBusy(true); setError('');
    try {
      const result = await createIdeWorkspacePackage(project, { revision, adapters });
      downloadBlob(result.blob, result.filename);
      const next = structuredClone(project);
      next.exports = [...(next.exports || []), result.record];
      next.lifecycle.updatedAt = new Date().toISOString();
      onCommit(next, `r${result.record.revision} IDE çalışma paketi oluşturuldu.`);
      close();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'IDE paketi oluşturulamadı.'); }
    finally { setBusy(false); }
  };

  return <dialog ref={dialogRef} className="ide-export-dialog" aria-labelledby="ide-export-title" onCancel={close} onClose={onClose}>
    <div className="dialog-head"><div className="dialog-icon"><Code2 size={20}/></div><div><span className="meta">IDE ÇALIŞMA PAKETİ</span><h2 id="ide-export-title">Planı kodlama ortamına taşı</h2></div><IconButton label="IDE paketini kapat" onClick={close}><X size={18}/></IconButton></div>
    <p className="dialog-lead">Seçtiğin canonical revision; görev bağımlılıkları, doğrulama sözleşmesi ve IDE’nin otomatik okuyacağı talimat dosyalarıyla tek bir ZIP’e dönüştürülür.</p>
    <div className="ide-export-body">
      <label className="ide-revision">Kaynak plan sürümü<select value={revision} onChange={event => setRevision(event.target.value)}><option value="current">Güncel r{project.revision}</option>{revisionOptions.filter((item: any) => item.number !== project.revision).map((item: any) => <option key={item.id} value={item.id}>r{item.number} — {item.summary}</option>)}</select></label>
      <fieldset className="ide-adapters"><legend>Hedefler</legend>{IDE_ADAPTERS.map(adapter => <label key={adapter.id} className={adapters.includes(adapter.id) ? 'active' : ''}><input type="checkbox" checked={adapters.includes(adapter.id)} onChange={() => toggleAdapter(adapter.id)}/><span className="ide-check">{adapters.includes(adapter.id) && <Check size={12}/>}</span><span><b>{adapter.label}</b><small>{adapter.path}</small></span></label>)}</fieldset>
      <section className="ide-file-preview" aria-label="Üretilecek dosyalar"><div><span className="meta">DOSYA ÖNİZLEMESİ</span><b>{Object.keys(preview.files).length + 1} dosya · canonical r{preview.source.revision}</b></div>{Object.keys(preview.files).map(path => <span key={path}><FileCode2 size={14}/>{path}</span>)}<span><ShieldCheck size={14}/>.promtgen/manifest.json <small>SHA-256 kaynak kimliği</small></span></section>
      {preview.source.lifecycle.status !== 'finalized' && <p className="ide-draft-warning"><ShieldCheck size={16}/> Bu revision henüz final değil. Paket bunu manifestte açıkça işaretler; ajanlardan kapsam değişikliklerinde kullanıcı onayı ister.</p>}
      {error && <p className="ide-export-error" role="alert">{error}</p>}
    </div>
    <div className="dialog-actions"><button type="button" onClick={close}>Vazgeç</button><button type="button" className="primary" disabled={busy || adapters.length === 0} onClick={download}>{busy ? <LoaderCircle className="spin" size={16}/> : <Download size={16}/>} ZIP paketini indir</button></div>
  </dialog>;
}
