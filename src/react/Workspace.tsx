import { lazy, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Download,
  LoaderCircle,
  MoreHorizontal,
  Save,
  Send,
  Sparkles
} from 'lucide-react';
import {
  applyApprovedChanges,
  finalizePlan,
  overridePlanningDepth,
  previewApprovedChanges,
  reopenPlan,
  restorePlanRevision,
  updatePlanSection,
  updateSuggestionStatus
} from '../v4/planning-engine.js';
import {
  generateDiscoveryAnswerExtraction,
  generateImpactAnalysis,
  runConversationalDiscoveryTurn
} from '../v4/application/idea-planning-api.js';
import { getProviderMeta } from '../v4/provider-settings.js';
import { applyCompiledTaskPlan, compileTaskPlan } from '../v4/task-compiler.js';
import { buildLocalPlanningMemory } from '../v4/planning-memory.js';
import { LiveAnnouncer } from './components/LiveAnnouncer.js';
import { LazyFeatureBoundary } from './components/LazyFeatureBoundary.js';
import { IdeaGuidePanel } from './components/IdeaOutcomeBar.js';
import type { ProjectDocumentV5, SuggestionStatus } from '../v4/contracts.js';
import type { ProviderSettings } from '../v4/provider-settings.js';
import type { CredentialVault } from '../v4/credential-vault.js';
import type { TaskCompilationResult } from '../v4/task-compiler.js';
import { prepareDiscoveryTurnProject } from '../v4/application/discovery-service.js';
import {
  applyDiscoveryAnswerDraft,
  compareDiscoveryAnswerWithAI,
  createDiscoveryAnswerDraft,
  type DiscoveryAnswerDraft
} from '../v4/application/discovery-answer-service.js';
import {
  applyIdeaPlanConversion,
  type IdeaPlanConversionPreview
} from '../v4/application/idea-plan-conversion-service.js';
import { DiscoveryAnswerReview } from './components/DiscoveryAnswerReview.js';
import { PlanAlignmentNotice } from './components/PlanAlignmentNotice.js';
import { TaskContractSummary } from './components/TaskContractSummary.js';
import {
  ExplorationDeck,
  IdeaDecisionCards,
  IdeaSnapshot,
  IdeaStudioHeader,
  IdeaStudioSidebar,
  QuestionChips,
  type IdeaStudioView
} from './features/idea-studio/IdeaStudioPrimitives.js';

type Project = ProjectDocumentV5;

const ProviderSettingsDialog = lazy(() => import('./components/ProviderSettingsDialog.js').then(module => ({ default: module.ProviderSettingsDialog })));
const RevisionHistoryDialog = lazy(() => import('./components/RevisionHistoryDialog.js').then(module => ({ default: module.RevisionHistoryDialog })));
const FinalizePlanDialog = lazy(() => import('./components/FinalizePlanDialog.js').then(module => ({ default: module.FinalizePlanDialog })));
const StorageHealthPanel = lazy(() => import('./components/StorageHealthPanel.js').then(module => ({ default: module.StorageHealthPanel })));
const TraceabilityMap = lazy(() => import('./components/TraceabilityMap.js').then(module => ({ default: module.TraceabilityMap })));
const PlanningScenarioPanel = lazy(() => import('./components/PlanningScenarioPanel.js').then(module => ({ default: module.PlanningScenarioPanel })));
const SectionRegenerationPanel = lazy(() => import('./components/SectionRegenerationPanel.js').then(module => ({ default: module.SectionRegenerationPanel })));
const PlanCodeAlignmentPanel = lazy(() => import('./components/PlanCodeAlignmentPanel.js').then(module => ({ default: module.PlanCodeAlignmentPanel })));

const depths = [
  { id: 'quick', label: 'Quick', detail: 'Fikir, kapsam ve görevler' },
  { id: 'standard', label: 'Standard', detail: 'Ürün ve teknik plan' },
  { id: 'advanced', label: 'Advanced', detail: 'Güvenlik ve dağıtım dahil' },
  { id: 'enterprise', label: 'Enterprise', detail: 'Operasyonel mimari dahil' }
] as const;

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState<IdeaStudioView>('develop');
  const [activeSection, setActiveSection] = useState('vision');
  const [sectionDraft, setSectionDraft] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const [focusedQuestion, setFocusedQuestion] = useState('');
  const [generating, setGenerating] = useState(false);
  const [compareAnswerWithAi, setCompareAnswerWithAi] = useState(false);
  const [changeImpactMode, setChangeImpactMode] = useState(false);
  const [notice, setNotice] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [finalizationBlockers, setFinalizationBlockers] = useState<string[]>([]);
  const [discoveryAnswerDraft, setDiscoveryAnswerDraft] = useState<DiscoveryAnswerDraft | null>(null);
  const [taskCompilation, setTaskCompilation] = useState<TaskCompilationResult | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setView('develop');
    setDiscoveryAnswerDraft(null);
  }, [project.id]);

  const currentBundle = [...project.proposalStore.bundles].reverse().find(bundle => bundle.status === 'open')
    || project.proposalStore.bundles.at(-1);
  const bundleResolved = currentBundle?.status === 'resolved';
  const pendingItems = bundleResolved ? [] : currentBundle?.items || [];
  const acceptedCount = pendingItems.filter(item => item.status === 'accepted' || item.status === 'edited').length;
  const unresolvedCount = pendingItems.filter(item => item.status === 'pending').length;
  const active = project.sections[activeSection];
  const changePreview = useMemo(
    () => currentBundle ? previewApprovedChanges(project, currentBundle.id) : null,
    [project, currentBundle?.id]
  );
  const impactedSections = useMemo(
    () => new Set((changePreview?.sections || []).map(section => section.sectionId)),
    [changePreview]
  );
  const questions = useMemo(() => [...new Set([
    ...(project.openQuestions || []),
    ...(project.ideaLabSession?.conceptSummary?.openQuestions || [])
  ].filter(Boolean))] as string[], [project.openQuestions, project.ideaLabSession?.conceptSummary?.openQuestions]);
  const hasCanonicalPlan = project.requirements.length > 0 || project.decisions.length > 0 || project.tasks.length > 0;
  const canonicalPlanningOpen = view === 'plan' && Boolean(project.sourceIdeaRevisionId || hasCanonicalPlan);

  useEffect(() => setSectionDraft(active?.content || ''), [activeSection, project.id, active?.content]);
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [project.messages.length, generating, discoveryAnswerDraft]);

  const persistCandidate = async (next: Project, message?: string, commandType = 'UpdateProject') => {
    const persisted = await onPersist(next, commandType);
    if (!persisted) return false;
    if (message) {
      setNotice(message);
      window.setTimeout(() => setNotice(''), 3200);
    }
    return true;
  };
  const commit = (next: Project, message?: string, commandType = 'UpdateProject') => {
    void persistCandidate(next, message, commandType);
  };

  const setSuggestion = (suggestionId: string, status: SuggestionStatus, edited = '') => {
    if (!currentBundle) return;
    commit(updateSuggestionStatus(project, currentBundle.id, suggestionId, status, edited), undefined, 'UpdateSuggestionStatus');
  };

  const applySuggestions = () => {
    if (!currentBundle) return;
    const target = structuredClone(project);
    const bundle = target.proposalStore.bundles.find(candidate => candidate.id === currentBundle.id);
    if (bundle) bundle.items.forEach(item => { if (item.status === 'pending') item.status = 'deferred'; });
    commit(applyApprovedChanges(target, currentBundle.id), 'Seçtiğin fikir kararları kaydedildi.', 'ApplyApprovedChanges');
  };

  const sendMessage = async (rawMessage: string, question = focusedQuestion) => {
    const message = rawMessage.trim();
    if (!message || generating) return;
    setGenerating(true);
    try {
      if (changeImpactMode) {
        const result = await generateImpactAnalysis(project, message, { pendingCommit: true });
        setMessageDraft('');
        setFocusedQuestion('');
        setChangeImpactMode(false);
        await persistCandidate(result.project, 'Değişikliğin plan etkisi hazır; henüz uygulanmadı.', 'ProposeChangeImpact');
        return;
      }

      const credential = await credentialVault.get(providerSettings.providerId) || '';
      const memory = providerSettings.useLocalMemory ? buildLocalPlanningMemory(projects, project.id) : null;
      const target = prepareDiscoveryTurnProject(project, currentBundle?.id);
      const result = await runConversationalDiscoveryTurn(target, {
        settings: providerSettings,
        credential,
        message,
        focusedQuestion: question,
        memory
      });
      let answerDraft = createDiscoveryAnswerDraft(
        { ...result.project, documentRevision: project.documentRevision + 1 },
        { answer: message, focusedQuestion: question }
      );
      if (answerDraft && compareAnswerWithAi) {
        const comparison = await generateDiscoveryAnswerExtraction(result.project, {
          settings: providerSettings,
          credential,
          answer: message,
          question
        });
        if (comparison.extraction && comparison.provenance) {
          answerDraft = compareDiscoveryAnswerWithAI(answerDraft, comparison.extraction, comparison.provenance);
        } else if (comparison.error) {
          answerDraft = {
            ...answerDraft,
            assessment: {
              ...answerDraft.assessment,
              warnings: [...answerDraft.assessment.warnings, `AI karşılaştırması yapılmadı: ${comparison.error}`]
            }
          };
        }
      }
      setMessageDraft('');
      setFocusedQuestion('');
      const sourceLabel = result.usedFallback ? 'Yerel fikir motoru' : getProviderMeta(providerSettings.providerId).label;
      const saved = await persistCandidate(result.project, `${sourceLabel} yeni seçenekleri hazırladı.`, 'AddDiscoveryTurn');
      if (saved) setDiscoveryAnswerDraft(answerDraft);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Mesaj işlenemedi. Tekrar deneyebilirsin.');
    } finally {
      setGenerating(false);
    }
  };

  const convertIdeaToPlan = async (preview: IdeaPlanConversionPreview) => {
    const result = applyIdeaPlanConversion(project, preview);
    if (!result.success) {
      setNotice(result.reason);
      return false;
    }
    return persistCandidate(result.project, 'Onaylanan fikir yaşayan plana dönüştürüldü.', 'ConfirmIdeaPlanConversion');
  };

  const restoreRevision = async (reference: string) => {
    const result = restorePlanRevision(project, reference);
    if (!result.success) { setNotice(result.reason); return false; }
    return persistCandidate(result.project, `r${result.restoredFromRevision} yeni revision olarak geri yüklendi.`, 'RestoreRevision');
  };

  const finish = () => {
    const result = finalizePlan(project, false);
    if (result.success) commit(result.project, 'Plan finalleştirildi.', 'FinalizePlan');
    else setFinalizationBlockers(result.blockers);
  };

  const exportMarkdown = async () => {
    const { downloadBlob, exportCanonicalMarkdown } = await import('../v4/exporter.js');
    downloadBlob(new Blob([exportCanonicalMarkdown(project)], { type: 'text/markdown' }), `${project.identity.name}.md`);
  };

  const saveSection = () => {
    if (!active) return;
    commit(updatePlanSection(project, activeSection, { content: sectionDraft }), `${active.title} kaydedildi.`, 'UpdatePlanSection');
  };

  const applyTaskPlan = () => {
    if (!taskCompilation) return;
    const result = applyCompiledTaskPlan(project, taskCompilation, { approved: true });
    if (!result.success) { setNotice(result.reason); setTaskCompilation(null); return; }
    commit(result.project, `${result.project.tasks.length} görev taslağı plana uygulandı.`, 'ApplyTaskPlan');
    setTaskCompilation(null);
  };

  return <div className="pg-studio-shell">
    <a className="skip-link" href="#pg-primary-content">Ana içeriğe geç</a>
    <IdeaStudioSidebar
      project={project}
      projects={projects}
      open={sidebarOpen}
      onClose={() => setSidebarOpen(false)}
      onSelect={onProject}
      onNew={onNew}
      onSettings={() => setSettingsOpen(true)}
    />
    <div className="pg-studio-stage">
      <IdeaStudioHeader
        project={project}
        view={view}
        onView={setView}
        onMenu={() => setSidebarOpen(true)}
        onExit={onNew}
        onHistory={() => setHistoryOpen(true)}
      />
      <PlanAlignmentNotice project={project} onCommit={commit} onInspect={() => setView('plan')}/>

      {view === 'develop' && <main id="pg-primary-content" className="pg-idea-workspace" tabIndex={-1}>
        <section className="pg-conversation-column" aria-label="Fikir geliştirme sohbeti">
          <div className="pg-thread" role="log" aria-live="polite" aria-label="Fikir geliştirme konuşması">
            <header className="pg-thread-welcome">
              <div className="pg-assistant-mark"><Sparkles size={19}/></div>
              <div><span>FİKİR STÜDYOSU</span><h1>Fikrini birlikte şekillendirelim</h1><p>Ben sorular soracağım, alternatifler çıkaracağım ve riskleri göstereceğim. Seçim her zaman sende kalacak.</p></div>
            </header>

            <article className="pg-original-idea"><span>Başlangıç fikrin</span><p>{project.identity.originalIdea}</p></article>

            {project.messages.map(message => <article key={message.id} className={`pg-message is-${message.role}`}>
              {message.role === 'assistant' && <div className="pg-message-avatar"><Sparkles size={15}/></div>}
              <div className="pg-message-body">
                <header><b>{message.role === 'user' ? 'Sen' : 'PromtGen'}</b>{message.createdAt && <time>{new Date(message.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</time>}</header>
                <p>{message.content}</p>
                {message.analysisNote && <details><summary>Bu yoruma nasıl ulaştım?</summary><p>{message.analysisNote}</p></details>}
              </div>
            </article>)}

            {generating && <div className="pg-thinking" role="status"><span><i/><i/><i/></span><p>Fikrini analiz ediyor, seçenekleri hazırlıyorum…</p></div>}

            {discoveryAnswerDraft && <div className="pg-inline-review"><DiscoveryAnswerReview
              draft={discoveryAnswerDraft}
              onChange={setDiscoveryAnswerDraft}
              onDiscard={() => setDiscoveryAnswerDraft(null)}
              onApply={() => {
                const result = applyDiscoveryAnswerDraft(project, discoveryAnswerDraft);
                if (!result.success) { setNotice(result.reason); return; }
                void persistCandidate(result.project, `${result.appliedFields.length} alan fikir haritasına işlendi.`, 'UpdateConceptAgreement')
                  .then(saved => { if (saved) setDiscoveryAnswerDraft(null); });
              }}
            /></div>}

            <IdeaDecisionCards items={pendingItems} onStatus={setSuggestion}/>
            {pendingItems.length > 0 && !bundleResolved && <div className="pg-decision-commit">
              <span>{unresolvedCount ? `${unresolvedCount} seçenek karar bekliyor` : `${acceptedCount} seçim kaydedilmeye hazır`}</span>
              <button type="button" disabled={unresolvedCount > 0} onClick={applySuggestions}>Seçimleri fikre işle <ArrowRight size={16}/></button>
            </div>}
            <QuestionChips questions={questions} active={focusedQuestion} onChoose={question => { setFocusedQuestion(question); setMessageDraft(''); }}/>
            <ExplorationDeck disabled={generating} onChoose={prompt => void sendMessage(prompt, '')}/>
            <div ref={messageEndRef}/>
          </div>

          <form className="pg-chat-composer" onSubmit={event => { event.preventDefault(); void sendMessage(messageDraft); }}>
            {focusedQuestion && <div className="pg-focused-question"><span>Yanıtladığın soru</span><b>{focusedQuestion}</b><button type="button" onClick={() => setFocusedQuestion('')}>Kapat</button></div>}
            {hasCanonicalPlan && <div className="pg-composer-mode">
              <button type="button" className={!changeImpactMode ? 'is-active' : ''} onClick={() => setChangeImpactMode(false)}>Fikri tartış</button>
              <button type="button" className={changeImpactMode ? 'is-active' : ''} onClick={() => setChangeImpactMode(true)}>Plan etkisini incele</button>
            </div>}
            <div className="pg-composer-box">
              <textarea
                id="discovery-direction"
                aria-label="Fikir sohbeti mesajı"
                rows={2}
                value={messageDraft}
                onChange={event => setMessageDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(messageDraft);
                  }
                }}
                placeholder={focusedQuestion ? 'Bu soruya doğal şekilde cevap ver…' : 'Fikrine bir ayrıntı ekle veya bir şey sor…'}
              />
              <button type="submit" aria-label="Gönder" disabled={!messageDraft.trim() || generating}>{generating ? <LoaderCircle className="spin" size={19}/> : <Send size={19}/>}</button>
            </div>
            <div className="pg-composer-foot"><span>Enter gönderir · Shift + Enter yeni satır</span><label><input type="checkbox" checked={compareAnswerWithAi} disabled={providerSettings.providerId === 'offline' || providerSettings.useAiWhenAvailable === false} onChange={event => setCompareAnswerWithAi(event.target.checked)}/> AI çıkarımıyla karşılaştır</label></div>
          </form>
        </section>
        <IdeaSnapshot project={project}/>
      </main>}

      {view === 'guide' && <main id="pg-primary-content" className="pg-document-workspace" tabIndex={-1}>
        <header className="pg-document-title"><span>YAŞAYAN FİKİR BELGESİ</span><h1>Konuşmayı anlaşılır bir fikre dönüştür</h1><p>Buradaki değişiklikler taslaktır. Sen onaylamadan yaşayan plana uygulanmaz.</p></header>
        <IdeaGuidePanel project={project} onCommit={commit} onConvert={convertIdeaToPlan} onOpenPlan={() => setView('plan')}/>
      </main>}

      {view === 'plan' && <main id="pg-primary-content" className="pg-plan-workspace" tabIndex={-1}>
        {!canonicalPlanningOpen
          ? <div className="pg-plan-gate"><header><span>PLANA GEÇİŞ</span><h1>Önce fikrin sınırlarını onayla</h1><p>Plan; yalnız onayladığın kullanıcı, problem, MVP kapsamı ve kararlar üzerinden oluşturulur.</p></header><IdeaGuidePanel project={project} onCommit={commit} onConvert={convertIdeaToPlan} onOpenPlan={() => setView('plan')}/></div>
          : <>
            <header className="pg-plan-header">
              <div><span>CANONICAL PLAN · r{project.canonicalRevision}</span><h1>Yaşayan plan</h1><p>{project.planningDepth.rationale}</p></div>
              <div><label>Derinlik<select value={project.planningDepth.selected} onChange={event => commit(overridePlanningDepth(project, event.target.value as Project['planningDepth']['selected']))}>{depths.map(depth => <option value={depth.id} key={depth.id}>{depth.label} — {depth.detail}</option>)}</select></label><button type="button" onClick={exportMarkdown}><Download size={15}/> Markdown</button><button type="button" className="is-primary" onClick={project.lifecycle.status === 'finalized' ? () => commit(reopenPlan(project), 'Yeni plan sürümü açıldı.', 'ReopenPlan') : finish}>{project.lifecycle.status === 'finalized' ? 'Yeniden aç' : 'Finalleştir'}</button></div>
            </header>
            <div className="pg-plan-layout">
              <nav className="pg-section-nav" aria-label="Plan bölümleri">
                <div><span>Hazırlık</span><strong>{project.readiness.score}/100</strong></div>
                {Object.values(project.sections).filter(section => section.required || section.content || section.items.length || impactedSections.has(section.id)).map(section => <button type="button" className={`${activeSection === section.id ? 'is-active' : ''} ${impactedSections.has(section.id) ? 'is-impacted' : ''}`} key={section.id} onClick={() => setActiveSection(section.id)}><span>{section.title}<small>{section.items.length ? `${section.items.length} öğe` : section.required ? 'Gerekli' : 'İsteğe bağlı'}</small></span><ChevronRightIcon/></button>)}
              </nav>
              <section className="pg-plan-editor">
                {active && <><header><div><span>PLAN BÖLÜMÜ</span><h2>{active.title}</h2><p>{active.description}</p></div><small>r{active.updatedAtRevision}</small></header><textarea aria-label={`${active.title} canonical içeriği`} value={sectionDraft} onChange={event => setSectionDraft(event.target.value)} rows={12} placeholder="Bu bölümün canonical içeriğini yaz…"/><button type="button" className="pg-save-section" disabled={sectionDraft === active.content} onClick={saveSection}><Save size={16}/> Bölümü kaydet</button>{active.items.length > 0 && <ul>{active.items.map(item => <li key={item}>{item}</li>)}</ul>}{activeSection === 'tasks' && <><TaskContractSummary tasks={project.tasks}/><button type="button" className="pg-compile-tasks" onClick={() => setTaskCompilation(compileTaskPlan(project))}><Sparkles size={15}/> Gereksinimlerden görev taslağı üret</button></>}</>}
                {taskCompilation && <div className="pg-task-preview"><h3>{taskCompilation.tasks.length} görev taslağı hazır</h3>{taskCompilation.tasks.slice(0, 6).map(task => <p key={task.id}><b>{task.title}</b><span>{task.priority} · {task.status}</span></p>)}<footer><button type="button" onClick={() => setTaskCompilation(null)}>Vazgeç</button><button type="button" disabled={!taskCompilation.tasks.length} onClick={applyTaskPlan}><Check size={14}/> Onayla</button></footer></div>}
              </section>
              <aside className="pg-plan-context">
                <h2>Bu sürüm</h2><dl><div><dt>Gereksinim</dt><dd>{project.requirements.length}</dd></div><div><dt>Karar</dt><dd>{project.decisions.length}</dd></div><div><dt>Görev</dt><dd>{project.tasks.length}</dd></div><div><dt>Risk</dt><dd>{project.risks.length}</dd></div></dl>
                <details><summary><MoreHorizontal size={16}/> Gelişmiş plan araçları</summary><LazyFeatureBoundary label="Gelişmiş plan araçları" resetKey={project.documentRevision}><StorageHealthPanel project={project} onCommit={persistCandidate}/><TraceabilityMap project={project}/><PlanningScenarioPanel project={project} onCommit={commit}/><PlanCodeAlignmentPanel project={project} onCommit={commit}/><SectionRegenerationPanel project={project} onCommit={commit} providerSettings={providerSettings} credentialVault={credentialVault}/></LazyFeatureBoundary></details>
              </aside>
            </div>
          </>}
      </main>}
    </div>

    {settingsOpen && <LazyFeatureBoundary label="AI sağlayıcı ayarları" resetKey={settingsOpen}><ProviderSettingsDialog open settings={providerSettings} onSave={onProviderSettings} onClose={() => setSettingsOpen(false)} credentialVault={credentialVault}/></LazyFeatureBoundary>}
    {historyOpen && <LazyFeatureBoundary label="Revision geçmişi" resetKey={historyOpen}><RevisionHistoryDialog open project={project} onRestore={restoreRevision} onClose={() => setHistoryOpen(false)}/></LazyFeatureBoundary>}
    {finalizationBlockers.length > 0 && <LazyFeatureBoundary label="Plan finalizasyonu" resetKey={finalizationBlockers.length}><FinalizePlanDialog blockers={finalizationBlockers} onClose={() => setFinalizationBlockers([])}/></LazyFeatureBoundary>}
    <LiveAnnouncer message={notice}/>
    {notice && <div className="toast" role="status"><Check size={17}/>{notice}</div>}
  </div>;
}

function ChevronRightIcon() {
  return <ArrowRight size={15}/>;
}
