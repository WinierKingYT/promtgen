import { invoke, isTauri } from '@tauri-apps/api/core';

const sessionCredentials = new Map();

export class SessionCredentialVault {
    async set(provider, credential) { sessionCredentials.set(provider, credential); }
    async get(provider) { return sessionCredentials.get(provider) || null; }
    async remove(provider) { sessionCredentials.delete(provider); }
}

export class DesktopCredentialVault {
    async set(provider, credential) { await invoke('set_provider_credential', { provider, credential }); }
    async get(provider) { return invoke('get_provider_credential', { provider }); }
    async remove(provider) { await invoke('delete_provider_credential', { provider }); }
}

export function createCredentialVault() { return isTauri() ? new DesktopCredentialVault() : new SessionCredentialVault(); }
