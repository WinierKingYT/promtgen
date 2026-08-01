import { useEffect, useRef, useState } from 'react';
import { CircleAlert, LoaderCircle, Trash2 } from 'lucide-react';

interface ProjectDeleteDialogProps {
  projectName: string;
  onConfirm: () => Promise<boolean>;
  onClose: () => void;
}

export function ProjectDeleteDialog({ projectName, onConfirm, onClose }: ProjectDeleteDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    requestAnimationFrame(() => cancelRef.current?.focus());
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const confirm = async () => {
    setDeleting(true);
    try {
      if (await onConfirm()) onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="project-delete-dialog"
      aria-labelledby="project-delete-title"
      aria-describedby="project-delete-description"
      onCancel={event => {
        event.preventDefault();
        if (!deleting) onClose();
      }}
      onClose={onClose}
    >
      <div className="project-delete-icon" aria-hidden="true"><CircleAlert size={22} /></div>
      <div>
        <span className="meta">GERİ ALINAMAZ İŞLEM</span>
        <h2 id="project-delete-title">“{projectName}” kalıcı olarak silinsin mi?</h2>
      </div>
      <p id="project-delete-description">
        Proje belgesiyle birlikte yerel checkpoint'ler, komut geçmişi, karantina kayıtları ve masaüstü yedekleri silinir. Bu işlem geri alınamaz.
      </p>
      <div className="project-delete-scope" role="list" aria-label="Silinecek yerel veriler">
        {['Proje ve revision geçmişi', 'Checkpoint ve kurtarma kayıtları', 'Komut geçmişi ve karantina', 'Masaüstü SQLite yedekleri'].map(item => (
          <span key={item} role="listitem"><Trash2 size={13} /> {item}</span>
        ))}
      </div>
      <div className="project-delete-actions">
        <button ref={cancelRef} type="button" disabled={deleting} onClick={onClose}>Vazgeç</button>
        <button type="button" className="danger" disabled={deleting} onClick={confirm}>
          {deleting ? <><LoaderCircle className="spin" size={16} /> Siliniyor…</> : <><Trash2 size={16} /> Kalıcı sil</>}
        </button>
      </div>
    </dialog>
  );
}
