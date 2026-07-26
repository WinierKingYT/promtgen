import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProjectDocument } from '../../src/v4/project-document.js';
import { generateArchitectureDiagram, generateDataFlowDiagram } from '../../src/v4/diagram-generator.js';

test('Mermaid.js Sistem Mimarisi Şeması Üretimi (Game Domain)', () => {
    const project = createProjectDocument({ idea: 'S&box oyun motorunda at sistemi' });
    const arch = generateArchitectureDiagram(project);

    assert.ok(arch.includes('graph TD'));
    assert.ok(arch.includes('subgraph EngineRuntime'));
    assert.ok(arch.includes('Server-Authority'));
});

test('Mermaid.js Sekans / Veri Akış Şeması Üretimi', () => {
    const project = createProjectDocument({ idea: 'Web uygulaması' });
    const flow = generateDataFlowDiagram(project);

    assert.ok(flow.includes('sequenceDiagram'));
    assert.ok(flow.includes('User->>System'));
});
