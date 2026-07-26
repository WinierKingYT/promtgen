export interface QuarantinedRecord {
  id: string;
  projectId: string | null;
  quarantinedAt: string;
  reason: string;
  rawPayload: unknown;
}

export function createQuarantineRecord(rawPayload: unknown, reason: string): QuarantinedRecord {
  const candidate = rawPayload && typeof rawPayload === 'object'
    ? rawPayload as { id?: unknown }
    : null;
  return {
    id: `quarantine-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    projectId: typeof candidate?.id === 'string' ? candidate.id : null,
    quarantinedAt: new Date().toISOString(),
    reason,
    rawPayload: structuredClone(rawPayload)
  };
}

// Compatibility name; persistence belongs to the repository transaction.
export const quarantineProject = createQuarantineRecord;
