import { useEffect, useRef } from 'react';
import { FolderCheck, ShieldAlert, FileText, X, HardDrive } from 'lucide-react';
import { IconButton } from './WorkspaceChrome.js';

export function ProjectInventoryModal({ open, nativeInventory, onClose }: { open: boolean; nativeInventory: any; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }, [open]);

  if (!open || !nativeInventory) return null;

  const totals = nativeInventory.totals || { included: 0, excluded: 0 };
  const items = nativeInventory.items || [];

  return (
    <dialog ref={dialogRef} open className="inventory-dialog" style={{ width: '90%', maxWidth: '750px', background: '#18181b', border: '1px solid rgba(139, 92, 246, 0.4)', borderRadius: '14px', color: '#f3f4f6', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.2)', padding: '8px', borderRadius: '8px', color: '#a78bfa' }}>
            <HardDrive size={22} />
          </div>
          <div>
            <span style={{ fontSize: '10px', color: '#a78bfa', fontWeight: 700, letterSpacing: '0.5px' }}>YEREL DOSYA ENVANTERİ</span>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>📂 Proje Dizin Analizi & Güvenlik Özeti</h2>
          </div>
        </div>
        <IconButton label="Pencereyi kapat" onClick={onClose}><X size={18}/></IconButton>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FolderCheck size={24} style={{ color: '#10b981' }} />
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#a7f3d0' }}>{totals.included} dosya</div>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>Güvenle envantere alındı</div>
          </div>
        </div>

        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldAlert size={24} style={{ color: '#ef4444' }} />
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#fca5a5' }}>{totals.excluded} öğe</div>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>Güvenlik politikasıyla korundu (.env, node_modules)</div>
          </div>
        </div>
      </div>

      <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '12px', maxHeight: '250px', overflowY: 'auto' }}>
        <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
          TARANAN ÖRNEK DOSYALAR VE UZANTILAR
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {items.slice(0, 30).map((file: any, idx: number) => (
            <div key={file.path || idx} style={{ fontSize: '11px', color: '#d1d5db', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={12} style={{ color: '#8b5cf6' }} />
              <span style={{ fontFamily: 'monospace' }}>{file.path || file}</span>
            </div>
          ))}
        </div>
      </div>
    </dialog>
  );
}
