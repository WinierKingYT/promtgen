import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import { validateProjectDocument } from '../../src/v4/project-document.js';
import {
  getDomainAgentCommittee,
  runCommitteeEvaluation,
  runCommitteeVoting
} from '../../src/v4/agent-committee.js';
import { getCapability, evaluateStableEligibility } from '../../src/v4/capability-registry.js';

interface Agent { id: string; name: string; role: string; focus: string }

/**
 * Üretim entegrasyon testi: gerçek planlama motorundan çıkan canonical belge
 * üzerinde uzman perspektiflerinin davranışı doğrulanır.
 */
describe('Expert perspectives production integration', () => {
  const webIdea = 'Küçük ekipler için web tabanlı görev takip dashboard ve REST API yapmak istiyorum';

  it('canonical belge üzerinde çalışır ve belgeyi bozmaz', () => {
    const project = analyzeIdea(webIdea);
    const before = JSON.stringify(project);

    const committee = getDomainAgentCommittee(project) as Agent[];
    runCommitteeEvaluation(project);
    runCommitteeVoting(project);

    assert.equal(JSON.stringify(project), before, 'perspektifler canonical belgeyi değiştirmemeli');
    assert.equal(committee.length, 4);
    assert.equal(validateProjectDocument(project).valid, true);
  });

  it('kanıtsız onay üretmez; kabul edilmiş karar ister', () => {
    const project = analyzeIdea(webIdea) as unknown as { decisions: unknown[] };
    project.decisions = [];
    const voting = runCommitteeVoting(project) as { score: number; votes: Array<{ vote: string }> };

    assert.ok(voting.votes.every(vote => vote.vote !== 'approved'), 'karar yokken onay verilmemeli');
    assert.equal(voting.score, 50);
  });

  it('özel uzman slotu her alanda uygulanır', () => {
    const slot = { id: 'agent-custom', name: 'Alan Uzmanı', role: 'Domain Expert', icon: '🔍', color: '#fff', focus: 'Projeye özel kurallar' };
    const ideas = [
      'S&box oyun fizik sistemi yapmak istiyorum',
      webIdea,
      'mobil ios android uygulama yapmak istiyorum',
      'llm prompt ajan sistemi yapmak istiyorum',
      'bahçe sulama takvimi tutmak istiyorum'
    ];
    for (const idea of ideas) {
      const project = analyzeIdea(idea) as unknown as { customAgentSlot?: unknown };
      const baseline = (getDomainAgentCommittee(project) as Agent[]).length;
      project.customAgentSlot = slot;
      const extended = getDomainAgentCommittee(project) as Agent[];
      assert.equal(extended.length, baseline + 1, `özel uzman eklenmedi: ${idea}`);
      assert.equal(extended.at(-1)?.id, 'agent-custom');
    }
  });

  it('kayıt defterindeki experimental beyanı gerçek davranışla tutarlıdır', () => {
    const capability = getCapability('expert-perspectives');
    assert.ok(capability);
    assert.equal(capability.maturity, 'experimental');
    assert.equal(capability.implementationMode, 'rule-engine');
    assert.ok(
      capability.limitations.some(limitation => /LLM/i.test(limitation)),
      'bağımsız LLM ajanı çalıştırmadığı beyan edilmeli'
    );

    // Beyan dogruysa: cikti senkron olmali, yani Promise donmemeli.
    const project = analyzeIdea(webIdea);
    assert.equal(runCommitteeEvaluation(project) instanceof Promise, false);

    const eligibility = evaluateStableEligibility(capability);
    assert.equal(eligibility.metrics.integrationTests > 0, true);
    assert.equal(eligibility.metrics.scenarioCount >= 5, true);
  });
});
