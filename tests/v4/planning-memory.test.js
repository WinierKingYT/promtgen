import assert from 'node:assert/strict';
import { analyzeIdea, applyIdeaExpansion } from '../../src/v4/planning-engine.js';
import { buildLocalPlanningMemory, hasUsefulPlanningMemory } from '../../src/v4/planning-memory.js';

function rememberedProject(idea, id, depth) {
    let project = analyzeIdea(idea);
    // If short idea landed in IDEA_EXPANSION, promote it so suggestionBundles exist
    if (project.lifecycle.activePhase === 'IDEA_EXPANSION') {
        project = applyIdeaExpansion(project, { answers: {}, dimensions: [] });
    }
    project.id = id;
    project.planningDepth.selected = depth;
    project.modules.active = [{ id: 'software.core', version: '1.0.0', enabledAtRevision: project.revision }];
    project.decisions = [{ id: `decision-${id}`, title: 'Yerel veri stratejisi', decision: 'Cihazda tut', rationale: '', status: 'accepted', sourceSuggestionIds: [], affectedSectionIds: ['architecture'] }];
    project.suggestionBundles[0].items[0].status = 'accepted';
    project.suggestionBundles[0].items[1].status = 'rejected';
    return project;
}

const first = rememberedProject('Gizli müşteri alfa projesi', 'memory-1', 'advanced');
const second = rememberedProject('Çok özel beta projesi', 'memory-2', 'advanced');
const current = rememberedProject('Yeni proje', 'current', 'quick');

const memory = buildLocalPlanningMemory([first, second, current], current.id);

assert.equal(memory.sourceProjectCount, 2);
assert.deepEqual(memory.depthAffinity[0], { id: 'advanced', count: 2 });
assert.deepEqual(memory.moduleAffinity[0], { id: 'software.core', count: 2 });
assert.deepEqual(memory.recurringDecisionThemes[0], { id: 'yerel-veri-stratejisi', count: 2 });
assert.ok(memory.acceptedSuggestionKinds.some(item => item.id === 'feature' && item.count === 2));
assert.ok(memory.rejectedSuggestionKinds.some(item => item.id === 'decision' && item.count === 2));
assert.ok(!JSON.stringify(memory).includes('Gizli müşteri'));
assert.ok(!JSON.stringify(memory).includes('Çok özel beta'));
assert.equal(hasUsefulPlanningMemory(memory), true);
assert.equal(hasUsefulPlanningMemory(buildLocalPlanningMemory([], '')), false);

console.log('✓ V4 privacy-limited local planning memory');
