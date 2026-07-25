const checkpointsStore = new Map();

export function computeDataChecksum(data) {
  const jsonStr = JSON.stringify(data || {});
  let hash = 0;
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `crc32-${Math.abs(hash).toString(16)}`;
}

export function createCheckpoint(project) {
  const pId = String(project.id);
  const checksumHash = computeDataChecksum(project);
  const checkpoint = {
    id: `chk-${Date.now()}-r${project.revision}`,
    projectId: pId,
    revision: project.revision,
    createdAt: new Date().toISOString(),
    checksumHash,
    projectSnapshot: structuredClone(project)
  };

  const existing = checkpointsStore.get(pId) || [];
  existing.push(checkpoint);
  if (existing.length > 5) existing.shift();

  checkpointsStore.set(pId, existing);
  return checkpoint;
}

export function getLatestCheckpoint(projectId) {
  const list = checkpointsStore.get(projectId) || [];
  return list.length ? list[list.length - 1] : null;
}

export function verifyDataIntegrity(project, expectedChecksum) {
  const actualHash = computeDataChecksum(project);
  return actualHash === expectedChecksum;
}
