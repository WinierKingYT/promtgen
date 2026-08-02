import type { ExportRecord, ProjectDocumentV5 } from './contracts.js';
import type { CanonicalRevisionReference } from './application/canonical-export-core.js';
import type { CanonicalExportBundle } from './application/canonical-export-service.js';
import type {
  PromtgenPackageEntry,
  PromtgenPackageInspection,
  PromtgenPackageIntegrity,
  PromtgenPackageManifest
} from './application/portable-package.js';

export type RevisionReference = CanonicalRevisionReference;
export type { PromtgenPackageEntry, PromtgenPackageInspection, PromtgenPackageIntegrity, PromtgenPackageManifest };
export interface IdeAdapterDefinition { id: string; label: string; path: string; }
export interface WorkspaceFiles {
  source: ProjectDocumentV5;
  adapters: string[];
  files: Record<string, string>;
}
export interface PackageArtifact {
  blob: Blob;
  filename: string;
  record: ExportRecord;
  manifest: Record<string, unknown>;
  files?: Record<string, string>;
}
export const IDE_ADAPTERS: readonly IdeAdapterDefinition[];
export function resolveCanonicalRevision(project: ProjectDocumentV5, reference?: RevisionReference): ProjectDocumentV5;
export function exportCanonicalMarkdown(project: ProjectDocumentV5, revision?: RevisionReference): string;
export function buildAgentPrompt(project: ProjectDocumentV5, adapter?: string, revision?: RevisionReference): string;
export function createDocumentSet(project: ProjectDocumentV5, options?: { revision?: RevisionReference; adapters?: string[] }): Record<string, string>;
export function createIdeWorkspaceFiles(project: ProjectDocumentV5, options?: { revision?: RevisionReference; adapters?: string[] }): WorkspaceFiles;
export function createIdeWorkspacePackage(project: ProjectDocumentV5, options?: { revision?: RevisionReference; adapters?: string[] }): Promise<PackageArtifact>;
export function createExportBundle(project: ProjectDocumentV5, options?: { revision?: RevisionReference; adapters?: string[]; format?: string }): Promise<CanonicalExportBundle>;
export function createPromtgenPackage(project: ProjectDocumentV5, options?: { revision?: RevisionReference; adapters?: string[]; includeExports?: boolean }): Promise<PackageArtifact>;
export function inspectPromtgenPackage(file: Blob | ArrayBuffer | Uint8Array): Promise<PromtgenPackageInspection>;
export function readPromtgenPackage(file: Blob | ArrayBuffer | Uint8Array): Promise<ProjectDocumentV5>;
export function downloadBlob(blob: Blob, filename: string): void;
