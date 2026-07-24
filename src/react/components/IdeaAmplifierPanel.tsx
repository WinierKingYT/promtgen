import { useState, useMemo } from 'react';
import { ArrowRight, Check, Sparkles, Telescope } from 'lucide-react';
import { applyIdeaExpansion } from '../../v4/planning-engine.js';
import { generateExpansionDimensions } from '../../v4/ai-discovery.js';

export function IdeaAmplifierPanel({ project, onCommit }: any) {
  const originalIdea = String(project.identity?.originalIdea || '').trim();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dimensions = useMemo(() => generateExpansionDimensions(originalIdea) as unknown[], [originalIdea]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});

  const toggleAnswer = (dimId: string, value: string) =>
    setAnswers(prev => prev[dimId] === value ? { ...prev, [dimId]: '' } : { ...prev, [dimId]: value });

  const expandedIdea = useMemo(() => {
    const parts = dimensions
      .map((d: any) => (answers[d.id] || '').trim())
      .filter(Boolean);
    return parts.length ? `${originalIdea} — ${parts.join(', ')}` : originalIdea;
  }, [answers, dimensions, originalIdea]);

  const answeredCount = Object.values(answers).filter(Boolean).length;

  const handleProceed = () => {
    const next = (applyIdeaExpansion as (...a: unknown[]) => unknown)(project, { answers, dimensions });
    onCommit(next, 'Fikir genişletildi. Planlama aşamasına geçildi.');
  };

  return (
    <section style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(16,185,129,0.08) 100%)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: '14px', padding: '24px', margin: '16px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        <Telescope size={22} style={{ color: '#a78bfa' }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px', color: '#f3f4f6' }}>🔭 Fikir Büyütücü</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>Kısa fikrinizi adım adım büyütün. Her boyuttan birini seçin veya kendiniz yazın.</div>
        </div>
        <button
          type="button"
          onClick={handleProceed}
          style={{ marginLeft: 'auto', fontSize: '11px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#9ca3af', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          Atla →
        </button>
      </div>

      {/* Original idea pill */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', color: '#d1d5db', marginBottom: '20px' }}>
        <Sparkles size={12} style={{ color: '#a78bfa' }} />
        Başlangıç fikri: <b style={{ color: '#e5e7eb' }}>"{originalIdea}"</b>
      </div>

      {/* Dimension cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {dimensions.map((dim: any) => (
          <div key={dim.id} style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${answers[dim.id] ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '10px', padding: '14px 16px', transition: 'border-color 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '18px' }}>{dim.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#f3f4f6' }}>{dim.label}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>{dim.question}</div>
              </div>
              {answers[dim.id] && <Check size={14} style={{ marginLeft: 'auto', color: '#10b981' }} />}
            </div>

            {/* Option chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {dim.options.map((opt: string) => {
                const isSelected = answers[dim.id] === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleAnswer(dim.id, opt)}
                    style={{
                      fontSize: '11px', padding: '5px 10px', borderRadius: '20px', cursor: 'pointer', border: '1px solid',
                      background: isSelected ? '#7c3aed' : 'rgba(255,255,255,0.05)',
                      borderColor: isSelected ? '#7c3aed' : 'rgba(255,255,255,0.15)',
                      color: isSelected ? '#fff' : '#d1d5db',
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      transition: 'all 0.15s',
                    }}
                  >
                    {isSelected && <Check size={12} />}
                    {opt}
                  </button>
                );
              })}
            </div>

            {/* Free text input */}
            <input
              type="text"
              placeholder="Veya kendiniz yazın ve Enter'a basın…"
              value={customInputs[dim.id] || ''}
              onChange={e => setCustomInputs(prev => ({ ...prev, [dim.id]: e.target.value }))}
              onKeyDown={e => {
                if (e.key === 'Enter' && (customInputs[dim.id] || '').trim()) {
                  const val = (customInputs[dim.id] || '').trim();
                  toggleAnswer(dim.id, val);
                  setCustomInputs(prev => ({ ...prev, [dim.id]: '' }));
                }
              }}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', color: '#e5e7eb', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        ))}
      </div>

      {/* Live expanded idea preview */}
      <div style={{ margin: '18px 0 0', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', padding: '14px 16px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#10b981', letterSpacing: '0.5px', marginBottom: '6px' }}>
          📝 BÜYÜYEN FİKİR ({answeredCount}/{dimensions.length} boyut seçili)
        </div>
        <p style={{ margin: 0, fontSize: '13px', color: '#e5e7eb', lineHeight: '1.6', fontStyle: answeredCount === 0 ? 'italic' : 'normal' }}>
          {expandedIdea}
        </p>
      </div>

      {/* Proceed button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
        <button
          type="button"
          onClick={handleProceed}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: answeredCount > 0 ? '#7c3aed' : 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}
        >
          {answeredCount > 0
            ? <><Sparkles size={15}/> Bu Fikirle Planlamaya Geçelim <ArrowRight size={15}/></>
            : <><ArrowRight size={15}/> Atla ve Doğrudan Başla</>}
        </button>
      </div>
    </section>
  );
}
