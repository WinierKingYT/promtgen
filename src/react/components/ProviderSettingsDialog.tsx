import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Bot, Check, CircleAlert, Eye, EyeOff, KeyRound, LoaderCircle, Save, ShieldCheck, Wifi, X } from 'lucide-react';
import { getProviderMeta, PROVIDER_CATALOG, saveProviderSettings } from '../../v4/provider-settings.js';
import { validateProviderSettings } from '../../v4/provider-url-policy.js';
import { testProviderConnection } from '../../v4/ai/provider-connection.js';
import type { ProviderConnectionResult } from '../../v4/ai/provider-connection.js';
import type { ProviderSettings } from '../../v4/provider-settings.js';
import type { CredentialVault } from '../../v4/credential-vault.js';
import { IconButton } from './WorkspaceChrome.js';

interface ProviderSettingsDialogProps {
  open: boolean;
  settings: ProviderSettings;
  onSave: (settings: ProviderSettings) => void;
  onClose: () => void;
  credentialVault: CredentialVault;
}

export function ProviderSettingsDialog({ open, settings, onSave, onClose, credentialVault }: ProviderSettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [draftSettings, setDraftSettings] = useState(settings);
  const [credential, setCredential] = useState('');
  const [showCredential, setShowCredential] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ProviderConnectionResult | null>(null);
  const provider = getProviderMeta(draftSettings.providerId);

  useEffect(() => {
    if (!open) {
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
      return;
    }
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDraftSettings(settings);
    setResult(null);
    credentialVault.get(settings.providerId).then((value: string | null) => setCredential(value || ''));
    requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('button, input, select')?.focus());
    const returnTarget = returnFocusRef.current;
    return () => {
      returnTarget?.focus();
      returnFocusRef.current = null;
    };
  }, [credentialVault, open, settings]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) || [])].filter(element => !element.hasAttribute('hidden'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const chooseProvider = async (providerId: string) => {
    const meta = getProviderMeta(providerId);
    setDraftSettings(current => ({ ...current, providerId, model: meta.defaultModel, baseUrl: meta.defaultBaseUrl || '' }));
    setCredential(await credentialVault.get(providerId) || '');
    setResult(null);
  };

  const test = async () => {
    if (provider.credentialRequired && !credential.trim()) {
      setResult({ ok: false, message: 'Bu sağlayıcı için API anahtarı gerekli.', providerId: draftSettings.providerId, latencyMs: 0, errorCode: 'credential', checkedAt: new Date().toISOString() });
      return;
    }
    const validation = validateProviderSettings(draftSettings, provider);
    if (!validation.valid) { setResult({ ok: false, message: validation.error, providerId: draftSettings.providerId, latencyMs: 0, errorCode: 'configuration', checkedAt: new Date().toISOString() }); return; }
    setTesting(true); setResult(null);
    try { setResult(await testProviderConnection(draftSettings, credential.trim())); }
    finally { setTesting(false); }
  };

  const save = async () => {
    const validation = validateProviderSettings(draftSettings, provider);
    if (!validation.valid) { setResult({ ok: false, message: validation.error, providerId: draftSettings.providerId, latencyMs: 0, errorCode: 'configuration', checkedAt: new Date().toISOString() }); return; }
    if (credential.trim()) await credentialVault.set(draftSettings.providerId, credential.trim());
    else await credentialVault.remove(draftSettings.providerId);
    onSave(saveProviderSettings(draftSettings));
    dialogRef.current?.close(); onClose();
  };

  return (
    <dialog ref={dialogRef} open={open} className="provider-dialog" aria-modal="true" aria-labelledby="provider-dialog-title" onKeyDown={handleKeyDown} onCancel={onClose} onClose={onClose}>
      <div className="dialog-head"><div className="dialog-icon"><Bot size={20} /></div><div><span className="meta">AI YAPILANDIRMASI</span><h2 id="provider-dialog-title">Planlama motoru</h2></div><IconButton label="Ayarları kapat" onClick={() => { dialogRef.current?.close(); onClose(); }}><X size={18} /></IconButton></div>
      <p className="dialog-lead">AI yalnızca filtrelenmiş plan bağlamını görür. Ürettiği hiçbir değişiklik sen onaylamadan plana uygulanmaz.</p>
      <fieldset className="provider-options"><legend>Sağlayıcı</legend>{PROVIDER_CATALOG.map(item => <label key={item.id} className={draftSettings.providerId === item.id ? 'active' : ''}><input type="radio" name="provider" value={item.id} checked={draftSettings.providerId === item.id} onChange={() => chooseProvider(item.id)} /><span className="provider-radio" /><span><b>{item.label}</b><small>{item.description}</small></span>{item.builtIn && <em>Yerleşik</em>}{item.id === 'offline' && <em>Fallback</em>}</label>)}</fieldset>
      <div className="provider-fields">
        <label htmlFor="provider-model">Model<input id="provider-model" value={draftSettings.model} onChange={event => setDraftSettings({ ...draftSettings, model: event.target.value })} disabled={draftSettings.providerId === 'offline'} /></label>
        {draftSettings.providerId === 'ollama' && <label htmlFor="provider-url">Yerel Ollama adresi<input id="provider-url" type="url" value={draftSettings.baseUrl} onChange={event => setDraftSettings({ ...draftSettings, baseUrl: event.target.value.replace(/\/$/, '') })} /><small>Yalnız localhost veya loopback adresleri kabul edilir.</small></label>}
        {['openai', 'nvidia'].includes(draftSettings.providerId) && <label htmlFor="provider-url">Sabit API adresi<input id="provider-url" type="url" value={draftSettings.baseUrl} readOnly aria-readonly="true" /></label>}
        {provider.credentialRequired && <label htmlFor="provider-credential">API anahtarı<div className="secret-input"><KeyRound size={16} /><input id="provider-credential" type={showCredential ? 'text' : 'password'} value={credential} autoComplete="off" onChange={event => setCredential(event.target.value)} placeholder="NVIDIA API anahtarını bir kez ekle" /><IconButton label={showCredential ? 'Anahtarı gizle' : 'Anahtarı göster'} onClick={() => setShowCredential(value => !value)}>{showCredential ? <EyeOff size={16} /> : <Eye size={16} />}</IconButton></div>{draftSettings.providerId === 'nvidia' && <small>GLM-5.2 hazır seçilidir. Masaüstünde anahtar işletim sistemi kasasında tutulur; web oturumunda sayfa kapanınca silinir.</small>}</label>}
      </div>
      <label className="memory-toggle"><input type="checkbox" checked={draftSettings.useLocalMemory === true} onChange={event => setDraftSettings({ ...draftSettings, useLocalMemory: event.target.checked })} /><span><b>Yerel proje tercihlerimi kullan</b><small>Geçmiş projelerin ham metni paylaşılmaz. Yalnız toplulaştırılmış plan derinliği, karar türü, bölüm ve modül eğilimleri yeni AI turlarına eklenir.</small></span></label>
      <div className="privacy-callout"><ShieldCheck size={18} /><span><b>{draftSettings.providerId === 'ollama' || draftSettings.providerId === 'offline' ? 'Bağlam cihazda kalır' : 'Kontrollü bağlam paylaşımı'}</b><small>{provider.credentialRequired ? 'Web anahtarı oturum belleğinde; masaüstü anahtarı işletim sistemi kasasında tutulur.' : 'API anahtarı veya bulut bağlantısı gerektirmez.'}</small></span></div>
      {result && <div className={`connection-result ${result.ok ? 'ok' : 'error'}`} role="status">{result.ok ? <Check size={16} /> : <CircleAlert size={16} />}<span>{result.message}<small>{result.providerId} · {result.latencyMs} ms{result.errorCode ? ` · ${result.errorCode}` : ''}</small></span></div>}
      <div className="dialog-actions"><button onClick={test} disabled={testing}>{testing ? <LoaderCircle className="spin" size={16} /> : <Wifi size={16} />} Bağlantıyı test et</button><button className="primary" onClick={save}><Save size={16} /> Ayarları kaydet</button></div>
    </dialog>
  );
}
