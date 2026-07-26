// Type declarations for src/v4/exporter.js
import { CanonicalProject } from './domain/types.js';

export interface ExportResult {
  markdown: string;
  prd: string;
  tasks: string;
  promptgenPackage: string;
  cursorRules: string;
  windsurfRules: string;
  copilotRules: string;
  fileTree: any[];
}

export function exportProject(project: CanonicalProject): ExportResult;
export function createDocumentSet(project: CanonicalProject): any;
export function createExportBundle(project: CanonicalProject): any;
export function resolveCanonicalRevision(project: CanonicalProject, revision?: number): any;
export function readPromtgenPackage(project: CanonicalProject): any;
export function createIdeWorkspacePackage(project: CanonicalProject, ide: 'cursor' | 'windsurf' | 'copilot'): string;
export function exportProjectToZip(project: CanonicalProject): Promise<Blob>;
export function createPromtgenPackage(project: CanonicalProject): string;
export function downloadBlob(blob: Blob, filename: string): void;
export function exportCanonicalMarkdown(project: CanonicalProject): string;