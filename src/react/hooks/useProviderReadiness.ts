import { useCallback, useEffect, useState } from 'react';
import { testProviderConnection } from '../../v4/ai/provider-connection.js';
import {
  evaluateProviderReadiness,
  type ProviderReadinessResult
} from '../../v4/application/provider-readiness-service.js';
import type { ProviderSettings } from '../../v4/provider-settings.js';

interface CredentialVault {
  get(providerId: string): Promise<string | null> | string | null;
}

/**
 * Açılışta çalışan bir AI sağlayıcısı olup olmadığını belirler.
 * Ağ çağrısını yalnız burada yapar; karar mantığı saf servistedir.
 */
export function useProviderReadiness(settings: ProviderSettings, credentialVault: CredentialVault) {
  const [readiness, setReadiness] = useState<ProviderReadinessResult | null>(null);
  const [checking, setChecking] = useState(true);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const result = await evaluateProviderReadiness(settings, {
        probe: async (candidate, credential) => {
          const outcome = await testProviderConnection(
            {
              providerId: candidate.providerId,
              model: candidate.model || '',
              baseUrl: candidate.baseUrl || ''
            },
            credential
          );
          return { ok: outcome.ok, errorCode: outcome.errorCode, message: outcome.message };
        },
        credentialFor: async providerId => (await credentialVault.get(providerId)) || ''
      });
      setReadiness(result);
      return result;
    } finally {
      setChecking(false);
    }
  }, [settings, credentialVault]);

  useEffect(() => { void check(); }, [check]);

  return { readiness, checking, recheck: check };
}
