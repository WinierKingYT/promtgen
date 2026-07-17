import { getInitialV3State, validateV3State } from '../../state/project-state-v3.js';
import { migrateProjectState } from '../../state/state-migrations.js';
import { EVENT_TYPES } from './event-log.js';

export const SCHEMA_VERSION = 3;

const VALIDATION_RULES = {
    root: {
        required: ['schemaVersion', 'revision', 'phase', 'lifecycle', 'configuration', 'identity', 'entityStores'],
        types: {
            schemaVersion: 'number',
            revision: 'number',
            lifecycle: 'object',
            configuration: 'object',
            identity: 'object',
            entityStores: 'object'
        }
    },
    lifecycle: {
        required: ['status', 'createdAt'],
        types: { status: 'string', createdAt: 'string' }
    },
    configuration: {
        required: ['language', 'planningDepth'],
        types: { language: 'string', planningDepth: 'string' },
        enum: { language: ['tr', 'en'], planningDepth: ['quick', 'standard', 'deep', 'enterprise'] }
    },
    identity: {
        required: ['name', 'problemStatement'],
        types: { name: 'string', problemStatement: 'string' }
    }
};

export class StateValidator {
    constructor(rules = null) {
        this.rules = rules || VALIDATION_RULES;
    }

    validate(state) {
        if (!state) return { valid: false, errors: [{ path: '/', message: 'State boş' }] };

        const errors = [];
        const warnings = [];

        this._validateObject(state, this.rules.root, '/', errors);

        if (Array.isArray(state.entityStores)) {
            warnings.push({ path: '/entityStores', message: 'entityStores dizi formatında, obje bekleniyor' });
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            score: this._calculateScore(errors, warnings)
        };
    }

    validatePatch(patch, _state) {
        if (!patch || !patch.path) {
            return { valid: false, errors: [{ message: 'Patch geçersiz: path gerekli' }] };
        }

        const errors = [];
        const pathParts = patch.path.split('/').filter(Boolean);

        if (pathParts.length === 0) {
            errors.push({ path: patch.path, message: 'Kök path değiştirilemez' });
        }

        if (patch.path.includes('__proto__') || patch.path.includes('constructor') || patch.path.includes('prototype')) {
            errors.push({ path: patch.path, message: 'Güvenlik: prototip kirletme engellendi' });
        }

        return { valid: errors.length === 0, errors };
    }

    validateExport(state) {
        const result = this.validate(state);
        if (!result.valid) return result;

        const errors = [];
        if (!state.lifecycle?.status) errors.push({ path: '/lifecycle/status', message: 'Lifecycle status eksik' });
        if (!state.identity?.name) errors.push({ path: '/identity/name', message: 'Proje adı eksik' });

        return { valid: errors.length === 0, errors, warnings: result.warnings };
    }

    _validateObject(obj, rules, path, errors) {
        if (!obj || typeof obj !== 'object') {
            errors.push({ path, message: `Beklenen: object, alınan: ${typeof obj}` });
            return;
        }

        for (const key of (rules.required || [])) {
            const val = obj[key];
            if (val === undefined || val === null || val === '') {
                errors.push({ path: `${path}/${key}`, message: `Zorunlu alan eksik: ${key}` });
            }
        }

        if (rules.types) {
            for (const [key, expectedType] of Object.entries(rules.types)) {
                const val = obj[key];
                if (val !== undefined && val !== null) {
                    const actualType = Array.isArray(val) ? 'array' : typeof val;
                    if ((expectedType === 'array' && !Array.isArray(val)) ||
                        (expectedType !== 'array' && actualType !== expectedType)) {
                        errors.push({ path: `${path}/${key}`, message: `Beklenen tip: ${expectedType}, alınan: ${actualType}` });
                    }
                }
            }
        }

        if (rules.enum) {
            for (const [key, allowed] of Object.entries(rules.enum)) {
                const val = obj[key];
                if (val !== undefined && val !== null && !allowed.includes(val)) {
                    errors.push({ path: `${path}/${key}`, message: `Geçersiz değer: '${val}'. İzin verilenler: ${allowed.join(', ')}` });
                }
            }
        }

        if (rules.children) {
            for (const [key, childRules] of Object.entries(rules.children)) {
                if (obj[key] && typeof obj[key] === 'object') {
                    this._validateObject(obj[key], childRules, `${path}/${key}`, errors);
                }
            }
        }
    }

    _calculateScore(errors, warnings) {
        let score = 100;
        score -= errors.length * 10;
        score -= warnings.length * 3;
        return Math.max(0, Math.min(100, score));
    }
}

export class StateSerializer {
    constructor(options = {}) {
        this.options = {
            prettyPrint: options.prettyPrint ?? true,
            includeMetadata: options.includeMetadata ?? true,
            maxDepth: options.maxDepth ?? 20,
            ...options
        };
    }

    serialize(state) {
        const output = {
            schemaVersion: SCHEMA_VERSION,
            exportedAt: new Date().toISOString(),
            state: this._cloneDeep(state, 0)
        };

        if (this.options.includeMetadata) {
            output.metadata = {
                nodeCount: this._countNodes(state),
                entityCount: this._countEntities(state),
                schemaVersion: SCHEMA_VERSION
            };
        }

        return output;
    }

    deserialize(json) {
        if (!json || !json.state) throw new Error('Geçersiz serileştirilmiş state');
        if (json.schemaVersion && json.schemaVersion > SCHEMA_VERSION) {
            throw new Error(`Desteklenmeyen schema sürümü: ${json.schemaVersion} (max: ${SCHEMA_VERSION})`);
        }
        return json.state;
    }

    toJSON(state) {
        return JSON.stringify(this.serialize(state), null, this.options.prettyPrint ? 2 : 0);
    }

    fromJSON(jsonStr) {
        try {
            const parsed = JSON.parse(jsonStr);
            return this.deserialize(parsed);
        } catch (e) {
            throw new Error(`JSON ayrıştırma hatası: ${e.message}`);
        }
    }

    _cloneDeep(obj, depth) {
        if (depth > this.options.maxDepth) return '[MAX_DEPTH]';
        if (obj === null || obj === undefined) return obj;
        if (typeof obj !== 'object') return obj;
        if (obj instanceof Date) return obj.toISOString();

        if (Array.isArray(obj)) {
            return obj.map(item => this._cloneDeep(item, depth + 1));
        }

        const result = {};
        for (const [key, val] of Object.entries(obj)) {
            result[key] = this._cloneDeep(val, depth + 1);
        }
        return result;
    }

    _countNodes(obj) {
        if (!obj || typeof obj !== 'object') return 0;
        let count = 1;
        for (const val of Object.values(obj)) {
            if (val && typeof val === 'object') count += this._countNodes(val);
        }
        return count;
    }

    _countEntities(state) {
        let count = 0;
        if (state.entityStores) {
            for (const [, entities] of Object.entries(state.entityStores)) {
                if (Array.isArray(entities)) count += entities.length;
            }
        }
        return count;
    }
}

export class StateSnapshot {
    constructor() {
        this._snapshots = [];
    }

    create(state, revision, label = '') {
        const snapshot = {
            id: `SNAP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            revision,
            label: label || `Revision ${revision}`,
            timestamp: new Date().toISOString(),
            state: JSON.parse(JSON.stringify(state))
        };
        this._snapshots.push(snapshot);
        return snapshot;
    }

    restore(snapshotId) {
        const snap = this._snapshots.find(s => s.id === snapshotId);
        if (!snap) return null;
        return JSON.parse(JSON.stringify(snap.state));
    }

    getLatest() {
        if (this._snapshots.length === 0) return null;
        return this._snapshots[this._snapshots.length - 1];
    }

    getByRevision(revision) {
        const snaps = this._snapshots.filter(s => s.revision === revision);
        return snaps.length > 0 ? snaps[snaps.length - 1] : null;
    }

    diff(snapshotIdA, snapshotIdB) {
        const a = this._snapshots.find(s => s.id === snapshotIdA);
        const b = this._snapshots.find(s => s.id === snapshotIdB);
        if (!a || !b) return null;
        return this._computeDiff(a.state, b.state, '');
    }

    list() {
        return this._snapshots.map(s => ({
            id: s.id,
            revision: s.revision,
            label: s.label,
            timestamp: s.timestamp
        }));
    }

    prune(keepCount = 10) {
        while (this._snapshots.length > keepCount) {
            this._snapshots.shift();
        }
    }

    _computeDiff(objA, objB, path) {
        const changes = [];

        if (objA === objB) return changes;
        if (typeof objA !== typeof objB) {
            changes.push({ path, type: 'type_change', from: typeof objA, to: typeof objB });
            return changes;
        }
        if (objA === null || objB === null || typeof objA !== 'object') {
            if (JSON.stringify(objA) !== JSON.stringify(objB)) {
                changes.push({ path, type: 'value_change', from: objA, to: objB });
            }
            return changes;
        }

        const keysA = new Set(Object.keys(objA));
        const keysB = new Set(Object.keys(objB));

        for (const key of keysA) {
            if (!keysB.has(key)) {
                changes.push({ path: `${path}/${key}`, type: 'removed', from: objA[key] });
            } else {
                changes.push(...this._computeDiff(objA[key], objB[key], `${path}/${key}`));
            }
        }

        for (const key of keysB) {
            if (!keysA.has(key)) {
                changes.push({ path: `${path}/${key}`, type: 'added', to: objB[key] });
            }
        }

        return changes;
    }
}

export function getDefaultState() {
    return getInitialV3State();
}

export function migrateState(state, targetVersion = SCHEMA_VERSION) {
    if (!state) return getDefaultState();
    const currentVersion = state.schemaVersion || 1;

    if (currentVersion >= targetVersion) return state;

    if (targetVersion >= 3) {
        const result = migrateProjectState(state);
        return result.state;
    }

    return state;
}
