import { useEffect, useMemo, useState } from 'react';
import { analyzeIdea } from '../../v4/planning-engine.js';
import { createPlatformRepository } from '../../v4/tauri-storage.js';
import { applyIdeaFoundationDraft, generateIdeaFoundation } from '../../v4/application/idea-foundation-service.js';
import { hasSavedProviderSettings, loadProviderSettings } from '../../v4/provider-settings.js';
import { detectFirstRunProviderSettings } from '../../v4/application/first-run-provider-detection.js';
import { listOllamaModels } from '../../v4/ai/ollama-models.js';
import { createCredentialVault } from '../../v4/credential-vault.js';
import { analyzeSelectedFiles, projectInventoryContext } from '../../v4/project-analyzer.js';
import type { ProjectDocumentV5 } from '../../v4/contracts.js';
import type { ProjectInventoryReport } from '../../v4/project-analyzer.js';
import { prepareInitialProject } from '../../v4/application/project-creation-service.js';
import { commitProjectCandidate, saveInitialProject } from '../../v4/application/command-transaction.js';
import { isCanonicalChangeCommand } from '../../v4/application/command-policy.js';
import {
  assertRecoveryPreviewFresh,
  restorePortablePackageAsNewRevision,
  type RecoveryPreview
} from '../../v4/application/recovery-service.js';
import type { PromtgenPackageInspection } from '../../v4/exporter.js';

type Project = ProjectDocumentV5;

const repository = createPlatformRepository();
const credentialVault = createCredentialVault();

export function useProjectState() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [appError, setAppError] = useState('');
  const [providerSettings, setProviderSettings] = useState(loadProviderSettings);
  const activeProject = useMemo(() => projects.find(project => project.id === activeId), [projects, activeId]);

  // İlk çalıştırma: hiçbir sağlayıcı ayarı kaydedilmemişse ve yerelde çalışan
  // bir Ollama en az bir model bildiriyorsa onu tercih eder. Kaydedilmiş bir
  // seçim varsa (NVIDIA, offline veya başka biri) bu efekt hiç dokunmaz.
  // Ağ çağrısı kısa bir zaman aşımıyla sınırlıdır ve açılışı bloklamaz;
  // sonuç gelene kadar mevcut varsayılan (NVIDIA) kullanılmaya devam eder.
  useEffect(() => {
    let cancelled = false;
    detectFirstRunProviderSettings({
      hasSavedSettings: hasSavedProviderSettings,
      listModels: listOllamaModels
    }).then(detected => {
      if (!cancelled && detected) setProviderSettings(detected);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    repository.list().then((items: Project[]) => {
      setProjects(items);
      setActiveId(null);
      // Her iki platform da (masaüstü Tauri/SQLite ve web IndexedDB) aynı
      // instance-scoped `takeListWarning()` sözleşmesini uygular (bkz.
      // ProjectRepository.takeListWarning, src/v4/contracts.ts) -- burada
      // artık `instanceof` dallanmasına gerek yok. İkisi de aynı `appError`
      // banner'ına akar, böylece kullanıcı hangi platformda olursa olsun
      // aynı geri bildirimi görür (bkz. src/v4/storage.ts
      // IndexedDbProjectRepository.takeListWarning ve
      // src/v4/tauri-storage.ts TauriSqliteProjectRepository.takeListWarning).
      const listWarning = repository.takeListWarning?.() ?? null;
      if (listWarning) reportRepositoryError(new Error(listWarning), listWarning);
    }).catch((error: unknown) => {
      reportRepositoryError(error, 'Projeler yüklenemedi. Verileriniz silinmedi; yerel depolamayı kontrol edip tekrar deneyin.');
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
          canonicalChange: isCanonicalChangeCommand(commandType),
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

  const create = async (idea: string, outputLanguage: ProjectDocumentV5['identity']['outputLanguage'], files: File[], nativeInventory?: ProjectInventoryReport) => {
    const inventory = nativeInventory || await analyzeSelectedFiles(files);
    const importedContext = projectInventoryContext(inventory);
    let project = analyzeIdea(idea, { outputLanguage, importedContext });
    project.profile.projectInventory = inventory as unknown as Record<string, unknown>;
    project.metadata.projectAnalysis = {
      version: inventory.version,
      analyzedAt: inventory.analyzedAt,
      includedFiles: inventory.totals.included,
      excludedFiles: inventory.totals.excluded,
    };
    const credential = await credentialVault.get(providerSettings.providerId) || '';
    // AI'nin fikri anlayıp temelini kurduğu adım: proje oluşturulmayı ASLA bekletmez
    // veya engellemez -- offline, sağlayıcı hatası veya zaman aşımında servis kendi
    // içinde deterministik yedeğe düşer (bkz. idea-foundation-service.ts). Yalnız
    // GERÇEKTEN üretilmiş bir taslak varsa projeye yazılır; aksi hâlde bugünkü
    // davranış (fikir koçu boş başlar) sessizce korunur.
    try {
      const foundation = await generateIdeaFoundation(project, { settings: providerSettings, credential });
      if (!foundation.usedFallback) {
        project = applyIdeaFoundationDraft(project, foundation);
      }
    } catch {
      // Fikir temeli oluşturulamasa da proje açılmaya devam eder.
    }
    // Proje oluşturma artık mimari üretmez. Mimari karşılaştırma şablonu
    // çözüm aşamasına taşındı (Workspace.tsx → SolutionStagePanel); burada
    // yalnız ilk revizyon kaydedilir.
    const prepared = prepareInitialProject({ project });
    await persist(prepared.project);
  };

  const importPackage = async (
    inspection: PromtgenPackageInspection,
    mode: 'new' | 'recovery',
    preview?: RecoveryPreview
  ) => {
    try {
      const current = projects.find(project => project.id === inspection.project.id);
      if (mode === 'new') {
        if (current) throw new Error('Bu proje cihazda zaten var. Paketi kurtarma önizlemesiyle yeniden açın.');
        return await persist(inspection.project, 'ImportPackage');
      }
      if (!current || !preview) throw new Error('Paket kurtarma önizlemesi bulunamadı.');
      assertRecoveryPreviewFresh(current, preview);
      const restored = restorePortablePackageAsNewRevision(current, inspection.project);
      return await persist(restored, 'RestorePackage');
    } catch (error) {
      setAppError(error instanceof Error ? error.message : 'Paket açılamadı.');
      window.setTimeout(() => setAppError(''), 4200);
      return false;
    }
  };

  const reportRepositoryError = (error: unknown, fallback: string) => {
    setAppError(error instanceof Error ? error.message : fallback);
    window.setTimeout(() => setAppError(''), 4200);
  };

  const archiveProject = async (id: string) => {
    try {
      if (!(await repository.archive(id))) return false;
      const archived = await repository.get(id);
      if (archived) setProjects(current => current.map(item => item.id === id ? archived : item));
      if (activeId === id) setActiveId(null);
      return true;
    } catch (error) {
      reportRepositoryError(error, 'Proje arşivlenemedi.');
      return false;
    }
  };

  const restoreProject = async (id: string) => {
    try {
      if (!(await repository.restore(id))) return false;
      const restored = await repository.get(id);
      if (restored) setProjects(current => current.map(item => item.id === id ? restored : item));
      return true;
    } catch (error) {
      reportRepositoryError(error, 'Proje arşivden çıkarılamadı.');
      return false;
    }
  };

  const purgeProject = async (id: string) => {
    try {
      const result = await repository.purge(id);
      if (!result.projectDeleted) throw new Error('Silinecek proje bulunamadı.');
      setProjects(current => current.filter(item => item.id !== id));
      if (activeId === id) setActiveId(null);
      return true;
    } catch (error) {
      reportRepositoryError(error, 'Proje kalıcı olarak silinemedi.');
      return false;
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
    archiveProject,
    restoreProject,
    purgeProject,
    credentialVault,
  };
}
