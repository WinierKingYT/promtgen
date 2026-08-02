export interface ProviderMeta {
  id: string;
  label: string;
  description: string;
  credentialRequired: boolean;
  defaultModel: string;
  defaultBaseUrl?: string;
  builtIn?: boolean;
}

export const PROVIDER_CATALOG: readonly ProviderMeta[];
export const DEFAULT_PROVIDER_ID: 'nvidia';
export const BUILT_IN_NVIDIA_MODEL: 'z-ai/glm-5.2';

export interface ProviderSettings {
  providerId: string;
  model: string;
  baseUrl: string;
  useAiWhenAvailable: boolean;
  useLocalMemory: boolean;
}

export function getDefaultProviderSettings(): ProviderSettings;
export function upgradeProviderSettings(settings: Partial<ProviderSettings> | null | undefined): ProviderSettings;
export function loadProviderSettings(): ProviderSettings;
export function saveProviderSettings(settings: ProviderSettings): ProviderSettings;
export function getProviderMeta(providerId: string): ProviderMeta;
