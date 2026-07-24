import { useState, useMemo } from 'react';
import { ArrowRight, Check, CheckCircle2, Layers, Lightbulb, ShieldAlert, Sparkles, Wand2, Activity, Telescope } from 'lucide-react';
import { confirmConceptSummary, applyImpactAnalysis, applyExtensionModules, resolveImpactContradiction, runConceptSimulation, applyIdeaExpansion } from '../../v4/planning-engine.js';
import { generateConceptSummary, generateExpansionDimensions } from '../../v4/ai-discovery.js';

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: '6px', fontSize: '11px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', color: '#9ca3af' }}>
        <span>{label}</span>
        <b style={{ color: '#f3f4f6' }}>{value}/5</b>
      </div>
      <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(value / 5) * 100}%`, background: color, borderRadius: '2px', transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

export function IdeaLabPanel({ project, onCommit, providerSettings }: any) {
  const session = project.ideaLabSession;
  const approaches = session?.approaches || [];
  const [selectedId, setSelectedId] = useState(session?.selectedApproachId || approaches.find((a: any) => a.recommended)?.id || approaches[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [customChips, setCustomChips] = useState<Record<string, string[]>>({});
  const [chipInputs, setChipInputs] = useState<Record<string, string>>({});

  const selectedApproach = approaches.find((a: any) => a.id === selectedId) || approaches[0];
  const sim = selectedApproach ? runConceptSimulation(project, selectedApproach.id) : null;

  const handleGenerateConcept = async () => {
    setLoading(true);
    try {
      const next = await generateConceptSummary(project, { selectedApproachId: selectedId, settings: providerSettings } as any);
      if (sim && next.ideaLabSession?.conceptSummary) {
        next.ideaLabSession.conceptSummary.simulationResult = sim;
      }
      onCommit(next, 'Konsept özeti hazırlandı ve simülasyon tamamlandı.');
    } finally {
      setLoading(false);
    }
  };

  const handlePresetClick = (presetText: string) => {
    const cleanText = presetText.replace(/^\[|\]$/g, '');
    const next = structuredClone(project);
    if (!next.ideaLabSession.ideaNotes) next.ideaLabSession.ideaNotes = [];
    if (!next.ideaLabSession.ideaNotes.includes(cleanText)) {
      next.ideaLabSession.ideaNotes.push(`Seçilen tercih: ${cleanText}`);
    }
    onCommit(next, `"${cleanText}" tercihi fikir laboratuvarına eklendi.`);
  };

  const handleAddCustomChip = (appId: string) => {
    const text = (chipInputs[appId] || '').trim();
    if (!text) return;
    const formattedChip = text.startsWith('[') ? text : `[${text}]`;
    setCustomChips(prev => ({
      ...prev,
      [appId]: [...(prev[appId] || []), formattedChip]
    }));
    setChipInputs(prev => ({ ...prev, [appId]: '' }));
    handlePresetClick(formattedChip);
  };

  return (
    <section className="idea-lab-container" style={{ background: 'var(--surface-color, #1e1e24)', borderRadius: '12px', padding: '20px', margin: '16px 0', border: '1px solid rgba(139, 92, 246, 0.3)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
      {/* Unlimited Idea Expansion Guidance Box */}
      <div style={{ background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.4)', padding: '12px 16px', borderRadius: '8px', marginBottom: '18px', fontSize: '13px', color: '#ddd6fe', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ fontWeight: 700, color: '#a78bfa', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={16} /> 💬 Sınırsız Fikir Geliştirme Aşaması
        </div>
        <span>1. <b>İstediğiniz Kadar Sohbet Edin:</b> Aşağıdaki sohbet kutusundan AI mimar ile dilediğiniz kadar yazışabilir, sorular sorabilir ve fikirlerinizi detaylandırabilirsiniz.</span>
        <span>2. <b>Mimari Seçenekleri Kıyaslayın:</b> Dilerseniz aşağıdaki 3 alternatif mimariyi ve metrik derecelendirmelerini inceleyip radyo butonuyla tercihinizi belirleyin.</span>
        <span>3. <b>Hazır Olduğunuzda Geçin:</b> Fikrinizi yeterince geliştirdiğinizi hissettiğinizde en alttaki <b>"Seçilen Yaklaşımla Konsept Özeti Oluştur"</b> butonuna basarak plana geçebilirsiniz.</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.2)', padding: '8px', borderRadius: '8px', color: '#a78bfa' }}>
            <Lightbulb size={24} />
          </div>
          <div>
            <span style={{ fontSize: '11px', letterSpacing: '1px', color: '#a78bfa', fontWeight: 600 }}>AŞAMA 2: FİKİR LABORATUVARI & TARTIŞMA</span>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Tasarım & Mimari Karşılaştırma Matrisi</h2>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            style={{ background: viewMode === 'cards' ? '#8b5cf6' : 'transparent', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
          >
            🎴 Kartlar
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            style={{ background: viewMode === 'table' ? '#8b5cf6' : 'transparent', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
          >
            📋 Yan Yana Karşılaştırma Tablosu
          </button>
        </div>
      </div>

      {/* AI Recommendation Rationale Panel */}
      {selectedApproach && (
        <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', color: '#bfdbfe' }}>
          <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={16} /> 💡 Mimarın Seçim Gerekçesi: "{selectedApproach.title}"
          </div>
          <span>{selectedApproach.recommended ? 'AI Mimar bu yaklaşımı projenizin karmaşıklık skoru ve ağ dengesine en uygun seçenek olarak öne çıkardı.' : 'Bu alternatif daha spesifik ihtiyaçlara odaklanmaktadır.'}</span>
        </div>
      )}

      {viewMode === 'cards' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {approaches.map((app: any) => {
            const isSelected = selectedId === app.id;
            const m = app.metrics || { effortScore: 3, networkLoad: 2, fpsImpact: 2, maintainability: 4 };
            const allChips = [...(app.presetAnswers || []), ...(customChips[app.id] || [])];
            return (
              <div
                key={app.id}
                onClick={() => setSelectedId(app.id)}
                style={{
                  border: isSelected ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.1)',
                  background: isSelected ? 'rgba(139, 92, 246, 0.12)' : 'rgba(255,255,255,0.02)',
                  borderRadius: '10px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {app.recommended && (
                  <span style={{ position: 'absolute', top: '12px', right: '12px', background: '#8b5cf6', color: '#fff', fontSize: '10px', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                    ÖNERİLEN
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <input type="radio" checked={isSelected} onChange={() => setSelectedId(app.id)} style={{ accentColor: '#8b5cf6' }} />
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#f3f4f6' }}>{app.title}</h3>
                </div>
                <p style={{ fontSize: '13px', color: '#d1d5db', marginBottom: '12px', lineHeight: '1.4' }}>{app.description}</p>

                {/* Metric Ratings Matrix */}
                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '10px', borderRadius: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '10px', color: '#a78bfa', fontWeight: 600, letterSpacing: '0.5px' }}>TRADEOFF METRİKLERİ</span>
                  <div style={{ marginTop: '6px' }}>
                    <MetricBar label="Geliştirme Eforu" value={m.effortScore} color="#f59e0b" />
                    <MetricBar label="Network / Ağ Yükü" value={m.networkLoad} color="#3b82f6" />
                    <MetricBar label="Performans / Kaynak Yükü" value={m.fpsImpact} color="#ef4444" />
                    <MetricBar label="Bakım Kolaylığı" value={m.maintainability} color="#10b981" />
                  </div>
                </div>

                {/* Preset Answers & Custom Chips */}
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ fontSize: '10px', color: '#9ca3af' }}>Tercih Çipleri:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px', marginBottom: '8px' }}>
                    {allChips.map((chip: string, idx: number) => (
                      <button
                        key={idx}
                        onClick={(e) => { e.stopPropagation(); handlePresetClick(chip); }}
                        style={{
                          background: 'rgba(139, 92, 246, 0.2)',
                          border: '1px solid rgba(139, 92, 246, 0.4)',
                          color: '#ddd6fe',
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>

                  {/* Custom Chip Input */}
                  <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      placeholder="Özel çip ekle..."
                      value={chipInputs[app.id] || ''}
                      onChange={e => setChipInputs({ ...chipInputs, [app.id]: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddCustomChip(app.id); }}
                      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', width: '100%' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddCustomChip(app.id)}
                      style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Ekle
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '12px', marginBottom: '8px' }}>
                  <strong style={{ color: '#10b981' }}>Avantajlar:</strong>
                  <ul style={{ margin: '4px 0 8px 16px', padding: 0, color: '#9ca3af' }}>
                    {app.pros?.map((p: string, i: number) => <li key={i}>{p}</li>)}
                  </ul>
                </div>

                <div style={{ fontSize: '12px', marginBottom: '8px' }}>
                  <strong style={{ color: '#ef4444' }}>Zorluk & Riskler:</strong>
                  <ul style={{ margin: '4px 0 8px 16px', padding: 0, color: '#9ca3af' }}>
                    {app.cons?.concat(app.risks || [])?.map((c: string, i: number) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Side-by-Side Comparative Table View */
        <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: '#ddd6fe' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(139, 92, 246, 0.3)' }}>
                <th style={{ padding: '12px', textAlign: 'left', width: '180px' }}>Metrik / Özellik</th>
                {approaches.map((app: any) => (
                  <th key={app.id} style={{ padding: '12px', textAlign: 'left', background: selectedId === app.id ? 'rgba(139, 92, 246, 0.2)' : 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input type="radio" checked={selectedId === app.id} onChange={() => setSelectedId(app.id)} style={{ accentColor: '#8b5cf6' }} />
                      <b>{app.title}</b>
                      {app.recommended && <span style={{ background: '#8b5cf6', color: '#fff', fontSize: '9px', padding: '1px 6px', borderRadius: '8px' }}>ÖNERİLEN</span>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '10px', color: '#a78bfa', fontWeight: 600 }}>Açıklama</td>
                {approaches.map((app: any) => <td key={app.id} style={{ padding: '10px', color: '#9ca3af', fontSize: '12px' }}>{app.description}</td>)}
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '10px', color: '#f59e0b', fontWeight: 600 }}>Geliştirme Eforu</td>
                {approaches.map((app: any) => <td key={app.id} style={{ padding: '10px' }}><MetricBar label="" value={app.metrics?.effortScore || 3} color="#f59e0b" /></td>)}
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '10px', color: '#3b82f6', fontWeight: 600 }}>Network / Ağ Yükü</td>
                {approaches.map((app: any) => <td key={app.id} style={{ padding: '10px' }}><MetricBar label="" value={app.metrics?.networkLoad || 2} color="#3b82f6" /></td>)}
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '10px', color: '#ef4444', fontWeight: 600 }}>Fizik / FPS Etkisi</td>
                {approaches.map((app: any) => <td key={app.id} style={{ padding: '10px' }}><MetricBar label="" value={app.metrics?.fpsImpact || 2} color="#ef4444" /></td>)}
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '10px', color: '#10b981', fontWeight: 600 }}>Bakım Kolaylığı</td>
                {approaches.map((app: any) => <td key={app.id} style={{ padding: '10px' }}><MetricBar label="" value={app.metrics?.maintainability || 4} color="#10b981" /></td>)}
              </tr>
              <tr>
                <td style={{ padding: '10px', color: '#10b981', fontWeight: 600 }}>Avantajlar</td>
                {approaches.map((app: any) => <td key={app.id} style={{ padding: '10px', fontSize: '11px', color: '#9ca3af' }}>{app.pros?.join(', ')}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleGenerateConcept}
          disabled={loading || !selectedId}
          style={{
            background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {loading ? 'Konsept & Simülasyon Çalışıyor...' : 'Seçilen Yaklaşımla Konsept Özeti Oluştur'} <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}

export function ConceptSummaryPanel({ project, onCommit }: any) {
  const summary = project.ideaLabSession?.conceptSummary;
  if (!summary) return null;

  const sim = summary.simulationResult;

  const handleConfirm = () => {
    const next = confirmConceptSummary(project);
    onCommit(next, 'Konsept özeti onaylandı. Canonical plan oluşturuldu!');
  };

  return (
    <section className="concept-summary-card" style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '20px', margin: '16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <CheckCircle2 size={24} color="#10b981" />
        <div>
          <span style={{ fontSize: '11px', letterSpacing: '1px', color: '#10b981', fontWeight: 600 }}>AŞAMA 3: KONSEPTİN NETLEŞMESİ</span>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#ecfdf5' }}>Konsept Özeti & A/B Simülasyonu</h2>
        </div>
      </div>

      <p style={{ fontSize: '14px', color: '#d1d5db', lineHeight: '1.5', marginBottom: '16px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
        {summary.summary}
      </p>

      {/* Simulation Predictions Card */}
      {sim && (
        <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '12px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#93c5fd' }}>
            <Activity size={18} />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>A/B Simülasyon Tahmin Raporu</span>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#e0f2fe' }}>
            <span>Tahmini Görev: <b>~{sim.taskEstimate} iş paketi</b></span>
            <span>Beklenen Risk: <b>{sim.riskCount} risk kaydı</b></span>
            <span>Plan Hazırlık: <b>%{sim.completenessScore}</b></span>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h4 style={{ color: '#10b981', margin: '0 0 6px 0', fontSize: '13px' }}>✓ Kesinleşen Özellikler</h4>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#9ca3af' }}>
            {summary.confirmedFeatures?.map((f: string, i: number) => <li key={i}>{f}</li>)}
          </ul>
        </div>

        <div>
          <h4 style={{ color: '#ef4444', margin: '0 0 6px 0', fontSize: '13px' }}>✕ Kapsam Dışı Bırakılanlar</h4>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#9ca3af' }}>
            {summary.outOfScope?.map((o: string, i: number) => <li key={i}>{o}</li>)}
          </ul>
        </div>

        <div>
          <h4 style={{ color: '#3b82f6', margin: '0 0 6px 0', fontSize: '13px' }}>⚙️ Teknik Yaklaşım</h4>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#9ca3af' }}>
            {summary.technicalApproaches?.map((t: string, i: number) => <li key={i}>{t}</li>)}
          </ul>
        </div>

        <div>
          <h4 style={{ color: '#f59e0b', margin: '0 0 6px 0', fontSize: '13px' }}>⚠️ Bilinen Riskler & Sorular</h4>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#9ca3af' }}>
            {summary.knownRisks?.concat(summary.openQuestions || [])?.map((r: string, i: number) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <span style={{ fontSize: '12px', color: '#9ca3af' }}>İlk Sürüm Hedefi: <b>{summary.mvpTarget}</b></span>
        <button
          onClick={handleConfirm}
          style={{
            background: '#10b981',
            color: '#fff',
            border: 'none',
            padding: '10px 22px',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Check size={18} /> Konsepti Onayla ve Planı Başlat
        </button>
      </div>
    </section>
  );
}

export function ImpactAnalysisPanel({ project, onCommit }: any) {
  const pendingImpacts = (project.impactAnalyses || []).filter((i: any) => i.status === 'proposed');
  if (!pendingImpacts.length) return null;

  return (
    <div style={{ margin: '16px 0' }}>
      {pendingImpacts.map((impact: any) => (
        <section key={impact.id} style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <ShieldAlert size={20} color="#f59e0b" />
            <h3 style={{ margin: 0, fontSize: '15px', color: '#fef3c7' }}>Yaşayan Plan Etki Analizi: "{impact.userRequest}"</h3>
          </div>
          <p style={{ fontSize: '13px', color: '#d1d5db', marginBottom: '12px' }}>{impact.summary}</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <strong style={{ color: '#f59e0b' }}>Değişen Bölümler:</strong>
              <p style={{ margin: '2px 0', color: '#9ca3af' }}>{impact.affectedSections?.join(', ')}</p>
            </div>
            <div>
              <strong style={{ color: '#3b82f6' }}>Mimari Etki:</strong>
              <p style={{ margin: '2px 0', color: '#9ca3af' }}>{impact.architectureImpact}</p>
            </div>
          </div>

          {impact.contradictions?.length > 0 && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', fontSize: '12px', color: '#fca5a5' }}>
              <strong>⚠️ Geçmiş Kararlarla Çelişki Tespiti:</strong>
              <ul style={{ margin: '4px 0 8px 16px', padding: 0 }}>
                {impact.contradictions.map((c: string, idx: number) => <li key={idx}>{c}</li>)}
              </ul>
              {/* Individual Supersede Action Buttons */}
              {impact.contradictionDetails?.map((detail: any) => (
                <div key={detail.decisionId} style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '6px' }}>
                  <span>Eski Karar: <b>"{detail.decisionTitle}"</b></span>
                  <button
                    onClick={() => {
                      const next = resolveImpactContradiction(project, impact.id, detail.decisionId, 'supersede');
                      onCommit(next, `Eski "${detail.decisionTitle}" kararı geçersiz kılındı (superseded) ve yeni sürüm r${next.revision} oluşturuldu.`);
                    }}
                    style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Önceki Kararı Geçersiz Kıl (Supersede)
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                const next = structuredClone(project);
                next.impactAnalyses = (next.impactAnalyses || []).filter((i: any) => i.id !== impact.id);
                onCommit(next, 'Etki analizi reddedildi ve kapatıldı.');
              }}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#9ca3af', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              Vazgeç / Kapat
            </button>
            <button
              onClick={() => {
                const next = applyImpactAnalysis(project, impact.id);
                onCommit(next, 'Etki analizi onaylandı ve yeni sürüm oluşturuldu.');
              }}
              style={{ background: '#f59e0b', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Check size={16} /> Etki Analizini Onayla (r{project.revision + 1})
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}

export function ExtensionModulesPanel({ project, onCommit }: any) {
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const rawIdea = String(project.identity?.originalIdea || '').toLowerCase();
  const isGame = /oyun|s&box|unity|godot|unreal|engine|at|mount|fizik|arcade|yaratık|entity/.test(rawIdea);
  const isWebSaaS = /web|saas|e-ticaret|site|dashboard|portal|react|next|api|backend|veritabanı/.test(rawIdea);
  const isMobile = /mobil|mobile|ios|android|flutter|react native|app/.test(rawIdea);
  const isAi = /yapay zeka|ai|agent|llm|prompt|model|gpt|bot/.test(rawIdea);

  const availableModules = isGame ? [
    { id: 'Mounted Combat & Actions', label: 'At/Binek Üzerinde Savaş & Aksiyon', desc: 'Sırtından silah kullanma, hızlanma ve hedef alma' },
    { id: 'Inventory & Transport', label: 'Eşya, Yük & Envanter Kapasitesi', desc: 'Çantalar, eyer ve yük taşıma limitleri' },
    { id: 'Creature Breeds & Stats', label: 'Yaratık Türleri & Stat Özelleştirme', desc: 'Farklı hız, stamina ve fiziki karakterler' },
    { id: 'Domestication & Bond', label: 'Evcilleştirme & Sadakat Seviyeleri', desc: 'Yabani yaratık bağ kurma ve komut dinleme' },
    { id: 'Herd AI & Ecology', label: 'Sürü Yapay Zekâsı & Ekoloji', desc: 'Birlikte otlayan ve kaçan otonom yaratık sürüleri' },
    { id: 'Racing & Leaderboard', label: 'Yarış & Zaman Karşı Liderlik Tablosu', desc: 'Parkurlar ve liderlik sıralaması' }
  ] : isWebSaaS ? [
    { id: 'Auth & Role Permissions', label: 'OAuth, JWT & Rol Yetkilendirme', desc: 'Çoklu kullanıcı yetkileri ve oturum yönetimi' },
    { id: 'Billing & Subscriptions', label: 'Ödeme Entegrasyonu & Abonelik', desc: 'Stripe/Iyzico ve faturalandırma sistemi' },
    { id: 'Analytics & Audit Logs', label: 'Kullanıcı Analitiği & İşlem Günlüğü', desc: 'Olay izleme ve admin denetim kaydı' },
    { id: 'Multi-Tenant Architecture', label: 'Multi-Tenant Organizasyon İzolasyonu', desc: 'Şirket/takım bazlı bağımsız veri alanları' },
    { id: 'API Rate Limiting & Gateway', label: 'API Hız Sınırlama & Gateway', desc: 'Aşırı istek engelleme ve güvenlik katmanı' },
    { id: 'Export & Webhook Engine', label: 'Veri Dışa Aktarma & Webhook Motoru', desc: 'JSON/CSV aktarımı ve otomatik webhooklar' }
  ] : isMobile ? [
    { id: 'Offline Sync Engine', label: 'Çevrimdışı Senkronizasyon Motoru', desc: 'Yerel veritabanı (SQLite) arka plan eşitlemesi' },
    { id: 'Push Notifications', label: 'Anlık Bildirimler & Kampanyalar', desc: 'FCM/APNS ile mobil bildirim akışı' },
    { id: 'Biometric Security', label: 'Biyometrik Giriş (FaceID / Parmak İzi)', desc: 'Güvenli yerel kimlik doğrulama' },
    { id: 'Dark Mode & Custom Themes', label: 'Karanlık Tema & Arayüz Özelleştirme', desc: 'Dinamik tema ve renk şemaları' },
    { id: 'Camera & QR Scanner', label: 'Kamera & QR Kodu Tarayıcı', desc: 'Cihaz donanım entegrasyonu' },
    { id: 'App Store In-App Purchases', label: 'Uygulama İçi Satın Alma (IAP)', desc: 'Apple & Google uygulama içi ödeme' }
  ] : isAi ? [
    { id: 'Vector Database RAG', label: 'Vektör Veritabanı & RAG Bağlam Hafızası', desc: 'Doküman arama ve uzun süreli AI hafızası' },
    { id: 'Multi-Provider Fallback', label: 'Çoklu LLM Sağlayıcı & Fallback', desc: 'OpenAI, Anthropic ve Ollama yedekli çalışma' },
    { id: 'Structured Output Validation', label: 'Yapılandırılmış JSON Şema Doğrulama', desc: 'Model yanıtlarının Zod/JSON-Schema denetimi' },
    { id: 'Prompt Redaction & Privacy', label: 'Hassas Veri Maskeleme (Privacy Redactor)', desc: 'Modele gönderilmeden önce kişisel veri redaksiyonu' },
    { id: 'Agentic Tool Calling', label: 'Otonom Ajan Araç Çağrısı (Tool Use)', desc: 'Ajanın kod çalıştırma ve API çağırma yeteneği' },
    { id: 'Token Budget Tracker', label: 'Token Bütçesi & Maliyet Takibi', desc: 'Model çağrı maliyeti ve hız sınırlayıcı' }
  ] : [
    { id: 'Modular Plugin System', label: 'Modüler Eklenti & Plugin Mimarisi', desc: 'Uygulama çekirdeğini bozmadan eklenti yazabilme' },
    { id: 'Audit & Event History', label: 'Detaylı Olay & Sürüm Geçmişi', desc: 'Tüm kullanıcı eylemlerinin geriye dönük izlenebilirliği' },
    { id: 'Export & Backup Package', label: 'Yedekleme & Dışa Aktarma Paketi', desc: 'Proje verisini ZIP / JSON olarak indirme' },
    { id: 'Role-Based Access Control', label: 'Gelişmiş Rol Bazlı Erişim Kontrolü', desc: 'Detaylı yetkilendirme matriksi' },
    { id: 'Local Encryption Layer', label: 'Yerel Veri Şifreleme Katmanı', desc: 'Disk üzerindeki verilerin AES-256 şifrelenmesi' },
    { id: 'Automated Health Monitoring', label: 'Otomatik Sistem Sağlık Kontrolü', desc: 'Performans ve hata takip izleyicisi' }
  ];

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleApply = () => {
    if (!selected.length) return;
    const next = applyExtensionModules(project, selected);
    onCommit(next, `${selected.length} isteğe bağlı modül plana eklendi.`);
    setSelected([]);
    setOpen(false);
  };

  return (
    <div style={{ margin: '16px 0', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px', background: 'rgba(0,0,0,0.15)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} color="#a78bfa" />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>İsteğe Bağlı Genişletme Paketleri</span>
        </div>
        <button
          onClick={() => setOpen(!open)}
          style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#d1d5db', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
        >
          {open ? 'Kapat' : '+ Paket Ekle'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '14px' }}>
            {availableModules.map(mod => {
              const isChecked = selected.includes(mod.id);
              return (
                <div
                  key={mod.id}
                  onClick={() => toggle(mod.id)}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: isChecked ? '1px solid #8b5cf6' : '1px solid rgba(255,255,255,0.05)',
                    background: isChecked ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#f3f4f6' }}>
                    <input type="checkbox" checked={isChecked} onChange={() => {}} style={{ accentColor: '#8b5cf6' }} />
                    {mod.label}
                  </div>
                  <p style={{ margin: '4px 0 0 20px', fontSize: '11px', color: '#9ca3af' }}>{mod.desc}</p>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              disabled={!selected.length}
              onClick={handleApply}
              style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              Seçilen Paketleri Plana Ekle (+{selected.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
