import { CircleAlert, CircleCheck, LoaderCircle, Settings2 } from 'lucide-react';
import {
  providerGateOpen,
  providerRecoveryHint,
  type ProviderReadinessResult
} from '../../v4/application/provider-readiness-service.js';

interface ProviderGateNoticeProps {
  readiness: ProviderReadinessResult | null;
  checking: boolean;
  onOpenSettings: () => void;
  onRecheck: () => void;
}

export function ProviderGateNotice({ readiness, checking, onOpenSettings, onRecheck }: ProviderGateNoticeProps) {
  if (checking && !readiness) {
    return (
      <div className="provider-gate checking" role="status">
        <LoaderCircle className="spin" size={17} /> AI sağlayıcısı denetleniyor…
      </div>
    );
  }
  if (!readiness) return null;

  if (providerGateOpen(readiness)) {
    return (
      <div className="provider-gate ready" role="status">
        <CircleCheck size={17} />
        <span>{readiness.message}</span>
        <button type="button" className="link" onClick={onOpenSettings}>Değiştir</button>
      </div>
    );
  }

  const hint = providerRecoveryHint(readiness);
  return (
    <div className="provider-gate blocked" role="alert">
      <div className="provider-gate-head">
        <CircleAlert size={18} />
        <strong>AI sağlayıcısı bağlı değil</strong>
      </div>
      <p>{readiness.message}</p>
      {hint && <p className="provider-gate-hint">{hint}</p>}
      <ul className="provider-gate-options">
        {readiness.options.map(option => (
          <li key={option.providerId}>
            <strong>{option.label}</strong>
            {option.requiresCredential
              ? <span className="badge">API anahtarı gerekir</span>
              : <span className="badge local">Anahtar gerekmez</span>}
            <span className="provider-gate-desc">{option.description}</span>
          </li>
        ))}
      </ul>
      <div className="provider-gate-actions">
        <button type="button" className="primary" onClick={onOpenSettings}>
          <Settings2 size={17} /> Sağlayıcı bağla
        </button>
        <button type="button" className="file-action" disabled={checking} onClick={onRecheck}>
          {checking ? <LoaderCircle className="spin" size={17} /> : null} Yeniden dene
        </button>
      </div>
    </div>
  );
}
