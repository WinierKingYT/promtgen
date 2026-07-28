import type { ProjectDocumentV5 } from '../contracts.js';
import { validateProjectDocument } from '../project-document.js';

export interface ReleaseCheckItem {
  id: string;
  category: 'functional' | 'security' | 'domain' | 'storage' | 'a11y';
  title: string;
  passed: boolean;
  blocker: boolean;
  message: string;
}

export interface ReleaseReadinessResult {
  ready: boolean;
  score: number;
  checks: ReleaseCheckItem[];
  blockers: ReleaseCheckItem[];
}

export function verifyProjectReadiness(project: ProjectDocumentV5): ReleaseReadinessResult {
  const checks: ReleaseCheckItem[] = [];

  // 1. Schema Version Check
  const isSchemaV5 = project.schemaVersion === 5 && project.schemaRevision === 2;
  checks.push({
    id: 'check-schema-v5',
    category: 'domain',
    title: 'Schema Version 5 Doğrulaması',
    passed: isSchemaV5,
    blocker: true,
    message: isSchemaV5 ? 'Schema 5.1 (Canonical)' : `Beklenen schema: 5.1, Mevcut: ${project.schemaVersion}.${project.schemaRevision}`
  });

  // 2. Identity Verification
  const hasIdentity = Boolean(project.identity?.name && project.identity?.originalIdea);
  checks.push({
    id: 'check-identity',
    category: 'functional',
    title: 'Proje Kimliği ve Fikir Tanımı',
    passed: hasIdentity,
    blocker: true,
    message: hasIdentity ? 'Proje adı ve ham fikir tanımlı' : 'Proje adı veya ham fikir eksik'
  });

  // 3. Invariant Domain Validation
  const valResult = validateProjectDocument(project);
  checks.push({
    id: 'check-domain-invariants',
    category: 'domain',
    title: 'Domain Invariant ve Cross-Entity Kontrolü',
    passed: valResult.valid,
    blocker: true,
    message: valResult.valid ? 'Domain invariant kuralları hatasız' : `Hatalar: ${valResult.errors.join('; ')}`
  });

  // 4. Acceptance Criteria Completeness
  const acceptedReqs = (project.requirements || []).filter(r => r.status === 'accepted');
  const allReqsHaveAc = acceptedReqs.every(r => r.acceptanceCriteria && r.acceptanceCriteria.length > 0);
  checks.push({
    id: 'check-acceptance-criteria',
    category: 'functional',
    title: 'Kabul Edilmiş Gereksinim Kriter Eksiksizliği',
    passed: allReqsHaveAc,
    blocker: false,
    message: allReqsHaveAc ? 'Tüm onaylı gereksinimlerin kabul kriterleri tanımlı' : 'Bazı onaylı gereksinimlerin kabul kriteri eksik'
  });

  const blockers = checks.filter(c => c.blocker && !c.passed);
  const passedCount = checks.filter(c => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);
  const ready = blockers.length === 0;

  return {
    ready,
    score,
    checks,
    blockers
  };
}

/** @deprecated Use verifyProjectReadiness. This validates a plan document, not an application release. */
export const verifyReleaseReadiness = verifyProjectReadiness;
