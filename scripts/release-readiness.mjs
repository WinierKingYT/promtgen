import { existsSync, readFileSync } from 'node:fs';

const evidencePath = process.argv[2] || 'release-evidence.json';
if (!existsSync(evidencePath)) {
  console.error(`NO-GO: release evidence not found: ${evidencePath}`);
  process.exit(1);
}
const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
const required = ['testAll', 'typecheck', 'lint', 'build', 'performanceBudget', 'versionSync', 'desktopTest', 'e2e'];
const failed = required.filter(id => evidence.checks?.[id] !== true);
if (!evidence.git?.commitSha) failed.push('commitSha');
if (!evidence.artifacts?.pwa) failed.push('pwaArtifact');
if (process.env.REQUIRE_PRODUCTION_ARTIFACTS === 'true') {
  if (evidence.artifacts?.signing !== 'signed') failed.push('windowsSigning');
  if (!evidence.artifacts?.sbom) failed.push('sbom');
}
if (failed.length) {
  console.error(`NO-GO: missing or failed evidence: ${[...new Set(failed)].join(', ')}`);
  process.exit(1);
}
console.log(`GO: PromtGen ${evidence.version} release evidence is complete for ${evidence.git.commitSha}.`);
