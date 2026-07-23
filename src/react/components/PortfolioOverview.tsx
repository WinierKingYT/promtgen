import { useMemo, useState } from 'react';
import { ArrowRight, CircleAlert, FolderKanban, Gauge, Search } from 'lucide-react';
import { buildPortfolioSummary, filterPortfolioProjects } from '../../v4/portfolio-engine.js';

export function PortfolioOverview({ projects, onOpen }: any) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [depth, setDepth] = useState('all');
  const [sort, setSort] = useState('updated');
  const summary = useMemo(() => buildPortfolioSummary(projects), [projects]);
  const visible = useMemo(() => filterPortfolioProjects(projects, { query, status, depth, sort }), [projects, query, status, depth, sort]);
  if (!projects.length) return null;
  return <section className="portfolio-overview" aria-labelledby="portfolio-title">
    <div className="portfolio-head"><div><span className="meta">YEREL PORTFÖY</span><h2 id="portfolio-title"><FolderKanban size={17}/> Projelerin</h2></div><span>{visible.length}/{summary.total}</span></div>
    <div className="portfolio-metrics"><span><b>{summary.total}</b><small>toplam</small></span><span><b>{summary.statuses.active}</b><small>canlı</small></span><span><b>{summary.statuses.finalized}</b><small>final</small></span><span><b>{summary.averageReadiness}</b><small>ort. hazırlık</small></span></div>
    <div className="portfolio-controls"><label><Search size={14}/><input aria-label="Projelerde ara" value={query} onChange={event => setQuery(event.target.value)} placeholder="Proje ara…"/></label><select aria-label="Proje durumu" value={status} onChange={event => setStatus(event.target.value)}><option value="all">Tüm durumlar</option><option value="active">Canlı</option><option value="finalized">Final</option><option value="archived">Arşiv</option></select><select aria-label="Plan derinliği" value={depth} onChange={event => setDepth(event.target.value)}><option value="all">Tüm derinlikler</option><option value="quick">Quick</option><option value="standard">Standard</option><option value="advanced">Advanced</option><option value="enterprise">Enterprise</option></select><select aria-label="Proje sıralaması" value={sort} onChange={event => setSort(event.target.value)}><option value="updated">Son güncellenen</option><option value="readiness">Hazırlık skoru</option><option value="name">Ada göre</option></select></div>
    {summary.attention.length > 0 && <p className="portfolio-attention"><CircleAlert size={14}/>{summary.attention.length} proje eksik veya güncelliğini yitirmiş bölüm içeriyor.</p>}
    <div className="portfolio-projects">{visible.slice(0, 20).map((project: any) => <button type="button" key={project.id} onClick={() => onOpen(project.id)}><span className="portfolio-score"><Gauge size={13}/>{project.readiness.score}</span><span><b>{project.identity.name}</b><small>{project.planningDepth.selected} · r{project.revision} · {project.lifecycle.status === 'finalized' ? 'final' : project.lifecycle.status === 'archived' ? 'arşiv' : 'canlı'}</small></span><ArrowRight size={15}/></button>)}</div>
    {!visible.length && <p className="portfolio-empty">Bu filtrelerle eşleşen yerel proje yok.</p>}
  </section>;
}
