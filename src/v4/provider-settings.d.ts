// Type declarations for src/v4/provider-settings.js

export interface ProviderMeta {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
  supportsStructuredOutput: boolean;
  supportsStreaming: boolean;
}

export const PROVIDER_CATALOG: ProviderMeta[];

export interface ProviderSettings {
  activeProvider: string;
  credentials: Record<string, string>;
  customEndpoints: Record<string, string>;
}

export function loadProviderSettings(): ProviderSettings;
export function saveProviderSettings(settings: ProviderSettings): void;
export function getProviderMeta(providerId: string): ProviderMeta | undefined;
export function validateProviderSettings(settings: ProviderSettings): { valid: boolean; errors: string[] };