import type { ProjectDocumentV5, SuggestionItem, Requirement, Decision, Risk } from '../../contracts.js';
import { validateCanonicalProject } from '../validation.js';

export interface AcceptProposalParams {
  project: ProjectDocumentV5;
  bundleId: string;
  itemId: string;
  commandId: string;
  expectedDocumentRevision: number;
}

export interface AcceptProposalResult {
  success: boolean;
  project: ProjectDocumentV5;
  appliedItem?: SuggestionItem;
  alreadyApplied?: boolean;
  error?: string;
}

export function acceptProposalItemAtomically(params: AcceptProposalParams): AcceptProposalResult {
  const { project, bundleId, itemId, commandId, expectedDocumentRevision } = params;

  // 1. Idempotency Check
  if (project.commandLog.some(record => record.commandId === commandId)) {
    return {
      success: true,
      project,
      alreadyApplied: true
    };
  }

  // 2. Concurrency Control (Revision Lock)
  if (project.documentRevision !== expectedDocumentRevision) {
    return {
      success: false,
      project,
      error: `Çakışan doküman revizyonu saptandı! Beklenen: ${expectedDocumentRevision}, mevcut: ${project.documentRevision}. Lütfen sayfayı yenileyip tekrar deneyin.`
    };
  }

  // Immutable clone for transaction isolation
  const nextProject: ProjectDocumentV5 = structuredClone(project);
  const bundle = (nextProject.proposalStore?.bundles || []).find(b => b.id === bundleId);

  if (!bundle) {
    return {
      success: false,
      project,
      error: `Teklif paketi (${bundleId}) bulunamadı.`
    };
  }

  const item = bundle.items.find(i => i.id === itemId);
  if (!item) {
    return {
      success: false,
      project,
      error: `Teklif öğesi (${itemId}) pakette bulunamadı.`
    };
  }

  if (item.status === 'accepted') {
    return {
      success: true,
      project,
      appliedItem: item,
      alreadyApplied: true
    };
  }

  const nowIso = new Date().toISOString();

  // 3. Entity Translation based on item kind
  if (item.kind === 'feature') {
    const req: Requirement = {
      id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: item.title,
      statement: item.editedDescription || item.description,
      kind: 'functional',
      priority: item.impact === 'high' ? 'must' : 'should',
      status: 'accepted',
      acceptanceCriteria: [`"${item.title}" kabul testi doğrulanmalıdır.`],
      sourceObjectiveIds: [],
      sourceSuggestionIds: [item.id]
    };
    nextProject.requirements.push(req);
  } else if (item.kind === 'decision' || item.kind === 'architecture') {
    const dec: Decision = {
      id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: item.title,
      decision: item.title,
      rationale: item.pros.join('; ') || 'AI Keşif grubundan kabul edildi.',
      alternatives: [],
      consequences: [],
      status: 'accepted',
      sourceSuggestionId: item.id,
      affectedSectionIds: item.affectedSections
    };
    nextProject.decisions.push(dec);
  } else if (item.kind === 'risk') {
    const risk: Risk = {
      id: `risk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: item.title,
      description: item.description,
      probability: 'medium',
      impact: item.impact,
      mitigation: '',
      owner: '',
      status: 'open',
      sourceSuggestionId: item.id
    };
    nextProject.risks.push(risk);
  }

  item.status = 'accepted';

  // 4. Validate Invariants Before Commit
  const valResult = validateCanonicalProject(nextProject);
  if (!valResult.valid) {
    return {
      success: false,
      project, // Rollback to original project
      error: `Transaction Invariant Hatası: ${valResult.errors.map(e => e.message).join('; ')}`
    };
  }

  // 5. Commit Transaction
  nextProject.documentRevision += 1;
  nextProject.canonicalRevision += 1;
  nextProject.lifecycle.updatedAt = nowIso;
  nextProject.commandLog.push({
    commandId,
    commandType: 'AcceptProposal',
    expectedDocumentRevision,
    committedDocumentRevision: nextProject.documentRevision,
    expectedCanonicalRevision: project.canonicalRevision,
    committedCanonicalRevision: nextProject.canonicalRevision,
    createdAt: nowIso
  });

  return {
    success: true,
    project: nextProject,
    appliedItem: item
  };
}
