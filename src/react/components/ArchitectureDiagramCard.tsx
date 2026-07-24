import { useState, useMemo } from 'react';
import { Copy, Check, Network, Layers } from 'lucide-react';
import { generateArchitectureDiagram, generateDataFlowDiagram } from '../../v4/diagram-generator.js';

export function ArchitectureDiagramCard({ project }: { project: any }) {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const archDiagram = useMemo(() => generateArchitectureDiagram(project), [project]);
  const flowDiagram = useMemo(() => generateDataFlowDiagram(project), [project]);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div style={{ background: 'rgba(30, 30, 38, 0.95)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '12px', padding: '16px', margin: '16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.2)', padding: '6px', borderRadius: '6px', color: '#a78bfa' }}>
            <Network size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f3f4f6' }}>Görsel Mimari & Veri Akış Şeması (Mermaid.js)</h3>
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>Projenizin mimari yapısı ve bileşen etkileşim grafiği</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* Architecture Diagram Code Preview */}
        <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Layers size={14} /> Sistem Katmanları (graph TD)
            </span>
            <button
              onClick={() => copyToClipboard(archDiagram, 'arch')}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#d1d5db', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {copiedType === 'arch' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              {copiedType === 'arch' ? 'Kopyalandı' : 'Mermaid Kopyala'}
            </button>
          </div>
          <pre style={{ margin: 0, fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto' }}>
            {archDiagram}
          </pre>
        </div>

        {/* Data Flow Diagram Code Preview */}
        <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Network size={14} /> Veri Akış Sekansı (sequence)
            </span>
            <button
              onClick={() => copyToClipboard(flowDiagram, 'flow')}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#d1d5db', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {copiedType === 'flow' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              {copiedType === 'flow' ? 'Kopyalandı' : 'Mermaid Kopyala'}
            </button>
          </div>
          <pre style={{ margin: 0, fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto' }}>
            {flowDiagram}
          </pre>
        </div>
      </div>
    </div>
  );
}
