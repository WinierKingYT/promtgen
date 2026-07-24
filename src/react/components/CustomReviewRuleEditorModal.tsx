import { useRef, useState } from 'react';
import { ShieldCheck, Plus, Trash2, X, FileCode2 } from 'lucide-react';
import { IconButton } from './WorkspaceChrome.js';

export function CustomReviewRuleEditorModal({ open, project, onCommit, onClose }: { open: boolean; project: any; onCommit: (project: any, msg: string) => void; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const rules = project.customReviewRules || [];

  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [condition, setCondition] = useState<'must_include' | 'must_not_include'>('must_include');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');

  if (!open) return null;

  const addRule = () => {
    if (!title.trim() || !query.trim()) return;
    const newRule = {
      id: `rule-custom-${Date.now()}`,
      title: title.trim(),
      query: query.trim(),
      condition,
      severity,
      message: `Özel denetim kuralı: "${query.trim()}" ${condition === 'must_include' ? 'bulunamadı' : 'bulundu'}.`,
      recommendation: `Plana "${query.trim()}" konusuyla ilgili gerekli kararı ekleyin.`
    };
    const next = structuredClone(project);
    next.customReviewRules = [...(next.customReviewRules || []), newRule];
    onCommit(next, `Özel mimari denetim kuralı eklendi: ${title}`);
    setTitle('');
    setQuery('');
  };

  const removeRule = (ruleId: string) => {
    const next = structuredClone(project);
    next.customReviewRules = (next.customReviewRules || []).filter((r: any) => r.id !== ruleId);
    onCommit(next, 'Özel mimari denetim kuralı silindi.');
  };

  return (
    <dialog ref={dialogRef} open className="custom-rules-dialog" style={{ width: '90%', maxWidth: '700px', background: '#18181b', border: '1px solid rgba(139, 92, 246, 0.4)', borderRadius: '14px', color: '#f3f4f6', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.2)', padding: '8px', borderRadius: '8px', color: '#a78bfa' }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <span style={{ fontSize: '10px', color: '#a78bfa', fontWeight: 700, letterSpacing: '0.5px' }}>DENETLEME MOTORU KURAL EDİTÖRÜ</span>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>🛡️ Özel Mimari İnceleme Kuralları</h2>
          </div>
        </div>
        <IconButton label="Pencereyi kapat" onClick={onClose}><X size={18}/></IconButton>
      </div>

      {/* Add New Rule Form */}
      <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
        <span style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 700, display: 'block', marginBottom: '8px' }}>YENİ İNCELEME KURALI EKLE</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="Kural Başlığı (Örn: TypeScript Zorunluluğu)"
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '12px' }}
          />
          <input
            type="text"
            placeholder="Aranacak Terim / Kısıt (Örn: typescript)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '12px' }}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'center' }}>
          <select
            value={condition}
            onChange={e => setCondition(e.target.value as any)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '12px' }}
          >
            <option value="must_include">Plana Mutlaka Dahil Edilmeli (Must Include)</option>
            <option value="must_not_include">Yasaklı Terim (Must Not Include)</option>
          </select>
          <select
            value={severity}
            onChange={e => setSeverity(e.target.value as any)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '12px' }}
          >
            <option value="low">Önem: Düşük (Low)</option>
            <option value="medium">Önem: Orta (Medium)</option>
            <option value="high">Önem: Yüksek (High)</option>
            <option value="critical">Önem: Kritik (Critical)</option>
          </select>
          <button
            type="button"
            onClick={addRule}
            disabled={!title.trim() || !query.trim()}
            style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Plus size={14} /> Ekle
          </button>
        </div>
      </div>

      {/* Rules List */}
      <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
        <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
          TANIMLI ÖZEL DENETİM KURALLARI ({rules.length})
        </span>
        {rules.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center', padding: '16px' }}>Henüz özel bir denetim kuralı tanımlanmadı.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rules.map((rule: any) => (
              <div key={rule.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '12px', color: '#e5e7eb' }}>{rule.title}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                    Koşul: <code style={{ color: '#a78bfa' }}>{rule.condition}</code> · Aranan: <code style={{ color: '#3b82f6' }}>"{rule.query}"</code> · Önem: <b>{rule.severity}</b>
                  </div>
                </div>
                <IconButton label="Kuralı sil" onClick={() => removeRule(rule.id)}>
                  <Trash2 size={14} style={{ color: '#ef4444' }} />
                </IconButton>
              </div>
            ))}
          </div>
        )}
      </div>
    </dialog>
  );
}
