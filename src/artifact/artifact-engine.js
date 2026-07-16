import { ENTITY_PREFIXES } from '../core/entity-store.js';

const ARTIFACT_TYPES = [
    'architecture', 'flow', 'interface', 'domain', 'decision',
    'deployment', 'sequence', 'component', 'data_model', 'test_plan',
    'risk_mitigation', 'schedule', 'dependency', 'generic'
];

let _artCounter = 0;

function nextArtifactId() {
    _artCounter++;
    return `${ENTITY_PREFIXES.artifact}-${String(_artCounter).padStart(3, '0')}`;
}

export function resetArtifactCounter() { _artCounter = 0; }

function defaultTemplates() {
    return {
        architecture: {
            type: 'architecture',
            label: 'Mimari Şeması',
            variables: ['projectName', 'components', 'relationships', 'domains'],
            template: '# {{projectName}} — Mimari Şeması\n\n## Bileşenler\n{{#each components}}- **{{this.name}}**: {{this.description}}\n{{/each}}\n\n## İlişkiler\n{{#each relationships}}- {{this.from}} → {{this.to}}: {{this.label}}\n{{/each}}\n\n## Alanlar\n{{#each domains}}- {{this}}\n{{/each}}\n'
        },
        flow: {
            type: 'flow',
            label: 'Akış Şeması',
            variables: ['projectName', 'steps'],
            template: '# {{projectName}} — Akış Şeması\n\n```mermaid\nflowchart TD\n{{#each steps}}  {{this.id}}[{{this.label}}]\n{{/each}}\n{{#each steps}}{{#if this.next}}  {{this.id}} --> {{this.next}}\n{{/if}}{{/each}}\n```\n'
        },
        decision: {
            type: 'decision',
            label: 'Karar Dokümanı',
            variables: ['projectName', 'decisionTitle', 'problemStatement', 'options', 'selectedOption'],
            template: '# {{projectName}} — Karar: {{decisionTitle}}\n\n## Problem\n{{problemStatement}}\n\n## Seçenekler\n{{#each options}}- **{{this.label}}**: {{this.description}}\n{{/each}}\n\n## Seçilen: {{selectedOption}}\n'
        },
        component: {
            type: 'component',
            label: 'Bileşen Şeması',
            variables: ['projectName', 'components'],
            template: '# {{projectName}} — Bileşen Şeması\n\n{{#each components}}## {{this.name}}\n- **Sorumluluk**: {{this.responsibility}}\n- **Bağımlılıklar**: {{this.dependencies}}\n- **Durum**: {{this.status}}\n\n{{/each}}\n'
        },
        domain: {
            type: 'domain',
            label: 'Alan Modeli',
            variables: ['projectName', 'domains'],
            template: '# {{projectName}} — Alan Modeli\n\n{{#each domains}}## {{this.name}}\n- **Açıklama**: {{this.description}}\n- **Varlıklar**: {{this.entities}}\n\n{{/each}}\n'
        },
        data_model: {
            type: 'data_model',
            label: 'Veri Modeli',
            variables: ['projectName', 'entities', 'relationships'],
            template: '# {{projectName}} — Veri Modeli\n\n{{#each entities}}### {{this.name}}\n| Alan | Tip | Zorunlu |\n|------|-----|---------|\n{{#each this.fields}}| {{this.name}} | {{this.type}} | {{this.required}} |\n{{/each}}\n{{/each}}\n\n{{#each relationships}}- {{this.from}} {{this.type}}-- {{this.to}}\n{{/each}}\n'
        },
        deployment: {
            type: 'deployment',
            label: 'Dağıtım Şeması',
            variables: ['projectName', 'environments', 'services'],
            template: '# {{projectName}} — Dağıtım Şeması\n\n## Ortamlar\n{{#each environments}}- **{{this.name}}**: {{this.url}}\n{{/each}}\n\n## Servisler\n{{#each services}}- **{{this.name}}** ({{this.type}}): {{this.scale}}\n{{/each}}\n'
        },
        test_plan: {
            type: 'test_plan',
            label: 'Test Planı',
            variables: ['projectName', 'testSuites', 'coverage'],
            template: '# {{projectName}} — Test Planı\n\n## Test Paketleri\n{{#each testSuites}}- **{{this.name}}**: {{this.description}} ({{this.count}} test)\n{{/each}}\n\n## Kapsama: {{coverage}}%\n'
        },
        sequence: {
            type: 'sequence',
            label: 'Sıra Diyagramı',
            variables: ['projectName', 'participants', 'messages'],
            template: '# {{projectName}} — Sıra Diyagramı\n\n```mermaid\nsequenceDiagram\n{{#each participants}}  participant {{this}}\n{{/each}}\n{{#each messages}}  {{this.from}}->>{{this.to}}: {{this.label}}\n{{/each}}\n```\n'
        },
        interface: {
            type: 'interface',
            label: 'Arayüz Şeması',
            variables: ['projectName', 'endpoints'],
            template: '# {{projectName}} — API Arayüzü\n\n{{#each endpoints}}### {{this.method}} {{this.path}}\n- **Açıklama**: {{this.description}}\n- **Parametreler**: {{this.params}}\n- **Yanıt**: {{this.response}}\n\n{{/each}}\n'
        },
        risk_mitigation: {
            type: 'risk_mitigation',
            label: 'Risk Mitigasyon Planı',
            variables: ['projectName', 'risks'],
            template: '# {{projectName}} — Risk Mitigasyon Planı\n\n| Risk | Olasılık | Etki | Mitigasyon |\n|------|----------|------|-------------|\n{{#each risks}}| {{this.description}} | {{this.probability}} | {{this.impact}} | {{this.mitigation}} |\n{{/each}}\n'
        },
        schedule: {
            type: 'schedule',
            label: 'Zamanlama',
            variables: ['projectName', 'milestones'],
            template: '# {{projectName}} — Zamanlama\n\n```mermaid\ngantt\ntitle {{projectName}} Zamanlama\ndateFormat  YYYY-MM-DD\n{{#each milestones}}section {{this.phase}}\n  {{this.name}}: {{this.start}}, {{this.duration}}d\n{{/each}}\n```\n'
        },
        dependency: {
            type: 'dependency',
            label: 'Bağımlılık Haritası',
            variables: ['projectName', 'dependencies'],
            template: '# {{projectName}} — Bağımlılıklar\n\n{{#each dependencies}}- **{{this.name}}** ({{this.version}}): {{this.purpose}}\n{{/each}}\n'
        }
    };
}

const templateRegistry = { ...defaultTemplates() };

export function getArtifactTypes() { return [...ARTIFACT_TYPES]; }

export function registerTemplate(type, templateDef) {
    if (!type) return { success: false, reason: 'Tip zorunlu' };
    templateRegistry[type] = { ...templateDef, type: templateDef.type || type };
    return { success: true, type, registered: true };
}

export function getTemplate(type) {
    return templateRegistry[type] || null;
}

export function listTemplates() {
    return Object.entries(templateRegistry).map(([key, t]) => ({
        type: key,
        label: t.label || key,
        variables: t.variables || []
    }));
}

function resolveVariables(templateDef, context) {
    const resolved = {};
    for (const v of (templateDef.variables || [])) {
        if (context[v] !== undefined) {
            resolved[v] = context[v];
        } else {
            resolved[v] = null;
        }
    }
    return resolved;
}

function renderTemplate(templateStr, variables) {
    let result = templateStr;

    result = result.replace(/\{\{projectName\}\}/g, variables.projectName || 'Proje');
    result = result.replace(/\{\{decisionTitle\}\}/g, variables.decisionTitle || '');
    result = result.replace(/\{\{problemStatement\}\}/g, variables.problemStatement || '');
    result = result.replace(/\{\{selectedOption\}\}/g, variables.selectedOption || '');
    result = result.replace(/\{\{coverage\}\}/g, String(variables.coverage ?? ''));

    result = result.replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, listName, block) => {
        const list = variables[listName];
        if (!Array.isArray(list) || list.length === 0) return '';
        return list.map(item => {
            let itemStr = block;
            itemStr = itemStr.replace(/\{\{this\.(\w+)\}\}/g, (_, prop) => item[prop] !== undefined ? String(item[prop]) : '');
            itemStr = itemStr.replace(/\{\{this\}\}/g, String(item));
            return itemStr;
        }).join('');
    });

    result = result.replace(/{{#each \w+}}[\s\S]*?{{\/each}}/g, '');
    result = result.replace(/\{\{#if ([\s\S]*?)\}\}([\s\S]*?)\{\{\/if\}\}/g, '');
    result = result.replace(/\{\{this\.\w+\}\}/g, '');
    result = result.replace(/\{\{this\}\}/g, '');
    result = result.replace(/{{#each \w+}}/g, '');
    result = result.replace(/{{\/each}}/g, '');

    return result;
}

export function generateArtifact(type, context, options = {}) {
    const templateDef = templateRegistry[type] || templateRegistry.generic;
    if (!templateDef) return { success: false, reason: `Bilinmeyen şablon tipi: ${type}` };

    const variables = resolveVariables(templateDef, context);
    const content = renderTemplate(templateDef.template, variables);

    const artifact = {
        id: options.id || nextArtifactId(),
        uid: `uid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        entityType: 'artifact',
        type,
        label: options.label || templateDef.label || type,
        title: options.title || `${context.projectName || 'Proje'} — ${templateDef.label || type}`,
        description: options.description || `${templateDef.label} otomatik oluşturuldu.`,
        content,
        variables,
        format: options.format || 'markdown',
        status: options.status || 'draft',
        version: options.version || 1,
        revision: options.revision || 0,
        tags: options.tags || [],
        source: options.source || { type: 'auto_generated', sourceId: null, evidenceType: 'direct_fact' },
        sourceModule: options.sourceModule || 'artifact-engine',
        generatedAt: new Date().toISOString(),
        dependencies: options.dependencies || []
    };

    return { success: true, artifact };
}

export function createArtifactVersion(artifact, newContent, revision, changeDescription = '') {
    const versioned = {
        ...artifact,
        content: newContent,
        version: artifact.version + 1,
        previousVersion: artifact.version,
        revision,
        updatedAt: new Date().toISOString(),
        changeDescription,
        history: [
            ...(artifact.history || []),
            {
                version: artifact.version,
                content: artifact.content,
                revision: artifact.revision || revision,
                timestamp: artifact.generatedAt || new Date().toISOString(),
                changeDescription: artifact.changeDescription || 'İlk oluşturma'
            }
        ]
    };
    return versioned;
}

export function buildArtifactContextFromState(state, extra = {}) {
    const ctx = {
        projectName: state.identity?.name || state.identity?.title || 'Proje',
        projectId: state.projectId || null,
        problemStatement: state.identity?.problemStatement || ''
    };

    if (state.objectives) ctx.objectives = state.objectives;
    if (state.domains) ctx.domains = Array.isArray(state.domains) ? state.domains : [];
    if (state.architecture) ctx.components = Array.isArray(state.architecture) ? state.architecture : [];

    if (state.moduleData?.software?.architecture) {
        ctx.components = Array.isArray(state.moduleData.software.architecture)
            ? state.moduleData.software.architecture
            : (ctx.components || []);
    }

    if (state.decisions) {
        ctx.decisions = state.decisions.map(d => ({
            id: d.id, title: d.title, status: d.status,
            selectedOptionId: d.selectedOptionId
        }));
    }

    if (state.risks) {
        ctx.risks = state.risks.map(r => ({
            description: r.description || r.title || '',
            probability: r.probability || 'medium',
            impact: r.impact || 'medium',
            mitigation: r.mitigation || ''
        }));
    }

    if (state.tasks) {
        ctx.tasks = state.tasks.map(t => ({
            id: t.id, title: t.title, status: t.status, phase: t.phase || ''
        }));
    }

    if (state.milestones) ctx.milestones = state.milestones;
    if (state.endpoints) ctx.endpoints = state.endpoints;
    if (state.dependencies) ctx.dependencies = state.dependencies;

    if (state.entityStores) {
        for (const [type, entities] of Object.entries(state.entityStores)) {
            if (Array.isArray(entities) && entities.length > 0 && !ctx[type]) {
                ctx[type] = entities;
            }
        }
    }

    Object.assign(ctx, extra);

    return ctx;
}

export function resolveAllArtifactTemplates() {
    return Object.keys(templateRegistry);
}
