import type { ProjectDocumentV5 } from './contracts.js';
import type { CreateProjectDocumentOptions } from './project-document.js';

export type LegacyProjectStateV4 = Omit<ProjectDocumentV5, 'schemaVersion' | 'schemaRevision' | 'proposalStore'> & {
  schemaVersion: 4;
  suggestionBundles: ProjectDocumentV5['proposalStore']['bundles'];
};

export function createLegacyProjectStateV4(options?: CreateProjectDocumentOptions): LegacyProjectStateV4;
export function isLegacyProjectStateV4(value: unknown): value is LegacyProjectStateV4;
