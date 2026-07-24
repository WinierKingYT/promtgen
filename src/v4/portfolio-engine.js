import { normalizeProjectStateV4 } from './canonical-entities.js';

export function buildPortfolioSummary(projects = []) {
    const normalized = projects.map(normalizeProjectStateV4);
    const depths = Object.fromEntries(['quick', 'standard', 'advanced', 'enterprise'].map(depth => [depth, normalized.filter(project => project.planningDepth.selected === depth).length]));
    const statuses = Object.fromEntries(['active', 'finalized', 'archived'].map(status => [status, normalized.filter(project => project.lifecycle.status === status).length]));
    const averageReadiness = normalized.length ? Math.round(normalized.reduce((total, project) => total + project.readiness.score, 0) / normalized.length) : 0;
    const attention = normalized.filter(project => project.readiness.blockers.length || Object.values(project.sections).some(section => section.status === 'stale')).map(project => ({
        id: project.id, name: project.identity.name, blockers: project.readiness.blockers.length,
        staleSections: Object.values(project.sections).filter(section => section.status === 'stale').length,
        readiness: project.readiness.score
    })).sort((a, b) => b.blockers - a.blockers || a.readiness - b.readiness);
    return { total: normalized.length, depths, statuses, averageReadiness, attention };
}

export function filterPortfolioProjects(projects = [], { query = '', status = 'all', depth = 'all', sort = 'updated' } = {}) {
    const needle = String(query).trim().toLocaleLowerCase('tr-TR');
    const filtered = projects.map(normalizeProjectStateV4).filter(project => {
        const matchesQuery = !needle || `${project.identity.name} ${project.identity.summary}`.toLocaleLowerCase('tr-TR').includes(needle);
        return matchesQuery && (status === 'all' || project.lifecycle.status === status) && (depth === 'all' || project.planningDepth.selected === depth);
    });
    return filtered.sort((a, b) => sort === 'readiness' ? b.readiness.score - a.readiness.score : sort === 'name' ? a.identity.name.localeCompare(b.identity.name, 'tr') : b.lifecycle.updatedAt.localeCompare(a.lifecycle.updatedAt));
}

export function buildComparativeAnalytics(projects = []) {
    const normalized = projects.map(normalizeProjectStateV4);
    const summary = buildPortfolioSummary(projects);
    
    const totalRevisions = normalized.reduce((total, p) => total + (p.revision || 1), 0);
    const totalTasks = normalized.reduce((total, p) => total + (p.tasks?.length || 0), 0);
    const totalDecisions = normalized.reduce((total, p) => total + (p.decisions?.length || 0), 0);
    
    const topActive = [...normalized].sort((a, b) => (b.revision || 1) - (a.revision || 1)).slice(0, 3).map(p => ({
        id: p.id,
        name: p.identity.name,
        revision: p.revision,
        score: p.readiness?.score || 0
    }));

    return {
        ...summary,
        totalRevisions,
        totalTasks,
        totalDecisions,
        topActive,
        analyzedAt: new Date().toISOString()
    };
}
