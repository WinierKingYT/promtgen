import { useEffect, useMemo, useState } from 'react';
import { Archive, ArrowRight, Check, ChevronDown, CircleAlert, Code2, Download, Eye, Gauge, GitBranch, History, Lightbulb, LoaderCircle, Menu, MessageCircle, RotateCcw, Save, Send, Settings2, Sparkles } from 'lucide-react';
import { applyApprovedChanges, finalizePlan, overridePlanningDepth, previewApprovedChanges, reopenPlan, restorePlanRevision, updatePlanSection, updateSuggestionStatus } from '../v4/planning-engine.js';
import { PHASE_REGISTRY } from '../v4/project-document.js';
import { createPromtgenPackage, downloadBlob, exportCanonicalMarkdown } from '../v4/exporter.js';
import { generateImpactAnalysis, runConversationalDiscoveryTurn } from '../v4/ai-discovery.js';
import { getProviderMeta } from '../v4/provider-settings.js';
import { applyCompiledTaskPlan, compileTaskPlan } from '../v4/task-compiler.js';
import { IconButton, ProjectRail, SuggestionCard } from './components/WorkspaceChrome';
import { ResearchPanel } from './components/ResearchPanel';
import { ReviewPanel } from './components/ReviewPanel';
import { ModulePanel } from './components/ModulePanel';
import { ExecutionPanel } from './components/ExecutionPanel';
import { IdeExportDialog } from './components/IdeExportDialog';
import { StorageHealthPanel } from './components/StorageHealthPanel';
import { RuntimeHealthDialog } from './components/RuntimeHealthDialog';
import { buildLocalPlanningMemory } from '../v4/planning-memory.js';
import { ConceptSummaryPanel, ExtensionModulesPanel, IdeaLabPanel } from './components/IdeaLabComponents';
import { ChangeImpactPanel } from './components/ChangeImpactPanel.js';
import { IdeaAmplifierPanel } from './components/IdeaAmplifierPanel';
import { ArchitectureDiagramCard } from './components/ArchitectureDiagramCard.js';
import { DecisionTimelineModal } from './components/DecisionTimelineModal.js';
import { ArchitectureComparatorModal } from './components/ArchitectureComparatorModal.js';
import { ProjectHealthRadarCard } from './components/ProjectHealthRadarCard.js';
import { ArchitectSmartTipsWidget } from './components/ArchitectSmartTipsWidget.js';
import { ProjectInventoryModal } from './components/ProjectInventoryModal.js';
import { AgentCommitteeModal } from './components/AgentCommitteeModal.js';
import { ProviderSettingsDialog } from './components/ProviderSettingsDialog.js';
import { RevisionHistoryDialog } from './components/RevisionHistoryDialog.js';
import { FinalizePlanDialog } from './components/FinalizePlanDialog.js';
import { GuidedHeaderBar } from './components/GuidedHeaderBar.js';
import { LiveAnnouncer } from './components/LiveAnnouncer.js';
import { IdeaDiscussionPanel } from './components/IdeaDiscussionPanel.js';
import type { ProjectDocumentV5 } from '../v4/contracts.js';
import type { ProviderSettings } from '../v4/provider-settings.js';
import type { CredentialVault } from '../v4/credential-vault.js';
import { prepareDiscoveryTurnProject } from '../v4/application/discovery-service.js';


type Project = ProjectDocumentV5;
const depths = [
  { id: 'quick', label: 'Quick', detail: 'Fikir → kapsam → görevler' },
  { id: 'standard', label: 'Standard', detail: 'Dengeli ürün ve teknik plan' },
  { id: 'advanced', label: 'Advanced', detail: 'Güvenlik ve dağıtım dahil' },
  { id: 'enterprise', label: 'Enterprise', detail: 'Tam operasyonel mimari' }
];

function PhaseGuide({ phase }: { phase: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const phaseOrder = ['IDEA_EXPANSION', 'DISCOVERY', 'IDEA_LAB', 'CONCEPT_CONFIRMATION', 'SHAPING', 'DESIGN', 'PLANNING', 'READY'];
  const stepIndex = Math.max(1, phaseOrder.indexOf(phase) + 1);
  const totalSteps = phaseOrder.length;

  const guideMap: Record<string, { step: string; action: string; next: string; bg: string; border: string }> = {
    IDEA_EXPANSION: {
      step: 'AŞAMA 1: FİKİR BÜYÜTÜCÜ',
      action: 'Kısa fikriniz algılandı. Seçeneklerle genişleterek daha büyük ve net bir fikre dönüştürebilirsiniz.',
      next: 'Her boyuttan bir seçenek seçin veya kendiniz yazın → "Bu Fikirle Planlamaya Geçelim" butonuna basın.',
      bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.4)'
    },
    DISCOVERY: {
      step: 'AŞAMA 1: FİKİR ANALİZİ TAMAMLANDI',
      action: '✅ Fikrin karmaşıklık skoru hesaplandı ve mimari seçenekler hazırlandı.',
      next: '💬 Aşağıdaki sohbet kutusundan direkt yazmaya başlayabilirsin — ya da Fikir Lab mimari kartlarını inceleyebilirsin (isteğe bağlı).',
      bg: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.3)'
    },
    IDEA_LAB: {
      step: 'AŞAMA 2: FİKİR LAB (İSTEĞE BAĞLI)',
      action: '3 mimari seçenek hazır. Birini seçip Konsept Özeti oluşturabilir ya da doğrudan aşağıdaki sohbetten devam edebilirsin.',
      next: 'Sohbet kutusuna yaz → Gönder. Veya bir mimari seç → "Konsept Özeti Oluştur" butonuna bas.',
      bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.4)'
    },
    CONCEPT_CONFIRMATION: {
      step: 'AŞAMA 3: KONSEPTİN NETLEŞMESİ (Onay Kapısı)',
      action: 'Seçtiğin mimariye dayalı Konsept Özeti ve A/B Simülasyon tahmini hazırlandı.',
      next: 'Özeti kontrol et ve "Konsepti Onayla ve Planı Başlat" butonuna basarak canonical planı üret.',
      bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.4)'
    },
    SHAPING: {
      step: 'AŞAMA 4: CANLI PLAN & KARAR TURLARI',
      action: 'AI tarafından sunulan seçenekleri inceleyip "Plana Ekle" veya "İstemiyorum" kararı veriyorsun.',
      next: 'Kararlarını verdikten sonra "Seçimleri Plana Uygula" butonuna basarak rN+1 revizyonu oluştur.',
      bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)'
    },
    DESIGN: {
      step: 'AŞAMA 5: MİMARİ & TEKNİK TASARIM',
      action: 'Projenin mimari, güvenlik ve veri senkronizasyon kararları netleştiriliyor.',
      next: 'Tasarım seçeneklerini kabul ettikçe sağ paneldeki Mimari ve Güvenlik bölümleri dolacak.',
      bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)'
    },
    PLANNING: {
      step: 'AŞAMA 6: GÖREV & TEST PLANI OLUŞTURMA',
      action: 'Gereksinimlerden uygulanabilir görev listesi ve kabul testleri türetiliyor.',
      next: 'Görevleri onaylayıp IDE butonundan Codex / Cursor ajan paketini indirebilirsin.',
      bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)'
    },
    READY: {
      step: 'AŞAMA 7-8: FİNALİZE EDİLMİŞ YAŞAYAN PLAN',
      action: 'Planın tamamlandı ve doğrulamalardan geçti. İstediğin zaman yeni istek girerek etki analizi yaptırabilirsin.',
      next: 'IDE butonundan çalışma paketini indir veya "Yeniden Aç" ile geliştirmeye devam et.',
      bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.4)'
    }
  };

  const current = guideMap[phase] || guideMap.SHAPING;

  if (collapsed) {
    return (
      <div style={{ background: current.bg, border: `1px solid ${current.border}`, borderRadius: '8px', padding: '6px 16px', margin: '14px 20px 0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af' }}>
        <span><b>{current.step}</b> ({stepIndex}/{totalSteps}) · {current.action.slice(0, 60)}…</span>
        <button type="button" onClick={() => setCollapsed(false)} style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          Rehberi Aç <ChevronDown size={14}/>
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: current.bg, border: `1px solid ${current.border}`, borderRadius: '10px', padding: '12px 18px', margin: '14px 20px 0 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px', color: '#fff' }}>
            {current.step} <span style={{ opacity: 0.7 }}>({stepIndex}/{totalSteps})</span>
          </div>
          <div style={{ fontSize: '13px', color: '#e5e7eb' }}>
            <b>Şu an ne yapıyorsun? </b> {current.action}
          </div>
        </div>
        <button type="button" onClick={() => setCollapsed(true)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '2px 6px', fontSize: '11px', borderRadius: '4px' }} title="Rehberi Daralt">
          ✕
        </button>
      </div>

      {/* Progress Bar & Next Step */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '11px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '240px' }}>
          <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${(stepIndex / totalSteps) * 100}%`, height: '100%', background: '#a78bfa', transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: '10px', color: '#9ca3af' }}>{Math.round((stepIndex / totalSteps) * 100)}%</span>
        </div>
        <div style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'right' }}>
          <strong style={{ color: '#a78bfa' }}>👉 Sonraki Adım: </strong> {current.next}
        </div>
      </div>
    </div>
  );
}

interface WorkspaceProps {
  project: Project;
  projects: Project[];
  onProject: (id: string) => void;
  onNew: () => void;
  onPersist: (project: Project, commandType?: string) => Promise<boolean>;
  providerSettings: ProviderSettings;
  onProviderSettings: (settings: ProviderSettings) => void;
  credentialVault: CredentialVault;
}

export function Workspace({ project, projects, onProject, onNew, onPersist, providerSettings, onProviderSettings, credentialVault }: WorkspaceProps) {
  const nativeInventory = (project.profile.projectInventory || null) as { totals?: { included?: number } } | null;
  const [railOpen, setRailOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('vision');
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [comparatorOpen, setComparatorOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [committeeOpen, setCommitteeOpen] = useState(false);
  const [ideExportOpen, setIdeExportOpen] = useState(false);
  const [runtimeHealthOpen, setRuntimeHealthOpen] = useState(false);
  const [runtimeCredential, setRuntimeCredential] = useState('');
  const [finalizationBlockers, setFinalizationBlockers] = useState<string[]>([]);
  const [taskCompilation, setTaskCompilation] = useState<any>(null);
  const [direction, setDirection] = useState('');
  const [focusedQuestion, setFocusedQuestion] = useState('');
  const [generating, setGenerating] = useState(false);
  const [changeImpactMode, setChangeImpactMode] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState(false);

  const [confirmingClearChat, setConfirmingClearChat] = useState(false);

  const clearChatHistory = () => {
    const next = structuredClone(project);
    next.messages = [{ id: `msg-${Date.now()}`, role: 'assistant', content: 'Sohbet geçmişi temizlendi. Yeni sorularınızla devam edebilirsiniz.', createdAt: new Date().toISOString() }];
    commit(next, 'Sohbet geçmişi temizlendi.');
    setConfirmingClearChat(false);
  };
  const currentBundle = [...project.proposalStore.bundles].reverse().find((bundle: any) => bundle.status === 'open') || project.proposalStore.bundles.at(-1);
  const changePreview = useMemo(() => currentBundle ? previewApprovedChanges(project, currentBundle.id) : null, [project, currentBundle?.id]);
  const impactedSections = useMemo(() => new Set((changePreview?.sections || []).map((section: any) => section.sectionId)), [changePreview]);
  const active = project.sections[activeSection];
  useEffect(() => setDraft(active?.content || ''), [activeSection, project.id, active?.content]);
  const commit = async (next: Project, message?: string, commandType = 'UpdateProject') => {
    const persisted = await onPersist(next, commandType);
    if (!persisted) return;
    if (message) { setNotice(message); window.setTimeout(() => setNotice(''), 2800); }
  };
  const status = (suggestionId: string, nextStatus: string, edited = '') => {
    if (!currentBundle) return;
    commit(updateSuggestionStatus(project, currentBundle.id, suggestionId, nextStatus, edited), undefined, 'UpdateSuggestionStatus');
  };
  const apply = () => {
    if (!currentBundle) return;
    const target = structuredClone(project);
    const bundle = target.proposalStore.bundles.find((b: any) => b.id === currentBundle.id);
    if (bundle) {
      for (const item of bundle.items) {
        if (item.status === 'pending') item.status = 'deferred';
      }
    }
    const next = applyApprovedChanges(target, currentBundle.id);
    commit(next, 'Kabul edilen değişiklikler plana işlendi.', 'ApplyApprovedChanges');
  };
  const addBundle = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const message = direction.trim();
    if (generating || !message) return;
    setGenerating(true);
    try {
      if (changeImpactMode) {
        const result = await generateImpactAnalysis(project, message, { pendingCommit: true });
        setDirection('');
        setFocusedQuestion('');
        setChangeImpactMode(false);
        commit(result.project, 'Değişiklik etkileri hesaplandı; canonical plan henüz değiştirilmedi.', 'ProposeChangeImpact');
        return;
      }
      const credential = await credentialVault.get(providerSettings.providerId) || '';
      const memory = providerSettings.useLocalMemory ? buildLocalPlanningMemory(projects, project.id) : null;
      const target = prepareDiscoveryTurnProject(project, currentBundle?.id);
      const result = await runConversationalDiscoveryTurn(target, { settings: providerSettings, credential, message, focusedQuestion, memory } as any);
      setDirection('');
      setFocusedQuestion('');
      commit(result.project, result.usedFallback && result.error ? `AI yanıtladı (yerel motor): ${result.error}` : `${getProviderMeta(providerSettings.providerId).label} mesajını yanıtladı ve yeni kararları hazırladı.`, 'AddDiscoveryTurn');
    } finally { setGenerating(false); }
  };
  const saveSection = () => {
    if (!active) return;
    commit(updatePlanSection(project, activeSection, { content: draft }), `${active.title} kaydedildi.`, 'UpdatePlanSection');
  };
  const exportPackage = async () => {
    const result = await createPromtgenPackage(project);
    downloadBlob(result.blob, result.filename);
    const next = structuredClone(project);
    next.exports = [...(next.exports || []), result.record];
    next.lifecycle.updatedAt = new Date().toISOString();
    commit(next, `r${result.record.revision} export kaydı korundu.`, 'RecordExport');
  };
  const exportMarkdown = () => downloadBlob(new Blob([exportCanonicalMarkdown(project)], { type: 'text/markdown' }), `${project.identity.name}.md`);
  const finish = () => {
    const result = finalizePlan(project, false);
    if (result.success) commit(result.project, 'Plan finalleştirildi.', 'FinalizePlan');
    else setFinalizationBlockers(result.blockers);
  };
  const forceFinish = () => {
    const result = finalizePlan(project, true);
    if (result.success) commit(result.project, 'Plan uyarılarla finalleştirildi.', 'FinalizePlan');
    else setNotice(result.blockers?.join(' · ') || 'Plan finalleştirilemedi.');
  };
  const openRuntimeHealth = async () => {
    setRuntimeCredential(await credentialVault.get(providerSettings.providerId) || '');
    setRuntimeHealthOpen(true);
  };
  const restoreRevision = (reference: string) => { const result = restorePlanRevision(project, reference); if (result.success) commit(result.project, `r${result.restoredFromRevision} planı yeni revision olarak geri yüklendi.`, 'RestoreRevision'); else setNotice(result.reason); };
  const approveTaskPlan = () => {
    const result = applyCompiledTaskPlan(project, taskCompilation, { approved: true });
    if (!result.success) { setNotice(result.reason); setTaskCompilation(null); return; }
    commit(result.project, `${result.project.tasks.length} görev ve ajan zinciri plana uygulandı.`, 'ApplyTaskPlan');
    setTaskCompilation(null);
  };
  const bundleResolved = currentBundle?.status === 'resolved';
  const accepted = bundleResolved ? 0 : currentBundle?.items.filter((x: any) => ['accepted', 'edited'].includes(x.status)).length || 0;
  const pendingCount = bundleResolved ? 0 : currentBundle?.items.filter((x: any) => x.status === 'pending').length || 0;
  const decisionComplete = !bundleResolved && pendingCount === 0;
  const bundleSource = currentBundle?.source?.type === 'ai' ? getProviderMeta(currentBundle.source.providerId).label : 'Yerel motor';
  const openQuestions = [...new Set((project.openQuestions || []).filter(Boolean))] as string[];
  const hasCanonicalPlan = project.requirements.length > 0 || project.decisions.length > 0 || project.tasks.length > 0;

  return <div className="app-shell">
    <a className="skip-link" href="#workspace-content">Ana içeriğe geç</a>
    <ProjectRail projects={projects} activeId={project.id} onSelect={onProject} onNew={onNew} open={railOpen} onClose={() => setRailOpen(false)}/>
    <main id="workspace-content" className="workspace" tabIndex={-1}>
      <header className="topbar"><IconButton label="Projeleri aç" onClick={() => setRailOpen(true)}><Menu size={20}/></IconButton><div className="title-block"><span>{project.identity.name}</span><small><span className="live-dot"/> r{project.revision} · {project.lifecycle.status === 'finalized' ? 'Final plan' : 'Canlı plan'}</small></div><div className="phase-strip">{PHASE_REGISTRY.map((phase: any) => <span key={phase.id} className={phase.id === project.lifecycle.activePhase ? 'active' : ''}>{phase.label}</span>)}</div><div className="top-actions"><button onClick={openRuntimeHealth}><Gauge size={16}/> Sistem</button><button onClick={() => setSettingsOpen(true)}><Settings2 size={16}/> {getProviderMeta(providerSettings.providerId).label}</button><button onClick={() => setIdeExportOpen(true)}><Code2 size={16}/> IDE</button><button onClick={exportMarkdown}><Download size={16}/> Markdown</button><button onClick={exportPackage}><Archive size={16}/> Paket</button>{project.lifecycle.status === 'finalized' ? <button className="primary compact" onClick={() => commit(reopenPlan(project), 'Yeni bir plan sürümü açıldı.', 'ReopenPlan')}><RotateCcw size={15}/> Yeniden aç</button> : <button className="primary compact" onClick={finish}><Check size={15}/> Finalleştir</button>}</div></header>
      <GuidedHeaderBar
        projectName={project.identity.name}
        activePhase={project.lifecycle.activePhase}
        revision={project.revision}
        onOpenAdvancedTools={openRuntimeHealth}
        onOpenExpertPerspectives={() => setCommitteeOpen(true)}
        onOpenArchitectureComparator={() => setComparatorOpen(true)}
        onOpenExporter={() => setIdeExportOpen(true)}
      />
      <PhaseGuide phase={project.lifecycle.activePhase} />
      <div className="workspace-grid">
        <section className="conversation" aria-label="Planlama sohbeti">
          <div className="idea-summary"><div className="ai-avatar"><Sparkles size={18}/></div><div><div className="meta">FİKİR ANALİZİ</div><p>{project.identity.originalIdea}</p></div></div>
          <div className="depth-panel"><div><span className="meta">ÖNERİLEN PLAN DERİNLİĞİ</span><h2>{project.planningDepth.recommended.toUpperCase()} <span>{project.planningDepth.signals.score}/100 karmaşıklık</span></h2><p>{project.planningDepth.rationale}</p></div><label>Derinliği değiştir<select value={project.planningDepth.selected} onChange={event => commit(overridePlanningDepth(project, event.target.value as Project['planningDepth']['selected']))}>{depths.map(depth => <option key={depth.id} value={depth.id}>{depth.label} — {depth.detail}</option>)}</select></label></div>
          {project.lifecycle.activePhase === 'IDEA_EXPANSION' && <IdeaAmplifierPanel project={project} onCommit={commit} />}
          {project.lifecycle.activePhase === 'IDEA_LAB' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-8px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const next = structuredClone(project);
                    next.lifecycle.activePhase = 'SHAPING';
                    commit(next, 'Fikir Lab atlandı, doğrudan Planlama aşamasına geçildi.');
                  }}
                  style={{ fontSize: '11px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#9ca3af', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Fikir Lab'ı Atla →
                </button>
              </div>
              <IdeaLabPanel project={project} onCommit={commit} providerSettings={providerSettings} />
            </>
          )}

          {['CONCEPT_CONFIRMATION', 'IDEA_LAB'].includes(project.lifecycle.activePhase) && project.ideaLabSession?.conceptSummary && <ConceptSummaryPanel project={project} onCommit={commit} />}
          {project.impactAnalyses?.some(impact => impact.status === 'proposed') && <ChangeImpactPanel project={project} onCommit={commit} />}
          {['DISCOVERY', 'IDEA_LAB', 'CONCEPT_CONFIRMATION'].includes(project.lifecycle.activePhase) && <IdeaDiscussionPanel project={project} onCommit={commit} />}
          <section className="discovery-chat" aria-labelledby="discovery-chat-title">
            {/* Live Conversation Summary Bar */}
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#d1d5db' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span>💬 <b>{project.messages.length}</b> Diyalog Mesajı</span>
                <span>🎯 <b>{project.decisions?.length || 0}</b> Kesinleşen Karar</span>
                <span>⚡ Revizyon: <b>r{project.revision}</b></span>
              </div>
              <span style={{ color: '#a78bfa', fontWeight: 600 }}>{project.lifecycle.activePhase} AŞAMASI</span>
            </div>

            <div className="chat-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="meta">ETKİLEŞİMLİ KEŞİF & SOHBET</span>
                <h2 id="discovery-chat-title"><MessageCircle size={18}/> Projeyi konuşarak şekillendir</h2>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setCommitteeOpen(true)} style={{ background: 'rgba(139, 92, 246, 0.2)', border: '1px solid rgba(139, 92, 246, 0.4)', color: '#a78bfa', fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}>
                  👥 Uzman Perspektifleri (Deneysel Kural)
                </button>
                {nativeInventory && (
                  <button type="button" onClick={() => setInventoryOpen(true)} style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#bfdbfe', fontSize: '11px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}>
                    📂 Envanter ({nativeInventory.totals?.included || 0})
                  </button>
                )}
                {project.messages.length > 5 && (
                  <button type="button" onClick={() => setExpandedHistory(!expandedHistory)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#ddd6fe', fontSize: '11px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}>
                    {expandedHistory ? 'Kısalt (-5 Mesaj)' : `Tüm Geçmişi Göster (${project.messages.length})`}
                  </button>
                )}
                {confirmingClearChat ? (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button type="button" onClick={clearChatHistory} style={{ background: '#ef4444', color: '#fff', border: 'none', fontSize: '11px', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                      Evet, Sil
                    </button>
                    <button type="button" onClick={() => setConfirmingClearChat(false)} style={{ background: 'rgba(255,255,255,0.1)', color: '#aaa', border: 'none', fontSize: '11px', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer' }}>
                      Vazgeç
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmingClearChat(true)} style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '11px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}>
                    Temizle
                  </button>
                )}
              </div>
            </div>

            <ArchitectSmartTipsWidget project={project} />

            <div className="message-log" role="log" aria-live="polite" aria-label="Keşif konuşması" style={{ maxHeight: expandedHistory ? '500px' : '260px', overflowY: 'auto' }}>
              {(expandedHistory ? project.messages : project.messages.slice(-6)).map((message: any) => (
                <div key={message.id} className={`chat-message ${message.role}`} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '12px', color: message.role === 'user' ? '#a78bfa' : '#10b981' }}>
                      {message.role === 'user' ? '👤 Sen' : '🤖 PromtGen Kıdemli Mimarı'}
                    </span>
                    {message.createdAt && <small style={{ fontSize: '10px', color: '#6b7280' }}>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>}
                  </div>
                  <p style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '13px', lineHeight: '1.5' }}>{message.content}</p>

                  {/* Collapsible Architect's Reasoning Note */}
                  {message.analysisNote && (
                    <details style={{ marginTop: '6px', background: 'rgba(139, 92, 246, 0.12)', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', color: '#ddd6fe' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#a78bfa' }}>🧠 Mimarın Mimari Notu (Trade-off & Riskler)</summary>
                      <p style={{ margin: '4px 0 0 0', color: '#e0e7ff', lineHeight: '1.4' }}>{message.analysisNote}</p>
                    </details>
                  )}
                </div>
              ))}
            </div>

            {openQuestions.length > 0 && (
              <div className="open-question-list" style={{ marginTop: '12px', background: 'rgba(139, 92, 246, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', display: 'block', marginBottom: '6px' }}>💬 AI Mimarın Sorduğu Derinleştirici Sorular (Yanıtlamak için tıkla):</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {openQuestions.slice(0, 3).map((question, idx) => (
                    <button type="button" className={focusedQuestion === question ? 'active' : ''} key={question} onClick={() => { setFocusedQuestion(question); setDirection(''); }} style={{ textAlign: 'left', background: focusedQuestion === question ? '#8b5cf6' : 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>
                      {idx + 1}. {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form className="discovery-composer" onSubmit={addBundle} style={{ marginTop: '12px' }}>
              {hasCanonicalPlan && (
                <div className="composer-mode-switch" role="group" aria-label="Mesaj işleme modu">
                  <button type="button" className={!changeImpactMode ? 'active' : ''} aria-pressed={!changeImpactMode} onClick={() => setChangeImpactMode(false)}>
                    Fikri tartış
                  </button>
                  <button type="button" className={changeImpactMode ? 'active impact' : ''} aria-pressed={changeImpactMode} onClick={() => setChangeImpactMode(true)}>
                    <GitBranch size={14} /> Plan değişikliğini analiz et
                  </button>
                  {changeImpactMode && <small>Mesajın önce diff ve etki önizlemesine dönüşür; onayın olmadan plana uygulanmaz.</small>}
                </div>
              )}
              <label htmlFor="discovery-direction"><Sparkles size={16}/><span><b>{focusedQuestion || 'Soru sor, fikir ekle veya mimari kısıt belirt:'}</b><small>{focusedQuestion ? 'Seçilen soruya yanıtını yazıyorsun.' : 'Örn. Atların dayanıklılık statı olsun mu? Multiplayer senkronizasyon nasıl olmalı?'}</small></span></label>
              <div className="composer-row"><textarea id="discovery-direction" rows={2} value={direction} onChange={event => setDirection(event.target.value)} placeholder={focusedQuestion ? 'Bu soruya yanıtını yaz…' : 'Mesajını yaz…'}/><button className="primary" type="submit" disabled={!direction.trim() || generating}>{generating ? <LoaderCircle className="spin" size={17}/> : <Send size={17}/>}<span>{generating ? 'Yanıtla' : 'Gönder'}</span></button></div>

              {/* Quick Direction Template Chips (Dynamically Generated) */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                <span style={{ fontSize: '10px', color: '#9ca3af', width: '100%' }}>Hızlı Şablon Butonları (Tıklayıp gönderin):</span>
                {(() => {
                  const raw = (project.identity?.originalIdea || '').toLowerCase();
                  const isGame = /oyun|s&box|unity|godot|unreal|engine|at|mount|fizik|arcade|yaratık|entity/.test(raw);
                  const isWeb = /web|saas|e-ticaret|site|dashboard|portal|react|next|api|backend/.test(raw);
                  const isMobile = /mobil|mobile|ios|android|flutter|react native|app/.test(raw);
                  const isAi = /yapay zeka|ai|agent|llm|prompt|model|gpt|bot/.test(raw);

                  const chips = isGame ? [
                    '⚡ MVP Kapsamını Daralt',
                    '🌐 Sunucu Yetkili (Server-Auth) Ağ Senkronizasyonu',
                    '🎮 Fizik & Animasyon Akışını Sadeleştir',
                    '🛠️ Modüler Eklenti Mimarisi Tanımla'
                  ] : isWeb ? [
                    '⚡ MVP Kapsamını Daralt',
                    '🔒 Auth & Rol Yetki Sınırlarını Önceliklendir',
                    '🌐 API-First Katmanlı Veri Modelini Kur',
                    '📊 Dashboard & Analitik Akışını Ekle'
                  ] : isMobile ? [
                    '⚡ MVP Kapsamını Daralt',
                    '📱 Local-First & SQLite Çevrimdışı Depo',
                    '🔔 Push Bildirim & FCM Entegrasyonu',
                    '🔒 Biyometrik Cihaz Güvenliği'
                  ] : isAi ? [
                    '⚡ MVP Kapsamını Daralt',
                    '🧠 Vektör Veritabanı & RAG Bağlam Hafızası',
                    '🔒 Hassas Veri Maskeleme & Gizlilik',
                    '🤖 Çoklu LLM Fallback Sağlayıcısı'
                  ] : [
                    '⚡ MVP Kapsamını Daralt',
                    '🔒 Hassas Veriyi Yerelde Tut',
                    '🌐 Modüler Mimari Katmanlarını Kur',
                    '📋 Kullanıcı Kabul Testlerini Belirle'
                  ];

                  return chips.map(chip => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => { setDirection(chip); }}
                      style={{ background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#ddd6fe', fontSize: '11px', padding: '3px 8px', borderRadius: '12px', cursor: 'pointer' }}
                    >
                      + {chip}
                    </button>
                  ));
                })()}
              </div>
            </form>
          </section>
          <div className="conversation-heading"><div><span className="meta">KARAR TURU · {bundleSource.toUpperCase()}</span><h2>{currentBundle?.title || 'Planı geliştir'}</h2><p>Yalnızca kabul ettiğin değişiklikler yaşayan plana uygulanır.</p></div><Lightbulb size={23}/></div>
          <div className="suggestions">{currentBundle?.items.map((item: any) => <SuggestionCard key={item.id} item={item} provenance={currentBundle.provenance} onSection={setActiveSection} onStatus={(nextStatus: string, edited = '') => status(item.id, nextStatus, edited)}/>)}</div>
          {!bundleResolved && changePreview && changePreview.acceptedCount > 0 && <section className="change-preview" aria-labelledby="change-preview-title" aria-live="polite">
            <div className="preview-head"><div className="preview-icon"><Eye size={17}/></div><div><span className="meta">UYGULAMA ÖNCESİ ÖNİZLEME</span><h3 id="change-preview-title">r{project.revision} → r{changePreview.nextRevision}</h3></div><div className="preview-count"><b>{changePreview.acceptedCount}</b><span>kabul</span></div></div>
            <p>{changePreview.canApply ? 'Uyguladığında aşağıdaki canonical plan bölümleri güncellenecek.' : changePreview.reason}</p>
            <div className="preview-sections">{changePreview.sections.map((section: any) => <button type="button" key={section.sectionId} onClick={() => setActiveSection(section.sectionId)}><span><b>{section.title}</b><small>{section.additions.length} yeni öğe{section.unchanged.length ? ` · ${section.unchanged.length} zaten mevcut` : ''}</small></span><ArrowRight size={15}/></button>)}</div>
            {(changePreview.records.decisions > 0 || changePreview.records.risks > 0) && <div className="preview-records">{changePreview.records.decisions > 0 && <span>+{changePreview.records.decisions} karar kaydı</span>}{changePreview.records.risks > 0 && <span>+{changePreview.records.risks} risk kaydı</span>}</div>}
          </section>}
          <div className="bundle-actions"><span>{bundleResolved ? 'Bu karar turu plana işlendi; yukarıdan konuşmaya devam edebilirsin.' : pendingCount ? `${pendingCount} seçenek karar bekliyor · ${accepted} kabul` : `${accepted} seçenek plana uygulanacak`}</span><button disabled={!decisionComplete} className="primary" onClick={apply}>{accepted ? 'Seçimleri plana uygula' : 'Turu tamamla'} <ArrowRight size={17}/></button></div>
        </section>
        <aside className="plan-panel" aria-label="Yaşayan plan">
          <div className="readiness"><div className="score-ring" style={{ '--score': `${project.readiness.score * 3.6}deg` } as any}><span>{project.readiness.score}</span></div><div><span className="meta">HAZIRLIK SKORU</span><b>{project.readiness.score >= 80 ? 'Uygulamaya yakın' : project.readiness.score >= 50 ? 'Gelişiyor' : 'Şekilleniyor'}</b><small>{project.readiness.blockers.length} eksik · {project.readiness.warnings.length} uyarı</small></div><Gauge size={19}/></div>

          <ProjectHealthRadarCard project={project} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
            <button
              type="button"
              onClick={() => setComparatorOpen(true)}
              style={{ background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#ddd6fe', fontSize: '11px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              ⚖️ Mimari Karşılaştırma Şablonu →
            </button>
          </div>

          <div className="section-tabs">{Object.values(project.sections).filter((section: any) => section.required || section.content || section.items.length || impactedSections.has(section.id)).map((section: any) => <button key={section.id} aria-current={activeSection === section.id ? 'true' : undefined} className={`${activeSection === section.id ? 'active' : ''} ${impactedSections.has(section.id) ? 'impacted' : ''}`} onClick={() => setActiveSection(section.id)}><span className={`section-state ${section.status}`}/><span>{section.title}<small>{impactedSections.has(section.id) ? 'Uygulanınca değişecek' : section.items.length ? `${section.items.length} karar/öğe` : section.required ? 'Gerekli' : 'İsteğe bağlı'}</small></span></button>)}</div>
          {active && <div className="section-editor"><div className="editor-head"><div><span className="meta">PLAN BÖLÜMÜ</span><h2>{active.title}</h2></div><span>r{active.updatedAtRevision}</span></div><p className="section-description">{active.description}</p><textarea aria-label={`${active.title} canonical içeriği`} value={draft} onChange={event => setDraft(event.target.value)} rows={8} placeholder="Bu bölümün canonical içeriğini yaz..."/>{active.items.length > 0 && <ul>{active.items.map((item: string) => <li key={item}>{item}</li>)}</ul>}<button type="button" className="save-button" disabled={draft === active.content} onClick={saveSection}><Save size={16}/> Bölümü kaydet</button>{activeSection === 'tasks' && <div className="task-compiler"><button type="button" onClick={() => setTaskCompilation(compileTaskPlan(project))}><Sparkles size={15}/> Gereksinimlerden görev taslağı üret</button>{taskCompilation && <div className="task-compilation" role="region" aria-label="Görev planı önizlemesi"><b>{taskCompilation.tasks.length} görev · {taskCompilation.testCases.length} test · {taskCompilation.agentPrompts.length} ajan adımı</b>{taskCompilation.tasks.slice(0, 5).map((task: any) => <span key={task.id}>{task.title}<small>{task.priority} · {task.status}</small></span>)}{taskCompilation.warnings.map((warning: string) => <p key={warning}><CircleAlert size={13}/>{warning}</p>)}<div><button type="button" onClick={() => setTaskCompilation(null)}>Vazgeç</button><button type="button" className="primary" disabled={!taskCompilation.tasks.length} onClick={approveTaskPlan}><Check size={14}/> Taslağı onayla</button></div></div>}</div>}</div>}
          {['SHAPING', 'DESIGN', 'PLANNING', 'REVIEW', 'READY'].includes(project.lifecycle.activePhase) && <ArchitectureDiagramCard project={project} />}
          <details style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '8px 12px', marginTop: '12px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '12px', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🛠️ Gelişmiş Araçlar & Analizler (Modüller, Testler, Ajanlar)
            </summary>
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <ExtensionModulesPanel project={project} onCommit={commit}/>
              <ReviewPanel project={project} onCommit={commit}/>
              <ModulePanel project={project} onCommit={commit}/>
              <ExecutionPanel project={project} onCommit={commit}/>
              <StorageHealthPanel project={project} onCommit={commit}/>
              <ResearchPanel project={project} onCommit={commit}/>
            </div>
          </details>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
            <button className="history-line" onClick={() => setHistoryOpen(true)}><History size={15}/><span>{project.revisions.length} kayıtlı değişiklik · r{project.revision}</span><ArrowRight size={14}/></button>
            <button type="button" onClick={() => setTimelineOpen(true)} style={{ background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#ddd6fe', padding: '0 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }} title="Etkileşimli Karar Zaman Çizelgesi">
              📅 Çizelge
            </button>
          </div>
        </aside>
      </div>
    </main>
    <ProviderSettingsDialog open={settingsOpen} settings={providerSettings} onSave={onProviderSettings} onClose={() => setSettingsOpen(false)} credentialVault={credentialVault}/>
    <RevisionHistoryDialog open={historyOpen} project={project} onRestore={restoreRevision} onClose={() => setHistoryOpen(false)}/>
    <DecisionTimelineModal open={timelineOpen} project={project} onClose={() => setTimelineOpen(false)}/>
    <ArchitectureComparatorModal open={comparatorOpen} project={project} onClose={() => setComparatorOpen(false)}/>
    <ProjectInventoryModal open={inventoryOpen} nativeInventory={nativeInventory} onClose={() => setInventoryOpen(false)}/>
    <AgentCommitteeModal open={committeeOpen} project={project} onCommit={commit} onClose={() => setCommitteeOpen(false)}/>
    <IdeExportDialog open={ideExportOpen} project={project} onCommit={commit} onClose={() => setIdeExportOpen(false)}/>
    <RuntimeHealthDialog open={runtimeHealthOpen} settings={providerSettings} credential={runtimeCredential} onClose={() => setRuntimeHealthOpen(false)}/>
    <FinalizePlanDialog blockers={finalizationBlockers} onConfirm={forceFinish} onClose={() => setFinalizationBlockers([])}/>
    <LiveAnnouncer message={notice} />
    {notice && <div className="toast" role="status"><Check size={17}/>{notice}</div>}
  </div>;
}
