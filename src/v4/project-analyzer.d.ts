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
  inventory: Array<{
    path: string;
    name?: string;
    extension?: string;
    size?: number;
    kind?: string;
    secretDetected?: boolean;
    injectionDetected?: boolean;
    lineCount?: number | null;
  }>;
  excluded: Array<{ path: string; reason: string }>;
}

export function analyzeSelectedFiles(files: File[]): Promise<ProjectInventoryReport>;
export function projectInventoryContext(report: ProjectInventoryReport): Array<{ name: string; kind: string; summary: string }>;
export function wrapUntrustedProjectContext(context: unknown): string;
