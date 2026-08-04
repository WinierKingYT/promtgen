import type { ProjectDocumentV5 } from '../contracts.js';
import { resolveIdeaRecordsForBundle } from './idea-discussion-service.js';

export function prepareDiscoveryTurnProject(
  project: ProjectDocumentV5,
  openBundleId?: string
): ProjectDocumentV5 {
  const candidate = structuredClone(project);
  if (!openBundleId) return candidate;

  const bundle = candidate.proposalStore.bundles.find(item => item.id === openBundleId);
  if (bundle?.status !== 'open') return candidate;

  for (const item of bundle.items) {
    if (item.status === 'pending') item.status = 'deferred';
  }
  bundle.status = 'resolved';
  // Paket kapanınca fikir defterindeki izleri de kapanmalı. Aksi hâlde her tur
  // arkasında kapatılamayan kayıtlar bırakır: kullanıcı o önerileri bir daha
  // göremediği hâlde kayıtlar "pending" kalıp plana geçişi bloklardı.
  return resolveIdeaRecordsForBundle(candidate, openBundleId);
}
