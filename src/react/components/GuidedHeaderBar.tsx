import { Archive, Check, Download, FlaskConical, GitBranch, History, Menu, MoreHorizontal, RotateCcw, Settings2 } from 'lucide-react';
import { PHASE_REGISTRY } from '../../v4/project-document.js';
import { IconButton } from './WorkspaceChrome.js';

export interface GuidedHeaderBarProps {
  projectName: string;
  activePhase: string;
  revision: number;
  canonical?: boolean;
  finalized?: boolean;
  onOpenProjects?: () => void;
  onOpenSettings?: () => void;
  onExportMarkdown?: () => void;
  onExportPackage?: () => void;
  onOpenHistory?: () => void;
  onOpenTimeline?: () => void;
  onOpenAdvancedTools?: () => void;
  onPrimaryAction?: () => void;
}

export function getPhaseGuidance(activePhase: string) {
  const index = Math.max(0, PHASE_REGISTRY.findIndex((phase: { id: string }) => phase.id === activePhase));
  const phase = PHASE_REGISTRY[index] || PHASE_REGISTRY[0];
  const guidance: Record<string, string> = {
    IDEA_EXPANSION: 'Fikri seçeneklerle netleştir.',
    DISCOVERY: 'Kritik soruları yanıtla.',
    IDEA_LAB: 'Yaklaşımı karşılaştır veya atla.',
    CONCEPT_CONFIRMATION: 'MVP sınırlarını onayla.',
    SHAPING: 'Önerileri karara dönüştür.',
    DESIGN: 'Mimari ve riskleri netleştir.',
    PLANNING: 'Görev ve doğrulamaları tamamla.',
    REVIEW: 'Kalite açıklarını kapat.',
    READY: 'Planı dışa aktar veya yeniden aç.'
  };
  return {
    label: phase.label,
    step: index + 1,
    total: PHASE_REGISTRY.length,
    next: guidance[activePhase] || 'Planın sıradaki açık kararını tamamla.'
  };
}

export function GuidedHeaderBar({
  projectName,
  activePhase,
  revision,
  canonical = false,
  finalized = false,
  onOpenProjects,
  onOpenSettings,
  onExportMarkdown,
  onExportPackage,
  onOpenHistory,
  onOpenTimeline,
  onOpenAdvancedTools,
  onPrimaryAction
}: GuidedHeaderBarProps) {
  const phase = getPhaseGuidance(activePhase);
  const run = (action?: () => void) => {
    action?.();
    document.querySelector<HTMLDetailsElement>('.workspace-tools')?.removeAttribute('open');
  };

  return (
    <>
      <header className="topbar">
        <IconButton label="Projeleri aç" onClick={onOpenProjects || (() => undefined)}><Menu size={20}/></IconButton>
        <div className="title-block">
          <span>{projectName}</span>
          <small><span className="live-dot"/> {canonical ? `r${revision} · ${finalized ? 'Final plan' : 'Canlı plan'}` : 'Fikir çalışma alanı'}</small>
        </div>
        <div className="phase-focus" aria-label={`Mevcut aşama ${phase.step}/${phase.total}: ${phase.label}`}>
          <span>{phase.step}/{phase.total}</span>
          <b>{phase.label}</b>
          <small>{phase.next}</small>
        </div>
        <div className="top-actions">
          {canonical && onPrimaryAction && (
            <button className="primary compact" onClick={onPrimaryAction}>
              {finalized ? <RotateCcw size={15}/> : <Check size={15}/>}
              {finalized ? 'Yeniden aç' : 'Finalleştir'}
            </button>
          )}
          <details className="workspace-tools">
            <summary aria-label="Çalışma alanı araçları"><MoreHorizontal size={17}/> Araçlar</summary>
            <div>
              <button type="button" onClick={() => run(onOpenSettings)}><Settings2 size={15}/> AI ayarları</button>
              {canonical && <button type="button" onClick={() => run(onExportMarkdown)}><Download size={15}/> Markdown</button>}
              {canonical && <button type="button" onClick={() => run(onExportPackage)}><Archive size={15}/> Proje paketi</button>}
              {canonical && <button type="button" onClick={() => run(onOpenHistory)}><History size={15}/> Revision geçmişi</button>}
              {canonical && <button type="button" onClick={() => run(onOpenTimeline)}><GitBranch size={15}/> Karar çizelgesi</button>}
              {canonical && <button type="button" onClick={() => run(onOpenAdvancedTools)}><FlaskConical size={15}/> Labs araçları</button>}
            </div>
          </details>
        </div>
      </header>
      <section className="phase-guide" aria-label="Sıradaki çalışma adımı">
        <span>Şimdi</span><b>{phase.label}</b><p>{phase.next}</p>
      </section>
    </>
  );
}
