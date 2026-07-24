import { useRef, useState } from 'react';
import { Columns3, Check, Scale, X, Info } from 'lucide-react';
import { IconButton } from './WorkspaceChrome.js';

export function ArchitectureComparatorModal({ open, project, onClose }: { open: boolean; project: any; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [optionA, setOptionA] = useState('Serverless + BaaS (Supabase / Firebase)');
  const [speedA, setSpeedA] = useState(5);
  const [costA, setCostA] = useState(15);
  const [opsA, setOpsA] = useState(2);
  const [lockinA, setLockinA] = useState(4);

  const [optionB, setOptionB] = useState('Self-Hosted Node.js + PostgreSQL + Docker');
  const [speedB, setSpeedB] = useState(3);
  const [costB, setCostB] = useState(30);
  const [opsB, setOpsB] = useState(4);
  const [lockinB, setLockinB] = useState(1);

  if (!open) return null;

  return (
    <dialog ref={dialogRef} open className="comparator-dialog" style={{ width: '90%', maxWidth: '850px', background: '#18181b', border: '1px solid rgba(139, 92, 246, 0.4)', borderRadius: '14px', color: '#f3f4f6', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.2)', padding: '8px', borderRadius: '8px', color: '#a78bfa' }}>
            <Scale size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '10px', color: '#a78bfa', fontWeight: 700, letterSpacing: '0.5px' }}>KARAR MATRİSİ</span>
              <span style={{ fontSize: '9px', background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.4)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>Deneysel Başlangıç Şablonu</span>
            </div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>⚖️ Mimari Karşılaştırma Şablonu</h2>
          </div>
        </div>
        <IconButton label="Şablonu kapat" onClick={onClose}><X size={18}/></IconButton>
      </div>

      {/* Honest Disclaimer Alert */}
      <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', padding: '8px 12px', marginBottom: '16px', fontSize: '11px', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Info size={16} style={{ flexShrink: 0 }} />
        <span><b>Başlangıç Varsayımı Açıklaması:</b> Gösterilen maliyet, efor ve yük değerleri proje verilerinden otomatik hesaplanmaz; sizin belirleyebileceğiniz başlangıç varsayımlarıdır. Bütün değerleri düzenleyebilirsiniz.</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Approach A */}
        <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 700 }}>YAKLAŞIM A</span>
            <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.1)', color: '#d1d5db', padding: '2px 6px', borderRadius: '4px' }}>Örnek Varsayım</span>
          </div>
          <input
            type="text"
            value={optionA}
            onChange={e => setOptionA(e.target.value)}
            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, margin: '8px 0 14px' }}
          />

          <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '10px', color: '#d1d5db' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span><b>Geliştirme Hızı:</b></span>
                <span>{speedA} / 5</span>
              </div>
              <input type="range" min="1" max="5" value={speedA} onChange={e => setSpeedA(Number(e.target.value))} style={{ width: '100%' }} />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span><b>Tahmini Aylık Maliyet:</b></span>
                <span>${costA} / ay</span>
              </div>
              <input type="range" min="0" max="200" value={costA} onChange={e => setCostA(Number(e.target.value))} style={{ width: '100%' }} />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span><b>Bakım / Operasyon Yükü:</b></span>
                <span>{opsA} / 5</span>
              </div>
              <input type="range" min="1" max="5" value={opsA} onChange={e => setOpsA(Number(e.target.value))} style={{ width: '100%' }} />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span><b>Vendor Lock-in Riski:</b></span>
                <span>{lockinA} / 5</span>
              </div>
              <input type="range" min="1" max="5" value={lockinA} onChange={e => setLockinA(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
          </div>
        </div>

        {/* Approach B */}
        <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>YAKLAŞIM B</span>
            <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.1)', color: '#d1d5db', padding: '2px 6px', borderRadius: '4px' }}>Örnek Varsayım</span>
          </div>
          <input
            type="text"
            value={optionB}
            onChange={e => setOptionB(e.target.value)}
            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, margin: '8px 0 14px' }}
          />

          <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '10px', color: '#d1d5db' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span><b>Geliştirme Hızı:</b></span>
                <span>{speedB} / 5</span>
              </div>
              <input type="range" min="1" max="5" value={speedB} onChange={e => setSpeedB(Number(e.target.value))} style={{ width: '100%' }} />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span><b>Tahmini Aylık Maliyet:</b></span>
                <span>${costB} / ay</span>
              </div>
              <input type="range" min="0" max="200" value={costB} onChange={e => setCostB(Number(e.target.value))} style={{ width: '100%' }} />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span><b>Bakım / Operasyon Yükü:</b></span>
                <span>{opsB} / 5</span>
              </div>
              <input type="range" min="1" max="5" value={opsB} onChange={e => setOpsB(Number(e.target.value))} style={{ width: '100%' }} />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span><b>Vendor Lock-in Riski:</b></span>
                <span>{lockinB} / 5</span>
              </div>
              <input type="range" min="1" max="5" value={lockinB} onChange={e => setLockinB(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
