import type { ProviderMeta, ProviderSettings } from './provider-settings.js';

export function normalizeProviderBaseUrl(providerId: string, value?: string): string;
export function normalizeProviderSettings(settings?: Partial<ProviderSettings>, catalogEntry?: Partial<ProviderMeta>): ProviderSettings;
export function validateProviderSettings(settings?: Partial<ProviderSettings>, catalogEntry?: Partial<ProviderMeta>):
  | { valid: true; settings: ProviderSettings; error: null }
  | { valid: false; settings: null; error: string };
export function getFixedProviderEndpoint(providerId: string): string;
