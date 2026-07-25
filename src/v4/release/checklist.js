import { validateCanonicalProject } from '../domain/validation.js';

export function verifyReleaseReadiness(project) {
  const checks = [];

  const isSchemaV5 = project.schemaVersion === 5;
  checks.push({
    id: 'check-schema-v5',
    category: 'domain',
    title: 'Schema Version 5 Doğrulaması',
    passed: isSchemaV5,
    blocker: true,
    message: isSchemaV5 ? 'Schema versiyonu 5 (Canonical)' : `Beklenen schemaVersion: 5, Mevcut: ${project.schemaVersion}`
  });

  const hasIdentity = Boolean(project.identity?.name && project.identity?.originalIdea);
  checks.push({
    id: 'check-identity',
    category: 'functional',
    title: 'Proje Kimliği ve Fikir Tanımı',
    passed: hasIdentity,
    blocker: true,
    message: hasIdentity ? 'Proje adı ve ham fikir tanımlı' : 'Proje adı veya ham fikir eksik'
  });

  const valResult = validateCanonicalProject(project);
  checks.push({
    id: 'check-domain-invariants',
    category: 'domain',
    title: 'Domain Invariant ve Cross-Entity Kontrolü',
    passed: valResult.valid,
    blocker: true,
    message: valResult.valid ? 'Domain invariant kuralları hatasız' : `Hatalar: ${valResult.errors.map(e => e.message).join('; ')}`
  });

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
