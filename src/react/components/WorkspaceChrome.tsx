import { useState, type ReactNode } from 'react';
import { Check, ChevronDown, Pencil, Plus, Sparkles, X } from 'lucide-react';

type ProjectSummary = {
  id: string;
  revision: number;
  identity: { name: string };
  planningDepth: { selected: string };
};

export function IconButton({ label, children, onClick }: { label: string; children: ReactNode; onClick: () => void }) {
  return <button className="icon-button" type="button" aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

export function ProjectRail({ projects, activeId, onSelect, onNew, open, onClose }: {
  projects: any[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  open: boolean;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState('');
  const filtered = projects.filter(p => (p.identity?.name || '').toLowerCase().includes(filter.toLowerCase()));

  return <aside className={`project-rail ${open ? 'open' : ''}`} aria-label="Projeler" aria-hidden={!open}>
    <div className="brand"><div className="brand-symbol">P</div><div><b>PromtGen</b><small>Project architect</small></div><IconButton label="Menüyü kapat" onClick={onClose}><X size={18}/></IconButton></div>
    <button className="new-project" type="button" onClick={onNew}><Plus size={18}/> Yeni proje</button>
    
    <div style={{ padding: '0 12px', margin: '8px 0' }}>
      <input
        type="text"
        placeholder="Proje filtrele…"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', color: '#e5e7eb', outline: 'none', boxSizing: 'border-box' }}
      />
    </div>

    <div className="rail-label">PROJELER ({filtered.length})</div>
    <nav className="project-list" aria-label="Kayıtlı projeler">
      {filtered.map(item => (
        <button type="button" key={item.id} aria-current={item.id === activeId ? 'page' : undefined} className={item.id === activeId ? 'active' : ''} onClick={() => onSelect(item.id)}>
          <span className="project-dot"/>
          <span>
            <b>{item.identity?.name || 'İsimsiz Proje'}</b>
            <small>{item.planningDepth?.selected || 'quick'} · r{item.revision} {item.readiness?.score !== undefined ? `· %${item.readiness.score}` : ''}</small>
          </span>
        </button>
      ))}
    </nav>
    <div className="rail-bottom"><div className="privacy-pill"><span/> Yerel depolama aktif</div></div>
  </aside>;
}

export function SuggestionCard({ item, onStatus, onSection }: {
  item: any;
  onStatus: (status: string, editedDescription?: string) => void;
  onSection: (sectionId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.editedDescription || item.description);
  const resolved = item.status !== 'pending';

  const sectionLabels: Record<string, string> = {
    vision: 'Vizyon', objectives: 'Hedefler', scope: 'Kapsam', requirements: 'Gereksinimler',
    decisions: 'Kararlar', architecture: 'Mimari', security: 'Güvenlik', tasks: 'Görevler',
    risks: 'Riskler', testing: 'Testler', deployment: 'Dağıtım', operations: 'Operasyon'
  };

  const kindLabels: Record<string, string> = {
    feature: 'Özel Fonksiyon', decision: 'Mimari Karar', risk: 'Risk Koruması',
    question: 'Açık Soru', architecture: 'Teknik Yapı'
  };

  return <article className={`suggestion-card ${item.recommended ? 'recommended' : ''} status-${item.status}`} style={{ background: resolved ? 'rgba(255,255,255,0.02)' : 'rgba(30, 30, 38, 0.95)', border: resolved ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
    <div className="suggestion-top" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
      <span className="kind" style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
        {kindLabels[item.kind] || item.kind}
      </span>
      {item.recommended && <span className="recommend" style={{ background: '#8b5cf6', color: '#fff', fontSize: '10px', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}><Sparkles size={11}/> AI Önerisi</span>}
      <span className={`effort effort-${item.effort}`} style={{ marginLeft: 'auto', fontSize: '11px', color: '#9ca3af' }}>{item.effort === 'high' ? 'Yüksek Efor' : item.effort === 'medium' ? 'Orta Efor' : 'Düşük Efor'}</span>
    </div>

    <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 700, color: '#f3f4f6' }}>{item.title}</h3>

    {/* Clear "Neden Önerildi?" & "Plan Etkisi" Guidance Boxes */}
    <div style={{ background: 'rgba(0,0,0,0.25)', padding: '10px', borderRadius: '8px', marginBottom: '12px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ color: '#d1d5db' }}>
        <strong style={{ color: '#a78bfa' }}>💡 Neden Önerildi? </strong>
        <span>{item.recommendationReason || 'Projenizin derinliği ve belirsizlikleri azaltmak için tasarlandı.'}</span>
      </div>
      <div style={{ color: '#d1d5db' }}>
        <strong style={{ color: '#10b981' }}>⚡ Plana Etkisi: </strong>
        <span>Kabul ederseniz <b>{(item.affectedSections || []).map((s: string) => sectionLabels[s] || s).join(', ')}</b> bölümlerine yeni kararlar/görevler eklenecektir.</span>
      </div>
    </div>

    {editing ? (
      <textarea aria-label={`${item.title} önerisini düzenle`} value={text} onChange={event => setText(event.target.value)} rows={3} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid #8b5cf6', color: '#fff', borderRadius: '6px', padding: '8px', marginBottom: '10px' }}/>
    ) : (
      <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#d1d5db', lineHeight: '1.4' }}>{item.editedDescription || item.description}</p>
    )}

    <details style={{ marginBottom: '12px', fontSize: '12px', color: '#9ca3af' }}>
      <summary style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#a78bfa' }}>Artılar & Eksiler Detayı <ChevronDown size={14}/></summary>
      <div className="tradeoffs" style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px' }}>
        <div><b style={{ color: '#10b981' }}>Artılar:</b> {(item.pros || []).map((value: string) => <div key={value}>+ {value}</div>)}</div>
        <div><b style={{ color: '#ef4444' }}>Eksiler:</b> {(item.cons || []).map((value: string) => <div key={value}>− {value}</div>)}</div>
      </div>
    </details>

    <div className="decision-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {editing ? (
        <>
          <button type="button" className="accept" onClick={() => { onStatus('edited', text); setEditing(false); }} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={15}/> Düzenlemeyi Plana Ekle</button>
          <button type="button" onClick={() => setEditing(false)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#aaa', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Vazgeç</button>
        </>
      ) : !resolved ? (
        <>
          <button type="button" className="accept" onClick={() => onStatus('accepted')} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={15}/> Plana Ekle</button>
          <button type="button" onClick={() => setEditing(true)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Pencil size={13}/> Düzenleyerek Ekle</button>
          <button type="button" onClick={() => onStatus('deferred')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Sonraya Bırak</button>
          <button type="button" onClick={() => onStatus('rejected')} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><X size={13}/> İstemiyorum</button>
        </>
      ) : (
        <span className="resolved-label" style={{ color: '#10b981', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={14}/> {item.status === 'accepted' ? 'Plana Eklendi' : item.status === 'rejected' ? 'Reddedildi' : item.status}</span>
      )}
    </div>
  </article>;
}

