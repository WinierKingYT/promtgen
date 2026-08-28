import { createProjectDocument, type CreateProjectDocumentOptions } from './project-document.js';
import type { ProjectDocumentV5 } from './contracts.js';

export type LegacyProjectStateV4 = Omit<ProjectDocumentV5, 'schemaVersion' | 'schemaRevision' | 'proposalStore'> & {
  schemaVersion: 4;
  suggestionBundles: ProjectDocumentV5['proposalStore']['bundles'];
};

/**
 * `createProjectDocument` yields a fully-formed V5 document; this function mutates
 * that same object in place into the legacy V4 shape (schemaVersion 4, no
 * schemaRevision, `suggestionBundles` instead of `proposalStore`). `LegacyDraft`
 * documents that single boundary — the object is genuinely ProjectDocumentV5 at
 * construction and is progressively downgraded to `LegacyProjectStateV4` by the
 * statements below; the non-null assertion on `proposalStore` reflects that it is
 * still present at that point (deleted only on the following line).
 */
type LegacyDraft = Omit<ProjectDocumentV5, 'schemaVersion' | 'schemaRevision' | 'proposalStore'> & {
  schemaVersion: number;
  schemaRevision?: number;
  proposalStore?: ProjectDocumentV5['proposalStore'];
  suggestionBundles?: ProjectDocumentV5['proposalStore']['bundles'];
};

/**
 * Migration-only V4 fixture builder. Production code must use ProjectDocumentV5.
 */
export function createLegacyProjectStateV4(options: CreateProjectDocumentOptions = {}): LegacyProjectStateV4 {
    const legacy = createProjectDocument(options) as LegacyDraft;
    legacy.schemaVersion = 4;
    delete legacy.schemaRevision;
    legacy.suggestionBundles = structuredClone(legacy.proposalStore!.bundles);
    delete legacy.proposalStore;
    return legacy as LegacyProjectStateV4;
}

export function isLegacyProjectStateV4(value: unknown): value is LegacyProjectStateV4 {
    return Boolean(value && typeof value === 'object' && (value as { schemaVersion?: unknown }).schemaVersion === 4);
}
