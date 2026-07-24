import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clearCodexCli, selectCodexCli } from '../../src/v4/desktop-execution.js';

const rust = readFileSync(new URL('../../src-tauri/src/execution.rs', import.meta.url), 'utf8');

assert.equal(typeof selectCodexCli, 'function');
assert.equal(typeof clearCodexCli, 'function');
assert.equal(selectCodexCli.length, 0, 'Frontend serbest executable yolu gönderememeli.');
assert.equal(clearCodexCli.length, 0);
assert.match(rust, /pick_file\(\)/, 'Executable native dosya seçiciyle seçilmeli.');
assert.match(rust, /allowed_codex_filename\(&executable\)/, 'Seçilen dosyanın adı native sınırda doğrulanmalı.');
assert.match(rust, /command_output_path\(&executable, &\["--version"\]\)/, 'Seçilen CLI kaydedilmeden önce çalıştırılmalı.');
assert.match(rust, /codex_program: PathBuf/, 'Doğrulanmış executable execution session içinde sabitlenmeli.');
assert.match(rust, /execute_codex_program\(&session\.codex_program, &session\.worktree/, 'Ajan adımı session’a sabitlenmiş executable kullanmalı.');
assert.match(rust, /AsyncCommand::new\(program\)/, 'Process sınırı yalnız native katmanın verdiği executable’ı çalıştırmalı.');
assert.match(rust, /native_codex_worktree_and_patch_flow_runs_end_to_end/, 'Gerçek process ve Git worktree E2E testi korunmalı.');
assert.doesNotMatch(rust, /run_codex_agent_step\([^)]*codex_(?:path|program)/s, 'Ajan çağrısı frontend’den executable yolu kabul etmemeli.');

console.log('✓ V4 secure Codex CLI selection boundary');
