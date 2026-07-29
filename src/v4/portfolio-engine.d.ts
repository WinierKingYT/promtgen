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

export function buildPortfolioSummary(projects?: ProjectDocumentV5[]): PortfolioSummary;
export function filterPortfolioProjects(
  projects?: ProjectDocumentV5[],
  filters?: PortfolioFilters
): ProjectDocumentV5[];
export function buildComparativeAnalytics(projects?: ProjectDocumentV5[]): PortfolioAnalytics;
