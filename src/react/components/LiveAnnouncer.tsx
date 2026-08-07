import React from 'react';

export interface LiveAnnouncerProps {
  message: string;
  politeness?: 'polite' | 'assertive';
}

export const LiveAnnouncer: React.FC<LiveAnnouncerProps> = ({ message, politeness = 'polite' }) => {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="pg-sr-only"
    >
      {message}
    </div>
  );
};
