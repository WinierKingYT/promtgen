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
      className="sr-only fixed -top-96 -left-96 w-1 h-1 overflow-hidden opacity-0 pointer-events-none"
    >
      {message}
    </div>
  );
};
