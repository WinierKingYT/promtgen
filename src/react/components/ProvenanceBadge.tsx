import React from 'react';

export type ProvenanceKind = 'canonical' | 'ai-proposed' | 'local-rule' | 'degraded';

interface ProvenanceBadgeProps {
  kind: ProvenanceKind;
  providerName?: string;
  className?: string;
}

/** Rozetin görünümü `.pg-provenance-badge` kurallarında; daha önce Tailwind yardımcı sınıflarıydı. */
const LABELS: Record<ProvenanceKind, { icon: string; text: string }> = {
  canonical: { icon: '✓', text: 'Onaylı plan' },
  'ai-proposed': { icon: '🤖', text: 'AI Önerisi' },
  'local-rule': { icon: '⚙️', text: 'Yerel Kural Motoru' },
  degraded: { icon: '⚠️', text: 'Yedek Kural Motoru (Fallback)' }
};

export const ProvenanceBadge: React.FC<ProvenanceBadgeProps> = ({ kind, providerName, className = '' }) => {
  const label = LABELS[kind];
  if (!label) return null;

  const text = kind === 'ai-proposed' && providerName ? `AI Önerisi (${providerName})` : label.text;

  return (
    <span className={`pg-provenance-badge is-${kind} ${className}`}>
      <span>{label.icon}</span>
      <span>{text}</span>
    </span>
  );
};
