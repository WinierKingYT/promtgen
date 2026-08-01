import type { ProjectDocumentV5 } from '../contracts.js';
import { normalizeProjectDocument } from '../canonical-entities.js';

export type CanonicalRevisionReference = number | string | 'current';

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

export function resolveCanonicalRevision(
  project: unknown,
  reference: CanonicalRevisionReference = 'current'
): ProjectDocumentV5 {
  const normalized = normalizeProjectDocument(project) as ProjectDocumentV5;
  if (reference === 'current' || reference == null || Number(reference) === normalized.canonicalRevision) return normalized;
  const revision = normalized.revisions.find(item => item.id === reference || item.number === Number(reference));
  if (!revision?.snapshot) throw new Error(`Plan revision'ı bulunamadı: ${reference}`);
  const snapshot = normalizeProjectDocument(revision.snapshot) as ProjectDocumentV5;
  snapshot.canonicalRevision = revision.number;
  snapshot.documentRevision = Math.max(snapshot.documentRevision || revision.number, revision.number);
  return snapshot;
}

export function canonicalHashPayload(project: unknown): Record<string, unknown> {
  const source = resolveCanonicalRevision(project);
  return {
    schemaVersion: source.schemaVersion,
    schemaRevision: source.schemaRevision,
    canonicalRevision: source.canonicalRevision,
    sourceIdeaRevisionId: source.sourceIdeaRevisionId,
    sourceIdeaRevisionNumber: source.sourceIdeaRevisionNumber,
    identity: source.identity,
    planningDepth: source.planningDepth,
    profile: source.profile,
    lifecycle: {
      status: source.lifecycle.status,
      activePhase: source.lifecycle.activePhase,
      finalizedAt: source.lifecycle.finalizedAt
    },
    sections: source.sections,
    objectives: source.objectives,
    assumptions: source.assumptions,
    requirements: source.requirements,
    decisions: source.decisions,
    tasks: source.tasks,
    risks: source.risks,
    milestones: source.milestones,
    testCases: source.testCases,
    traceLinks: source.traceLinks,
    agentPrompts: source.agentPrompts,
    researchQuestions: source.researchQuestions,
    sources: source.sources,
    evidence: source.evidence,
    reviewFindings: source.reviewFindings,
    simulationRuns: source.simulationRuns,
    modules: source.modules,
    readiness: source.readiness
  };
}

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256(value: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(value));
}
