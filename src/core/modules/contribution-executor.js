import { CONTRIBUTION_TYPES } from './module-types.js';

export class ContributionExecutor {
    constructor(moduleRegistry) {
        this.registry = moduleRegistry;
    }

    executeContributions(moduleIds, state, options = {}) {
        const summary = this.registry.getContributionSummary(moduleIds);
        const log = [];
        const patches = [];
        let resultState = state;

        for (const type of CONTRIBUTION_TYPES) {
            const items = summary[type];
            if (!items || items.length === 0) continue;

            const handler = this._handlers[type];
            if (handler) {
                const output = handler(items, resultState, options);
                if (output.patches) patches.push(...output.patches);
                if (output.state) resultState = output.state;
                log.push(...(output.log || []));
            }
        }

        return { state: resultState, patches, log };
    }

    get pendingHandlers() {
        return ['stateSchema', 'discovery', 'decisions', 'artifacts', 'reviewer'];
    }

    get _handlers() {
        return {
            stateSchema: (items, state) => this._applyStateSchema(items, state),
            discovery: (items) => this._applyDiscovery(items),
            decisions: (items) => this._applyDecisions(items),
            artifacts: (items) => this._applyArtifacts(items),
            reviewer: (items) => this._applyReviewerRules(items)
        };
    }

    _applyStateSchema(items, state) {
        const patches = [];
        const log = [];
        const resultState = JSON.parse(JSON.stringify(state));

        for (const { moduleId, value } of items) {
            const ns = value.namespace || '';
            const parts = ns.split('.');
            let current = resultState;
            for (const part of parts) {
                if (!part) continue;
                if (current[part] === undefined) current[part] = {};
                current = current[part];
            }

            for (const field of (value.required || [])) {
                const fieldParts = field.split('.');
                let obj = resultState;
                let existing = true;
                for (const fp of fieldParts) {
                    if (obj[fp] === undefined) { existing = false; break; }
                    obj = obj[fp];
                }
                if (!existing) {
                    patches.push({ op: 'add', path: `/${ns}/${field}`.replace(/\/+/g, '/'), value: '' });
                    log.push({ type: 'stateSchema', moduleId, action: 'field_created', field });
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

    _applyArtifacts(items) {
        const patches = [];
        const log = [];
        for (const { moduleId, value } of items) {
            for (const name of (value.required || [])) {
                patches.push({
                    op: 'add',
                    path: '/artifacts/-',
                    value: {
                        id: `ART-${name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`,
                        title: name,
                        artifactType: 'document',
                        status: 'draft',
                        sourceModule: moduleId,
                        createdAt: new Date().toISOString()
                    }
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
