export interface QuarantinedRecord {
  id: string;
  quarantinedAt: string;
  reason: string;
  rawPayload: unknown;
}

const quarantineMemoryStore = new Map<string, QuarantinedRecord>();

export function quarantineProject(rawPayload: any, reason: string): QuarantinedRecord {
  const id = `quarantine-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const record: QuarantinedRecord = {
    id,
    quarantinedAt: new Date().toISOString(),
    reason,
    rawPayload
  };

  quarantineMemoryStore.set(id, record);
  return record;
}

export function listQuarantinedRecords(): QuarantinedRecord[] {
  return Array.from(quarantineMemoryStore.values());
}

export function clearQuarantine(): void {
  quarantineMemoryStore.clear();
}
