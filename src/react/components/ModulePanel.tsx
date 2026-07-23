import { useMemo, useRef, useState } from 'react';
import { Boxes, Check, CircleAlert, Download, Sparkles } from 'lucide-react';
import { applyLocalModuleImport, applyModuleActivation, previewLocalModuleImport, previewModuleActivation, suggestModules } from '../../v4/module-registry.js';

export function ModulePanel({ project, onCommit }: { project: any; onCommit: (project: any, message: string) => void }) {
  const suggestions = useMemo(() => suggestModules(project), [project]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activation, setActivation] = useState<any>(null);
  const [localImport, setLocalImport] = useState<any>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const prepare = () => { const next = previewModuleActivation(project, [...selected]); setActivation(next); setError(next.errors.join(' ')); };
  const approve = () => {
    const result = applyModuleActivation(project, activation, { approved: true });
    if (!result.success) { setError(result.reason); return; }
    onCommit(result.project, `${activation.moduleIds.length} planlama modülü etkinleştirildi.`);
    setActivation(null); setSelected(new Set()); setError('');
  };
  const loadManifest = async (file: File) => {
    try { const preview = previewLocalModuleImport(project, JSON.parse(await file.text())); setLocalImport(preview); setError(preview.errors.join(' ')); }
    catch { setError('Modül manifesti geçerli JSON değil.'); }
  };
  const approveImport = () => {
    const result = applyLocalModuleImport(project, localImport, { approved: true });
    if (!result.success) { setError(result.reason); return; }
    onCommit(result.project, `${localImport.manifest.id} yerel modülü kaydedildi.`);
    setLocalImport(null); setError('');
  };

  return <details className="module-panel">
    <summary><Boxes size={16}/><span>Planlama modülleri<small>{project.modules.active.length} aktif · {project.modules.localManifests.length} yerel</small></span></summary>
    <div className="module-body">
      <p>Modüller yalnız deklaratif plan, inceleme ve export katkılarıdır; komut veya kod çalıştıramaz.</p>
      {suggestions.length > 0 && <section aria-labelledby="module-suggestions-title"><h3 id="module-suggestions-title"><Sparkles size={13}/> Projene uygun modüller</h3>{suggestions.slice(0, 6).map(({ module, matchedTriggers }: any) => <label key={module.id}><input type="checkbox" checked={selected.has(module.id)} onChange={() => { setActivation(null); setSelected(current => { const next = new Set(current); if (next.has(module.id)) next.delete(module.id); else next.add(module.id); return next; }); }}/><span><b>{module.name}</b><small>{module.description}</small><em>{matchedTriggers.join(', ')}</em></span></label>)}</section>}
      {selected.size > 0 && !activation && <button type="button" onClick={prepare}>Aktivasyonu önizle</button>}
      {activation && <div className="module-preview" role="region" aria-label="Modül aktivasyon önizlemesi"><b>{activation.moduleIds.join(' → ')}</b><small>Zorunlu bölümler: {activation.requiredSections.join(', ') || 'değişiklik yok'}</small><div><button type="button" onClick={() => setActivation(null)}>Vazgeç</button><button type="button" className="primary" disabled={activation.errors.length > 0} onClick={approve}><Check size={14}/> Modülleri onayla</button></div></div>}
      <button type="button" onClick={() => fileRef.current?.click()}><Download size={14}/> Yerel JSON manifest ekle</button><input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={event => event.target.files?.[0] && loadManifest(event.target.files[0])}/>
      {localImport && <div className="module-preview"><b>{localImport.manifest?.name || localImport.manifest?.id}</b><small>{localImport.manifest?.id}@{localImport.manifest?.version}</small><div><button type="button" onClick={() => setLocalImport(null)}>Vazgeç</button><button type="button" className="primary" disabled={localImport.errors.length > 0} onClick={approveImport}><Check size={14}/> Manifesti onayla</button></div></div>}
      {error && <p className="module-error" role="alert"><CircleAlert size={14}/>{error}</p>}
    </div>
  </details>;
}
