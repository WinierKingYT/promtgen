let _counter = {};
export function resetEntityCounters() { _counter = {}; }

export const ENTITY_PREFIXES = {
    objective: 'OBJ', stakeholder: 'STK', constraint: 'CON',
    assumption: 'ASM', decision: 'DEC', risk: 'RSK',
    openQuestion: 'Q', scopeItem: 'SCOPE', requirement: 'REQ',
    deliverable: 'DEL', workstream: 'WS', milestone: 'MIL',
    artifact: 'ART', task: 'TASK', prompt: 'PROMPT',
    agent: 'AGENT', test: 'TEST', reviewFinding: 'FIND',
    waiver: 'WVR', approval: 'APPR', event: 'EVT'
};

function nextId(type) {
    const p = ENTITY_PREFIXES[type] || 'ENT';
    if (!_counter[p]) _counter[p] = 0;
    _counter[p]++;
    return `${p}-${String(_counter[p]).padStart(3, '0')}`;
}

export function buildEntity(type, data, revision = 1) {
    const id = data.id || nextId(type);
    return {
        id, uid: data.uid || `uid-${id}-${Date.now()}`,
        entityType: type, title: data.title || '',
        description: data.description || '',
        status: data.status || 'draft',
        priority: data.priority || 'medium',
        sourceModule: data.sourceModule || 'universal',
        source: data.source || { type: 'manual', sourceId: null, evidenceType: 'direct_fact' },
        sensitivity: data.sensitivity || 'internal',
        version: 1, createdAtRevision: revision, updatedAtRevision: revision,
        tags: data.tags || [],
        ...data
    };
}

export function addToStore(store, type, data, revision) {
    const entity = buildEntity(type, data, revision);
    const existing = store[type] || [];
    if (entity.id && existing.some(e => e.id === entity.id)) return null;
    store[type] = existing;
    existing.push(entity);
    return entity;
}

export function getFromStore(store, type, id) {
    const list = store[type] || [];
    return list.find(e => e.id === id) || null;
}

export function updateInStore(store, type, id, changes, revision) {
    const list = store[type] || [];
    const idx = list.findIndex(e => e.id === id);
    if (idx === -1) return null;
    const entity = { ...list[idx] };
    for (const key of Object.keys(changes)) {
        if (key === 'id' || key === 'entityType' || key === 'uid') continue;
        entity[key] = changes[key];
    }
    entity.version = (entity.version || 1) + 1;
    entity.updatedAtRevision = revision;
    list[idx] = entity;
    return entity;
}

export function removeFromStore(store, type, id) {
    const list = store[type] || [];
    const idx = list.findIndex(e => e.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    return true;
}

export function filterStore(store, type, predicate) {
    return (store[type] || []).filter(predicate);
}

export function storeCount(store, type) {
    return (store[type] || []).length;
}

export function buildStoreArrays(types) {
    const store = {};
    for (const t of types) store[t] = [];
    return store;
}
