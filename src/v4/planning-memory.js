import { normalizeProjectStateV4 } from './canonical-entities.js';

const DEPTHS = ['quick', 'standard', 'advanced', 'enterprise'];

function increment(map, key, amount = 1) {
    if (!key) return;
    map.set(key, (map.get(key) || 0) + amount);
}

function ranked(map, limit = 8) {
    return [...map.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)).slice(0, limit);
}

export function buildLocalPlanningMemory(projects = [], excludeProjectId = '') {
    const source = projects.filter(project => project?.id && project.id !== excludeProjectId).map(normalizeProjectStateV4);
    const depthCounts = new Map(DEPTHS.map(depth => [depth, 0]));
    const moduleCounts = new Map();
    const acceptedKinds = new Map();
    const rejectedKinds = new Map();
    const sectionAffinity = new Map();
    const recurringDecisionThemes = new Map();

    for (const project of source) {
        increment(depthCounts, project.planningDepth.selected);
        for (const module of project.modules.active) increment(moduleCounts, module.id);
        for (const decision of project.decisions.filter(item => item.status === 'accepted')) {
            const theme = String(decision.title || '').toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
            increment(recurringDecisionThemes, theme);
        }
        for (const item of project.suggestionBundles.flatMap(bundle => bundle.items)) {
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

export function hasUsefulPlanningMemory(memory) {
    return Boolean(memory?.sourceProjectCount && (memory.depthAffinity?.length || memory.moduleAffinity?.length || memory.acceptedSuggestionKinds?.length));
}
