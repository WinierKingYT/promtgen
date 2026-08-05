import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  CAPABILITY_REGISTRY,
  STABLE_PROMOTION_POLICY,
  commitEvidenceMatches,
  evaluateStableEligibility,
  getCapability,
  type ProductCapability
} from '../../src/v4/capability-registry.js';
import { generateDiscoveryBundle } from '../../src/v4/ai-discovery.js';
import { DISCOVERY_SCHEMA_ID } from '../../src/v4/ai-schemas.js';

describe('Product Capability Claims Honesty Audit (Category 1)', () => {
  it('CAPABILITY_REGISTRY defines all core capabilities with honest maturity tags and limitations', () => {
    assert.ok(CAPABILITY_REGISTRY.length >= 5, 'At least 5 core capabilities registered');
    for (const cap of CAPABILITY_REGISTRY) {
      assert.ok(['prototype', 'experimental', 'beta', 'candidate-stable', 'stable'].includes(cap.maturity), `Valid maturity for ${cap.id}`);
      assert.ok(Array.isArray(cap.limitations) && cap.limitations.length > 0, `Limitations declared for ${cap.id}`);
      assert.ok(Array.isArray(cap.evidence) && cap.evidence.length > 0, `Evidence declared for ${cap.id}`);
      assert.ok(cap.supportedDomains.length > 0, `Supported domains declared for ${cap.id}`);
      if (cap.promotionEvidence.scenarios.source) {
        assert.ok(existsSync(path.resolve(cap.promotionEvidence.scenarios.source)), `Benchmark report exists for ${cap.id}`);
      }
      for (const evidence of cap.evidence) {
        assert.ok(existsSync(path.resolve(evidence.testId)), `Evidence exists for ${cap.id}: ${evidence.testId}`);
      }
      if (cap.maturity === 'stable') {
        // Sürüm bağlamı boyutu burada doğrulanamaz: birim testin commit bağlamı
        // yoktur. Onu CI'da gerçek GITHUB_SHA ile scripts/check-capability-evidence.ts
        // denetler. Burada yeteneğin kendi kanıtı tam olmalıdır.
        const eligibility = evaluateStableEligibility(cap);
        assert.deepEqual(eligibility.capabilityBlockers, [], `Stable capability ${cap.id} passes the evidence gate`);
        for (const platform of cap.platforms) {
          assert.equal(cap.platformMaturity[platform], 'stable', `${cap.id} is stable on ${platform}`);
          assert.ok(cap.evidence.some(item => item.platforms.includes(platform)), `${cap.id} has ${platform} evidence`);
        }
      }
      if (cap.maturity === 'candidate-stable') {
        const eligibility = evaluateStableEligibility(cap);
        assert.equal(eligibility.eligible, false, `${cap.id} remains candidate-stable while evidence is incomplete`);
        // Yetenek boyutunda gerçek bir engel olmalı. Yalnız sürüm bağlamı
        // engeliyle candidate-stable kalmak, kanıt eksikliğini gizlerdi.
        assert.ok(
          eligibility.capabilityBlockers.some(blocker => /benchmark|kullanıcı/i.test(blocker)),
          `${cap.id} exposes benchmark or user evidence blockers`
        );
      }
    }
  });

  it('promotes a candidate only when every stable evidence threshold is met', () => {
    const source = getCapability('canonical-planning');
    assert.ok(source);
    const eligibleCapability: ProductCapability = {
      ...structuredClone(source),
      maturity: 'stable',
      platformMaturity: { web: 'stable', desktop: 'stable' },
      promotionEvidence: {
        scenarios: {
          completed: STABLE_PROMOTION_POLICY.minimumScenarioCount,
          passed: STABLE_PROMOTION_POLICY.minimumScenarioCount,
          source: 'benchmarks/canonical-planning.json'
        },
        users: {
          participants: STABLE_PROMOTION_POLICY.minimumUserParticipants,
          source: 'docs/research/canonical-planning-users.md'
        },
        recovery: { documented: true, path: 'docs/release/rollback.md' },
        criticalKnownDefects: 0,
        lastVerifiedCommit: 'abcdef1',
        lastReviewed: '2026-07-28'
      }
    };
    assert.deepEqual(evaluateStableEligibility(eligibleCapability, {
      currentCommitSha: 'abcdef1234567890',
      verifiedCommitSha: 'abcdef1'
    }).blockers, []);
  });

  it('rejects stale, missing and non-git commit evidence', () => {
    assert.equal(commitEvidenceMatches('abcdef1234567890', 'abcdef1'), true);
    assert.equal(commitEvidenceMatches('abcdef1234567890', '1234567'), false);
    assert.equal(commitEvidenceMatches('abcdef1234567890', 'test-commit'), false);

    const source = getCapability('canonical-planning');
    assert.ok(source);
    const withoutBuildContext = evaluateStableEligibility(source);
    assert.equal(withoutBuildContext.metrics.commitEvidenceCurrent, false);
    assert.ok(withoutBuildContext.blockers.some(blocker => /build\/CI commit/i.test(blocker)));

    const stale = evaluateStableEligibility(source, {
      currentCommitSha: 'abcdef1234567890',
      verifiedCommitSha: '1234567'
    });
    assert.equal(stale.metrics.commitEvidenceCurrent, false);
    assert.ok(stale.blockers.some(blocker => /eşleşmiyor/i.test(blocker)));
  });

  it('separates capability evidence blockers from release context blockers', () => {
    const source = getCapability('canonical-planning');
    assert.ok(source);

    for (const capability of CAPABILITY_REGISTRY) {
      const eligibility = evaluateStableEligibility(capability);
      // blockers, iki boyutun birleşimidir; terfi kararı hiçbir engeli kaybetmez.
      assert.deepEqual(
        eligibility.blockers,
        [...eligibility.capabilityBlockers, ...eligibility.releaseContextBlockers],
        `${capability.id} blockers are the union of both dimensions`
      );
      assert.equal(eligibility.eligible, eligibility.blockers.length === 0);
      // Commit bağlamı verilmediğinde build/CI engeli YALNIZ sürüm boyutunda çıkar.
      // Yetenek boyutuna sızarsa statik belge her yeteneği yanlışlıkla eksik gösterir.
      assert.ok(
        !eligibility.capabilityBlockers.some(blocker => /build\/CI commit|eşleşmiyor/i.test(blocker)),
        `${capability.id} keeps commit context out of capability blockers`
      );
      assert.deepEqual(
        eligibility.releaseContextBlockers,
        ['Güncel build/CI commit bağlamı olmadan Stable kanıtı doğrulanamaz.'],
        `${capability.id} reports the missing build context exactly once`
      );
    }

    // Gerçek commit bağlamı verildiğinde sürüm boyutu temizlenir; yetenek boyutu değişmez.
    const verified = source.promotionEvidence.lastVerifiedCommit || 'abcdef1';
    const withContext = evaluateStableEligibility(source, {
      currentCommitSha: verified,
      verifiedCommitSha: verified
    });
    assert.deepEqual(withContext.releaseContextBlockers, []);
    assert.deepEqual(withContext.capabilityBlockers, evaluateStableEligibility(source).capabilityBlockers);
  });

  it('README public claims map to the registry and avoid forbidden overclaims', () => {
    const readme = readFileSync(path.resolve('README.md'), 'utf8');
    const publicNames = new Set(CAPABILITY_REGISTRY.map(capability => capability.publicName));
    const claimedNames = [...readme.matchAll(/^- \*\*([^*]+)\*\*:/gm)].map(match => match[1]);
    for (const claim of claimedNames.slice(0, 7)) {
      assert.ok(publicNames.has(claim), `README claim is registered: ${claim}`);
    }
    assert.doesNotMatch(readme, /sessiz fallback yapılmaz/i);
    assert.doesNotMatch(readme, /\bmulti-agent\b|\bsecurity scan\b|\bverified executable\b/i);
    assert.match(readme, /Candidate Stable/);
    assert.doesNotMatch(readme, /Kararlı Özellikler \(Stable Capabilities\)/);
  });

  it('keeps optional inventory behind progressive disclosure without overstating it', () => {
    const startScreen = readFileSync(path.resolve('src/react/components/StartScreen.tsx'), 'utf8');
    assert.match(startScreen, /Mevcut bir çalışmayla başla/);
    assert.match(startScreen, /hassas dosyalar filtrelenir/i);
    assert.doesNotMatch(startScreen, /güvenlik taraması|security scan/i);
  });

  it('Expert perspectives capability is marked as experimental rule-engine and declares no LLM agents', () => {
    const cap = getCapability('expert-perspectives');
    assert.ok(cap, 'expert-perspectives capability registered');
    assert.equal(cap?.maturity, 'experimental');
    assert.equal(cap?.implementationMode, 'rule-engine');
    assert.ok(cap?.limitations.some(l => l.includes('LLM ajanları')), 'Declares no LLM agents limitation');
  });

  it('Architecture comparator template declares non-automatic metric computation limitation', () => {
    const cap = getCapability('architecture-comparator-template');
    assert.ok(cap, 'architecture-comparator-template capability registered');
    assert.equal(cap?.implementationMode, 'static-template');
    assert.ok(cap?.limitations.some(l => l.includes('hesaplanmaz')), 'Declares metric initial assumption limitation');
  });

  it('generateDiscoveryBundle attaches valid GenerationProvenance metadata on output', async () => {
    const mockProject: any = {
      identity: { originalIdea: 'Alışkanlık Takipçisi', name: 'Alışkanlık' },
      planningDepth: { selected: 'standard' },
      proposalStore: { bundles: [] },
      messages: [],
      decisions: [],
      lifecycle: { activePhase: 'DISCOVERY' }
    };

    const result = await generateDiscoveryBundle(mockProject, { settings: { providerId: 'offline' } });
    assert.ok(result.bundle, 'Bundle generated');
    assert.ok(result.bundle.provenance, 'Provenance metadata present');
    assert.equal(result.bundle.provenance.schemaId, DISCOVERY_SCHEMA_ID);
    assert.ok(['rule-engine', 'fallback', 'local-ai', 'cloud-ai'].includes(result.bundle.provenance.mode));
  });
});
