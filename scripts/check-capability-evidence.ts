import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import {
  CAPABILITY_REGISTRY,
  commitEvidenceMatches,
  evaluateStableEligibility
} from '../src/v4/capability-registry.js';

interface ReleaseEvidence {
  git?: { commitSha?: string; dirty?: boolean };
}

const evidencePath = process.argv[2] || 'release-evidence.json';
const evidence = JSON.parse(readFileSync(evidencePath, 'utf8')) as ReleaseEvidence;
const currentCommitSha = process.env.GITHUB_SHA
  || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const verifiedCommitSha = evidence.git?.commitSha || '';

if (evidence.git?.dirty !== false) {
  throw new Error('Capability kanıtı temiz bir Git çalışma ağacında üretilmelidir.');
}

if (!commitEvidenceMatches(currentCommitSha, verifiedCommitSha)) {
  throw new Error(`Release kanıtı güncel commit'e ait değil (kanıt: ${verifiedCommitSha || 'yok'}, güncel: ${currentCommitSha}).`);
}

const failures = CAPABILITY_REGISTRY
  .filter(capability => capability.maturity === 'stable')
  .map(capability => ({
    capability,
    result: evaluateStableEligibility(capability, { currentCommitSha, verifiedCommitSha })
  }))
  .filter(({ result }) => !result.eligible);

if (failures.length > 0) {
  for (const { capability, result } of failures) {
    console.error(`${capability.id}: ${result.blockers.join(' ')}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Capability kanıtı güncel commit ile eşleşiyor: ${currentCommitSha}`);
}
