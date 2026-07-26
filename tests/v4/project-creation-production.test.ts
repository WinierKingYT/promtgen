import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import { prepareInitialProject } from '../../src/v4/application/project-creation-service.js';

describe('Production project creation routing', () => {
  it('keeps a short idea in IDEA_EXPANSION without calling Idea Lab', async () => {
    const project = analyzeIdea('At sistemi');
    let ideaLabCalls = 0;
    const result = await prepareInitialProject({
      project,
      generateIdeaLab: async candidate => {
        ideaLabCalls += 1;
        return { project: candidate };
      }
    });

    assert.equal(result.project.lifecycle.activePhase, 'IDEA_EXPANSION');
    assert.equal(result.ideaLabGenerated, false);
    assert.equal(ideaLabCalls, 0);
  });

  it('runs Idea Lab for a routed rich idea and records the resulting revision', async () => {
    const project = analyzeIdea('Web SaaS admin paneli, kullanıcı rolleri, ödeme API entegrasyonu ve çevrimdışı mobil kullanım');
    const result = await prepareInitialProject({
      project,
      generateIdeaLab: async candidate => ({
        project: { ...candidate, lifecycle: { ...candidate.lifecycle, activePhase: 'IDEA_LAB' } }
      })
    });

    assert.equal(result.ideaLabGenerated, true);
    assert.equal(result.project.lifecycle.activePhase, 'IDEA_LAB');
    assert.ok(result.project.revisions.length > 0);
  });
});
