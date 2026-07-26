// Type declarations for src/v4/credential-vault.js
export interface CredentialVault {
  loadCredentials(): Promise<Record<string, string>>;
  saveCredentials(credentials: Record<string, string>): Promise<void>;
  getCredential(key: string): Promise<string | null>;
  setCredential(key: string, value: string): Promise<void>;
  deleteCredential(key: string): Promise<void>;
  listCredentials(): Promise<string[]>;
}

export function createCredentialVault(): CredentialVault;
export class CredentialVault {
  loadCredentials(): Promise<Record<string, string>>;
  saveCredentials(credentials: Record<string, string>): Promise<void>;
  getCredential(key: string): Promise<string | null>;
  setCredential(key: string, value: string): Promise<void>;
  deleteCredential(key: string): Promise<void>;
  listCredentials(): Promise<string[]>;
}