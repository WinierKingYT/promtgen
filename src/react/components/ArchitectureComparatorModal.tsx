import { useRef, useState } from 'react';
import { Columns3, Check, Scale, X } from 'lucide-react';
import { IconButton } from './WorkspaceChrome.js';

export function ArchitectureComparatorModal({ open, project, onClose }: { open: boolean; project: any; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [optionA, setOptionA] = useState('Serverless + BaaS (Supabase / Firebase)');
  const [optionB, setOptionB] = useState('Self-Hosted Node.js + PostgreSQL + Docker');

  if (!open) return null;

  return (
    <dialog ref={dialogRef} open className="comparator-dialog" style={{ width: '90%', maxWidth: '850px', background: '#18181b', border: '1px solid rgba(139, 92, 246, 0.4)', borderRadius: '14px', color: '#f3f4f6', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.2)', padding: '8px', borderRadius: '8px', color: '#a78bfa' }}>
            <Scale size={22} />
          </div>
          <div>
            <span style={{ fontSize: '10px', color: '#a78bfa', fontWeight: 700, letterSpacing: '0.5px' }}>MİMARİ KARSILASTIRMA</span>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>⚖️ A/B Mimari Karşılaştırma Laboratuvarı</h2>
          </div>
        </div>
        <IconButton label="Laboratuvarı kapat" onClick={onClose}><X size={18}/></IconButton>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Approach A */}
        <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '10px', padding: '16px' }}>
          <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 700 }}>YAKLAŞIM A</span>
          <input
            type="text"
            value={optionA}
            onChange={e => setOptionA(e.target.value)}
            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, margin: '8px 0 12px' }}
          />
          <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px', color: '#d1d5db' }}>
            <div><b>Geliştirme Hızı:</b> 🚀 Çok Yüksek</div>
            <div><b>Aylık Maliyet (İlk Başlangıç):</b> 🟢 $0 - $25/ay</div>
            <div><b>Bakım Yükü:</b> 🟢 Düşük (Sorumluluk BaaS'ta)</div>
            <div><b>Vendor Lock-in Riski:</b> ⚠️ Orta - Yüksek</div>
          </div>
        </div>

        {/* Approach B */}
        <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '16px' }}>
          <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>YAKLAŞIM B</span>
          <input
            type="text"
            value={optionB}
            onChange={e => setOptionB(e.target.value)}
            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, margin: '8px 0 12px' }}
          />
          <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px', color: '#d1d5db' }}>
            <div><b>Geliştirme Hızı:</b> ⚡ Orta</div>
            <div><b>Aylık Maliyet (İlerleme Aşaması):</b> 🟢 Sabit VPS ($10 - $40/ay)</div>
            <div><b>Bakım Yükü:</b> ⚠️ Orta (DevOps & SQL yönetimi gerekli)</div>
            <div><b>Vendor Lock-in Riski:</b> 🟢 Sıfır (Tam Taşınabilir)</div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
