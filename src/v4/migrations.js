import { createProjectStateV4, validateProjectStateV4 } from './project-state-v4.js';
import { assessPlanningDepth, recalculateReadiness } from './planning-engine.js';
import { normalizeProjectStateV4 } from './canonical-entities.js';

const PHASE_MAP = {
    IDEA_CAPTURED: 'DISCOVERY', PROFILE_DRAFTED: 'DISCOVERY', PROJECT_PROFILED: 'DISCOVERY', DISCOVERY_IN_PROGRESS: 'DISCOVERY',
    MVP_DEFINED: 'SHAPING', OBJECTIVES_DEFINED: 'SHAPING', REQUIREMENTS_DRAFTED: 'SHAPING', SCOPE_DEFINED: 'SHAPING', DELIVERABLES_DEFINED: 'SHAPING',
    TECH_OPTIONS_READY: 'DESIGN', TECH_STACK_SELECTED: 'DESIGN', ARCHITECTURE_DRAFTED: 'DESIGN',
    TASKS_DRAFTED: 'PLANNING', EXECUTION_PLAN_DRAFTED: 'PLANNING', AGENT_PACKAGE_DRAFTED: 'PLANNING',
    REVIEW_IN_PROGRESS: 'REVIEW', READY_FOR_EXPORT: 'READY', EXPORTED: 'READY'
};

export function migrateToV4(input) {
    if (!input || typeof input !== 'object') return { success: false, error: 'Geçersiz proje verisi.', project: null, backup: input };
    if (input.schemaVersion === 4) {
        const normalized = normalizeProjectStateV4(input);
        const validation = validateProjectStateV4(normalized);
        return validation.valid ? { success: true, project: normalized, backup: structuredClone(input), migratedFrom: 4 } : { success: false, error: validation.errors.join('; '), project: null, backup: input };
    }
    const source = input.currentProjectState || input;
    const idea = source.identity?.originalIdea || source.identity?.summary || source.identity?.problemStatement || input.draftDescription || 'İçe aktarılan proje';
    const depthName = source.configuration?.planningDepth || ({ 3: 'quick', 5: 'standard', 8: 'advanced', 12: 'enterprise' }[input.stepDepth]) || assessPlanningDepth(idea).recommended;
    const project = createProjectStateV4({
        idea,
        name: source.identity?.name || input.name || 'İçe Aktarılan Proje',
        outputLanguage: source.configuration?.language === 'en' ? 'en' : 'tr',
        planningDepth: { ...assessPlanningDepth(idea), selected: depthName, overridden: Boolean(source.configuration?.planningDepth || input.stepDepth) },
        profile: { domains: source.profile?.domains || [], platforms: source.profile?.platforms || [], importedContext: [] }
    });
    project.id = source.projectId || input.id || project.id;
    project.lifecycle.activePhase = PHASE_MAP[source.phase || source.workflowStage] || 'DISCOVERY';
    project.lifecycle.status = source.lifecycle?.status === 'archived' ? 'archived' : 'active';
    if ((source.phase || source.workflowStage) === 'EXPORTED') {
        project.lifecycle.status = 'finalized';
        project.exports.push({ id: `legacy-export-${Date.now()}`, format: 'legacy', revision: project.revision, createdAt: source.lifecycle?.updatedAt || new Date().toISOString() });
    }
    copySection(project, 'vision', source.identity?.summary || idea, []);
    copySection(project, 'objectives', '', (source.objectives || source.requirements || []).map(item => item.title || item.description || item.text || String(item)));
    copySection(project, 'scope', '', [...(source.scope?.mustHave || []), ...(source.scope?.shouldHave || [])]);
    copySection(project, 'decisions', '', (source.decisions || []).map(item => item.title || item.decision || String(item)));
    copySection(project, 'architecture', source.moduleData?.software?.architecture?.description || source.architecture?.description || '', []);
    copySection(project, 'tasks', '', (source.tasks || []).map(item => item.title || String(item)));
    copySection(project, 'risks', '', (source.risks || []).map(item => item.description || item.title || String(item)));
    project.objectives = structuredClone(source.objectives || []);
    project.requirements = structuredClone(source.requirements || []);
    project.decisions = structuredClone(source.decisions || []);
    project.assumptions = structuredClone(source.assumptions || []);
    project.tasks = structuredClone(source.tasks || []);
    project.risks = structuredClone(source.risks || []);
    project.testCases = structuredClone(source.testCases || []);
    project.milestones = structuredClone(source.milestones || []);
    project.traceLinks = structuredClone(source.traceLinks || []);
    project.agentPrompts = structuredClone(source.agentPrompts || source.prompts || []);
    project.researchQuestions = structuredClone(source.researchQuestions || []);
    project.sources = structuredClone(source.sources || []);
    project.evidence = structuredClone(source.evidence || []);
    project.reviewFindings = structuredClone(source.reviewFindings || []);
    project.simulationRuns = structuredClone(source.simulationRuns || []);
    project.executionSessions = structuredClone(source.executionSessions || []);
    project.openQuestions = structuredClone(source.openQuestions || []);
    project.metadata.legacyBackup = { schemaVersion: source.schemaVersion || 1, importedAt: new Date().toISOString() };
    const validation = validateProjectStateV4(project);
    if (!validation.valid) return { success: false, error: validation.errors.join('; '), project: null, backup: structuredClone(input) };
    return { success: true, project: recalculateReadiness(normalizeProjectStateV4(project)), backup: structuredClone(input), migratedFrom: source.schemaVersion || 1 };
}

function copySection(project, id, content, items) {
    const section = project.sections[id];
    if (!section) return;
    section.content = String(content || '');
    section.items = items.filter(Boolean).map(String);
    section.status = section.content || section.items.length ? 'draft' : 'empty';
}
