import React from 'react';

export type ProvenanceKind = 'canonical' | 'ai-proposed' | 'local-rule' | 'degraded';

interface ProvenanceBadgeProps {
  kind: ProvenanceKind;
  providerName?: string;
  className?: string;
}

export const ProvenanceBadge: React.FC<ProvenanceBadgeProps> = ({ kind, providerName, className = '' }) => {
  switch (kind) {
    case 'canonical':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ${className}`}>
          <span>✓</span>
          <span>Canonical Plan</span>
        </span>
      );
    case 'ai-proposed':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30 ${className}`}>
          <span>🤖</span>
          <span>{providerName ? `AI Önerisi (${providerName})` : 'AI Önerisi'}</span>
        </span>
      );
    case 'local-rule':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 ${className}`}>
          <span>⚙️</span>
          <span>Yerel Kural Motoru</span>
        </span>
      );
    case 'degraded':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-orange-500/10 text-orange-300 border border-orange-500/30 ${className}`}>
          <span>⚠️</span>
          <span>Yedek Kural Motoru (Fallback)</span>
        </span>
      );
    default:
      return null;
  }
};
