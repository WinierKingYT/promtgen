import { useEffect, useMemo, useRef, useState } from 'react';
import { ArchiveRestore, FileArchive, LoaderCircle, ShieldCheck, TriangleAlert } from 'lucide-react';
import {
  buildRecoveryPreview,
  requiresExplicitLegacyRecoveryAcknowledgement,
  type RecoveryPreview
} from '../../v4/application/recovery-service.js';
import type { ProjectDocumentV5 } from '../../v4/contracts.js';
import type { PromtgenPackageInspection } from '../../v4/exporter.js';

interface PackageImportDialogProps {
  inspection: PromtgenPackageInspection;
  existingProject?: ProjectDocumentV5;
  onConfirm: (mode: 'new' | 'recovery', preview?: RecoveryPreview) => Promise<boolean>;
  onClose: () => void;
}

const integrityCopy = {
  full: { title: 'Paket içeriği SHA-256 kayıtlarıyla eşleşiyor', detail: 'Manifest, proje, geçmiş ve export dosyalarının SHA-256 değerleri eşleşiyor.' },
  canonical: { title: 'Plan içeriği doğrulandı', detail: 'Eski paket sürümü nedeniyle yardımcı dosyalar tek tek doğrulanamadı.' },
  legacy: { title: 'Eski paket — sınırlı doğrulama', detail: 'Şema güvenli biçimde doğrulandı; kriptografik bütünlük kaydı yok.' }
} as const;

export function PackageImportDialog({ inspection, existingProject, onConfirm, onClose }: PackageImportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [saving, setSaving] = useState(false);
  const [legacyRecoveryAcknowledged, setLegacyRecoveryAcknowledged] = useState(false);
  const recoveryPreview = useMemo(() => existingProject
    ? buildRecoveryPreview(
        existingProject,
        inspection.project,
        'portable-package',
        inspection.integrity.level === 'full' ? 'verified' : inspection.integrity.level === 'canonical' ? 'validated' : 'legacy'
      )
    : null, [existingProject, inspection]);
  const integrity = integrityCopy[inspection.integrity.level];
  const mode = recoveryPreview ? 'recovery' : 'new';
  const requiresLegacyAcknowledgement = requiresExplicitLegacyRecoveryAcknowledgement(recoveryPreview);
  const canConfirm = (!recoveryPreview || recoveryPreview.canRestore)
    && (!requiresLegacyAcknowledgement || legacyRecoveryAcknowledged);

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
    setSaving(true);
    try {
      if (await onConfirm(mode, recoveryPreview ?? undefined)) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="package-import-dialog"
      aria-labelledby="package-import-title"
      aria-describedby="package-import-description"
      onCancel={event => {
        event.preventDefault();
        if (!saving) onClose();
      }}
      onClose={onClose}
    >
      <div className="package-import-heading">
        <span className="package-import-icon" aria-hidden="true"><FileArchive size={22} /></span>
        <div>
          <span className="meta">PROMTGEN PAKETİ · V{inspection.manifest.formatVersion}</span>
          <h2 id="package-import-title">{inspection.project.identity.name}</h2>
          <p id="package-import-description">
            {recoveryPreview
              ? 'Paketin plan içeriği yalnız sen onayladıktan sonra yeni bir plan sürümü olarak eklenecek. Cihazdaki sürüm geçmişin, dışa aktarımların ve çalıştırma kayıtların olduğu gibi korunur.'
              : 'Paket henüz kaydedilmedi. İçeriği ve bütünlük sonucunu inceleyip yeni proje olarak ekleyebilirsin.'}
          </p>
        </div>
      </div>

      <section className={`package-integrity ${inspection.integrity.level}`} aria-label="Paket bütünlüğü">
        {inspection.integrity.level === 'full' ? <ShieldCheck size={19} /> : <TriangleAlert size={19} />}
        <div>
          <strong>{integrity.title}</strong>
          <span>{integrity.detail}</span>
          <small>{inspection.integrity.verifiedEntries}/{inspection.integrity.totalEntries} paket girdisi doğrulandı.</small>
          <small className="package-trust-limit">Bu kontrol içeriğin manifestle eşleştiğini gösterir; paketi kimin ürettiğini veya kaynağın güvenilirliğini kanıtlamaz.</small>
        </div>
      </section>

      <div className="package-import-facts" role="list" aria-label="Paket bilgileri">
        <span role="listitem"><small>Paket belge rev.</small><strong>r{inspection.project.documentRevision}</strong></span>
        <span role="listitem"><small>Paketteki plan sürümü</small><strong>r{inspection.project.canonicalRevision}</strong></span>
        <span role="listitem"><small>{recoveryPreview ? 'Yerel hedef rev.' : 'Export belgesi'}</small><strong>{recoveryPreview ? `r${recoveryPreview.nextCanonicalRevision}` : inspection.manifest.files.length}</strong></span>
      </div>

      {inspection.integrity.warnings.length > 0 && (
        <div className="package-import-warnings" role="note">
          {inspection.integrity.warnings.map(warning => <span key={warning}><TriangleAlert size={14} /> {warning}</span>)}
        </div>
      )}

      {recoveryPreview && (
        <section className="package-recovery-preview" aria-labelledby="package-change-title">
          <div>
            <h3 id="package-change-title">Geri yükleme etkisi</h3>
            <span>Paket r{recoveryPreview.sourceCanonicalRevision} → yerel yeni r{recoveryPreview.nextCanonicalRevision}</span>
          </div>
          <p className="package-recovery-contract">Yerel r{recoveryPreview.expectedCanonicalRevision} zaman çizelgesi korunur; paketin kendi geçmişi yerel geçmişin yerine geçmez.</p>
          {!recoveryPreview.canRestore ? <p>{recoveryPreview.reason}</p> : (
            <div className="package-change-grid">
              <span><strong>{recoveryPreview.sections.length}</strong> plan bölümü</span>
              <span><strong>{recoveryPreview.entities.length}</strong> varlık grubu</span>
              <span><strong>{recoveryPreview.documentChanges.length}</strong> fikir/keşif alanı</span>
            </div>
          )}
          {recoveryPreview.sections.length > 0 && (
            <ul>{recoveryPreview.sections.slice(0, 5).map(section => <li key={section.sectionId}>{section.title}: +{section.addedLines + section.addedItems} / −{section.removedLines + section.removedItems}</li>)}</ul>
          )}
          {recoveryPreview.entities.length > 0 && (
            <ul>{recoveryPreview.entities.slice(0, 5).map(entity => <li key={entity.key}>{entity.label}: +{entity.added}, −{entity.removed}, {entity.changed} değişti</li>)}</ul>
          )}
        </section>
      )}

      {requiresLegacyAcknowledgement && (
        <label className="package-legacy-acknowledgement">
          <input
            type="checkbox"
            checked={legacyRecoveryAcknowledged}
            onChange={event => setLegacyRecoveryAcknowledged(event.currentTarget.checked)}
          />
          <span>
            <strong>Sınırlı doğrulamayı kabul ediyorum</strong>
            Bu eski paketin kriptografik bütünlük kanıtı olmadığını ve canonical içeriğinin yerel geçmişime yeni revision olarak ekleneceğini anlıyorum.
          </span>
        </label>
      )}

      <div className="package-import-actions">
        <button ref={cancelRef} type="button" disabled={saving} onClick={onClose}>Vazgeç</button>
        <button type="button" className="primary" disabled={saving || !canConfirm} onClick={confirm}>
          {saving
            ? <><LoaderCircle className="spin" size={16} /> Kaydediliyor…</>
            : recoveryPreview
              ? <><ArchiveRestore size={16} /> Yeni revision olarak geri yükle</>
              : <><FileArchive size={16} /> Yeni proje olarak içe aktar</>}
        </button>
      </div>
    </dialog>
  );
}
