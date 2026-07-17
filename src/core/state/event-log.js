import { ENTITY_PREFIXES } from '../entity-store.js';

const EVENT_TYPES = {
    STATE_CREATED: 'state_created',
    STATE_PATCHED: 'state_patched',
    STATE_MIGRATED: 'state_migrated',
    STATE_SNAPSHOT: 'state_snapshot',
    STATE_ROLLBACK: 'state_rollback',
    STATE_VALIDATED: 'state_validated',
    STATE_EXPORTED: 'state_exported',
    MODULE_ACTIVATED: 'module_activated',
    MODULE_DEACTIVATED: 'module_deactivated',
    PHASE_TRANSITION: 'phase_transition',
    APPROVAL_GRANTED: 'approval_granted',
    APPROVAL_INVALIDATED: 'approval_invalidated',
    ENTITY_ADDED: 'entity_added',
    ENTITY_UPDATED: 'entity_updated',
    ENTITY_REMOVED: 'entity_removed',
    ERROR: 'error'
};

let _eventCounter = 0;

function nextEventId() {
    _eventCounter++;
    return `${ENTITY_PREFIXES.event}-${String(_eventCounter).padStart(4, '0')}`;
}

export function resetEventCounter() { _eventCounter = 0; }

export class EventLog {
    constructor(events = []) {
        this._events = [];
        this._indexByType = new Map();
        this._indexByEntity = new Map();
        for (const e of events) this._add(e);
    }

    _add(event) {
        this._events.push(event);
        if (!this._indexByType.has(event.type)) this._indexByType.set(event.type, []);
        this._indexByType.get(event.type).push(event);

        if (event.entityId) {
            if (!this._indexByEntity.has(event.entityId)) this._indexByEntity.set(event.entityId, []);
            this._indexByEntity.get(event.entityId).push(event);
        }
    }

    log(type, payload = {}, options = {}) {
        if (!Object.values(EVENT_TYPES).includes(type) && !options.custom) {
            throw new Error(`Geçersiz event türü: ${type}`);
        }

        const event = {
            id: options.id || nextEventId(),
            type,
            entityType: payload.entityType || null,
            entityId: payload.entityId || null,
            projectRevision: options.revision || 0,
            patchId: payload.patchId || null,
            moduleId: payload.moduleId || null,
            userId: options.userId || 'system',
            source: options.source || 'system',
            timestamp: new Date().toISOString(),
            metadata: options.metadata || {},
            data: payload.data || {},
            description: payload.description || this._defaultDescription(type, payload),
            tags: payload.tags || []
        };

        this._add(event);
        return event;
    }

    getEvents(filters = {}) {
        let result = this._events;
        if (filters.type) result = result.filter(e => e.type === filters.type);
        if (filters.entityId) result = result.filter(e => e.entityId === filters.entityId);
        if (filters.moduleId) result = result.filter(e => e.moduleId === filters.moduleId);
        if (filters.fromRevision) result = result.filter(e => e.projectRevision >= filters.fromRevision);
        if (filters.toRevision) result = result.filter(e => e.projectRevision <= filters.toRevision);
        if (filters.fromDate) result = result.filter(e => new Date(e.timestamp) >= new Date(filters.fromDate));
        if (filters.toDate) result = result.filter(e => new Date(e.timestamp) <= new Date(filters.toDate));
        if (filters.limit) result = result.slice(-filters.limit);
        return result;
    }

    getEventsByType(type) { return [...(this._indexByType.get(type) || [])]; }

    getEventsByEntity(entityId) { return [...(this._indexByEntity.get(entityId) || [])]; }

    getTimeline(reverse = true) {
        const sorted = [...this._events].sort((a, b) =>
            new Date(a.timestamp) - new Date(b.timestamp)
        );
        return reverse ? sorted.reverse() : sorted;
    }

    getStats() {
        const byType = {};
        for (const e of this._events) {
            byType[e.type] = (byType[e.type] || 0) + 1;
        }
        return {
            total: this._events.length,
            byType,
            firstEvent: this._events[0]?.timestamp || null,
            lastEvent: this._events[this._events.length - 1]?.timestamp || null
        };
    }

    search(query) {
        const q = query.toLowerCase();
        return this._events.filter(e =>
            e.type.toLowerCase().includes(q) ||
            e.description?.toLowerCase().includes(q) ||
            e.entityId?.toLowerCase().includes(q) ||
            JSON.stringify(e.data).toLowerCase().includes(q)
        );
    }

    getStateHistory(entityType, entityId) {
        return this.getEventsByEntity(entityId).filter(e =>
            e.type === EVENT_TYPES.ENTITY_ADDED ||
            e.type === EVENT_TYPES.ENTITY_UPDATED ||
            e.type === EVENT_TYPES.ENTITY_REMOVED
        );
    }

    clear() { this._events = []; this._indexByType.clear(); this._indexByEntity.clear(); }

    toJSON() { return { events: this._events }; }
    static fromJSON(json) { return new EventLog(json.events || []); }

    _defaultDescription(type, payload) {
        const descriptions = {
            [EVENT_TYPES.STATE_CREATED]: 'State oluşturuldu',
            [EVENT_TYPES.STATE_PATCHED]: `Patch uygulandı: ${payload.patchId || 'bilinmiyor'}`,
            [EVENT_TYPES.PHASE_TRANSITION]: `Faz geçişi: ${payload.fromPhase || '?'} → ${payload.toPhase || '?'}`,
            [EVENT_TYPES.ENTITY_ADDED]: `Entity eklendi: ${payload.entityType || '?'} (${payload.entityId || '?'})`,
            [EVENT_TYPES.ENTITY_UPDATED]: `Entity güncellendi: ${payload.entityId || '?'}`,
            [EVENT_TYPES.ENTITY_REMOVED]: `Entity silindi: ${payload.entityId || '?'}`,
            [EVENT_TYPES.APPROVAL_GRANTED]: `Onay verildi: ${payload.approvalKey || '?'}`,
            [EVENT_TYPES.ERROR]: `Hata: ${payload.message || 'bilinmiyor'}`
        };
        return descriptions[type] || `${type} eventi kaydedildi`;
    }
}

export { EVENT_TYPES };
