// Type declarations for src/v4/desktop-project-import.js
import { CanonicalProject } from './domain/types.js';

export interface ImportResult {
  project: CanonicalProject;
  warnings: string[];
}

export function importDesktopProject(filePath: string): Promise<ImportResult>;
export function isDesktopProjectImportAvailable(): boolean;
export function selectDesktopProjectFolder(): Promise<ImportResult | null>;