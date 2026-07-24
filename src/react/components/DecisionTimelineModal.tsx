import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowRight, CheckCircle2, ChevronRight, Clock, GitCommit, Layers, ShieldAlert, X } from 'lucide-react';
import { IconButton } from './WorkspaceChrome.js';

export function DecisionTimelineModal({ open, project, onClose }: { open: boolean; project: any; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedRevNum, setSelectedRevNum] = useState<number | null>(null);

  const revisions = [...(project.revisions || [])].sort((a: any, b: any) => b.number - a.number);
  const decisions = project.decisions || [];

  useEffect(() => {
    if (!open) return;
    setSelectedRevNum(project.revision);
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }, [open, project.id, project.revision]);

  const close = () => { dialogRef.current?.close(); onClose(); };

  if (!open) return null;

  return (
    <dialog ref={dialogRef} className="timeline-dialog" aria-labelledby="timeline-title" onCancel={close} onClose={onClose} style={{ width: '90%', maxWidth: '800px', background: '#18181b', border: '1px solid rgba(139, 92, 246, 0.4)', borderRadius: '14px', color: '#f3f4f6', padding: '24px' }}>
      <div className="dialog-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.2)', padding: '8px', borderRadius: '8px', color: '#a78bfa' }}>
            <Activity size={22} />
          </div>
          <div>
            <span style={{ fontSize: '10px', color: '#a78bfa', fontWeight: 700, letterSpacing: '0.5px' }}>REVİZYON VE KARAR GEÇMİŞİ</span>
            <h2 id="timeline-title" style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>📅 Etkileşimli Zaman Çizelgesi</h2>
          </div>
        </div>
        <IconButton label="Çizelgeyi kapat" onClick={close}><X size={18}/></IconButton>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px', maxHeight: '500px', overflow: 'hidden' }}>
        {/* Left Column: Revision Steps Timeline List */}
        <div style={{ overflowY: 'auto', paddingRight: '8px', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '10px' }}>
            REVİZYON ADIMLARI ({revisions.length})
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {revisions.map((rev: any) => {
              const isCurrent = rev.number === project.revision;
              const isSelected = selectedRevNum === rev.number;
              return (
                <button
                  key={rev.id || rev.number}
                  type="button"
                  onClick={() => setSelectedRevNum(rev.number)}
                  style={{
                    textAlign: 'left',
                    background: isSelected ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.03)',
                    border: isSelected ? '1px solid #8b5cf6' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    color: '#fff',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '12px', color: isSelected ? '#a78bfa' : '#e5e7eb' }}>
                      <GitCommit size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> r{rev.number}
                    </span>
                    {isCurrent && (
                      <span style={{ background: '#10b981', color: '#fff', fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '10px' }}>
                        GÜNCEL
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: '#d1d5db', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {rev.summary || 'Plan revizyonu'}
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={10} /> {new Date(rev.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Revision Detail View */}
        <div style={{ overflowY: 'auto', paddingRight: '6px' }}>
          {(() => {
            const rev = revisions.find((r: any) => r.number === selectedRevNum) || revisions[0];
            if (!rev) return <p style={{ color: '#9ca3af' }}>Detay bulunamadı.</p>;

            const affectedSections = rev.affectedSections || [];

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '10px', padding: '14px' }}>
                  <span style={{ fontSize: '10px', color: '#a78bfa', fontWeight: 700 }}>REVİZYON ÖZETİ</span>
                  <h3 style={{ margin: '4px 0 6px 0', fontSize: '15px', color: '#fff' }}>r{rev.number} — {rev.summary}</h3>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                    Oluşturulma: <b>{new Date(rev.createdAt || Date.now()).toLocaleString()}</b>
                  </div>
                </div>

                {/* Affected Canonical Sections */}
                {affectedSections.length > 0 && (
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Layers size={13} /> Güncellenen Bölümler ({affectedSections.length}):
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {affectedSections.map((sec: string) => (
                        <span key={sec} style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#bfdbfe', fontSize: '11px', padding: '2px 8px', borderRadius: '4px' }}>
                          {sec}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Decisions in this Revision / Project */}
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                    <CheckCircle2 size={13} /> Kabul Edilen Kararlar ({decisions.filter((d: any) => d.status === 'accepted').length}):
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {decisions.filter((d: any) => d.status === 'accepted').map((d: any) => (
                      <div key={d.id} style={{ fontSize: '12px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '8px 10px', borderRadius: '6px' }}>
                        <div style={{ fontWeight: 700, color: '#a7f3d0' }}>{d.title}</div>
                        <div style={{ color: '#d1d5db', fontSize: '11px', marginTop: '2px' }}>{d.decision}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </dialog>
  );
}
