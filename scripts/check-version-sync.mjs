import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const packageVersion = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')).version;
const tauriVersion = JSON.parse(readFileSync(new URL('src-tauri/tauri.conf.json', root), 'utf8')).version;
const cargo = readFileSync(new URL('src-tauri/Cargo.toml', root), 'utf8');
const cargoVersion = cargo.match(/^\s*version\s*=\s*"([^"]+)"/m)?.[1];
const versions = { packageVersion, tauriVersion, cargoVersion };

if (!cargoVersion || new Set(Object.values(versions)).size !== 1) {
  console.error(`Version mismatch: ${JSON.stringify(versions)}`);
  process.exit(1);
}
console.log(`Version sync OK: ${packageVersion}`);
