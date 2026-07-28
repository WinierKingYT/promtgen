import { useEffect, useMemo, useState } from 'react';
import { analyzeIdea } from '../../v4/planning-engine.js';
import { createPlatformRepository } from '../../v4/tauri-storage.js';
import { generateIdeaLabBundle } from '../../v4/ai-discovery.js';
import { loadProviderSettings } from '../../v4/provider-settings.js';
import { createCredentialVault } from '../../v4/credential-vault.js';
import { analyzeSelectedFiles, projectInventoryContext } from '../../v4/project-analyzer.js';
import { readPromtgenPackage } from '../../v4/exporter.js';
import type { ProjectDocumentV5 } from '../../v4/contracts.js';
import { prepareInitialProject } from '../../v4/application/project-creation-service.js';
import { commitProjectCandidate, saveInitialProject } from '../../v4/application/command-transaction.js';

type Project = ProjectDocumentV5;

const repository = createPlatformRepository();
const credentialVault = createCredentialVault();
const DOCUMENT_ONLY_COMMANDS = new Set([
  'AddDiscoveryTurn', 'UpdateSuggestionStatus', 'ProposeChangeImpact', 'ResolveImpactContradiction',
  'RejectChangeImpact', 'CreatePlanningScenario', 'DiscardPlanningScenario', 'SelectPlanningScenario',
  'GenerateSectionPatches', 'UpdateSectionPatchStatus', 'MarkSectionPatchesStale', 'UpdateIdeaDiscussion',
  'StartExecutionSession', 'RecordExecutionResult', 'RecordExport', 'UpdateProject'
]);

export function useProjectState() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [appError, setAppError] = useState('');
  const [providerSettings, setProviderSettings] = useState(loadProviderSettings);
  const activeProject = useMemo(() => projects.find(project => project.id === activeId), [projects, activeId]);

  useEffect(() => {
    repository.list().then((items: Project[]) => {
      setProjects(items.filter(item => item.lifecycle.status !== 'archived'));
      setActiveId(null);
    }).finally(() => setLoading(false));
  }, []);

  const persist = async (project: Project, commandType = 'UpdateProject') => {
    const currentProject = projects.find(item => item.id === project.id);
    const createdAt = new Date().toISOString();
    const commandId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = currentProject
      ? await commitProjectCandidate(repository, currentProject, project, {
          commandId,
          commandType,
          projectId: currentProject.id,
          expectedDocumentRevision: currentProject.documentRevision,
          expectedCanonicalRevision: currentProject.canonicalRevision,
          canonicalChange: !DOCUMENT_ONLY_COMMANDS.has(commandType),
          createdAt
        })
      : await saveInitialProject(repository, project, commandId, createdAt);
    if (!result.success) {
      setAppError(result.error);
      window.setTimeout(() => setAppError(''), 4200);
      return false;
    }
    const next = result.project;
    setProjects(current => [next, ...current.filter(item => item.id !== next.id)]);
    setActiveId(next.id);
    return true;
  };

  const create = async (idea: string, outputLanguage: string, files: File[], nativeInventory?: any) => {
    const inventory = nativeInventory || await analyzeSelectedFiles(files);
    const importedContext = projectInventoryContext(inventory);
    const project = analyzeIdea(idea, { outputLanguage, importedContext });
    project.profile.projectInventory = inventory;
    project.metadata.projectAnalysis = {
      version: inventory.version,
      analyzedAt: inventory.analyzedAt,
      includedFiles: inventory.totals.included,
      excludedFiles: inventory.totals.excluded,
    };
    const credential = await credentialVault.get(providerSettings.providerId) || '';
    const prepared = await prepareInitialProject({
      project,
      generateIdeaLab: candidate => generateIdeaLabBundle(candidate, {
        settings: providerSettings,
        credential,
        ideaText: idea,
      } as any)
    });
    await persist(prepared.project);
  };

  const importPackage = async (file: File) => {
    try {
      await persist(await readPromtgenPackage(file));
    } catch (error) {
      setAppError(error instanceof Error ? error.message : 'Paket açılamadı.');
      window.setTimeout(() => setAppError(''), 4200);
    }
  };

  return {
    projects,
    activeId,
    setActiveId,
    activeProject,
    loading,
    appError,
    providerSettings,
    setProviderSettings,
    persist,
    create,
    importPackage,
    credentialVault,
  };
}
