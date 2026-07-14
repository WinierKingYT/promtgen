export function getInitialCanonicalState() {
    return {
        schemaVersion: 1,
        revision: 1,
        identity: {
            name: "",
            summary: "",
            problem: "",
            desiredOutcome: ""
        },
        profile: {
            domains: [],
            platforms: [],
            interfaces: [],
            capabilities: [],
            uncertainties: []
        },
        scope: {
            mustHave: [],
            shouldHave: [],
            couldHave: [],
            notNow: [],
            outOfScope: []
        },
        requirements: {
            functional: [],
            nonFunctional: [],
            domainSpecific: []
        },
        decisions: [],
        assumptions: [],
        risks: [],
        openQuestions: [],
        architecture: {
            components: [],
            dataFlows: [],
            integrations: []
        },
        tasks: [],
        documents: [],
        reviews: []
    };
}

export function applyStatePatch(state, patch) {
    if (!patch || !patch.operation || !patch.path) return state;

    const cloned = JSON.parse(JSON.stringify(state));
    const pathParts = patch.path.split('/').filter(p => p !== '');

    let current = cloned;
    for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (current[part] === undefined) {
            current[part] = {};
        }
        current = current[part];
    }

    const lastPart = pathParts[pathParts.length - 1];

    if (patch.operation === 'add' || patch.operation === 'set') {
        if (Array.isArray(current)) {
            if (lastPart === '-') {
                current.push(patch.value);
            } else {
                const idx = parseInt(lastPart);
                if (!isNaN(idx)) {
                    current.splice(idx, 0, patch.value);
                }
            }
        } else {
            current[lastPart] = patch.value;
        }
    } else if (patch.operation === 'replace') {
        if (Array.isArray(current)) {
            const idx = parseInt(lastPart);
            if (!isNaN(idx) && idx >= 0 && idx < current.length) {
                current[idx] = patch.value;
            }
        } else {
            current[lastPart] = patch.value;
        }
    } else if (patch.operation === 'remove') {
        if (Array.isArray(current)) {
            const idx = parseInt(lastPart);
            if (!isNaN(idx) && idx >= 0 && idx < current.length) {
                current.splice(idx, 1);
            }
        } else {
            delete current[lastPart];
        }
    }

    cloned.revision += 1;
    return cloned;
}

export function validateCanonicalState(state) {
    if (!state || typeof state !== 'object') return false;
    const requiredKeys = ['schemaVersion', 'revision', 'identity', 'profile', 'scope', 'requirements', 'decisions', 'assumptions', 'risks', 'openQuestions', 'architecture', 'tasks', 'documents'];
    for (const key of requiredKeys) {
        if (state[key] === undefined) return false;
    }
    return true;
}
