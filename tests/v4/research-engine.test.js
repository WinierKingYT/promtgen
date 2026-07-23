import assert from 'node:assert/strict';
import { createProjectStateV4 } from '../../src/v4/project-state-v4.js';
import { addApprovedEvidence, applyResearchAgenda, inferSourceType, proposeResearchAgenda, validateResearchUrl } from '../../src/v4/research-engine.js';
import { analyzeCanonicalTraceability } from '../../src/v4/canonical-graph.js';
import { createDocumentSet } from '../../src/v4/exporter.js';

const project = createProjectStateV4({ idea: 'Güvenli yerel planlama uygulaması', planningDepth: { recommended: 'advanced', selected: 'advanced', overridden: false, rationale: 'test', signals: { score: 8, features: 3, integrations: 1, sensitiveData: true, multiPlatform: true, scaleIntent: false, uncertainty: 2 } } });
const agenda = proposeResearchAgenda(project);
assert.equal(agenda.optional, true);
assert.ok(agenda.questions.length >= 2);
assert.equal(applyResearchAgenda(project, agenda).success, false);
const agendaResult = applyResearchAgenda(project, agenda, { approvedQuestionIds: [agenda.questions[0].id] });
assert.equal(agendaResult.success, true);
assert.equal(agendaResult.project.researchQuestions[0].status, 'active');
assert.equal(validateResearchUrl('http://example.com').valid, false);
assert.equal(validateResearchUrl('https://user:pass@example.com').valid, false);
assert.equal(inferSourceType('https://www.rfc-editor.org/rfc/rfc9110'), 'primary');

const waiting = addApprovedEvidence(agendaResult.project, { questionId: agenda.questions[0].id, url: 'https://www.rfc-editor.org/rfc/rfc9110', title: 'RFC 9110', claim: 'HTTP davranışı standartta tanımlanır', summary: 'Uygulama HTTP semantiğini standartla uyumlu ele almalı.' });
assert.equal(waiting.success, false);
const accepted = addApprovedEvidence(agendaResult.project, { questionId: agenda.questions[0].id, url: 'https://www.rfc-editor.org/rfc/rfc9110#section-9', title: 'RFC 9110', publisher: 'IETF', claim: 'HTTP davranışı standartta tanımlanır', summary: 'Uygulama HTTP semantiğini standartla uyumlu ele almalı.', confidence: 'high' }, { approved: true });
assert.equal(accepted.success, true);
assert.equal(accepted.source.sourceType, 'primary');
assert.equal(accepted.project.researchQuestions[0].status, 'answered');
assert.equal(analyzeCanonicalTraceability(accepted.project).engine.getStats().totalEdges, 2);
assert.ok(createDocumentSet(accepted.project)['documents/research.md'].includes('RFC 9110'));
console.log('✓ V4 opt-in research and evidence ledger');
