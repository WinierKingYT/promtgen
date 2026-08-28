import assert from 'node:assert/strict';
import { analyzeIdea, applyIdeaExpansion } from '../../src/v4/planning-engine.js';
import { buildLocalPlanningMemory, hasUsefulPlanningMemory } from '../../src/v4/planning-memory.js';

function rememberedProject(idea, id, depth) {
    let project = analyzeIdea(idea);
    // If short idea landed in IDEA_EXPANSION, promote it so proposal bundles exist
    if (project.lifecycle.activePhase === 'IDEA_EXPANSION') {
        project = applyIdeaExpansion(project, { answers: {}, dimensions: [] });
    }
    project.id = id;
    project.planningDepth.selected = depth;
    project.modules.active = [{ id: 'software.core', version: '1.0.0', enabledAtRevision: project.canonicalRevision }];
    project.decisions = [{ id: `decision-${id}`, title: 'Yerel veri stratejisi', decision: 'Cihazda tut', rationale: '', status: 'accepted', sourceSuggestionIds: [], affectedSectionIds: ['architecture'] }];
    project.proposalStore.bundles[0].items[0].status = 'accepted';
    project.proposalStore.bundles[0].items[1].status = 'rejected';
    return project;
}

const first = rememberedProject('Gizli müşteri alfa projesi', 'memory-1', 'advanced');
const second = rememberedProject('Çok özel beta projesi', 'memory-2', 'advanced');
const current = rememberedProject('Yeni proje', 'current', 'quick');

// Only `second` has this decision, so its theme appears exactly once across the
// remembered (non-excluded) projects — it must be dropped by the `count >= 2`
// recurring-theme threshold, unlike 'Yerel veri stratejisi' which appears twice.
second.decisions.push({ id: 'decision-memory-2-unique', title: 'Tek seferlik özel karar', decision: 'Yalnızca bu projede', rationale: '', status: 'accepted', sourceSuggestionIds: [], affectedSectionIds: ['architecture'] });

const memory = buildLocalPlanningMemory([first, second, current], current.id);

assert.equal(memory.sourceProjectCount, 2);
assert.deepEqual(memory.depthAffinity[0], { id: 'advanced', count: 2 });
// Depths with zero occurrences (standard, enterprise, and the excluded-project-only
// 'quick') must be dropped, not just outranked — pins the `item.count > 0` filter.
assert.equal(memory.depthAffinity.length, 1, 'Sıfır sayımlı derinlikler depthAffinity dışında kalır');
assert.deepEqual(memory.moduleAffinity[0], { id: 'software.core', count: 2 });
assert.deepEqual(memory.recurringDecisionThemes[0], { id: 'yerel-veri-stratejisi', count: 2 });
assert.equal(memory.recurringDecisionThemes.length, 1, 'Yalnızca bir projede geçen tema (count < 2) tekrarlayan temalarda görünmez');
assert.ok(memory.acceptedSuggestionKinds.some(item => item.id === 'feature' && item.count === 2));
assert.ok(memory.rejectedSuggestionKinds.some(item => item.id === 'decision' && item.count === 2));
// Accepted suggestion item[0] ('feature') carries affectedSections ['vision', 'scope',
// 'requirements'] in both remembered projects; sectionAffinity was never asserted before.
assert.ok(memory.sectionAffinity.some(item => item.id === 'vision' && item.count === 2), 'sectionAffinity kabul edilen önerinin etkilediği bölümleri sayar');
assert.ok(!JSON.stringify(memory).includes('Gizli müşteri'));
assert.ok(!JSON.stringify(memory).includes('Çok özel beta'));
assert.equal(hasUsefulPlanningMemory(memory), true);
assert.equal(hasUsefulPlanningMemory(buildLocalPlanningMemory([], '')), false);
// sourceProjectCount alone is not "useful" — every affinity list must also be empty
// for this branch; pins the OR-of-lengths check, not just the leading count guard.
assert.equal(hasUsefulPlanningMemory({ version: 1, sourceProjectCount: 3, depthAffinity: [], moduleAffinity: [], acceptedSuggestionKinds: [], rejectedSuggestionKinds: [], sectionAffinity: [], recurringDecisionThemes: [] }), false, 'Kaynak proje sayısı olsa da hiçbir eğilim yoksa faydasız sayılır');
assert.equal(hasUsefulPlanningMemory(null), false);
assert.equal(hasUsefulPlanningMemory(undefined), false);

console.log('✓ V4 privacy-limited local planning memory');
