import { createProjectDocument, validateProjectDocument } from './project-document.js';
import { assessPlanningDepth } from './planning-engine.js';
import { normalizeProjectDocument } from './canonical-entities.js';

const PHASE_MAP = {
    IDEA_CAPTURED: 'DISCOVERY', PROFILE_DRAFTED: 'DISCOVERY', PROJECT_PROFILED: 'DISCOVERY', DISCOVERY_IN_PROGRESS: 'DISCOVERY',
    MVP_DEFINED: 'SHAPING', OBJECTIVES_DEFINED: 'SHAPING', REQUIREMENTS_DRAFTED: 'SHAPING', SCOPE_DEFINED: 'SHAPING', DELIVERABLES_DEFINED: 'SHAPING',
    TECH_OPTIONS_READY: 'DESIGN', TECH_STACK_SELECTED: 'DESIGN', ARCHITECTURE_DRAFTED: 'DESIGN',
    TASKS_DRAFTED: 'PLANNING', EXECUTION_PLAN_DRAFTED: 'PLANNING', AGENT_PACKAGE_DRAFTED: 'PLANNING',
    REVIEW_IN_PROGRESS: 'REVIEW', READY_FOR_EXPORT: 'READY', EXPORTED: 'READY'
};

const ARRAY_FIELDS = [
    'objectives', 'requirements', 'decisions', 'assumptions', 'risks', 'tasks', 'testCases', 'milestones',
    'traceLinks', 'agentPrompts', 'researchQuestions', 'sources', 'evidence', 'reviewFindings',
    'simulationRuns', 'executionSessions', 'openQuestions', 'messages', 'revisions', 'exports', 'commandLog',
    'dismissedSuggestionFingerprints', 'impactAnalyses', 'planningScenarios', 'sectionPatchProposals', 'ideaDocumentRevisions'
];

export const LATEST_SCHEMA_VERSION = 5;
export const LATEST_SCHEMA_REVISION = 3;

export function migrateLegacyToV5(input) {
    if (!input || typeof input !== 'object') return failure(input, 'Geçersiz proje verisi.');
    const source = input.currentProjectState || input;
    const idea = source.identity?.originalIdea || source.identity?.summary || source.identity?.problemStatement || input.draftDescription || 'İçe aktarılan proje';
    const assessment = assessPlanningDepth(idea);
    const depthName = source.configuration?.planningDepth || ({ 3: 'quick', 5: 'standard', 8: 'advanced', 12: 'enterprise' }[input.stepDepth]) || assessment.recommended;
    const project = createProjectDocument({
        idea,
        name: source.identity?.name || input.name || 'İçe Aktarılan Proje',
        outputLanguage: source.identity?.outputLanguage || (source.configuration?.language === 'en' ? 'en' : 'tr'),
        planningDepth: { ...assessment, selected: depthName, overridden: Boolean(source.configuration?.planningDepth || input.stepDepth) },
        profile: {
            domains: source.profile?.domains || [],
            platforms: source.profile?.platforms || [],
            importedContext: source.profile?.importedContext || []
        }
    });

    project.id = source.id || source.projectId || input.id || project.id;
    const sourceRevision = Number(source.documentRevision || source.revision || project.documentRevision);
    project.documentRevision = sourceRevision;
    project.canonicalRevision = Number(source.canonicalRevision || source.revision || project.canonicalRevision);
    project.lifecycle = { ...project.lifecycle, ...(source.lifecycle || {}) };
    project.lifecycle.activePhase = PHASE_MAP[source.phase || source.workflowStage] || source.lifecycle?.activePhase || project.lifecycle.activePhase;
    if ((source.phase || source.workflowStage) === 'EXPORTED') {
        project.lifecycle.status = 'finalized';
        project.exports.push({ id: `legacy-export-${Date.now()}`, format: 'legacy', canonicalRevision: project.canonicalRevision, createdAt: source.lifecycle?.updatedAt || new Date().toISOString() });
    }

    copySection(project, 'vision', source.identity?.summary || idea, []);
    copySection(project, 'objectives', '', (source.objectives || source.requirements || []).map(item => item.title || item.description || item.text || String(item)));
    copySection(project, 'scope', '', [...(source.scope?.mustHave || []), ...(source.scope?.shouldHave || [])]);
    copySection(project, 'decisions', '', (source.decisions || []).map(item => item.title || item.decision || String(item)));
    copySection(project, 'architecture', source.moduleData?.software?.architecture?.description || source.architecture?.description || '', []);
    copySection(project, 'tasks', '', (source.tasks || []).map(item => item.title || String(item)));
    copySection(project, 'risks', '', (source.risks || []).map(item => item.description || item.title || String(item)));

    for (const field of ARRAY_FIELDS) {
        if (Array.isArray(source[field])) project[field] = structuredClone(source[field]);
    }
    project.agentPrompts = structuredClone(source.agentPrompts || source.prompts || project.agentPrompts);
    if (source.sections && typeof source.sections === 'object') project.sections = structuredClone(source.sections);
    project.proposalStore = {
        bundles: structuredClone(source.proposalStore?.bundles || source.suggestionBundles || [])
    };
    project.modules = structuredClone(source.modules || project.modules);
    project.readiness = structuredClone(source.readiness || project.readiness);
    project.ideaLabSession = structuredClone(source.ideaLabSession || project.ideaLabSession);
    project.ideaDiscussion = structuredClone(source.ideaDiscussion || project.ideaDiscussion);
    if (source.ideaExpansionSession) project.ideaExpansionSession = structuredClone(source.ideaExpansionSession);
    project.metadata = {
        ...(source.metadata || {}),
        canonicalModelVersion: 1,
        migration: {
            migratedAt: new Date().toISOString(),
            sourceSchemaVersion: source.schemaVersion ?? 1,
            sourceSchemaRevision: source.schemaRevision ?? null
        }
    };

    return finalizeMigration(project, input, source.schemaVersion ?? 1);
}

export function migrateV4toV5(input) {
    if (!input || typeof input !== 'object') return failure(input, 'Geçersiz proje verisi.');
    if (input.schemaVersion !== 4) {
        return failure(input, `Beklenmeyen schemaVersion: ${input.schemaVersion}. Yalnızca 4→5 migration destekleniyor.`);
    }
    return migrateLegacyToV5(input);
}

export function tryMigrateOrPassthrough(input) {
    if (!input || typeof input !== 'object') return { project: input, migrated: false, error: 'Geçersiz proje verisi.', backup: input };

    if (input.schemaVersion === LATEST_SCHEMA_VERSION && input.schemaRevision === LATEST_SCHEMA_REVISION) {
        const project = normalizeProjectDocument(structuredClone(input));
        const validation = validateProjectDocument(project);
        return validation.valid
            ? { project, migrated: false, error: null, backup: structuredClone(input) }
            : { project: input, migrated: false, error: validation.errors.join('; '), backup: structuredClone(input) };
    }

    const result = input.schemaVersion === 4
        ? migrateV4toV5(input)
        : input.schemaVersion === 5
            ? finalizeMigration(structuredClone(input), input, 5)
            : migrateLegacyToV5(input);
    return result.success
        ? { project: result.project, migrated: true, error: null, backup: result.backup }
        : { project: input, migrated: false, error: result.error, backup: result.backup };
}

function finalizeMigration(candidate, original, migratedFrom) {
    const project = normalizeProjectDocument(candidate);
    project.schemaVersion = LATEST_SCHEMA_VERSION;
    project.schemaRevision = LATEST_SCHEMA_REVISION;
    delete project.suggestionBundles;
    repairLegacyAcceptanceMetadata(project);
    const validation = validateProjectDocument(project);
    if (!validation.valid) return failure(original, validation.errors.join('; '));
    return {
        success: true,
        project,
        backup: structuredClone(original),
        migratedFrom
    };
}

function repairLegacyAcceptanceMetadata(project) {
    const warnings = [];
    for (const requirement of project.requirements) {
        if (requirement.status === 'accepted' && requirement.acceptanceCriteria.length === 0) {
            requirement.acceptanceCriteria = ['Migration sonrası kabul kriteri kullanıcı tarafından doğrulanmalı.'];
            warnings.push(`Gereksinim kabul kriteri tamamlandı: ${requirement.id}`);
        }
    }
    for (const decision of project.decisions) {
        if (decision.status === 'accepted' && !decision.rationale) {
            decision.rationale = 'Eski kayıtta gerekçe bulunmadı; migration sonrası kullanıcı doğrulaması gerekiyor.';
            warnings.push(`Karar gerekçesi tamamlandı: ${decision.id}`);
        }
    }
    if (warnings.length > 0) {
        project.metadata.migrationWarnings = [...(project.metadata.migrationWarnings || []), ...warnings];
    }
}

function failure(original, error) {
    return { success: false, error, project: null, backup: structuredClone(original) };
}

function copySection(project, id, content, items) {
    const section = project.sections[id];
    if (!section) return;
    section.content = String(content || '');
    section.items = items.filter(Boolean).map(String);
    section.status = section.content || section.items.length ? 'draft' : 'empty';
}
