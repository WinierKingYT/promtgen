export interface ProviderMeta {
  id: string;
  label: string;
  description: string;
  credentialRequired: boolean;
  defaultModel: string;
  defaultBaseUrl?: string;
}

export const PROVIDER_CATALOG: readonly ProviderMeta[];

export interface ProviderSettings {
  providerId: string;
  model: string;
  baseUrl: string;
  useAiWhenAvailable: boolean;
  useLocalMemory: boolean;
}

export function getDefaultProviderSettings(): ProviderSettings;
export function loadProviderSettings(): ProviderSettings;
export function saveProviderSettings(settings: ProviderSettings): ProviderSettings;
export function getProviderMeta(providerId: string): ProviderMeta;
