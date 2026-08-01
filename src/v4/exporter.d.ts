import type { ExportRecord, ProjectDocumentV5 } from './contracts.js';

export type RevisionReference = number | string | 'current';
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
export interface PromtgenPackageEntry {
  path: string;
  sha256: string;
  bytes: number;
  role: 'project' | 'history' | 'export';
}
export interface PromtgenPackageManifest {
  format: 'promtgen';
  formatVersion: 1 | 2 | 3;
  schemaVersion: 4 | 5;
  schemaRevision?: number;
  projectId?: string;
  revision?: number;
  canonicalRevision?: number;
  canonicalHash?: string;
  createdAt?: string;
  files: string[];
  entries?: PromtgenPackageEntry[];
  adapters?: string[];
}
export interface PromtgenPackageIntegrity {
  level: 'full' | 'canonical' | 'legacy';
  verifiedEntries: number;
  totalEntries: number;
  warnings: string[];
}
export interface PromtgenPackageInspection {
  project: ProjectDocumentV5;
  manifest: PromtgenPackageManifest;
  integrity: PromtgenPackageIntegrity;
}

export const IDE_ADAPTERS: readonly IdeAdapterDefinition[];
export function resolveCanonicalRevision(project: ProjectDocumentV5, reference?: RevisionReference): ProjectDocumentV5;
export function exportCanonicalMarkdown(project: ProjectDocumentV5, revision?: RevisionReference): string;
export function buildAgentPrompt(project: ProjectDocumentV5, adapter?: string, revision?: RevisionReference): string;
export function createDocumentSet(project: ProjectDocumentV5, options?: { revision?: RevisionReference; adapters?: string[] }): Record<string, string>;
export function createIdeWorkspaceFiles(project: ProjectDocumentV5, options?: { revision?: RevisionReference; adapters?: string[] }): WorkspaceFiles;
export function createIdeWorkspacePackage(project: ProjectDocumentV5, options?: { revision?: RevisionReference; adapters?: string[] }): Promise<PackageArtifact>;
export function createExportBundle(project: ProjectDocumentV5, options?: { revision?: RevisionReference; adapters?: string[]; format?: string }): Promise<unknown>;
export function createPromtgenPackage(project: ProjectDocumentV5, options?: { revision?: RevisionReference; adapters?: string[]; includeExports?: boolean }): Promise<PackageArtifact>;
export function inspectPromtgenPackage(file: Blob | ArrayBuffer | Uint8Array): Promise<PromtgenPackageInspection>;
export function readPromtgenPackage(file: Blob | ArrayBuffer | Uint8Array): Promise<ProjectDocumentV5>;
export function downloadBlob(blob: Blob, filename: string): void;
