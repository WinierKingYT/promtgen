import { useEffect, useRef } from 'react';
import { FolderCheck, ShieldAlert, FileText, X, HardDrive } from 'lucide-react';
import { IconButton } from './WorkspaceChrome.js';
import type { ProjectInventoryReport } from '../../v4/project-analyzer.js';

interface ProjectInventoryModalProps {
  open: boolean;
  nativeInventory: ProjectInventoryReport | null;
  onClose: () => void;
}

/**
 * Envanter penceresi. Bütün renkler tema token'larından gelir; bu dosya bir
 * zamanlar mor/mavi/yeşil sabit hex'lerle yazılmıştı (mor #8b5cf6, mavi
 * #3b82f6, yeşil #10b981, gri #9ca3af) ve temanın dışında duran tek ekrandı.
 *
 * Biçim, diğer diyaloglarla AYNI sözlüğü kullanır (`.dialog-head`,
 * `.dialog-icon`, `.dialog-actions`): üstte mono/büyük harf bölüm adı,
 * altında serif başlık, en altta kompakt aksiyon. Örtü `--pg-overlay`.
 * Kullanıcıya görünen metinlerin hiçbiri değişmedi.
 */
export function ProjectInventoryModal({ open, nativeInventory, onClose }: ProjectInventoryModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }, [open]);

  if (!open || !nativeInventory) return null;

  const { totals, inventory } = nativeInventory;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="inventory-dialog-title"
      className="inventory-dialog"
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-head">
        <div className="dialog-icon"><HardDrive size={22} /></div>
        <div>
          <span className="meta">DOSYA ENVANTERİ</span>
          <h2 id="inventory-dialog-title">📂 Proje Envanteri ve Hassas İçerik Filtresi</h2>
        </div>
        <IconButton label="Pencereyi kapat" onClick={onClose}><X size={18}/></IconButton>
      </div>

      <div className="inventory-body">
        {/* Taramanın kapsamını söyleyen not: iddia edilenden fazlası vaat edilmesin. */}
        <p className="inventory-scope">
          ℹ️ <b>Kapsam Açıklaması:</b> Klasör yapısı, dosya türleri ve hassas bağımlılıklar (.env, node_modules) filtrelenir. Tam antivirüs veya SAST kod analizi yapılmaz.
        </p>

        <div className="inventory-totals">
          <div className="inventory-total is-included">
            <FolderCheck size={24} aria-hidden="true" />
            <span>
              <b>{totals.included} dosya</b>
              <small>Güvenle envantere alındı</small>
            </span>
          </div>

          <div className="inventory-total is-excluded">
            <ShieldAlert size={24} aria-hidden="true" />
            <span>
              <b>{totals.excluded} öğe</b>
              <small>Güvenlik politikasıyla korundu (.env, node_modules)</small>
            </span>
          </div>
        </div>

        <div className="inventory-sample">
          <span className="meta">TARANAN ÖRNEK DOSYALAR VE UZANTILAR</span>
          <ul>
            {inventory.slice(0, 30).map(file => (
              <li key={file.path}>
                <FileText size={12} aria-hidden="true" />
                <code>{file.path}</code>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="dialog-actions">
        <button type="button" onClick={onClose}>Kapat</button>
      </div>
    </dialog>
  );
}
