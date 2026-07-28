import { normalizePlanningScenario } from '../canonical-entities.js';
import type { PlanningScenario, PlanningScenarioDecision, ProjectDocumentV5 } from '../contracts.js';

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function scoreText(value: string, patterns: RegExp[]) {
  return patterns.reduce((score, pattern) => score + (pattern.test(value) ? 1 : 0), 0);
}

export function comparePlanningScenario(decisions: PlanningScenarioDecision[]) {
  const text = decisions.map(item => `${item.title} ${item.decision} ${item.rationale}`).join(' ').toLocaleLowerCase('tr-TR');
  const affectedSectionIds = [...new Set(decisions.flatMap(item => item.affectedSectionIds))];
  const dependencies = [...new Set(decisions.flatMap(item => item.dependencies))];
  const effortScore = Math.min(5, Math.max(1,
    1 + Math.ceil(decisions.length / 2) + scoreText(text, [/entegrasyon|api|ağ|network/, /migration|taşıma/, /çoklu|multi|platform/])
  ));
  const riskScore = Math.min(5, Math.max(1,
    1 + scoreText(text, [/güvenlik|secret|kimlik|yetki/, /veri kaybı|migration/, /network|senkron|gecikme/, /ödeme|finans/])
  ));
  const clarityBonus = decisions.every(item => item.rationale && item.affectedSectionIds.length) ? 6 : 0;
  const readinessDelta = Math.max(-25, Math.min(25, clarityBonus + decisions.length * 2 - effortScore - riskScore * 2));
  return { effortScore, riskScore, readinessDelta, affectedSectionIds, dependencies };
}

export function createPlanningScenario(project: ProjectDocumentV5, input: {
  name: string;
  description?: string;
  decisions: Array<Omit<PlanningScenarioDecision, 'id'> & { id?: string }>;
}) {
  const scenario = normalizePlanningScenario({
    id: id('scenario'),
    name: input.name,
    description: input.description || '',
    baseCanonicalRevision: project.canonicalRevision,
    decisions: input.decisions.map(decision => ({ ...decision, id: decision.id || id('scenario-decision') })),
    comparison: comparePlanningScenario(input.decisions.map(decision => ({ ...decision, id: decision.id || '' }))),
    status: 'draft',
    createdAt: now(),
    updatedAt: now()
  }) as PlanningScenario;
  if (!scenario.name || scenario.decisions.length === 0) throw new Error('Senaryo adı ve en az bir alternatif karar gerekli.');
  const next = structuredClone(project);
  next.planningScenarios = [...(next.planningScenarios || []), scenario];
  return { project: next, scenario };
}

export function discardPlanningScenario(project: ProjectDocumentV5, scenarioId: string) {
  const next = structuredClone(project);
  const scenario = next.planningScenarios.find(item => item.id === scenarioId);
  if (!scenario || scenario.status === 'merged') return project;
  scenario.status = 'discarded';
  scenario.updatedAt = now();
  return next;
}

export function selectPlanningScenario(project: ProjectDocumentV5, scenarioId: string) {
  const scenario = project.planningScenarios.find(item => item.id === scenarioId);
  if (!scenario || scenario.status !== 'draft') {
    return { success: false as const, project, reason: 'Birleştirilebilir taslak senaryo bulunamadı.' };
  }
  if (scenario.baseCanonicalRevision !== project.canonicalRevision) {
    return { success: false as const, project, reason: `Senaryo r${scenario.baseCanonicalRevision} planına ait; güncel r${project.canonicalRevision} üzerinden yeniden oluşturulmalı.` };
  }
  const next = structuredClone(project);
  const selected = next.planningScenarios.find(item => item.id === scenarioId)!;
  selected.status = 'selected';
  selected.updatedAt = now();
  const request = [
    `${selected.name}: ${selected.description}`.trim(),
    ...selected.decisions.map(decision => `${decision.title}: ${decision.decision}. Gerekçe: ${decision.rationale}`)
  ].filter(Boolean).join('\n');
  return { success: true as const, project: next, scenario: selected, request };
}

export function linkScenarioImpact(project: ProjectDocumentV5, scenarioId: string, impactAnalysisId: string) {
  const next = structuredClone(project);
  const scenario = next.planningScenarios.find(item => item.id === scenarioId);
  const impact = (next.impactAnalyses || []).find(item => item.id === impactAnalysisId);
  if (!scenario || scenario.status !== 'selected' || !impact) return project;
  scenario.impactAnalysisId = impactAnalysisId;
  scenario.updatedAt = now();
  impact.sourceScenarioId = scenarioId;
  return next;
}
