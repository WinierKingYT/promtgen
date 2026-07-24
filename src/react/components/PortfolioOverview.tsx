import { useMemo, useState } from 'react';
import { ArrowRight, CircleAlert, FolderKanban, Gauge, Search, Layers, Activity } from 'lucide-react';
import { buildPortfolioSummary, filterPortfolioProjects, buildComparativeAnalytics } from '../../v4/portfolio-engine.js';

export function PortfolioOverview({ projects, onOpen }: any) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [depth, setDepth] = useState('all');
  const [sort, setSort] = useState('updated');
  const summary = useMemo(() => buildPortfolioSummary(projects), [projects]);
  const analytics = useMemo(() => buildComparativeAnalytics(projects), [projects]);
  const visible = useMemo(() => filterPortfolioProjects(projects, { query, status, depth, sort }), [projects, query, status, depth, sort]);
  if (!projects.length) return null;
  return <section className="portfolio-overview" aria-labelledby="portfolio-title">
    <div className="portfolio-head"><div><span className="meta">YEREL PORTFÖY ANALİTİĞİ</span><h2 id="portfolio-title"><FolderKanban size={17}/> Projelerin ({summary.total})</h2></div><span>{visible.length}/{summary.total}</span></div>
    
    <div className="portfolio-metrics">
      <span><b>{summary.total}</b><small>toplam proje</small></span>
      <span><b>{analytics.totalRevisions}</b><small>toplam revizyon</small></span>
      <span><b>{analytics.totalTasks}</b><small>toplam görev</small></span>
      <span><b>%{summary.averageReadiness}</b><small>ort. hazırlık</small></span>
    </div>

    {/* Top Active Projects Badge Row */}
    {analytics.topActive?.length > 0 && (
      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ color: '#a78bfa', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Activity size={13} /> En Aktif Projeler:
        </span>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {analytics.topActive.map((p: any) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onOpen(p.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', textDecoration: 'underline', padding: 0, fontSize: '12px' }}
            >
              <b>{p.name}</b> (r{p.revision})
            </button>
          ))}
        </div>
      </div>
    )}

    <div className="portfolio-controls"><label><Search size={14}/><input aria-label="Projelerde ara" value={query} onChange={event => setQuery(event.target.value)} placeholder="Proje ara…"/></label><select aria-label="Proje durumu" value={status} onChange={event => setStatus(event.target.value)}><option value="all">Tüm durumlar</option><option value="active">Canlı</option><option value="finalized">Final</option><option value="archived">Arşiv</option></select><select aria-label="Plan derinliği" value={depth} onChange={event => setDepth(event.target.value)}><option value="all">Tüm derinlikler</option><option value="quick">Quick</option><option value="standard">Standard</option><option value="advanced">Advanced</option><option value="enterprise">Enterprise</option></select><select aria-label="Proje sıralaması" value={sort} onChange={event => setSort(event.target.value)}><option value="updated">Son güncellenen</option><option value="readiness">Hazırlık skoru</option><option value="name">Ada göre</option></select></div>
    {summary.attention.length > 0 && <p className="portfolio-attention"><CircleAlert size={14}/>{summary.attention.length} proje eksik veya güncelliğini yitirmiş bölüm içeriyor.</p>}
    <div className="portfolio-projects">{visible.slice(0, 20).map((project: any) => <button type="button" key={project.id} onClick={() => onOpen(project.id)}><span className="portfolio-score"><Gauge size={13}/>{project.readiness.score}</span><span><b>{project.identity.name}</b><small>{project.planningDepth.selected} · r{project.revision} · {project.lifecycle.status === 'finalized' ? 'final' : project.lifecycle.status === 'archived' ? 'arşiv' : 'canlı'}</small></span><ArrowRight size={15}/></button>)}</div>
    {!visible.length && <p className="portfolio-empty">Bu filtrelerle eşleşen yerel proje yok.</p>}
  </section>;
}
