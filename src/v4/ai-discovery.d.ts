// Type declarations for src/v4/ai-discovery.js
import { CanonicalProject } from './domain/types.js';

export interface DiscoveryOptions {
  project: CanonicalProject;
  providerId: string;
  apiKey: string;
}

export interface DiscoveryBundle {
  summary: string;
  options: any[];
  openQuestions: string[];
  analysisNote: string;
  mode?: string;
  fallbackReason?: string;
  provenanceId?: string;
}

export function generateDiscoveryBundle(options: DiscoveryOptions): Promise<DiscoveryBundle>;
export function generateIdeaLabBundle(options: DiscoveryOptions): Promise<any>;
export function generateImpactAnalysis(project: CanonicalProject, changeId: string): Promise<any>;
export function runConversationalDiscoveryTurn(project: CanonicalProject, userMessage: string, options: any): Promise<any>;
export function localFallbackDiscovery(options: any): any;
export function contextualFallback(project: CanonicalProject, error: any): any;
export function buildDiscoverySystemPrompt(project: CanonicalProject): string;
export function mapAiBundle(bundle: any, project: CanonicalProject): any;
export function testProviderConnection(providerId: string, apiKey: string): Promise<boolean>;