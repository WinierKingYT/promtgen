import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CAPABILITY_REGISTRY, getCapability } from '../../src/v4/capability-registry.js';
import { generateDiscoveryBundle } from '../../src/v4/ai-discovery.js';

describe('Product Capability Claims Honesty Audit (Category 1)', () => {
  it('CAPABILITY_REGISTRY defines all core capabilities with honest maturity tags and limitations', () => {
    assert.ok(CAPABILITY_REGISTRY.length >= 5, 'At least 5 core capabilities registered');
    for (const cap of CAPABILITY_REGISTRY) {
      assert.ok(['prototype', 'experimental', 'beta', 'stable'].includes(cap.maturity), `Valid maturity for ${cap.id}`);
      assert.ok(Array.isArray(cap.limitations) && cap.limitations.length > 0, `Limitations declared for ${cap.id}`);
      assert.ok(Array.isArray(cap.evidence) && cap.evidence.length > 0, `Evidence declared for ${cap.id}`);
    }
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
      suggestionBundles: [],
      messages: [],
      decisions: [],
      lifecycle: { activePhase: 'DISCOVERY' }
    };

    const result = await generateDiscoveryBundle(mockProject, { settings: { providerId: 'offline' } });
    assert.ok(result.bundle, 'Bundle generated');
    assert.ok(result.bundle.provenance, 'Provenance metadata present');
    assert.equal(result.bundle.provenance.schemaId, 'discovery-bundle-v1');
    assert.ok(['rule-engine', 'fallback', 'local-ai', 'cloud-ai'].includes(result.bundle.provenance.mode));
  });
});
