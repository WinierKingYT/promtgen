import { normalizeProjectDocument } from './canonical-entities.js';
import type { PlanningDepthLevel } from './contracts.js';

const DEPTHS: PlanningDepthLevel[] = ['quick', 'standard', 'advanced', 'enterprise'];

function increment(map: Map<string, number>, key: string, amount = 1): void {
    if (!key) return;
    map.set(key, (map.get(key) || 0) + amount);
}

export interface RankedPlanningSignal {
  id: string;
  count: number;
}

function ranked(map: Map<string, number>, limit = 8): RankedPlanningSignal[] {
    return [...map.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)).slice(0, limit);
}

export interface LocalPlanningMemory {
  version: 1;
  sourceProjectCount: number;
  depthAffinity: RankedPlanningSignal[];
  moduleAffinity: RankedPlanningSignal[];
  acceptedSuggestionKinds: RankedPlanningSignal[];
  rejectedSuggestionKinds: RankedPlanningSignal[];
  sectionAffinity: RankedPlanningSignal[];
  recurringDecisionThemes: RankedPlanningSignal[];
}

/**
 * `projects` is deliberately `unknown[]`, not `ProjectDocumentV5[]`: every entry is
 * piped through `normalizeProjectDocument` (which itself accepts `unknown`) before
 * use, so this function already tolerates legacy/unnormalized project records — a
 * narrower `ProjectDocumentV5[]` parameter type would overclaim a precondition the
 * implementation does not actually require.
 */
export function buildLocalPlanningMemory(projects: unknown[] = [], excludeProjectId = ''): LocalPlanningMemory {
    const source = projects
        .filter(project => {
            const id = (project as { id?: unknown } | null | undefined)?.id;
            return Boolean(id) && id !== excludeProjectId;
        })
        .map(normalizeProjectDocument);
    const depthCounts = new Map<string, number>(DEPTHS.map(depth => [depth, 0]));
    const moduleCounts = new Map<string, number>();
    const acceptedKinds = new Map<string, number>();
    const rejectedKinds = new Map<string, number>();
    const sectionAffinity = new Map<string, number>();
    const recurringDecisionThemes = new Map<string, number>();

    for (const project of source) {
        increment(depthCounts, project.planningDepth.selected);
        for (const module of project.modules.active) increment(moduleCounts, module.id);
        for (const decision of project.decisions.filter(item => item.status === 'accepted')) {
            const theme = String(decision.title || '').toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
            increment(recurringDecisionThemes, theme);
        }
        for (const item of project.proposalStore.bundles.flatMap(bundle => bundle.items)) {
            if (['accepted', 'edited'].includes(item.status)) {
                increment(acceptedKinds, item.kind);
                for (const section of item.affectedSections || []) increment(sectionAffinity, section);
            } else if (item.status === 'rejected') increment(rejectedKinds, item.kind);
        }
    }

    return {
        version: 1,
        sourceProjectCount: source.length,
        depthAffinity: ranked(depthCounts, 4).filter(item => item.count > 0),
        moduleAffinity: ranked(moduleCounts, 8),
        acceptedSuggestionKinds: ranked(acceptedKinds, 5),
        rejectedSuggestionKinds: ranked(rejectedKinds, 5),
        sectionAffinity: ranked(sectionAffinity, 12),
        recurringDecisionThemes: ranked(recurringDecisionThemes, 8).filter(item => item.count >= 2)
    };
}

export function hasUsefulPlanningMemory(memory: LocalPlanningMemory | null | undefined): boolean {
    return Boolean(memory?.sourceProjectCount && (memory.depthAffinity?.length || memory.moduleAffinity?.length || memory.acceptedSuggestionKinds?.length));
}
