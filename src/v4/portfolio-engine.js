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
