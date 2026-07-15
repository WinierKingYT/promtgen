import { createEvent, EVENT_TYPES } from '../domain/project-events.js';

const MAX_EVENTS = 5000;

export class EventStore {
    constructor() {
        this.events = [];
    }

    get all() {
        return this.events;
    }

    record(type, projectId, revisionBefore, revisionAfter, payload = {}) {
        const event = createEvent(type, projectId, revisionBefore, revisionAfter, payload);
        this.events.push(event);
        if (this.events.length > MAX_EVENTS) {
            this.events.splice(0, this.events.length - MAX_EVENTS);
        }
        return event;
    }

    findByType(type) {
        return this.events.filter(e => e.type === type);
    }

    findByProjectId(projectId) {
        return this.events.filter(e => e.projectId === projectId);
    }

    replay(initialState, projectId) {
        let state = JSON.parse(JSON.stringify(initialState));
        const projectEvents = this.findByProjectId(projectId);
        for (const event of projectEvents) {
            if (event.type === EVENT_TYPES.PATCH_TRANSACTION_COMMITTED) {
                const patches = event.payload.patches || [];
                for (const patch of patches) {
                    state = this._applyPatch(state, patch);
                }
            }
        }
        return state;
    }

    _applyPatch(state, patch) {
        const parts = patch.path.split('/').filter(p => p !== '');
        let current = state;
        for (let i = 0; i < parts.length - 1; i++) {
            if (current[parts[i]] === undefined) current[parts[i]] = {};
            current = current[parts[i]];
        }
        const last = parts[parts.length - 1];
        if (patch.operation === 'replace' || patch.operation === 'set') {
            current[last] = patch.value;
        } else if (patch.operation === 'add') {
            if (Array.isArray(current)) {
                if (last === '-') current.push(patch.value);
                else current.splice(parseInt(last), 0, patch.value);
            }
        } else if (patch.operation === 'remove') {
            if (Array.isArray(current)) current.splice(parseInt(last), 1);
            else delete current[last];
        }
        return state;
    }
}
