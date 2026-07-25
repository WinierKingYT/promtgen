import React, { useState } from 'react';
import { ChevronRight, Sparkles, MoreHorizontal, Layers, ShieldCheck, Compass } from 'lucide-react';
import { ProvenanceBadge } from './ProvenanceBadge.js';

export interface GuidedHeaderBarProps {
  projectName: string;
  activePhase: string;
  revision: number;
  onOpenAdvancedTools?: () => void;
  onOpenExpertPerspectives?: () => void;
  onOpenArchitectureComparator?: () => void;
  onOpenExporter?: () => void;
}

const PHASES = [
  { id: 'IDEA_EXPANSION', label: '1. Fikir Genişletme' },
  { id: 'DISCOVERY', label: '2. Keşif & Analiz' },
  { id: 'IDEA_LAB', label: '3. Fikir Laboratuvarı' },
  { id: 'PLANNING', label: '4. Canonical Plan' },
  { id: 'READY', label: '5. Görevler & Çıktı' }
];

export const GuidedHeaderBar: React.FC<GuidedHeaderBarProps> = ({
  projectName,
  activePhase,
  revision,
  onOpenAdvancedTools,
  onOpenExpertPerspectives,
  onOpenArchitectureComparator,
  onOpenExporter
}) => {
  const [showAdvancedMenu, setShowAdvancedMenu] = useState(false);

  return (
    <header className="w-full bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-slate-200">
      {/* Project Identity & Revision */}
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-white tracking-wide truncate max-w-xs" title={projectName}>
          {projectName}
        </h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono border border-slate-700">
          r{revision}
        </span>
        <ProvenanceBadge kind="canonical" />
      </div>

      {/* Phase Roadmap Breadcrumb */}
      <nav aria-label="Aşama Adımları" className="hidden md:flex items-center gap-1 text-xs">
        {PHASES.map((phase, idx) => {
          const isActive = phase.id === activePhase;
          return (
            <React.Fragment key={phase.id}>
              {idx > 0 && <ChevronRight size={12} className="text-slate-600" />}
              <span
                className={`px-2 py-1 rounded transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {phase.label}
              </span>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Progressive Disclosure Action Controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm"
        >
          <Sparkles size={14} />
          <span>Aşamayı İlet</span>
        </button>

        {/* Overflow Menu for Advanced Tools */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAdvancedMenu(!showAdvancedMenu)}
            aria-label="Gelişmiş Araçlar Menüsü"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            <MoreHorizontal size={16} />
          </button>

          {showAdvancedMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-xl py-1 z-50 text-xs">
              <div className="px-3 py-1.5 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-800">
                Gelişmiş Denetim Araçları
              </div>
              <button
                type="button"
                onClick={() => { setShowAdvancedMenu(false); onOpenExpertPerspectives?.(); }}
                className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-800 flex items-center gap-2"
              >
                <Compass size={14} className="text-purple-400" />
                <span>Uzman Perspektifleri</span>
              </button>
              <button
                type="button"
                onClick={() => { setShowAdvancedMenu(false); onOpenArchitectureComparator?.(); }}
                className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-800 flex items-center gap-2"
              >
                <Layers size={14} className="text-amber-400" />
                <span>Mimari Karşılaştırma</span>
              </button>
              <button
                type="button"
                onClick={() => { setShowAdvancedMenu(false); onOpenExporter?.(); }}
                className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-800 flex items-center gap-2"
              >
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>Boilerplate Exporter</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
