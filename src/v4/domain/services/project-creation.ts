import type { ProjectDocumentV5 } from '../../contracts.js';
import { createProjectDocument } from '../../project-document.js';

export interface IdeaRoutingResult {
  phase: 'IDEA_EXPANSION' | 'DISCOVERY' | 'IDEA_LAB';
  densityScore: number;
  reasons: string[];
}

export function routeIdea(ideaText: string): IdeaRoutingResult {
  const text = String(ideaText || '').trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const reasons: string[] = [];

  let densityScore = 0;

  // Signal detection
  const hasProblemSignal = /problem|sorun|ihtiyaç|eksik|çözüm|hedef/.test(text.toLowerCase());
  const hasUserSignal = /kullanıcı|oyuncu|müşteri|admin|ekip|firma/.test(text.toLowerCase());
  const hasPlatformSignal = /web|mobil|ios|android|unity|godot|saas|api|desktop/.test(text.toLowerCase());
  const hasConstraintSignal = /gizli|offline|sadece|zorunlu|bütçe|hızlı/.test(text.toLowerCase());

  if (wordCount >= 20) densityScore += 3;
  else if (wordCount >= 8) densityScore += 1;

  if (hasProblemSignal) { densityScore += 2; reasons.push('Problem/Çözüm tanımı algılandı'); }
  if (hasUserSignal) { densityScore += 2; reasons.push('Hedef kitle/kullanıcı sinyali algılandı'); }
  if (hasPlatformSignal) { densityScore += 2; reasons.push('Platform/Teknoloji tercihi algılandı'); }
  if (hasConstraintSignal) { densityScore += 1; reasons.push('Sınır/Kısıt sinyali algılandı'); }

  if (densityScore <= 2) {
    reasons.push('Fikir henüz çok kısa ve soyut; önce seçeneklerle genişletilmeli');
    return { phase: 'IDEA_EXPANSION', densityScore, reasons };
  }

  if (densityScore >= 6) {
    reasons.push('Fikir yeterli derinliğe sahip; alternatif mimariler tartışılabilir');
    return { phase: 'IDEA_LAB', densityScore, reasons };
  }

  reasons.push('Fikir orta düzey detay içeriyor; ham vizyon keşfi adımı başlatılabilir');
  return { phase: 'DISCOVERY', densityScore, reasons };
}

export interface CreateProjectParams {
  name?: string;
  ideaText: string;
  depth?: 'quick' | 'standard' | 'advanced' | 'enterprise';
  metadata?: Record<string, unknown>;
}

export function createCanonicalProjectInstance(params: CreateProjectParams): ProjectDocumentV5 {
  const idea = String(params.ideaText || '').trim();
  const routing = routeIdea(idea);
  const depth = params.depth || 'standard';
  const name = params.name?.trim() || (idea.slice(0, 30) ? `"${idea.slice(0, 30)}..."` : 'Yeni Proje');
  const project = createProjectDocument({
    idea,
    name,
    planningDepth: {
      recommended: depth,
      selected: depth,
      overridden: Boolean(params.depth),
      rationale: params.depth ? 'Kullanıcı tarafından seçildi.' : 'Varsayılan planlama derinliği.',
      signals: { score: 0, features: 0, integrations: 0, sensitiveData: false, multiPlatform: false, scaleIntent: false, uncertainty: 1 }
    }
  });
  project.lifecycle.activePhase = routing.phase;
  project.metadata = { ...project.metadata, routing, ...(params.metadata || {}) };
  return project;
}
