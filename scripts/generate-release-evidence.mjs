import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

function git(cmd) {
    try { return execSync(`git ${cmd}`, { encoding: 'utf8', timeout: 10000 }).trim(); }
    catch { return null; }
}

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const commitSha = git('rev-parse HEAD');
const commitMessage = git('log -1 --pretty=%s');
const branch = git('rev-parse --abbrev-ref HEAD');
const timestamp = new Date().toISOString();
const requiredJobsGreen = process.env.REQUIRED_JOBS_GREEN === 'true';
function listFiles(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? listFiles(path) : [path];
    });
}
const artifactFiles = existsSync('dist') ? listFiles('dist') : [];
const checksums = Object.fromEntries(artifactFiles.map(path => [
    path.replaceAll('\\', '/'),
    createHash('sha256').update(readFileSync(path)).digest('hex')
]));

const evidence = {
    version: packageJson.version,
    timestamp,
    git: { commitSha, commitMessage, branch },
    checks: {
        testAll: requiredJobsGreen,
        typecheck: requiredJobsGreen,
        lint: requiredJobsGreen,
        build: requiredJobsGreen && existsSync('dist/index.html'),
        performanceBudget: requiredJobsGreen,
        versionSync: requiredJobsGreen,
        desktopTest: requiredJobsGreen,
        e2e: requiredJobsGreen,
    },
    artifacts: {
        dist: existsSync('dist'),
        pwa: existsSync('dist/sw.js'),
        sourcemaps: existsSync('dist/assets'),
        checksums,
        signing: process.env.WINDOWS_SIGNED === 'true' ? 'signed' : 'unsigned',
        sbom: existsSync('sbom.cdx.json')
    },
};

const outputPath = new URL('../release-evidence.json', import.meta.url);
writeFileSync(outputPath, JSON.stringify(evidence, null, 2));
console.log(`✓ Release evidence written to release-evidence.json`);
console.log(JSON.stringify(evidence, null, 2));
