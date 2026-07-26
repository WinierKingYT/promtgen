export interface CredentialVault {
  set(provider: string, credential: string): Promise<void>;
  get(provider: string): Promise<string | null>;
  remove(provider: string): Promise<void>;
}

export class SessionCredentialVault implements CredentialVault {
  set(provider: string, credential: string): Promise<void>;
  get(provider: string): Promise<string | null>;
  remove(provider: string): Promise<void>;
}

export class DesktopCredentialVault implements CredentialVault {
  set(provider: string, credential: string): Promise<void>;
  get(provider: string): Promise<string | null>;
  remove(provider: string): Promise<void>;
}

export function createCredentialVault(): CredentialVault;
