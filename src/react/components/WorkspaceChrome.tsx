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
  projects: ProjectSummary[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  open: boolean;
  onClose: () => void;
}) {
  return <aside className={`project-rail ${open ? 'open' : ''}`} aria-label="Projeler" aria-hidden={!open && undefined}>
    <div className="brand"><div className="brand-symbol">P</div><div><b>PromtGen</b><small>Project architect</small></div><IconButton label="Menüyü kapat" onClick={onClose}><X size={18}/></IconButton></div>
    <button className="new-project" type="button" onClick={onNew}><Plus size={18}/> Yeni proje</button>
    <div className="rail-label">PROJELER</div>
    <nav className="project-list" aria-label="Kayıtlı projeler">{projects.map(item => <button type="button" key={item.id} aria-current={item.id === activeId ? 'page' : undefined} className={item.id === activeId ? 'active' : ''} onClick={() => onSelect(item.id)}><span className="project-dot"/><span><b>{item.identity.name}</b><small>{item.planningDepth.selected} · r{item.revision}</small></span></button>)}</nav>
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
  return <article className={`suggestion-card ${item.recommended ? 'recommended' : ''} status-${item.status}`}>
    <div className="suggestion-top"><span className="kind">{item.kind}</span>{item.recommended && <span className="recommend"><Sparkles size={12}/> AI önerisi</span>}<span className={`effort effort-${item.effort}`}>{item.effort} efor</span></div>
    <h3>{item.title}</h3>
    {editing ? <textarea aria-label={`${item.title} önerisini düzenle`} value={text} onChange={event => setText(event.target.value)} rows={3}/> : <p>{item.editedDescription || item.description}</p>}
    <details><summary>Artılar, eksiler ve etkiler <ChevronDown size={14}/></summary><div className="tradeoffs"><div><b>Artılar</b>{item.pros.map((value: string) => <span key={value}>+ {value}</span>)}</div><div><b>Eksiler</b>{item.cons.map((value: string) => <span key={value}>− {value}</span>)}</div></div><div className="affected-links"><span>Etkilediği bölümler</span>{item.affectedSections.map((sectionId: string) => <button type="button" key={sectionId} onClick={() => onSection(sectionId)}>{sectionId}</button>)}</div></details>
    <div className="decision-actions">
      {editing ? <><button type="button" className="accept" onClick={() => { onStatus('edited', text); setEditing(false); }}><Check size={15}/> Düzenlemeyi kabul et</button><button type="button" onClick={() => setEditing(false)}>Vazgeç</button></> : !resolved ? <><button type="button" className="accept" onClick={() => onStatus('accepted')}><Check size={15}/> Kabul</button><button type="button" onClick={() => setEditing(true)}><Pencil size={14}/> Düzenle</button><button type="button" onClick={() => onStatus('deferred')}>Ertele</button><button type="button" onClick={() => onStatus('rejected')}><X size={14}/> Reddet</button></> : <span className="resolved-label"><Check size={14}/> {item.status}</span>}
    </div>
  </article>;
}
