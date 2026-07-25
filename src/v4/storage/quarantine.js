const quarantineMemoryStore = new Map();

export function quarantineProject(rawPayload, reason) {
  const id = `quarantine-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const record = {
    id,
    quarantinedAt: new Date().toISOString(),
    reason,
    rawPayload
  };

  quarantineMemoryStore.set(id, record);
  return record;
}

export function listQuarantinedRecords() {
  return Array.from(quarantineMemoryStore.values());
}

export function clearQuarantine() {
  quarantineMemoryStore.clear();
}
