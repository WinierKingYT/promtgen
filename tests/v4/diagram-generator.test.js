import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProjectStateV4 } from '../../src/v4/project-state-v4.js';
import { generateArchitectureDiagram, generateDataFlowDiagram } from '../../src/v4/diagram-generator.js';

test('Mermaid.js Sistem Mimarisi Şeması Üretimi (Game Domain)', () => {
    const project = createProjectStateV4({ idea: 'S&box oyun motorunda at sistemi' });
    const arch = generateArchitectureDiagram(project);

    assert.ok(arch.includes('graph TD'));
    assert.ok(arch.includes('subgraph GameEngine'));
    assert.ok(arch.includes('Server Authority'));
});

test('Mermaid.js Sekans / Veri Akış Şeması Üretimi', () => {
    const project = createProjectStateV4({ idea: 'Web uygulaması' });
    const flow = generateDataFlowDiagram(project);

    assert.ok(flow.includes('sequenceDiagram'));
    assert.ok(flow.includes('User->>System'));
});
