use rfd::{MessageButtons, MessageDialog, MessageDialogResult, MessageLevel};
use serde::Serialize;
use std::{collections::{HashMap, HashSet}, fs, path::PathBuf, process::Command, sync::{atomic::{AtomicU64, Ordering}, Mutex}, time::{Duration, SystemTime, UNIX_EPOCH}};
use tauri::{AppHandle, Manager, State};
use tokio::{io::AsyncWriteExt, process::Command as AsyncCommand, time::timeout};

const MAX_PROMPT_BYTES: usize = 64 * 1024;
const MAX_OUTPUT_BYTES: usize = 1024 * 1024;
const AGENT_TIMEOUT: Duration = Duration::from_secs(30 * 60);
const ROLE_ORDER: [&str; 4] = ["planner", "implementer", "reviewer", "verifier"];
static TOKEN_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Clone)]
struct RepositorySelection { root: PathBuf, name: String }

#[derive(Clone)]
struct NativeExecutionSession { repository_root: PathBuf, worktree: PathBuf, completed_roles: HashSet<String> }

#[derive(Default)]
pub struct ExecutionState {
    repositories: Mutex<HashMap<String, RepositorySelection>>,
    sessions: Mutex<HashMap<String, NativeExecutionSession>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeCapabilities { git_available: bool, git_version: String, codex_available: bool, codex_version: String }

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

#[tauri::command]
pub fn execution_capabilities() -> RuntimeCapabilities {
    let git = command_output("git", &["--version"]);
    let codex = command_output("codex", &["--version"]);
    RuntimeCapabilities { git_available: git.is_ok(), git_version: git.unwrap_or_default(), codex_available: codex.is_ok(), codex_version: codex.unwrap_or_default() }
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
    state.sessions.lock().map_err(|_| "Execution state kilidi alınamadı.")?.insert(session_token.clone(), NativeExecutionSession { repository_root: repository.root, worktree, completed_roles: HashSet::new() });
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
    let mut child = AsyncCommand::new("codex").args(["exec", "--sandbox", sandbox, "-C"]).arg(&session.worktree).arg("-").current_dir(&session.worktree).kill_on_drop(true).stdin(std::process::Stdio::piped()).stdout(std::process::Stdio::piped()).stderr(std::process::Stdio::piped()).spawn().map_err(|error| format!("Codex CLI başlatılamadı: {error}"))?;
    if let Some(mut stdin) = child.stdin.take() { stdin.write_all(prompt.as_bytes()).await.map_err(|error| error.to_string())?; stdin.shutdown().await.map_err(|error| error.to_string())?; }
    let output = match timeout(AGENT_TIMEOUT, child.wait_with_output()).await {
        Ok(result) => result.map_err(|error| error.to_string())?,
        Err(_) => return Ok(AgentStepResult { role, risk: risk.into(), sandbox: sandbox.into(), success: false, exit_code: None, stdout: String::new(), stderr: "Ajan adımı 30 dakika zaman aşımına uğradı.".into(), output_summary: "Zaman aşımı".into(), started_at, completed_at: timestamp_string(), timed_out: true })
    };
    let (stdout, stdout_truncated) = limited_text(&output.stdout); let (stderr, stderr_truncated) = limited_text(&output.stderr);
    let success = output.status.success();
    if success { state.sessions.lock().map_err(|_| "Execution state kilidi alınamadı.")?.get_mut(&session_token).ok_or("Execution session kayboldu.")?.completed_roles.insert(role.clone()); }
    let summary_source = if stdout.trim().is_empty() { &stderr } else { &stdout };
    let mut output_summary: String = summary_source.chars().take(2000).collect();
    if stdout_truncated || stderr_truncated { output_summary.push_str("\n[Çıktı 1 MB sınırında kesildi]"); }
    Ok(AgentStepResult { role, risk: risk.into(), sandbox: sandbox.into(), success, exit_code: output.status.code(), stdout, stderr, output_summary, started_at, completed_at: timestamp_string(), timed_out: false })
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
}
