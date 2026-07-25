import { CanonicalProject } from '../types.js';
import { toProjectId } from '../ids.js';
import { createPlanSections } from '../../project-state-v4.js';

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
  metadata?: Record<string, any>;
}

export function createCanonicalProjectInstance(params: CreateProjectParams): CanonicalProject {
  const idea = String(params.ideaText || '').trim();
  const routing = routeIdea(idea);
  const nowIso = new Date().toISOString();
  const pId = toProjectId(`project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const depth = params.depth || 'standard';

  const name = params.name?.trim() || (idea.slice(0, 30) ? `"${idea.slice(0, 30)}..."` : 'Yeni Proje');

  return {
    id: pId,
    schemaVersion: 5,
    revision: 1,
    identity: {
      name,
      originalIdea: idea,
      summary: idea.slice(0, 200)
    },
    lifecycle: {
      activePhase: routing.phase,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso
    },
    scope: {
      items: []
    },
    requirements: [],
    decisions: [],
    risks: [],
    tasks: [],
    milestones: [],
    proposalStore: {
      bundles: []
    },
    metadata: {
      depth,
      routing,
      sections: createPlanSections(depth, 1),
      ...(params.metadata || {})
    }
  };
}
