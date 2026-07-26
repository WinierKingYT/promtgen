import type { ProjectDocumentV5 } from '../contracts.js';
import { captureCurrentRevision } from '../planning-engine.js';

interface IdeaLabResult {
  project: ProjectDocumentV5;
  usedFallback?: boolean;
  error?: string | null;
}

export interface PrepareInitialProjectOptions {
  project: ProjectDocumentV5;
  generateIdeaLab: (project: ProjectDocumentV5) => Promise<IdeaLabResult>;
  now?: () => string;
}

export interface PreparedInitialProject {
  project: ProjectDocumentV5;
  ideaLabGenerated: boolean;
  usedFallback: boolean;
  error: string | null;
}

export async function prepareInitialProject({
  project,
  generateIdeaLab,
  now = () => new Date().toISOString()
}: PrepareInitialProjectOptions): Promise<PreparedInitialProject> {
  if (project.lifecycle.activePhase === 'IDEA_EXPANSION') {
    return {
      project: captureCurrentRevision(project, 'Kısa fikir genişletme aşamasında oluşturuldu'),
      ideaLabGenerated: false,
      usedFallback: false,
      error: null
    };
  }

  const input = structuredClone(project);
  input.proposalStore.bundles = [];
  const result = await generateIdeaLab(input);
  const target = result.project;
  if (result.usedFallback || result.error) {
    target.messages.push({
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: `Bulut AI çağrısı tamamlanamadı (${result.error || 'Sağlayıcı zaman aşımı'}). Yerel kural motoru başlangıç mimarisi alternatifleri üretti.`,
      analysisNote: 'Local Fallback Engine',
      createdAt: now()
    });
  } else {
    target.messages.push({
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: 'Fikir Laboratuvarı: Projeniz için mimari alternatifler ve metrik matrisi hazırlandı.',
      createdAt: now()
    });
  }

  return {
    project: captureCurrentRevision(target, 'İlk fikir laboratuvarı turu oluşturuldu'),
    ideaLabGenerated: true,
    usedFallback: Boolean(result.usedFallback),
    error: result.error || null
  };
}
