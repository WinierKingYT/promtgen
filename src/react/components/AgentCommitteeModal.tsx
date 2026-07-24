import { useEffect, useRef, useState } from 'react';
import { Users, Check, Sparkles, X, Plus, Vote, Award, ShieldAlert } from 'lucide-react';
import { getDomainAgentCommittee, runCommitteeEvaluation, runCommitteeVoting } from '../../v4/agent-committee.js';
import { IconButton } from './WorkspaceChrome.js';

export function AgentCommitteeModal({ open, project, onCommit, onClose }: { open: boolean; project: any; onCommit: (project: any, msg: string) => void; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const committee = getDomainAgentCommittee(project);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [votingResult, setVotingResult] = useState<any>(null);

  const [customName, setCustomName] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [customFocus, setCustomFocus] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEvaluations(runCommitteeEvaluation(project));
    setVotingResult(runCommitteeVoting(project));
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }, [open, project.id, project.decisions]);

  if (!open) return null;

  const acceptDecision = (item: any) => {
    const next = structuredClone(project);
    const newDecision = {
      id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: `${item.agent.name} Tavsiyesi`,
      decision: item.decisionProposal,
      status: 'accepted',
      rationale: item.recommendation
    };
    next.decisions = [...(next.decisions || []), newDecision];
    onCommit(next, `${item.agent.name} mimari kararı kabul edildi.`);
  };

  const addCustomAgent = () => {
    if (!customName.trim() || !customRole.trim()) return;
    const customSlot = {
      id: `agent-custom-${Date.now()}`,
      name: customName.trim(),
      role: customRole.trim(),
      icon: '💡',
      color: '#ec4899',
      focus: customFocus.trim() || 'Özel mimari alan optimizasyonu'
    };
    const next = structuredClone(project);
    next.customAgentSlot = customSlot;
    onCommit(next, `Konseye 5. özel ajan eklendi: ${customName}`);
    setShowAddCustom(false);
    setCustomName('');
    setCustomRole('');
    setCustomFocus('');
  };

  return (
    <dialog ref={dialogRef} open className="committee-dialog" style={{ width: '92%', maxWidth: '850px', background: '#18181b', border: '1px solid rgba(139, 92, 246, 0.4)', borderRadius: '14px', color: '#f3f4f6', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.2)', padding: '8px', borderRadius: '8px', color: '#a78bfa' }}>
            <Users size={22} />
          </div>
          <div>
            <span style={{ fontSize: '10px', color: '#a78bfa', fontWeight: 700, letterSpacing: '0.5px' }}>ÇOKLU AJAN MİMARİ KONSEYİ</span>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>👥 Alan Uzmanı Ajan Konseyi & Konsensüs Oylaması</h2>
          </div>
        </div>
        <IconButton label="Konseyi kapat" onClick={onClose}><X size={18}/></IconButton>
      </div>

      {/* Consensus Score Banner */}
      {votingResult && (
        <div style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: votingResult.score >= 80 ? '#10b981' : '#f59e0b', color: '#fff', padding: '8px 12px', borderRadius: '8px', fontWeight: 800, fontSize: '16px' }}>
              %{votingResult.score}
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>Konsey Konsensüs Uyum Skoru</div>
              <div style={{ fontSize: '11px', color: '#d1d5db' }}>{votingResult.summary}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAddCustom(!showAddCustom)}
            style={{ background: 'rgba(236, 72, 153, 0.2)', border: '1px solid rgba(236, 72, 153, 0.4)', color: '#fbcfe8', fontSize: '11px', fontWeight: 600, padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}
          >
            {showAddCustom ? 'İptal' : '➕ 5. Özel Ajan Ekle'}
          </button>
        </div>
      )}

      {/* Form to add 5th Custom Agent */}
      {showAddCustom && (
        <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(236, 72, 153, 0.4)', borderRadius: '10px', padding: '12px', marginBottom: '16px' }}>
          <span style={{ fontSize: '11px', color: '#fbcfe8', fontWeight: 700, display: 'block', marginBottom: '8px' }}>ÖZEL 5. UZMAN AJAN TANIMLA</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <input type="text" placeholder="Ajan Adı (Örn: Maliyet & Bütçe Uzmanı)" value={customName} onChange={e => setCustomName(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '12px' }} />
            <input type="text" placeholder="Ajan Rolü (Örn: Cost Optimization Architect)" value={customRole} onChange={e => setCustomRole(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '12px' }} />
          </div>
          <input type="text" placeholder="Odak Alanı (Örn: Cloud sunucu harcamaları ve API kotası optimizasyonu)" value={customFocus} onChange={e => setCustomFocus(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', marginBottom: '8px' }} />
          <button type="button" onClick={addCustomAgent} disabled={!customName.trim() || !customRole.trim()} style={{ background: '#ec4899', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            Ajanı Konseye Ekle
          </button>
        </div>
      )}

      {/* Agent Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', maxHeight: '420px', overflowY: 'auto' }}>
        {evaluations.map((item: any) => {
          const voteInfo = votingResult?.votes?.find((v: any) => v.agent.id === item.agent.id);
          const voteBadge = voteInfo?.vote === 'approved' ? '🟢 ONAYLADI' : voteInfo?.vote === 'conditional' ? '🟡 ŞARTLI ONAY' : '🔴 ÇEKİNCESİ VAR';

          return (
            <div
              key={item.agent.id}
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${item.agent.color}40`,
                borderRadius: '10px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>{item.agent.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>{item.agent.name}</div>
                      <div style={{ fontSize: '10px', color: item.agent.color, fontWeight: 600 }}>{item.agent.role}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: voteInfo?.vote === 'approved' ? '#10b981' : voteInfo?.vote === 'conditional' ? '#f59e0b' : '#ef4444', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '10px' }}>
                    {voteBadge}
                  </span>
                </div>

                <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '8px', fontStyle: 'italic' }}>
                  Odak: {item.agent.focus}
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '10px', fontSize: '11px', color: '#d1d5db', lineHeight: '1.4' }}>
                  <div style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: '4px' }}>💡 Ajan Tavsiyesi:</div>
                  {item.recommendation}
                </div>
              </div>

              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', color: '#a78bfa', fontWeight: 600 }}>Karar: {item.decisionProposal.slice(0, 25)}...</span>
                <button
                  type="button"
                  onClick={() => acceptDecision(item)}
                  style={{ background: item.agent.color, color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={12} /> Plana Kabul Et
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </dialog>
  );
}
