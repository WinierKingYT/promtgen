import { CONTRIBUTION_TYPES } from './module-types.js';

export class ContributionExecutor {
    constructor(moduleRegistry) {
        this.registry = moduleRegistry;
    }

    executeContributions(moduleIds, state, options = {}) {
        const orderedIds = this._orderByDependencies(moduleIds);
        const summary = this.registry.getContributionSummary(orderedIds);
        const log = [];
        const patches = [];
        let resultState = state;
        const seenArtifactNames = new Set();
        for (const art of (state.artifacts || [])) {
            const key = (art.title || art.name || '').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            if (key) seenArtifactNames.add(key);
        }
        for (const esArt of (state.entityStores?.artifact || [])) {
            const key = (esArt.title || esArt.name || '').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            if (key) seenArtifactNames.add(key);
        }

        for (const type of CONTRIBUTION_TYPES) {
            const items = summary[type];
            if (!items || items.length === 0) continue;

            const handler = this._handlers[type];
            if (handler) {
                const output = handler(items, resultState, { ...options, seenArtifactNames });
                if (output.patches) patches.push(...output.patches);
                if (output.state) resultState = output.state;
                log.push(...(output.log || []));
            }
        }

        return { state: resultState, patches, log };
    }

    _orderByDependencies(moduleIds) {
        const result = this.registry.resolveDependencies(moduleIds);
        const ordered = [];
        const added = new Set();
        const inputSet = new Set(moduleIds);
        for (const id of result.resolved) {
            if (!inputSet.has(id) && result.required?.includes(id)) {
                if (!added.has(id)) {
                    ordered.push(id);
                    added.add(id);
                }
            }
        }
        for (const id of result.resolved) {
            if (inputSet.has(id) && !added.has(id)) {
                ordered.push(id);
                added.add(id);
            }
        }
        for (const id of moduleIds) {
            if (!added.has(id)) {
                ordered.push(id);
                added.add(id);
            }
        }
        return ordered;
    }

    get pendingHandlers() {
        return ['stateSchema', 'discovery', 'decisions', 'artifacts', 'reviewer'];
    }

    get _handlers() {
        return {
            stateSchema: (items, state) => this._applyStateSchema(items, state),
            discovery: (items) => this._applyDiscovery(items),
            decisions: (items) => this._applyDecisions(items),
            artifacts: (items, state, opts) => this._applyArtifacts(items, opts),
            reviewer: (items) => this._applyReviewerRules(items)
        };
    }

    _applyStateSchema(items, state) {
        const patches = [];
        const log = [];
        const resultState = JSON.parse(JSON.stringify(state));

        for (const { moduleId, value } of items) {
            const nsParts = (value.namespace || '').split('.').filter(Boolean);
            let nsObj = resultState;
            for (const part of nsParts) {
                if (nsObj[part] === undefined) nsObj[part] = {};
                nsObj = nsObj[part];
            }

            for (const field of (value.required || [])) {
                const fieldParts = field.split('.');
                const allParts = [...nsParts, ...fieldParts];
                let obj = resultState;
                let existing = true;
                for (const fp of allParts) {
                    if (obj[fp] === undefined) { existing = false; break; }
                    obj = obj[fp];
                }
                if (!existing) {
                    const path = '/' + allParts.join('/');
                    patches.push({ operation: 'add', path, value: '' });
                    log.push({ type: 'stateSchema', moduleId, action: 'field_created', field: allParts.join('.') });
                }
            }
        }

        return { state: resultState, patches, log };
    }

    _applyDiscovery(items) {
        const allFields = [];
        for (const { moduleId, value } of items) {
            for (const f of (value.requiredFields || [])) {
                allFields.push({ field: f, moduleId });
            }
        }
        return { patches: [], log: [{ type: 'discovery', moduleIds: items.map(i => i.moduleId), requiredFields: allFields }] };
    }

    _applyDecisions(items) {
        const decisionTypes = [];
        for (const { moduleId, value } of items) {
            for (const t of (value.types || [])) {
                decisionTypes.push({ type: t, moduleId });
            }
        }
        return { patches: [], log: [{ type: 'decisions', decisionTypes }] };
    }

    _applyArtifacts(items, opts = {}) {
        const patches = [];
        const log = [];
        const seen = opts.seenArtifactNames || new Set();
        for (const { moduleId, value } of items) {
            for (const name of (value.required || [])) {
                const key = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                const artifactValue = {
                    id: `ART-${name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`,
                    title: name,
                    artifactType: 'document',
                    status: 'draft',
                    sourceModule: moduleId,
                    createdAt: new Date().toISOString()
                };
                patches.push({
                    operation: 'add',
                    path: '/artifacts/-',
                    value: artifactValue
                });
                patches.push({
                    operation: 'add',
                    path: '/entityStores/artifact/-',
                    value: { ...artifactValue }
                });
                log.push({ type: 'artifacts', moduleId, action: 'artifact_template_added', name });
            }
        }
        return { patches, log };
    }

    _applyReviewerRules(items) {
        const rules = [];
        for (const { moduleId, value } of items) {
            for (const r of (value.rules || [])) {
                rules.push({ rule: r, moduleId });
            }
        }
        return { patches: [], log: [{ type: 'reviewer', rules }] };
    }
}
