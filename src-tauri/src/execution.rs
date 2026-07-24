use rfd::{MessageButtons, MessageDialog, MessageDialogResult, MessageLevel};
use serde::{Deserialize, Serialize};
use std::{collections::{HashMap, HashSet}, fs, path::{Path, PathBuf}, process::Command, sync::{atomic::{AtomicU64, Ordering}, Mutex}, time::{Duration, SystemTime, UNIX_EPOCH}};
use tauri::{AppHandle, Manager, State};
use tokio::{io::AsyncWriteExt, process::Command as AsyncCommand, time::timeout};

const MAX_PROMPT_BYTES: usize = 64 * 1024;
const MAX_OUTPUT_BYTES: usize = 1024 * 1024;
const AGENT_TIMEOUT: Duration = Duration::from_secs(30 * 60);
const ROLE_ORDER: [&str; 4] = ["planner", "implementer", "reviewer", "verifier"];
const CODEX_SETTINGS_SCHEMA: u8 = 1;
static TOKEN_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Clone)]
struct RepositorySelection { root: PathBuf, name: String }

#[derive(Clone)]
struct NativeExecutionSession { repository_root: PathBuf, worktree: PathBuf, codex_program: PathBuf, completed_roles: HashSet<String> }

#[derive(Default)]
pub struct ExecutionState {
    repositories: Mutex<HashMap<String, RepositorySelection>>,
    sessions: Mutex<HashMap<String, NativeExecutionSession>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeCapabilities {
    git_available: bool,
    git_version: String,
    codex_available: bool,
    codex_version: String,
    codex_source: String,
    codex_path: String,
    codex_error: String,
    custom_codex_configured: bool,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CodexSettings { schema_version: u8, executable_path: String }

struct CodexDetection { program: PathBuf, version: String, source: String, display_path: String }

struct CodexProcessResult { success: bool, exit_code: Option<i32>, stdout: Vec<u8>, stderr: Vec<u8>, timed_out: bool }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositorySelectionResult { repository_token: String, display_name: String, branch: String, dirty: bool }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeResult { session_token: String, worktree_label: String }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentStepResult { role: String, risk: String, sandbox: String, success: bool, exit_code: Option<i32>, stdout: String, stderr: String, output_summary: String, started_at: String, completed_at: String, timed_out: bool }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchResult { status: String, stat: String, patch: String, truncated: bool }

fn token(prefix: &str) -> String {
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    let count = TOKEN_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{prefix}-{timestamp}-{count}")
}

fn command_output(program: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new(program).args(args).output().map_err(|error| error.to_string())?;
    if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).trim().to_string()); }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn command_output_path(program: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new(program).args(args).output().map_err(|error| error.to_string())?;
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if error.is_empty() { format!("Komut başarısız oldu: {}", output.status) } else { error });
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn allowed_codex_filename(path: &Path) -> bool {
    path.file_name().and_then(|value| value.to_str()).is_some_and(|name| name.eq_ignore_ascii_case("codex") || name.eq_ignore_ascii_case("codex.exe"))
}

fn codex_settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app.path().app_config_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join("execution-settings.json"))
}

fn load_custom_codex(app: &AppHandle) -> Result<Option<PathBuf>, String> {
    let path = codex_settings_path(app)?;
    if !path.exists() { return Ok(None); }
    let settings: CodexSettings = serde_json::from_slice(&fs::read(path).map_err(|error| error.to_string())?).map_err(|_| "Codex CLI ayar dosyası bozuk.".to_string())?;
    if settings.schema_version != CODEX_SETTINGS_SCHEMA { return Err("Codex CLI ayar sürümü desteklenmiyor.".into()); }
    let executable = PathBuf::from(settings.executable_path).canonicalize().map_err(|_| "Seçili Codex CLI yolu artık kullanılamıyor.".to_string())?;
    if !executable.is_file() || !allowed_codex_filename(&executable) { return Err("Seçili dosya doğrulanmış bir codex/codex.exe değil.".into()); }
    Ok(Some(executable))
}

fn detect_codex(app: &AppHandle) -> Result<Option<CodexDetection>, String> {
    if let Some(program) = load_custom_codex(app)? {
        let version = command_output_path(&program, &["--version"]).map_err(|error| format!("Seçili Codex CLI çalıştırılamadı: {error}"))?;
        let display_path = program.to_string_lossy().to_string();
        return Ok(Some(CodexDetection { program, version, source: "custom".into(), display_path }));
    }
    match command_output("codex", &["--version"]) {
        Ok(version) => Ok(Some(CodexDetection { program: PathBuf::from("codex"), version, source: "path".into(), display_path: "PATH / codex".into() })),
        Err(_) => Ok(None),
    }
}

fn runtime_capabilities(app: &AppHandle) -> RuntimeCapabilities {
    let git = command_output("git", &["--version"]);
    let custom_codex_configured = codex_settings_path(app).map(|path| path.exists()).unwrap_or(false);
    match detect_codex(app) {
        Ok(Some(codex)) => RuntimeCapabilities {
            git_available: git.is_ok(),
            git_version: git.unwrap_or_default(),
            codex_available: true,
            codex_version: codex.version,
            codex_source: codex.source,
            codex_path: codex.display_path,
            codex_error: String::new(),
            custom_codex_configured,
        },
        Ok(None) => RuntimeCapabilities {
            git_available: git.is_ok(),
            git_version: git.unwrap_or_default(),
            codex_available: false,
            codex_version: String::new(),
            codex_source: "missing".into(),
            codex_path: String::new(),
            codex_error: "Codex CLI PATH üzerinde bulunamadı.".into(),
            custom_codex_configured,
        },
        Err(error) => RuntimeCapabilities {
            git_available: git.is_ok(),
            git_version: git.unwrap_or_default(),
            codex_available: false,
            codex_version: String::new(),
            codex_source: "custom".into(),
            codex_path: String::new(),
            codex_error: error,
            custom_codex_configured,
        },
    }
}

fn git_output(root: &PathBuf, args: &[&str]) -> Result<String, String> {
    let mut full_args = vec!["-C", root.to_str().ok_or("Repository yolu UTF-8 değil.")?];
    full_args.extend_from_slice(args);
    command_output("git", &full_args)
}

fn safe_project_label(value: &str) -> String {
    let clean: String = value.chars().filter(|character| character.is_ascii_alphanumeric() || *character == '-' || *character == '_').take(48).collect();
    if clean.is_empty() { "project".into() } else { clean }
}

fn role_policy(role: &str) -> Option<(&'static str, &'static str)> {
    match role { "planner" | "reviewer" => Some(("low", "read-only")), "verifier" => Some(("medium", "read-only")), "implementer" => Some(("high", "workspace-write")), _ => None }
}

fn expected_role(completed: &HashSet<String>) -> Option<&'static str> {
    ROLE_ORDER.iter().find(|role| !completed.contains(**role)).copied()
}

fn approved(title: &str, description: &str) -> bool {
    MessageDialog::new().set_level(MessageLevel::Warning).set_title(title).set_description(description).set_buttons(MessageButtons::YesNo).show() == MessageDialogResult::Yes
}

fn timestamp_string() -> String { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs().to_string() }

fn limited_text(bytes: &[u8]) -> (String, bool) {
    let truncated = bytes.len() > MAX_OUTPUT_BYTES;
    (String::from_utf8_lossy(&bytes[..bytes.len().min(MAX_OUTPUT_BYTES)]).to_string(), truncated)
}

async fn execute_codex_program(program: &Path, worktree: &Path, sandbox: &str, prompt: &str, timeout_after: Duration) -> Result<CodexProcessResult, String> {
    let mut child = AsyncCommand::new(program).args(["exec", "--sandbox", sandbox, "-C"]).arg(worktree).arg("-").current_dir(worktree).kill_on_drop(true).stdin(std::process::Stdio::piped()).stdout(std::process::Stdio::piped()).stderr(std::process::Stdio::piped()).spawn().map_err(|error| format!("Codex CLI başlatılamadı: {error}"))?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(prompt.as_bytes()).await.map_err(|error| error.to_string())?;
        stdin.shutdown().await.map_err(|error| error.to_string())?;
    }
    match timeout(timeout_after, child.wait_with_output()).await {
        Ok(result) => {
            let output = result.map_err(|error| error.to_string())?;
            Ok(CodexProcessResult { success: output.status.success(), exit_code: output.status.code(), stdout: output.stdout, stderr: output.stderr, timed_out: false })
        },
        Err(_) => Ok(CodexProcessResult { success: false, exit_code: None, stdout: Vec::new(), stderr: "Ajan adımı zaman aşımına uğradı.".as_bytes().to_vec(), timed_out: true }),
    }
}

#[tauri::command]
pub fn execution_capabilities(app: AppHandle) -> RuntimeCapabilities {
    runtime_capabilities(&app)
}

#[tauri::command]
pub fn select_codex_cli(app: AppHandle) -> Result<Option<RuntimeCapabilities>, String> {
    let Some(selected) = rfd::FileDialog::new().set_title("Codex CLI çalıştırılabilir dosyasını seç").pick_file() else { return Ok(None); };
    let executable = selected.canonicalize().map_err(|error| error.to_string())?;
    if !executable.is_file() || !allowed_codex_filename(&executable) { return Err("Yalnız codex veya codex.exe adlı çalıştırılabilir dosya seçilebilir.".into()); }
    command_output_path(&executable, &["--version"]).map_err(|error| format!("Seçilen Codex CLI doğrulanamadı: {error}"))?;
    let settings = CodexSettings { schema_version: CODEX_SETTINGS_SCHEMA, executable_path: executable.to_string_lossy().to_string() };
    fs::write(codex_settings_path(&app)?, serde_json::to_vec_pretty(&settings).map_err(|error| error.to_string())?).map_err(|error| error.to_string())?;
    Ok(Some(runtime_capabilities(&app)))
}

#[tauri::command]
pub fn clear_codex_cli(app: AppHandle) -> Result<RuntimeCapabilities, String> {
    let path = codex_settings_path(&app)?;
    if path.exists() { fs::remove_file(path).map_err(|error| error.to_string())?; }
    Ok(runtime_capabilities(&app))
}

#[tauri::command]
pub fn select_execution_repository(state: State<'_, ExecutionState>) -> Result<Option<RepositorySelectionResult>, String> {
    let Some(selected) = rfd::FileDialog::new().set_title("Ajan için Git repository seç").pick_folder() else { return Ok(None); };
    let selected = selected.canonicalize().map_err(|error| error.to_string())?;
    let root_text = git_output(&selected, &["rev-parse", "--show-toplevel"])?;
    let root = PathBuf::from(root_text).canonicalize().map_err(|error| error.to_string())?;
    if root != selected { return Err("Güvenlik için repository kök klasörünü doğrudan seçmelisiniz.".into()); }
    let branch = git_output(&root, &["branch", "--show-current"]).unwrap_or_else(|_| "detached".into());
    let dirty = !git_output(&root, &["status", "--porcelain"]).unwrap_or_default().is_empty();
    let name = root.file_name().unwrap_or_default().to_string_lossy().to_string();
    let repository_token = token("repository");
    state.repositories.lock().map_err(|_| "Repository state kilidi alınamadı.")?.insert(repository_token.clone(), RepositorySelection { root, name: name.clone() });
    Ok(Some(RepositorySelectionResult { repository_token, display_name: name, branch, dirty }))
}

#[tauri::command]
pub fn prepare_execution_worktree(app: AppHandle, state: State<'_, ExecutionState>, repository_token: String, project_id: String) -> Result<WorktreeResult, String> {
    let codex = detect_codex(&app)?.ok_or("Codex CLI bulunamadı. Önce Sistem Doktoru üzerinden doğrulanmış bir Codex CLI seçin.")?;
    let repository = state.repositories.lock().map_err(|_| "Repository state kilidi alınamadı.")?.get(&repository_token).cloned().ok_or("Repository seçimi geçersiz veya süresi dolmuş.")?;
    if !approved("İzole worktree oluşturulsun mu?", &format!("Repository: {}\nRisk: ORTA\nAna çalışma ağacı değiştirilmeyecek; HEAD’den detached worktree oluşturulacak.", repository.name)) { return Err("Kullanıcı worktree oluşturmayı iptal etti.".into()); }
    let parent = app.path().app_local_data_dir().map_err(|error| error.to_string())?.join("execution-worktrees").join(safe_project_label(&project_id));
    fs::create_dir_all(&parent).map_err(|error| error.to_string())?;
    let session_token = token("session");
    let worktree = parent.join(&session_token);
    if worktree.exists() { return Err("Worktree hedefi zaten var.".into()); }
    let repository_text = repository.root.to_str().ok_or("Repository yolu UTF-8 değil.")?;
    let worktree_text = worktree.to_str().ok_or("Worktree yolu UTF-8 değil.")?;
    command_output("git", &["-C", repository_text, "worktree", "add", "--detach", worktree_text, "HEAD"])?;
    state.sessions.lock().map_err(|_| "Execution state kilidi alınamadı.")?.insert(session_token.clone(), NativeExecutionSession { repository_root: repository.root, worktree, codex_program: codex.program, completed_roles: HashSet::new() });
    Ok(WorktreeResult { session_token, worktree_label: format!("{} / isolated", repository.name) })
}

#[tauri::command]
pub async fn run_codex_agent_step(state: State<'_, ExecutionState>, session_token: String, role: String, prompt: String) -> Result<AgentStepResult, String> {
    if prompt.as_bytes().len() > MAX_PROMPT_BYTES { return Err("Ajan promptu 64 KB sınırını aşıyor.".into()); }
    let (risk, sandbox) = role_policy(&role).ok_or("Geçersiz ajan rolü.")?;
    let session = state.sessions.lock().map_err(|_| "Execution state kilidi alınamadı.")?.get(&session_token).cloned().ok_or("Execution session bulunamadı.")?;
    let expected = expected_role(&session.completed_roles).ok_or("Tüm ajan adımları zaten tamamlandı.")?;
    if role != expected { return Err(format!("Sıradaki ajan rolü {expected}.")); }
    let confirmation = format!("Rol: {role}\nRisk: {}\nSandbox: {sandbox}\nWorktree: {}\n\nBu adım yerel Codex CLI ile çalıştırılsın mı?", risk.to_uppercase(), session.worktree.file_name().unwrap_or_default().to_string_lossy());
    if !approved("Ajan adımı onayı", &confirmation) { return Err("Kullanıcı ajan adımını iptal etti.".into()); }
    let started_at = timestamp_string();
    let output = execute_codex_program(&session.codex_program, &session.worktree, sandbox, &prompt, AGENT_TIMEOUT).await?;
    let (stdout, stdout_truncated) = limited_text(&output.stdout); let (stderr, stderr_truncated) = limited_text(&output.stderr);
    let success = output.success;
    if success { state.sessions.lock().map_err(|_| "Execution state kilidi alınamadı.")?.get_mut(&session_token).ok_or("Execution session kayboldu.")?.completed_roles.insert(role.clone()); }
    let summary_source = if stdout.trim().is_empty() { &stderr } else { &stdout };
    let mut output_summary: String = summary_source.chars().take(2000).collect();
    if stdout_truncated || stderr_truncated { output_summary.push_str("\n[Çıktı 1 MB sınırında kesildi]"); }
    Ok(AgentStepResult { role, risk: risk.into(), sandbox: sandbox.into(), success, exit_code: output.exit_code, stdout, stderr, output_summary: if output.timed_out { "Zaman aşımı".into() } else { output_summary }, started_at, completed_at: timestamp_string(), timed_out: output.timed_out })
}

#[tauri::command]
pub fn execution_patch(state: State<'_, ExecutionState>, session_token: String) -> Result<PatchResult, String> {
    let session = state.sessions.lock().map_err(|_| "Execution state kilidi alınamadı.")?.get(&session_token).cloned().ok_or("Execution session bulunamadı.")?;
    let status = git_output(&session.worktree, &["status", "--short"])?;
    let stat = git_output(&session.worktree, &["diff", "--stat", "HEAD"])?;
    let patch_bytes = Command::new("git").arg("-C").arg(&session.worktree).args(["diff", "--binary", "HEAD"]).output().map_err(|error| error.to_string())?.stdout;
    let (patch, truncated) = limited_text(&patch_bytes);
    Ok(PatchResult { status, stat, patch, truncated })
}

#[tauri::command]
pub fn cleanup_execution_worktree(state: State<'_, ExecutionState>, session_token: String) -> Result<(), String> {
    let session = state.sessions.lock().map_err(|_| "Execution state kilidi alınamadı.")?.get(&session_token).cloned().ok_or("Execution session bulunamadı.")?;
    if !approved("İzole worktree kaldırılsın mı?", "Risk: YÜKSEK\nKaydedilmemiş değişiklik varsa Git kaldırmayı reddedecek. --force kullanılmayacak.") { return Err("Kullanıcı worktree kaldırmayı iptal etti.".into()); }
    let repository_text = session.repository_root.to_str().ok_or("Repository yolu UTF-8 değil.")?;
    let worktree_text = session.worktree.to_str().ok_or("Worktree yolu UTF-8 değil.")?;
    command_output("git", &["-C", repository_text, "worktree", "remove", worktree_text])?;
    state.sessions.lock().map_err(|_| "Execution state kilidi alınamadı.")?.remove(&session_token);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new(label: &str) -> Self {
            let path = std::env::temp_dir().join(format!("promtgen-{label}-{}", token("test")));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) { let _ = fs::remove_dir_all(&self.0); }
    }

    fn checked_command(program: &str, args: &[&str], current_dir: &Path) -> String {
        let output = Command::new(program).args(args).current_dir(current_dir).output().unwrap();
        assert!(output.status.success(), "{program} {:?} başarısız: {}", args, String::from_utf8_lossy(&output.stderr));
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    }

    fn build_fake_codex(directory: &Path) -> PathBuf {
        let source = directory.join("fake-codex.rs");
        let executable = directory.join(if cfg!(windows) { "codex.exe" } else { "codex" });
        let mut file = fs::File::create(&source).unwrap();
        file.write_all(br#"
use std::{env, fs, io::{self, Read}};
fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    if args == ["--version"] { println!("codex-cli fake-1.0.0"); return; }
    let mut prompt = String::new();
    io::stdin().read_to_string(&mut prompt).unwrap();
    fs::write("agent-args.txt", args.join("|")).unwrap();
    fs::write("agent-prompt.txt", prompt).unwrap();
    fs::write("plan.txt", "initial\nimplemented by fake codex\n").unwrap();
    println!("fake codex completed");
}
"#).unwrap();
        let output = Command::new("rustc").args(["--edition", "2021"]).arg(&source).arg("-o").arg(&executable).output().unwrap();
        assert!(output.status.success(), "Sahte Codex derlenemedi: {}", String::from_utf8_lossy(&output.stderr));
        executable
    }

    #[test]
    fn execution_roles_have_fixed_sandbox_and_risk() {
        assert_eq!(role_policy("planner"), Some(("low", "read-only")));
        assert_eq!(role_policy("implementer"), Some(("high", "workspace-write")));
        assert_eq!(role_policy("shell"), None);
    }

    #[test]
    fn execution_role_order_cannot_be_skipped() {
        let mut completed = HashSet::new();
        assert_eq!(expected_role(&completed), Some("planner"));
        completed.insert("planner".into());
        assert_eq!(expected_role(&completed), Some("implementer"));
    }

    #[test]
    fn project_labels_are_path_safe() {
        assert_eq!(safe_project_label("../demo project!"), "demoproject");
        assert_eq!(safe_project_label(""), "project");
    }

    #[test]
    fn codex_selection_only_accepts_expected_executable_names() {
        assert!(allowed_codex_filename(Path::new("C:/tools/codex.exe")));
        assert!(allowed_codex_filename(Path::new("/usr/local/bin/codex")));
        assert!(!allowed_codex_filename(Path::new("C:/tools/powershell.exe")));
        assert!(!allowed_codex_filename(Path::new("codex-wrapper.cmd")));
    }

    #[test]
    fn native_codex_worktree_and_patch_flow_runs_end_to_end() {
        if command_output("git", &["--version"]).is_err() { eprintln!("Git bulunamadı; native E2E testi atlandı."); return; }
        let temporary = TestDirectory::new("native-e2e");
        let repository = temporary.0.join("repository");
        let worktree = temporary.0.join("worktree");
        let tools = temporary.0.join("tools");
        fs::create_dir_all(&repository).unwrap();
        fs::create_dir_all(&tools).unwrap();
        checked_command("git", &["init"], &repository);
        checked_command("git", &["config", "user.email", "promtgen-test@example.invalid"], &repository);
        checked_command("git", &["config", "user.name", "PromtGen Test"], &repository);
        fs::write(repository.join("plan.txt"), "initial\n").unwrap();
        checked_command("git", &["add", "plan.txt"], &repository);
        checked_command("git", &["commit", "-m", "initial"], &repository);
        let worktree_text = worktree.to_str().unwrap();
        checked_command("git", &["worktree", "add", "--detach", worktree_text, "HEAD"], &repository);

        let fake_codex = build_fake_codex(&tools);
        assert!(allowed_codex_filename(&fake_codex));
        assert_eq!(command_output_path(&fake_codex, &["--version"]).unwrap(), "codex-cli fake-1.0.0");
        let prompt = "# IMPLEMENTER\nSadece atanmış worktree içinde plan.txt dosyasını güncelle.";
        let runtime = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        let result = runtime.block_on(execute_codex_program(&fake_codex, &worktree, "workspace-write", prompt, Duration::from_secs(10))).unwrap();

        assert!(result.success);
        assert!(!result.timed_out);
        assert_eq!(result.exit_code, Some(0));
        assert!(String::from_utf8_lossy(&result.stdout).contains("fake codex completed"));
        let recorded_args = fs::read_to_string(worktree.join("agent-args.txt")).unwrap();
        assert!(recorded_args.starts_with("exec|--sandbox|workspace-write|-C|"));
        assert!(recorded_args.ends_with("|-"));
        assert_eq!(fs::read_to_string(worktree.join("agent-prompt.txt")).unwrap(), prompt);
        let status = checked_command("git", &["status", "--short"], &worktree);
        let patch = checked_command("git", &["diff", "--binary", "HEAD"], &worktree);
        assert!(status.contains("M plan.txt"));
        assert!(status.contains("?? agent-args.txt"));
        assert!(patch.contains("+implemented by fake codex"));
    }
}
