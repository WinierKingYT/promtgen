import { useState, type ReactNode } from 'react';
import { Check, ChevronDown, Pencil, Plus, Sparkles, X } from 'lucide-react';
import { ProvenanceBadge } from './ProvenanceBadge.js';
import type { GenerationProvenance, ProjectDocumentV5, SuggestionItem, SuggestionStatus } from '../../v4/contracts.js';

export function IconButton({ label, children, onClick }: { label: string; children: ReactNode; onClick: () => void }) {
  return <button className="icon-button" type="button" aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

export function ProjectRail({ projects, activeId, onSelect, onNew, open, onClose }: {
  projects: ProjectDocumentV5[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  open: boolean;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState('');
  const filtered = projects.filter(p => p.lifecycle.status !== 'archived' && (p.identity?.name || '').toLowerCase().includes(filter.toLowerCase()));

  return <aside className={`project-rail ${open ? 'open' : ''}`} aria-label="Projeler" aria-hidden={!open}>
    <div className="brand"><div className="brand-symbol">P</div><div><b>PromtGen</b><small>Project architect</small></div><IconButton label="Menüyü kapat" onClick={onClose}><X size={18}/></IconButton></div>
    <button className="new-project" type="button" onClick={onNew}><Plus size={18}/> Yeni proje</button>
    
    <div className="project-filter">
      <input
        type="text"
        placeholder="Proje filtrele…"
        value={filter}
        onChange={e => setFilter(e.target.value)}
      />
    </div>

    <div className="rail-label">PROJELER ({filtered.length})</div>
    <nav className="project-list" aria-label="Kayıtlı projeler">
      {filtered.map(item => (
        <button type="button" key={item.id} aria-current={item.id === activeId ? 'page' : undefined} className={item.id === activeId ? 'active' : ''} onClick={() => onSelect(item.id)}>
          <span className="project-dot"/>
          <span>
            <b>{item.identity?.name || 'İsimsiz Proje'}</b>
            <small>{item.planningDepth?.selected || 'quick'} · r{item.canonicalRevision} {item.readiness?.score !== undefined ? `· %${item.readiness.score}` : ''}</small>
          </span>
        </button>
      ))}
    </nav>
    <div className="rail-bottom"><div className="privacy-pill"><span/> Yerel depolama aktif</div></div>
  </aside>;
}

export function SuggestionCard({ item, provenance, onStatus }: {
  item: SuggestionItem;
  provenance?: GenerationProvenance;
  onStatus: (status: SuggestionStatus, editedDescription?: string) => void;
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

  return <article className={`suggestion-card ${item.recommended ? 'recommended' : ''} status-${item.status}`}>
    <div className="suggestion-top">
      <span className="kind">
        {kindLabels[item.kind] || item.kind}
      </span>
      {provenance && (
        <ProvenanceBadge
          kind={provenance.mode === 'fallback' ? 'degraded' : provenance.mode === 'rule-engine' ? 'local-rule' : 'ai-proposed'}
          providerName={provenance.model || provenance.providerId || undefined}
        />
      )}
      {item.recommended && <span className="recommend"><Sparkles size={11}/> Tavsiye edilen</span>}
      <span className={`effort effort-${item.effort}`}>{item.effort === 'high' ? 'Yüksek Efor' : item.effort === 'medium' ? 'Orta Efor' : 'Düşük Efor'}</span>
    </div>

    <h3>{item.title}</h3>

    {/* Clear "Neden Önerildi?" & "Plan Etkisi" Guidance Boxes */}
    <div className="suggestion-rationale">
      <div className="is-reason">
        <strong>💡 Neden Önerildi? </strong>
        <span>{item.recommendationReason || 'Projenizin derinliği ve belirsizlikleri azaltmak için tasarlandı.'}</span>
      </div>
      <div className="is-impact">
        <strong>⚡ Plana Etkisi: </strong>
        <span>Kabul ederseniz <b>{(item.affectedSections || []).map((s: string) => sectionLabels[s] || s).join(', ')}</b> bölümlerine yeni kararlar/görevler eklenecektir.</span>
      </div>
    </div>

    {editing ? (
      <textarea className="suggestion-editor" aria-label={`${item.title} önerisini düzenle`} value={text} onChange={event => setText(event.target.value)} rows={3}/>
    ) : (
      <p className="suggestion-description">{item.editedDescription || item.description}</p>
    )}

    <details className="suggestion-tradeoffs">
      <summary>Artılar & Eksiler Detayı <ChevronDown size={14}/></summary>
      <div className="tradeoffs">
        <div><b className="is-pro">Artılar:</b> {(item.pros || []).map((value: string) => <div key={value}>+ {value}</div>)}</div>
        <div><b className="is-con">Eksiler:</b> {(item.cons || []).map((value: string) => <div key={value}>− {value}</div>)}</div>
      </div>
    </details>

    <div className="decision-actions">
      {editing ? (
        <>
          <button type="button" className="accept" onClick={() => { onStatus('edited', text); setEditing(false); }}><Check size={15}/> Düzenlemeyi Plana Ekle</button>
          <button type="button" onClick={() => setEditing(false)}>Vazgeç</button>
        </>
      ) : !resolved ? (
        <>
          <button type="button" className="accept" onClick={() => onStatus('accepted')}><Check size={15}/> Plana Ekle</button>
          <button type="button" onClick={() => setEditing(true)}><Pencil size={13}/> Düzenleyerek Ekle</button>
          <button type="button" onClick={() => onStatus('deferred')}>Sonraya Bırak</button>
          <button type="button" className="reject" onClick={() => onStatus('rejected')}><X size={13}/> İstemiyorum</button>
        </>
      ) : (
        <span className="resolved-label"><Check size={14}/> {item.status === 'accepted' ? 'Plana Eklendi' : item.status === 'rejected' ? 'Reddedildi' : item.status}</span>
      )}
    </div>
  </article>;
}
