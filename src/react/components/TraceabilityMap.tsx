import { useMemo, useState, type CSSProperties } from 'react';
import { GitBranch, ListTree, Search } from 'lucide-react';
import { buildTraceabilityView, type TraceabilityNodeType } from '../../v4/application/traceability-view.js';
import type { ProjectDocumentV5 } from '../../v4/contracts.js';

const TYPE_META: Record<TraceabilityNodeType, { label: string; color: string; x: number }> = {
  decision: { label: 'Karar', color: '#a78bfa', x: 100 },
  requirement: { label: 'Gereksinim', color: '#60a5fa', x: 300 },
  task: { label: 'Görev', color: '#34d399', x: 500 },
  test: { label: 'Test', color: '#fbbf24', x: 700 },
  risk: { label: 'Risk', color: '#fb7185', x: 900 }
};

const TERMINAL_STATUSES = new Set(['superseded', 'implemented', 'verified', 'done', 'passed', 'mitigated', 'accepted']);

function short(value: string, length = 22) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

export function TraceabilityMap({ project }: { project: ProjectDocumentV5 }) {
  const [revision, setRevision] = useState(project.canonicalRevision);
  const [types, setTypes] = useState<TraceabilityNodeType[]>(Object.keys(TYPE_META) as TraceabilityNodeType[]);
  const [status, setStatus] = useState<'all' | 'open' | 'complete'>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const view = useMemo(() => buildTraceabilityView(project, revision), [project, revision]);
  const visibleNodes = useMemo(() => view.nodes.filter(node => {
    if (!types.includes(node.type)) return false;
    if (query && !`${node.label} ${node.id}`.toLocaleLowerCase('tr-TR').includes(query.toLocaleLowerCase('tr-TR'))) return false;
    const complete = TERMINAL_STATUSES.has(node.status);
    return status === 'all' || (status === 'complete' ? complete : !complete);
  }).slice(0, 60), [query, status, types, view.nodes]);
  const nodeIds = new Set(visibleNodes.map(node => node.id));
  const visibleEdges = view.edges.filter(edge => nodeIds.has(edge.fromId) && nodeIds.has(edge.toId));
  const positions = new Map<string, { x: number; y: number }>();
  for (const type of Object.keys(TYPE_META) as TraceabilityNodeType[]) {
    visibleNodes.filter(node => node.type === type).forEach((node, index) => {
      positions.set(node.id, { x: TYPE_META[type].x, y: 58 + index * 68 });
    });
  }
  const maxRows = Math.max(3, ...Object.keys(TYPE_META).map(type => visibleNodes.filter(node => node.type === type).length));
  const height = Math.max(280, 105 + maxRows * 68);
  const selected = view.nodes.find(node => node.id === selectedId) || null;

  const toggleType = (type: TraceabilityNodeType) => {
    setTypes(current => current.includes(type) ? current.filter(item => item !== type) : [...current, type]);
  };

  return (
    <section className="trace-map" aria-labelledby="trace-map-title">
      <header>
        <div><span className="meta">CANONICAL İZLENEBİLİRLİK</span><h3 id="trace-map-title"><GitBranch size={17}/> Plan bağlantı haritası</h3></div>
        <label>Revision<select value={view.revision} onChange={event => setRevision(Number(event.target.value))}>{view.availableRevisions.map(item => <option key={item.number} value={item.number}>{item.label}</option>)}</select></label>
      </header>
      <div className="trace-map-controls">
        <label className="trace-search"><Search size={14}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Kayıt ara…" aria-label="İzlenebilirlik kaydı ara"/></label>
        <select value={status} onChange={event => setStatus(event.target.value as typeof status)} aria-label="Kayıt durumu filtresi">
          <option value="all">Tüm durumlar</option><option value="open">Açık/aktif</option><option value="complete">Tamamlanan</option>
        </select>
        <div className="trace-type-filters" aria-label="Kayıt türü filtreleri">{(Object.keys(TYPE_META) as TraceabilityNodeType[]).map(type => <button type="button" key={type} aria-pressed={types.includes(type)} onClick={() => toggleType(type)} style={{ '--trace-color': TYPE_META[type].color } as CSSProperties}>{TYPE_META[type].label}</button>)}</div>
      </div>
      {view.invalidLinkIds.length > 0 && <p className="trace-warning" role="alert">{view.invalidLinkIds.length} bağlantının canonical ucu bulunamadığı için gösterilmedi.</p>}
      <div className="trace-canvas" tabIndex={0} aria-label={`r${view.revision} izlenebilirlik grafiği, ${visibleNodes.length} kayıt ve ${visibleEdges.length} bağlantı`}>
        <svg viewBox={`0 0 1000 ${height}`} role="img" aria-labelledby="trace-svg-title trace-svg-description">
          <title id="trace-svg-title">Canonical plan izlenebilirlik grafiği</title>
          <desc id="trace-svg-description">Karar, gereksinim, görev, test ve risk kayıtları arasındaki yönlü bağlantılar.</desc>
          <defs><marker id="trace-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>
          {(Object.keys(TYPE_META) as TraceabilityNodeType[]).filter(type => types.includes(type)).map(type => <text key={type} className="trace-column-title" x={TYPE_META[type].x} y="24" textAnchor="middle">{TYPE_META[type].label}</text>)}
          {visibleEdges.map(edge => {
            const from = positions.get(edge.fromId)!;
            const to = positions.get(edge.toId)!;
            return <g key={edge.id}><line className="trace-edge" x1={from.x + 74} y1={from.y} x2={to.x - 74} y2={to.y} markerEnd="url(#trace-arrow)"/><title>{edge.relation}</title></g>;
          })}
          {visibleNodes.map(node => {
            const position = positions.get(node.id)!;
            const meta = TYPE_META[node.type];
            return <g key={node.id} role="button" tabIndex={0} aria-label={`${meta.label}: ${node.label}, ${node.status}`} className={`trace-node ${node.impacted ? 'impacted' : ''} ${selectedId === node.id ? 'selected' : ''}`} onClick={() => setSelectedId(node.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(node.id); } }}>
              <rect x={position.x - 76} y={position.y - 22} width="152" height="44" rx="8" style={{ stroke: meta.color }}/>
              {node.impacted && <circle cx={position.x + 65} cy={position.y - 13} r="5" fill="#fb7185"/>}
              <text x={position.x} y={position.y - 3} textAnchor="middle">{short(node.label)}</text>
              <text className="trace-node-status" x={position.x} y={position.y + 13} textAnchor="middle">{node.status}</text>
            </g>;
          })}
        </svg>
      </div>
      {selected && <aside className="trace-detail" aria-live="polite">
        <div><span className="meta">{TYPE_META[selected.type].label.toUpperCase()}</span><b>{selected.label}</b><small>{selected.id}</small></div>
        <dl><div><dt>Durum</dt><dd>{selected.status}</dd></div><div><dt>Son değişiklik</dt><dd>r{selected.lastChangedRevision} · {selected.lastChangeReason}</dd></div><div><dt>Plan bölümleri</dt><dd>{selected.affectedSectionIds.join(', ') || 'Belirtilmedi'}</dd></div><div><dt>Bağlantılar</dt><dd>{view.edges.filter(edge => edge.fromId === selected.id || edge.toId === selected.id).length}</dd></div></dl>
      </aside>}
      <details className="trace-list-fallback">
        <summary><ListTree size={14}/> Erişilebilir bağlantı listesini aç</summary>
        <ul>{visibleEdges.map(edge => {
          const from = view.nodes.find(node => node.id === edge.fromId);
          const to = view.nodes.find(node => node.id === edge.toId);
          return <li key={edge.id}><b>{from?.label}</b><span>{edge.relation}</span><b>{to?.label}</b></li>;
        })}</ul>
      </details>
      {visibleNodes.length === 60 && <small className="trace-limit">Performans için ilk 60 kayıt gösteriliyor; arama ve filtrelerle daraltın.</small>}
    </section>
  );
}
