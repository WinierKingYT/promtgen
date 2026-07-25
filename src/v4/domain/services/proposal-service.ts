import { CanonicalProject, ProposalBundle, ProposalItem, Requirement, Decision, Task, Risk } from '../types.js';
import { toRequirementId, toDecisionId, toTaskId, toRiskId, toProposalId } from '../ids.js';
import { validateCanonicalProject } from '../validation.js';

export interface AcceptProposalParams {
  project: CanonicalProject;
  bundleId: string;
  itemId: string;
  commandId: string;
  expectedRevision: number;
}

export interface AcceptProposalResult {
  success: boolean;
  project: CanonicalProject;
  appliedItem?: ProposalItem;
  alreadyApplied?: boolean;
  error?: string;
}

// In-memory record of processed command IDs to enforce idempotency
const PROCESSED_COMMAND_IDS = new Set<string>();

export function acceptProposalItemAtomically(params: AcceptProposalParams): AcceptProposalResult {
  const { project, bundleId, itemId, commandId, expectedRevision } = params;

  // 1. Idempotency Check
  if (PROCESSED_COMMAND_IDS.has(commandId)) {
    return {
      success: true,
      project,
      alreadyApplied: true
    };
  }

  // 2. Concurrency Control (Revision Lock)
  if (project.revision !== expectedRevision) {
    return {
      success: false,
      project,
      error: `Çakışan revizyon saptandı! Beklenen revizyon: ${expectedRevision}, Mevcut revizyon: ${project.revision}. Lütfen sayfayı yenileyip tekrar deneyin.`
    };
  }

  // Immutable clone for transaction isolation
  const nextProject: CanonicalProject = structuredClone(project);
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
      id: toRequirementId(`req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
      title: item.title,
      description: item.description,
      category: 'functional',
      priority: item.impact === 'high' ? 'must' : 'should',
      status: 'accepted',
      acceptanceCriteria: [
        {
          id: `ac-${Date.now()}` as any,
          statement: `"${item.title}" kabul testi doğrulanmalıdır.`,
          verificationMethod: 'user-acceptance',
          measurable: true,
          linkedTestCaseIds: []
        }
      ],
      relatedDecisionIds: [],
      relatedRiskIds: [],
      relatedTaskIds: [],
      provenance: {
        origin: 'ai',
        createdAt: nowIso,
        acceptedAt: nowIso,
        proposalId: toProposalId(bundleId)
      }
    };
    nextProject.requirements.push(req);
  } else if (item.kind === 'decision' || item.kind === 'architecture') {
    const dec: Decision = {
      id: toDecisionId(`dec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
      title: item.title,
      context: item.description,
      decision: item.title,
      rationale: item.pros.join('; ') || 'AI Keşif grubundan kabul edildi.',
      alternatives: [],
      status: 'accepted',
      relatedRequirementIds: [],
      relatedRiskIds: [],
      provenance: {
        origin: 'ai',
        createdAt: nowIso,
        acceptedAt: nowIso,
        proposalId: toProposalId(bundleId)
      },
      decidedAt: nowIso
    };
    nextProject.decisions.push(dec);
  } else if (item.kind === 'risk') {
    const risk: Risk = {
      id: toRiskId(`risk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
      title: item.title,
      description: item.description,
      category: 'technical',
      probability: 3,
      impact: item.impact === 'high' ? 4 : 2,
      exposure: 3 * (item.impact === 'high' ? 4 : 2),
      status: 'identified',
      relatedRequirementIds: [],
      relatedDecisionIds: [],
      provenance: {
        origin: 'ai',
        createdAt: nowIso,
        proposalId: toProposalId(bundleId)
      }
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
  nextProject.revision += 1;
  nextProject.lifecycle.updatedAt = nowIso;
  PROCESSED_COMMAND_IDS.add(commandId);

  return {
    success: true,
    project: nextProject,
    appliedItem: item
  };
}
