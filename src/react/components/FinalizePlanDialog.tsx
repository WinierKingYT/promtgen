import { useEffect, useRef } from 'react';
import { CircleAlert, X } from 'lucide-react';
import { IconButton } from './WorkspaceChrome.js';

interface FinalizePlanDialogProps {
  blockers: string[];
  onClose: () => void;
}

export function FinalizePlanDialog({ blockers, onClose }: FinalizePlanDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const open = blockers.length > 0;

  useEffect(() => {
    if (open && !dialogRef.current?.open) dialogRef.current?.showModal();
    if (!open && dialogRef.current?.open) dialogRef.current.close();
  }, [open]);

  const close = () => { dialogRef.current?.close(); onClose(); };

  return (
    <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby="finalize-dialog-title" aria-describedby="finalize-dialog-description" onCancel={close} onClose={onClose}>
      <div className="dialog-head"><div className="dialog-icon warning"><CircleAlert size={20} /></div><div><span className="meta">PLAN TAMAMLAMA KAPISI</span><h2 id="finalize-dialog-title">Plan henüz finalleştirilemez</h2></div><IconButton label="Finalizasyon uyarısını kapat" onClick={close}><X size={18} /></IconButton></div>
      <div className="confirm-body">
        <p id="finalize-dialog-description">{blockers.length} kritik koşul tamamlanmadı. Bu engeller veri ve kapsam tutarlılığını koruduğu için atlanamaz; normal uyarılar finalizasyonu engellemez.</p>
        <ul>{blockers.slice(0, 8).map(blocker => <li key={blocker}>{blocker}</li>)}</ul>
        {blockers.length > 8 && <small>+{blockers.length - 8} ek uyarı</small>}
      </div>
      <div className="dialog-actions"><button type="button" className="primary" onClick={close}>Planı geliştirmeye devam et</button></div>
    </dialog>
  );
}
