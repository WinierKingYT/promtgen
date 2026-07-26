import { useEffect, useMemo, useState } from 'react';
import { analyzeIdea, captureCurrentRevision, recalculateReadiness } from '../../v4/planning-engine.js';
import { createPlatformRepository } from '../../v4/tauri-storage.js';
import { generateIdeaLabBundle } from '../../v4/ai-discovery.js';
import { loadProviderSettings } from '../../v4/provider-settings.js';
import { createCredentialVault } from '../../v4/credential-vault.js';
import { analyzeSelectedFiles, projectInventoryContext } from '../../v4/project-analyzer.js';
import { readPromtgenPackage } from '../../v4/exporter.js';

type Project = any;

const repository = createPlatformRepository();
const credentialVault = createCredentialVault();

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

  const persist = async (project: Project) => {
    const next = recalculateReadiness(project);
    await repository.save(next);
    setProjects(current => [next, ...current.filter(item => item.id !== next.id)]);
    setActiveId(next.id);
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
    project.suggestionBundles = [];
    const credential = await credentialVault.get(providerSettings.providerId) || '';
    const ideaLabResult = await generateIdeaLabBundle(project, {
      settings: providerSettings,
      credential,
      ideaText: idea,
    } as any);
    const targetProject = ideaLabResult.project;
    if (ideaLabResult.usedFallback || ideaLabResult.error) {
      targetProject.messages.push({
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Bulut AI çağrısı tamamlanamadı (${ideaLabResult.error || 'Sağlayıcı zaman aşımı'}). Yerel kural motoru devreye girerek 3 başlangıç mimari alternatifi üretti. Dilerseniz Ayarlar'dan API anahtarınızı güncelleyebilir veya bu yerel seçeneklerle devam edebilirsiniz.`,
        analysisNote: 'Local Fallback Engine (Sağlayıcı Kesintisi)',
        createdAt: new Date().toISOString(),
      });
    } else {
      targetProject.messages.push({
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Fikir Laboratuvarı: Projeniz için 3 mimari alternatif ve metrik matrisi hazırlandı.',
        createdAt: new Date().toISOString(),
      });
    }
    await persist(captureCurrentRevision(targetProject));
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
