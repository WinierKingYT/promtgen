import { normalizeProjectDocument } from './canonical-entities.js';
import type {
    PlanningDepthLevel,
    ProjectDocumentV5,
    ProjectLifecycleStatus
} from './contracts.js';

export type PortfolioStatusFilter = 'all' | ProjectLifecycleStatus;
export type PortfolioDepthFilter = 'all' | PlanningDepthLevel;
export type PortfolioSort = 'updated' | 'readiness' | 'name';

export interface PortfolioFilters {
    query?: string;
    status?: PortfolioStatusFilter;
    depth?: PortfolioDepthFilter;
    sort?: PortfolioSort;
}

export interface PortfolioAttentionItem {
    id: string;
    name: string;
    blockers: number;
    staleSections: number;
    readiness: number;
}

export interface PortfolioSummary {
    total: number;
    depths: Record<PlanningDepthLevel, number>;
    statuses: Record<ProjectLifecycleStatus, number>;
    averageReadiness: number;
    attention: PortfolioAttentionItem[];
}

export interface PortfolioActiveProject {
    id: string;
    name: string;
    canonicalRevision: number;
    score: number;
}

export interface PortfolioAnalytics extends PortfolioSummary {
    totalRevisions: number;
    totalTasks: number;
    totalDecisions: number;
    topActive: PortfolioActiveProject[];
    analyzedAt: string;
}

const PLANNING_DEPTH_LEVELS: PlanningDepthLevel[] = ['quick', 'standard', 'advanced', 'enterprise'];
const PROJECT_LIFECYCLE_STATUSES: ProjectLifecycleStatus[] = ['active', 'finalized', 'archived'];

export function buildPortfolioSummary(projects: ProjectDocumentV5[] = []): PortfolioSummary {
    const normalized = projects.map(normalizeProjectDocument);
    // `Object.fromEntries` always widens to an index signature (`{ [k: string]: number }`),
    // which can't express "every PlanningDepthLevel/ProjectLifecycleStatus key is present" --
    // an invariant guaranteed here only because the map source is the fixed literal list above.
    // Same justified pattern already used for `dimensionEvidence` in canonical-entities.ts.
    const depths = Object.fromEntries(PLANNING_DEPTH_LEVELS.map(depth => [depth, normalized.filter(project => project.planningDepth.selected === depth).length])) as Record<PlanningDepthLevel, number>;
    const statuses = Object.fromEntries(PROJECT_LIFECYCLE_STATUSES.map(status => [status, normalized.filter(project => project.lifecycle.status === status).length])) as Record<ProjectLifecycleStatus, number>;
    const averageReadiness = normalized.length ? Math.round(normalized.reduce((total, project) => total + project.readiness.score, 0) / normalized.length) : 0;
    const attention = normalized.filter(project => project.readiness.blockers.length || Object.values(project.sections).some(section => section.status === 'stale')).map(project => ({
        id: project.id, name: project.identity.name, blockers: project.readiness.blockers.length,
        staleSections: Object.values(project.sections).filter(section => section.status === 'stale').length,
        readiness: project.readiness.score
    })).sort((a, b) => b.blockers - a.blockers || a.readiness - b.readiness);
    return { total: normalized.length, depths, statuses, averageReadiness, attention };
}

export function filterPortfolioProjects(projects: ProjectDocumentV5[] = [], { query = '', status = 'all', depth = 'all', sort = 'updated' }: PortfolioFilters = {}): ProjectDocumentV5[] {
    const needle = String(query).trim().toLocaleLowerCase('tr-TR');
    const filtered = projects.map(normalizeProjectDocument).filter(project => {
        const matchesQuery = !needle || `${project.identity.name} ${project.identity.summary}`.toLocaleLowerCase('tr-TR').includes(needle);
        return matchesQuery && (status === 'all' || project.lifecycle.status === status) && (depth === 'all' || project.planningDepth.selected === depth);
    });
    return filtered.sort((a, b) => sort === 'readiness' ? b.readiness.score - a.readiness.score : sort === 'name' ? a.identity.name.localeCompare(b.identity.name, 'tr') : b.lifecycle.updatedAt.localeCompare(a.lifecycle.updatedAt));
}

export function buildComparativeAnalytics(projects: ProjectDocumentV5[] = []): PortfolioAnalytics {
    const normalized = projects.map(normalizeProjectDocument);
    const summary = buildPortfolioSummary(projects);

    const totalRevisions = normalized.reduce((total, p) => total + (p.canonicalRevision || 1), 0);
    const totalTasks = normalized.reduce((total, p) => total + (p.tasks?.length || 0), 0);
    const totalDecisions = normalized.reduce((total, p) => total + (p.decisions?.length || 0), 0);

    const topActive = [...normalized].sort((a, b) => (b.canonicalRevision || 1) - (a.canonicalRevision || 1)).slice(0, 3).map(p => ({
        id: p.id,
        name: p.identity.name,
        canonicalRevision: p.canonicalRevision,
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
