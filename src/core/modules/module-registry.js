import { createModuleManifest, MODULE_STATUS, CONTRIBUTION_TYPES } from './module-types.js';

export class ModuleRegistry {
    constructor() {
        this._modules = new Map();
        this._counter = 0;
    }

    register(manifest) {
        if (!manifest.id) throw new Error('Modül ID zorunlu');
        if (this._modules.has(manifest.id)) throw new Error(`Modül '${manifest.id}' zaten kayıtlı`);
        const m = createModuleManifest(manifest);
        this._modules.set(m.id, m);
        return m;
    }

    getModule(id) { return this._modules.get(id) || null; }

    hasModule(id) { return this._modules.has(id); }

    getAllModules() { return [...this._modules.values()]; }

    getModulesByCategory(category) {
        return this.getAllModules().filter(m => m.category === category);
    }

    getModulesByParent(parentId) {
        return this.getAllModules().filter(m => m.parentModule === parentId);
    }

    getLeafModules() {
        return this.getAllModules().filter(m =>
            !this.getAllModules().some(other => other.parentModule === m.id)
        );
    }

    resolveDependencies(moduleIds) {
        return this.resolveRequiredDependencies(moduleIds);
    }

    resolveRequiredDependencies(moduleIds) {
        const resolved = new Set();
        const queue = [...moduleIds];
        const missing = [];

        while (queue.length > 0) {
            const id = queue.shift();
            if (resolved.has(id)) continue;

            const mod = this._modules.get(id);
            if (!mod) { missing.push(id); continue; }

            resolved.add(id);

            for (const depId of mod.dependencies) {
                if (!resolved.has(depId) && !queue.includes(depId)) queue.push(depId);
            }
        }

        return {
            resolved: [...resolved],
            missing,
            resolvedModules: [...resolved].map(id => this._modules.get(id)).filter(Boolean)
        };
    }

    suggestOptionalDependencies(moduleIds) {
        const suggestions = [];
        const processed = new Set();

        for (const id of moduleIds) {
            const mod = this._modules.get(id);
            if (!mod) continue;
            if (processed.has(id)) continue;
            processed.add(id);

            for (const depId of mod.optionalDependencies) {
                if (!moduleIds.includes(depId) && this._modules.has(depId)) {
                    suggestions.push({
                        moduleId: depId,
                        name: this._modules.get(depId).name,
                        requiredBy: id,
                        reason: mod.optionalDependencies?.find(d => d === depId)?.reason || `${mod.name} için opsiyonel modül`
                    });
                }
            }
        }

        return suggestions;
    }

    detectConflicts(moduleIds) {
        const conflicts = [];
        const activeModules = moduleIds.map(id => this._modules.get(id)).filter(Boolean);

        for (const mod of activeModules) {
            if (!mod.conflictsWith) continue;
            for (const conflict of mod.conflictsWith) {
                const conflictId = typeof conflict === 'string' ? conflict : conflict.moduleId;
                if (moduleIds.includes(conflictId)) {
                    conflicts.push({
                        moduleA: mod.id,
                        moduleB: conflictId,
                        severity: conflict.severity || 'high',
                        resolution: conflict.resolution || 'decision_required',
                        description: conflict.description || `${mod.id} ile ${conflictId} çakışıyor`
                    });
                }
            }
        }

        return conflicts;
    }

    validateCompatibility(moduleIds) {
        const deps = this.resolveRequiredDependencies(moduleIds);
        const conflicts = this.detectConflicts(moduleIds);
        const warnings = [
            ...this._generateWarnings(moduleIds),
            ...this.suggestOptionalDependencies(moduleIds).map(s => ({
                type: 'optional_suggestion',
                moduleId: s.requiredBy,
                suggestedModule: s.moduleId,
                message: `${s.name} opsiyonel olarak öneriliyor (${s.requiredBy})`
            }))
        ];

        return {
            valid: deps.missing.length === 0 && conflicts.length === 0,
            missing: deps.missing,
            conflicts,
            warnings
        };
    }

    suggestModules(context) {
        const { state, userInput = '', activeModules = [] } = context;
        const suggestions = [];

        for (const [, mod] of this._modules) {
            if (activeModules.includes(mod.id)) continue;
            if (mod.category === 'core') continue;

            const signals = mod.activation?.signals || [];
            const matchCount = signals.filter(s =>
                userInput.toLowerCase().includes(s.toLowerCase()) ||
                JSON.stringify(state || {}).toLowerCase().includes(s.toLowerCase())
            ).length;

            if (matchCount > 0) {
                const confidence = Math.min(1, 0.2 + matchCount * 0.2);
                if (confidence >= (mod.activation?.minimumConfidence || 0.5)) {
                    suggestions.push({
                        moduleId: mod.id,
                        name: mod.name,
                        confidence: Math.round(confidence * 100) / 100,
                        matchCount,
                        totalSignals: signals.length,
                        description: mod.description
                    });
                }
            }
        }

        return suggestions.sort((a, b) => b.confidence - a.confidence);
    }

    _generateWarnings(moduleIds) {
        const warnings = [];
        const activeModules = moduleIds.map(id => this._modules.get(id)).filter(Boolean);

        for (const mod of activeModules) {
            if (!mod.optionalDependencies) continue;
            for (const optDep of mod.optionalDependencies) {
                if (!moduleIds.includes(optDep) && this._modules.has(optDep)) {
                    warnings.push({
                        type: 'suggested_module',
                        moduleId: mod.id,
                        suggestedModule: optDep,
                        message: `${mod.name} için '${optDep}' modülü öneriliyor`
                    });
                }
            }
        }

        return warnings;
    }

    getContributionSummary(moduleIds) {
        const activeModules = moduleIds.map(id => this._modules.get(id)).filter(Boolean);
        const summary = {};

        for (const type of CONTRIBUTION_TYPES) {
            summary[type] = [];
        }

        for (const mod of activeModules) {
            if (!mod.contributions) continue;
            for (const [type, value] of Object.entries(mod.contributions)) {
                if (summary[type]) {
                    summary[type].push({ moduleId: mod.id, value });
                }
            }
        }

        return summary;
    }

    getStats() {
        const all = this.getAllModules();
        const byCategory = {};
        for (const m of all) {
            byCategory[m.category] = (byCategory[m.category] || 0) + 1;
        }
        return {
            total: all.length,
            byCategory,
            leafCount: this.getLeafModules().length
        };
    }

    unregister(moduleId) {
        return this._modules.delete(moduleId);
    }
}
