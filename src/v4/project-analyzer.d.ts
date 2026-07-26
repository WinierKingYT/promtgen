// Type declarations for src/v4/project-analyzer.js
import { CanonicalProject } from './domain/types.js';

export interface ProjectAnalysis {
  detectedTech: string[];
  suggestedStack: string;
  riskAreas: string[];
  missingConfigs: string[];
}

export function analyzeProject(project: CanonicalProject): ProjectAnalysis;
export function detectTechStack(files: any[]): string[];
export function analyzeSelectedFiles(files: File[]): Promise<any>;
export function projectInventoryContext(project: CanonicalProject): any;