import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, History, RotateCcw, X } from 'lucide-react';
import { comparePlanRevisions } from '../../v4/planning-engine.js';
import { IconButton } from './WorkspaceChrome.js';

interface RevisionHistoryDialogProps {
  open: boolean;
  project: any;
  onRestore: (reference: string) => void;
  onClose: () => void;
}

export function RevisionHistoryDialog({ open, project, onRestore, onClose }: RevisionHistoryDialogProps) {
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

  return (
    <dialog ref={dialogRef} className="revision-dialog" aria-labelledby="revision-dialog-title" onCancel={close} onClose={onClose}>
      <div className="dialog-head"><div className="dialog-icon"><History size={20} /></div><div><span className="meta">SÜRÜM GEÇMİŞİ</span><h2 id="revision-dialog-title">Plan revision'larını karşılaştır</h2></div><IconButton label="Geçmişi kapat" onClick={close}><X size={18} /></IconButton></div>
      <div className="revision-body">
        {revisions.length === 0 ? <div className="empty-history"><History size={25} /><b>Henüz karşılaştırılabilir snapshot yok</b><p>İlk plan değişikliğinden sonra revision geçmişi burada görünecek.</p></div> : <>
          <div className="revision-selectors">
            <label htmlFor="revision-from">Eski sürüm<select id="revision-from" value={from} onChange={event => { setFrom(event.target.value); setConfirmRestore(false); }}>{revisions.map((revision: any) => <option key={revision.id} value={revision.id}>r{revision.number} — {revision.summary}</option>)}</select></label>
            <ArrowRight size={18} />
            <label htmlFor="revision-to">Yeni sürüm<select id="revision-to" value={to} onChange={event => setTo(event.target.value)}><option value="current">r{project.revision} — Güncel plan</option>{revisions.map((revision: any) => <option key={revision.id} value={revision.id}>r{revision.number} — {revision.summary}</option>)}</select></label>
          </div>
          {comparison.valid && <div className="revision-summary" role="status" aria-live="polite"><span><b>{comparison.summary.changedSections}</b> bölüm</span><span className="added"><b>+{comparison.summary.addedLines + comparison.summary.addedItems}</b> ekleme</span><span className="removed"><b>−{comparison.summary.removedLines + comparison.summary.removedItems}</b> kaldırma</span></div>}
          <div className="revision-diffs">
            {comparison.valid && comparison.sections.length === 0 && <p className="no-diff">Seçilen revision'lar arasında canonical plan farkı yok.</p>}
            {comparison.sections.map((section: any) => <details key={section.sectionId} open><summary><span><b>{section.title}</b><small>{section.beforeStatus} → {section.afterStatus}</small></span><ChevronDown size={15} /></summary><div className="line-diff" aria-label={`${section.title} satır farkları`}>{section.content.map((line: any, index: number) => <div key={`${line.type}-${index}`} className={line.type}><span>{line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}</span><code>{line.text || ' '}</code></div>)}</div>{(section.addedItems.length > 0 || section.removedItems.length > 0) && <div className="item-diff">{section.removedItems.map((item: string) => <p className="removed" key={`removed-${item}`}>− {item}</p>)}{section.addedItems.map((item: string) => <p className="added" key={`added-${item}`}>+ {item}</p>)}</div>}</details>)}
          </div>
        </>}
      </div>
      {revisions.length > 0 && <div className="revision-actions">{confirmRestore ? <div className="restore-confirm" role="alert"><span><b>r{selectedRevision?.number} planı geri yüklensin mi?</b><small>Mevcut geçmiş ve exportlar korunacak; sonuç r{project.revision + 1} olarak kaydedilecek.</small></span><button onClick={() => { onRestore(from); close(); }}>Evet, yeni revision oluştur</button><button onClick={() => setConfirmRestore(false)}>Vazgeç</button></div> : <><span>Geri yükleme mevcut planın üzerine yazmaz.</span><button disabled={!selectedRevision || selectedRevision.number === project.revision} onClick={() => setConfirmRestore(true)}><RotateCcw size={15} /> Seçili sürümü geri yükle</button></>}</div>}
    </dialog>
  );
}
