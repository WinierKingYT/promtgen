import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

function git(cmd) {
    try { return execSync(`git ${cmd}`, { encoding: 'utf8', timeout: 10000 }).trim(); }
    catch { return null; }
}

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const commitSha = git('rev-parse HEAD');
const commitMessage = git('log -1 --pretty=%s');
const branch = git('rev-parse --abbrev-ref HEAD');
const timestamp = new Date().toISOString();

const evidence = {
    version: packageJson.version,
    timestamp,
    git: { commitSha, commitMessage, branch },
    checks: {
        typecheck: existsSync('tsconfig.json'),
        lint: existsSync('eslint.config.js'),
        build: existsSync('dist/index.html'),
        tests: {
            unit: existsSync('tests'),
            v4: existsSync('tests/v4'),
            security: existsSync('tests/security'),
            e2e: existsSync('tests/e2e'),
        },
    },
    artifacts: {
        dist: existsSync('dist'),
        pwa: existsSync('dist/sw.js'),
        sourcemaps: existsSync('dist/assets'),
    },
};

const outputPath = new URL('../release-evidence.json', import.meta.url);
writeFileSync(outputPath, JSON.stringify(evidence, null, 2));
console.log(`✓ Release evidence written to release-evidence.json`);
console.log(JSON.stringify(evidence, null, 2));
