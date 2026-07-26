import type { ProjectDocumentV5 } from '../contracts.js';

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
  return candidate;
}
