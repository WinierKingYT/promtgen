// Type declarations for src/v4/provider-url-policy.js

export interface ProviderUrlPolicy {
  allowedDomains: string[];
  requireHttps: boolean;
  maxRedirects: number;
}

export function normalizeProviderSettings(settings: any): any;
export function validateProviderSettings(settings: any): { valid: boolean; errors: string[] };
export function getProviderUrlPolicy(providerId: string): ProviderUrlPolicy;