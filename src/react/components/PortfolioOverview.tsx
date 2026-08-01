import { useMemo, useState } from 'react';
import { Archive, ArrowRight, CircleAlert, FolderKanban, Gauge, Search, Activity, RotateCcw, Trash2 } from 'lucide-react';
import { buildPortfolioSummary, filterPortfolioProjects, buildComparativeAnalytics } from '../../v4/portfolio-engine.js';
import type { ProjectDocumentV5 } from '../../v4/contracts.js';
import type {
  PortfolioDepthFilter,
  PortfolioSort,
  PortfolioStatusFilter
} from '../../v4/portfolio-engine.js';
import { ProjectDeleteDialog } from './ProjectDeleteDialog.js';

interface PortfolioOverviewProps {
  projects: ProjectDocumentV5[];
  onOpen: (projectId: string) => void;
  onArchive: (projectId: string) => Promise<boolean>;
  onRestore: (projectId: string) => Promise<boolean>;
  onPurge: (projectId: string) => Promise<boolean>;
}

export function PortfolioOverview({ projects, onOpen, onArchive, onRestore, onPurge }: PortfolioOverviewProps) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<PortfolioStatusFilter>('all');
  const [depth, setDepth] = useState<PortfolioDepthFilter>('all');
  const [sort, setSort] = useState<PortfolioSort>('updated');
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const [deleteProject, setDeleteProject] = useState<ProjectDocumentV5 | null>(null);
  const [actionStatus, setActionStatus] = useState('');
  const summary = useMemo(() => buildPortfolioSummary(projects), [projects]);
  const analytics = useMemo(() => buildComparativeAnalytics(projects), [projects]);
  const visible = useMemo(() => filterPortfolioProjects(projects, { query, status, depth, sort }), [projects, query, status, depth, sort]);
  const changeArchiveState = async (project: ProjectDocumentV5) => {
    setBusyProjectId(project.id);
    const restoring = project.lifecycle.status === 'archived';
    try {
      const changed = restoring ? await onRestore(project.id) : await onArchive(project.id);
      if (changed) setActionStatus(restoring ? `${project.identity.name} arşivden çıkarıldı.` : `${project.identity.name} arşivlendi.`);
    } finally {
      setBusyProjectId(null);
    }
  };
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
          {analytics.topActive.map(project => (
            <button
              key={project.id}
              type="button"
              onClick={() => onOpen(project.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', textDecoration: 'underline', padding: 0, fontSize: '12px' }}
            >
              <b>{project.name}</b> (r{project.canonicalRevision})
            </button>
          ))}
        </div>
      </div>
    )}

    <div className="portfolio-controls"><label><Search size={14}/><input aria-label="Projelerde ara" value={query} onChange={event => setQuery(event.target.value)} placeholder="Proje ara…"/></label><select aria-label="Proje durumu" value={status} onChange={event => setStatus(event.target.value as PortfolioStatusFilter)}><option value="all">Tüm durumlar</option><option value="active">Canlı</option><option value="finalized">Final</option><option value="archived">Arşiv</option></select><select aria-label="Plan derinliği" value={depth} onChange={event => setDepth(event.target.value as PortfolioDepthFilter)}><option value="all">Tüm derinlikler</option><option value="quick">Quick</option><option value="standard">Standard</option><option value="advanced">Advanced</option><option value="enterprise">Enterprise</option></select><select aria-label="Proje sıralaması" value={sort} onChange={event => setSort(event.target.value as PortfolioSort)}><option value="updated">Son güncellenen</option><option value="readiness">Hazırlık skoru</option><option value="name">Ada göre</option></select></div>
    {summary.attention.length > 0 && <p className="portfolio-attention"><CircleAlert size={14}/>{summary.attention.length} proje eksik veya güncelliğini yitirmiş bölüm içeriyor.</p>}
    <div className="portfolio-projects">{visible.slice(0, 20).map(project => <article className="portfolio-project-card" key={project.id}>
      <button className="portfolio-project-open" type="button" onClick={() => onOpen(project.id)}>
        <span className="portfolio-score"><Gauge size={13}/>{project.readiness.score}</span>
        <span><b>{project.identity.name}</b><small>{project.planningDepth.selected} · r{project.canonicalRevision} · {project.lifecycle.status === 'finalized' ? 'final' : project.lifecycle.status === 'archived' ? 'arşiv' : 'canlı'}</small></span>
        <ArrowRight size={15}/>
      </button>
      <div className="portfolio-project-actions" aria-label={`${project.identity.name} proje işlemleri`}>
        <button
          type="button"
          disabled={busyProjectId === project.id}
          onClick={() => changeArchiveState(project)}
          title={project.lifecycle.status === 'archived' ? 'Arşivden çıkar' : 'Arşivle'}
          aria-label={`${project.identity.name} projesini ${project.lifecycle.status === 'archived' ? 'arşivden çıkar' : 'arşivle'}`}
        >
          {project.lifecycle.status === 'archived' ? <RotateCcw size={14}/> : <Archive size={14}/>}
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => setDeleteProject(project)}
          title="Kalıcı sil"
          aria-label={`${project.identity.name} projesini kalıcı sil`}
        ><Trash2 size={14}/></button>
      </div>
    </article>)}</div>
    {!visible.length && <p className="portfolio-empty">Bu filtrelerle eşleşen yerel proje yok.</p>}
    <p className="sr-only" aria-live="polite" aria-atomic="true">{actionStatus}</p>
    {deleteProject && <ProjectDeleteDialog
      projectName={deleteProject.identity.name}
      onClose={() => setDeleteProject(null)}
      onConfirm={async () => {
        const deleted = await onPurge(deleteProject.id);
        if (deleted) setActionStatus(`${deleteProject.identity.name} kalıcı olarak silindi.`);
        return deleted;
      }}
    />}
  </section>;
}
