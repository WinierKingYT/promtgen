export interface ProjectInventoryReport {
  version: number;
  analyzedAt: string;
  source: string;
  totals: { selected: number; included: number; excluded: number; bytes: number };
  languages: Array<{ name: string; files: number }>;
  frameworks: string[];
  manifests: string[];
  scriptNames: string[];
  security: { secretFiles: string[]; injectionFiles: string[] };
  inventory: Array<Record<string, unknown>>;
  excluded: Array<{ path: string; reason: string }>;
}

export function analyzeSelectedFiles(files: File[]): Promise<ProjectInventoryReport>;
export function projectInventoryContext(report: ProjectInventoryReport): Array<{ name: string; kind: string; summary: string }>;
export function wrapUntrustedProjectContext(context: unknown): string;
