use rusqlite::{params, Connection};
use serde::Serialize;
use std::{collections::{HashMap, HashSet}, fs, path::{Path, PathBuf}};
use tauri::{AppHandle, Manager};

mod execution;

const MAX_PROJECT_FILES: usize = 5_000;
const MAX_PROJECT_BYTES: u64 = 100 * 1024 * 1024;
const MAX_PROJECT_DEPTH: usize = 30;
const MAX_PROJECT_DOCUMENT_BYTES: usize = 10 * 1024 * 1024;
const MAX_PROJECT_BACKUPS: i64 = 20;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeInventoryEntry {
    path: String,
    name: String,
    extension: String,
    size: u64,
    kind: String,
    secret_detected: bool,
    injection_detected: bool,
    line_count: Option<usize>,
}

#[derive(Serialize)]
struct NativeLanguage { name: String, files: usize }

#[derive(Serialize)]
struct NativeTotals { selected: usize, included: usize, excluded: usize, bytes: u64 }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeSecurity { secret_files: Vec<String>, injection_files: Vec<String> }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeInventoryReport {
    version: u8,
    analyzed_at: String,
    source: String,
    root_name: String,
    totals: NativeTotals,
    languages: Vec<NativeLanguage>,
    frameworks: Vec<String>,
    manifests: Vec<String>,
    script_names: Vec<String>,
    security: NativeSecurity,
    inventory: Vec<NativeInventoryEntry>,
    excluded: Vec<serde_json::Value>,
}

fn ignored_directory(name: &str) -> bool {
    matches!(name.to_ascii_lowercase().as_str(), ".git" | ".svn" | ".hg" | "node_modules" | "dist" | "build" | "target" | "coverage" | ".next" | ".nuxt" | ".cache" | "vendor")
}

fn sensitive_or_hidden(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    (lower.starts_with('.') && lower != ".github") || matches!(lower.as_str(), "credentials" | "credentials.json" | "secrets.json" | "id_rsa" | "id_ed25519") || lower.ends_with(".pem") || lower.ends_with(".key")
}

fn language_for_extension(extension: &str) -> Option<&'static str> {
    match extension {
        "js" | "mjs" | "cjs" | "jsx" => Some("JavaScript"), "ts" | "tsx" => Some("TypeScript"),
        "py" => Some("Python"), "rb" => Some("Ruby"), "php" => Some("PHP"), "java" => Some("Java"),
        "kt" | "kts" => Some("Kotlin"), "go" => Some("Go"), "rs" => Some("Rust"), "cs" => Some("C#"),
        "cpp" | "hpp" => Some("C++"), "c" | "h" => Some("C/C++"), "swift" => Some("Swift"),
        "dart" => Some("Dart"), "vue" => Some("Vue"), "svelte" => Some("Svelte"), "html" => Some("HTML"),
        "css" => Some("CSS"), "scss" => Some("SCSS"), "sql" => Some("SQL"), _ => None,
    }
}

fn is_text_extension(extension: &str) -> bool {
    matches!(extension, "js" | "mjs" | "cjs" | "jsx" | "ts" | "tsx" | "vue" | "svelte" | "py" | "rb" | "php" | "java" | "kt" | "kts" | "go" | "rs" | "cs" | "cpp" | "c" | "h" | "hpp" | "swift" | "dart" | "html" | "css" | "scss" | "less" | "sql" | "graphql" | "md" | "txt" | "json" | "jsonc" | "yaml" | "yml" | "toml" | "xml" | "ini" | "cfg" | "sh" | "ps1" | "bat")
}

fn manifest_kind(name: &str) -> Option<&'static str> {
    match name.to_ascii_lowercase().as_str() {
        "package.json" => Some("Node.js"), "cargo.toml" => Some("Rust"), "pyproject.toml" | "requirements.txt" => Some("Python"),
        "go.mod" => Some("Go"), "pom.xml" => Some("Java/Maven"), "build.gradle" => Some("Java/Gradle"),
        "build.gradle.kts" => Some("Kotlin/Gradle"), "composer.json" => Some("PHP"), "gemfile" => Some("Ruby"),
        "pubspec.yaml" => Some("Dart/Flutter"), "dockerfile" => Some("Docker"), "docker-compose.yml" => Some("Docker Compose"), _ => None,
    }
}

fn package_signals(path: &Path, frameworks: &mut HashSet<String>, scripts: &mut HashSet<String>) {
    let Ok(metadata) = fs::metadata(path) else { return; };
    if metadata.len() > 256 * 1024 { return; }
    let Ok(content) = fs::read_to_string(path) else { return; };
    let Ok(value) = serde_json::from_str::<serde_json::Value>(&content) else { return; };
    for section in ["dependencies", "devDependencies"] {
        if let Some(entries) = value.get(section).and_then(|item| item.as_object()) {
            for name in entries.keys() {
                if matches!(name.as_str(), "react" | "vue" | "svelte" | "next" | "nuxt" | "vite" | "electron" | "@tauri-apps/api") { frameworks.insert(name.clone()); }
            }
        }
    }
    if let Some(entries) = value.get("scripts").and_then(|item| item.as_object()) {
        for name in entries.keys().take(30) { scripts.insert(name.clone()); }
    }
}

fn inventory_folder(root: &Path) -> Result<NativeInventoryReport, String> {
    let root = root.canonicalize().map_err(|error| error.to_string())?;
    if !root.is_dir() { return Err("Seçilen yol klasör değil.".into()); }
    let mut stack = vec![(root.clone(), 0usize)];
    let mut inventory = Vec::new(); let mut excluded = Vec::new(); let mut total_bytes = 0u64; let mut selected = 0usize;
    let mut languages: HashMap<String, usize> = HashMap::new(); let mut manifests = HashSet::new();
    let mut frameworks = HashSet::new(); let mut script_names = HashSet::new();
    while let Some((directory, depth)) = stack.pop() {
        if depth > MAX_PROJECT_DEPTH { continue; }
        let entries = fs::read_dir(&directory).map_err(|error| error.to_string())?;
        for entry in entries.flatten() {
            let path = entry.path(); let name = entry.file_name().to_string_lossy().to_string();
            let Ok(file_type) = entry.file_type() else { continue; };
            if file_type.is_symlink() { excluded.push(serde_json::json!({"path": name, "reason": "symlink"})); continue; }
            if file_type.is_dir() {
                if ignored_directory(&name) || sensitive_or_hidden(&name) { excluded.push(serde_json::json!({"path": name, "reason": "ignored_directory"})); }
                else { stack.push((path, depth + 1)); }
                continue;
            }
            selected += 1;
            let relative = path.strip_prefix(&root).map_err(|error| error.to_string())?.to_string_lossy().replace('\\', "/");
            if sensitive_or_hidden(&name) { excluded.push(serde_json::json!({"path": relative, "reason": "sensitive_or_hidden"})); continue; }
            if inventory.len() >= MAX_PROJECT_FILES { excluded.push(serde_json::json!({"path": relative, "reason": "file_limit"})); continue; }
            let size = entry.metadata().map(|value| value.len()).unwrap_or(0);
            if total_bytes + size > MAX_PROJECT_BYTES { excluded.push(serde_json::json!({"path": relative, "reason": "total_size_limit"})); continue; }
            total_bytes += size;
            let extension = path.extension().map(|value| value.to_string_lossy().to_ascii_lowercase()).unwrap_or_default();
            if let Some(language) = language_for_extension(&extension) { *languages.entry(language.into()).or_default() += 1; }
            if let Some(kind) = manifest_kind(&name) { manifests.insert(kind.to_string()); }
            if name.eq_ignore_ascii_case("package.json") { package_signals(&path, &mut frameworks, &mut script_names); }
            inventory.push(NativeInventoryEntry { path: relative, name, extension: extension.clone(), size, kind: if is_text_extension(&extension) { "text".into() } else { "metadata".into() }, secret_detected: false, injection_detected: false, line_count: None });
        }
    }
    let mut language_list: Vec<_> = languages.into_iter().map(|(name, files)| NativeLanguage { name, files }).collect();
    language_list.sort_by(|a, b| b.files.cmp(&a.files));
    Ok(NativeInventoryReport {
        version: 1, analyzed_at: format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()),
        source: "desktop-folder".into(), root_name: root.file_name().unwrap_or_default().to_string_lossy().to_string(),
        totals: NativeTotals { selected, included: inventory.len(), excluded: excluded.len(), bytes: total_bytes },
        languages: language_list, frameworks: frameworks.into_iter().collect(), manifests: manifests.into_iter().collect(), script_names: script_names.into_iter().collect(),
        security: NativeSecurity { secret_files: Vec::new(), injection_files: Vec::new() }, inventory, excluded,
    })
}

#[tauri::command]
fn select_and_inventory_project_folder() -> Result<Option<NativeInventoryReport>, String> {
    match rfd::FileDialog::new().set_title("PromtGen için proje klasörünü seç").pick_folder() {
        Some(path) => inventory_folder(&path).map(Some), None => Ok(None),
    }
}

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("promtgen.sqlite3"))
}

fn initialize_database(connection: &Connection) -> Result<(), String> {
    connection.busy_timeout(std::time::Duration::from_secs(5)).map_err(|e| e.to_string())?;
    connection.pragma_update(None, "foreign_keys", "ON").map_err(|e| e.to_string())?;
    connection.pragma_update(None, "journal_mode", "WAL").map_err(|e| e.to_string())?;
    connection.pragma_update(None, "synchronous", "NORMAL").map_err(|e| e.to_string())?;
    connection.execute("CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, document TEXT NOT NULL, updated_at TEXT NOT NULL)", []).map_err(|e| e.to_string())?;
    connection.execute("CREATE TABLE IF NOT EXISTS project_backups (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, document TEXT NOT NULL, created_at TEXT NOT NULL)", []).map_err(|e| e.to_string())?;
    connection.execute("CREATE INDEX IF NOT EXISTS idx_project_backups_project ON project_backups(project_id, id DESC)", []).map_err(|e| e.to_string())?;
    connection.execute("CREATE TABLE IF NOT EXISTS project_quarantine (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, document TEXT NOT NULL, reason TEXT NOT NULL, quarantined_at TEXT NOT NULL)", []).map_err(|e| e.to_string())?;
    Ok(())
}

fn database(app: &AppHandle) -> Result<Connection, String> {
    let connection = Connection::open(db_path(app)?).map_err(|e| e.to_string())?;
    initialize_database(&connection)?;
    Ok(connection)
}

fn valid_project_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 128 && id.chars().all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.'))
}

fn validate_project_document(id: &str, document: &str) -> Result<i64, String> {
    if !valid_project_id(id) { return Err("Geçersiz proje kimliği.".into()); }
    if document.len() > MAX_PROJECT_DOCUMENT_BYTES { return Err("Proje belgesi 10 MB sınırını aşıyor.".into()); }
    let value = serde_json::from_str::<serde_json::Value>(document).map_err(|error| format!("Geçersiz JSON: {error}"))?;
    if value.get("id").and_then(|item| item.as_str()) != Some(id) { return Err("Belge proje kimliği ile kayıt kimliği eşleşmiyor.".into()); }
    Ok(value.get("revision").and_then(|item| item.as_i64()).unwrap_or(0))
}

fn timestamp() -> String {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis().to_string()
}

fn backup_document(transaction: &rusqlite::Transaction<'_>, project_id: &str, document: &str, created_at: &str) -> Result<(), String> {
    let revision = serde_json::from_str::<serde_json::Value>(document).ok().and_then(|value| value.get("revision").and_then(|item| item.as_i64())).unwrap_or(0);
    transaction.execute("INSERT INTO project_backups(project_id, revision, document, created_at) VALUES(?1, ?2, ?3, ?4)", params![project_id, revision, document, created_at]).map_err(|e| e.to_string())?;
    transaction.execute("DELETE FROM project_backups WHERE project_id=?1 AND id NOT IN (SELECT id FROM project_backups WHERE project_id=?1 ORDER BY id DESC LIMIT ?2)", params![project_id, MAX_PROJECT_BACKUPS]).map_err(|e| e.to_string())?;
    Ok(())
}

fn quarantine_document(transaction: &rusqlite::Transaction<'_>, project_id: &str, document: &str, reason: &str) -> Result<(), String> {
    transaction.execute("INSERT INTO project_quarantine(project_id, document, reason, quarantined_at) VALUES(?1, ?2, ?3, ?4)", params![project_id, document, reason, timestamp()]).map_err(|e| e.to_string())?;
    transaction.execute("DELETE FROM projects WHERE id=?1", [project_id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn save_project(app: AppHandle, id: String, document: String, updated_at: String) -> Result<(), String> {
    validate_project_document(&id, &document)?;
    let mut connection = database(&app)?;
    let transaction = connection.transaction().map_err(|e| e.to_string())?;
    let previous = transaction.query_row("SELECT document FROM projects WHERE id=?1", [&id], |row| row.get::<_, String>(0)).ok();
    if let Some(previous_document) = previous.filter(|value| value != &document) { backup_document(&transaction, &id, &previous_document, &updated_at)?; }
    transaction.execute("INSERT INTO projects(id, document, updated_at) VALUES(?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET document=?2, updated_at=?3", params![id, document, updated_at]).map_err(|e| e.to_string())?;
    transaction.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_project(app: AppHandle, id: String) -> Result<Option<String>, String> {
    let mut connection = database(&app)?;
    let transaction = connection.transaction().map_err(|e| e.to_string())?;
    let document = match transaction.query_row("SELECT document FROM projects WHERE id=?1", [&id], |row| row.get::<_, String>(0)) {
        Ok(value) => value, Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None), Err(error) => return Err(error.to_string())
    };
    if let Err(reason) = validate_project_document(&id, &document) {
        quarantine_document(&transaction, &id, &document, &reason)?;
        transaction.commit().map_err(|e| e.to_string())?;
        return Ok(None);
    }
    transaction.commit().map_err(|e| e.to_string())?;
    Ok(Some(document))
}

#[tauri::command]
fn list_projects(app: AppHandle) -> Result<Vec<String>, String> {
    let mut connection = database(&app)?;
    let transaction = connection.transaction().map_err(|e| e.to_string())?;
    let rows = {
        let mut statement = transaction.prepare("SELECT id, document FROM projects ORDER BY updated_at DESC").map_err(|e| e.to_string())?;
        let collected = statement.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
        collected
    };
    let mut documents = Vec::new();
    for (id, document) in rows {
        match validate_project_document(&id, &document) {
            Ok(_) => documents.push(document),
            Err(reason) => quarantine_document(&transaction, &id, &document, &reason)?,
        }
    }
    transaction.commit().map_err(|e| e.to_string())?;
    Ok(documents)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StorageHealth { ok: bool, quick_check: String, project_count: i64, backup_count: i64, quarantine_count: i64, database_bytes: u64, journal_mode: String }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupSummary { id: i64, project_id: String, revision: i64, created_at: String, bytes: usize }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct QuarantineSummary { id: i64, project_id: String, reason: String, quarantined_at: String, bytes: usize }

#[tauri::command]
fn storage_health(app: AppHandle) -> Result<StorageHealth, String> {
    let connection = database(&app)?;
    let quick_check: String = connection.query_row("PRAGMA quick_check(1)", [], |row| row.get(0)).map_err(|e| e.to_string())?;
    let journal_mode: String = connection.query_row("PRAGMA journal_mode", [], |row| row.get(0)).map_err(|e| e.to_string())?;
    let count = |table: &str| -> Result<i64, String> { connection.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| row.get(0)).map_err(|e| e.to_string()) };
    Ok(StorageHealth { ok: quick_check == "ok", quick_check, project_count: count("projects")?, backup_count: count("project_backups")?, quarantine_count: count("project_quarantine")?, database_bytes: fs::metadata(db_path(&app)?).map(|value| value.len()).unwrap_or(0), journal_mode })
}

#[tauri::command]
fn list_project_backups(app: AppHandle, project_id: String) -> Result<Vec<BackupSummary>, String> {
    if !valid_project_id(&project_id) { return Err("Geçersiz proje kimliği.".into()); }
    let connection = database(&app)?;
    let mut statement = connection.prepare("SELECT id, project_id, revision, created_at, length(document) FROM project_backups WHERE project_id=?1 ORDER BY id DESC LIMIT ?2").map_err(|e| e.to_string())?;
    let summaries = statement.query_map(params![project_id, MAX_PROJECT_BACKUPS], |row| Ok(BackupSummary { id: row.get(0)?, project_id: row.get(1)?, revision: row.get(2)?, created_at: row.get(3)?, bytes: row.get::<_, i64>(4)?.max(0) as usize })).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    Ok(summaries)
}

#[tauri::command]
fn list_quarantined_projects(app: AppHandle) -> Result<Vec<QuarantineSummary>, String> {
    let connection = database(&app)?;
    let mut statement = connection.prepare("SELECT id, project_id, reason, quarantined_at, length(document) FROM project_quarantine ORDER BY id DESC LIMIT 100").map_err(|e| e.to_string())?;
    let summaries = statement.query_map([], |row| Ok(QuarantineSummary { id: row.get(0)?, project_id: row.get(1)?, reason: row.get(2)?, quarantined_at: row.get(3)?, bytes: row.get::<_, i64>(4)?.max(0) as usize })).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    Ok(summaries)
}

#[tauri::command]
fn read_project_backup_with_confirmation(app: AppHandle, project_id: String, backup_id: i64) -> Result<Option<String>, String> {
    if !valid_project_id(&project_id) || backup_id <= 0 { return Err("Geçersiz yedek seçimi.".into()); }
    let approved = rfd::MessageDialog::new().set_level(rfd::MessageLevel::Warning).set_title("PromtGen yedeğini geri yükle").set_description("Seçilen yerel yedek yeni bir plan revision'ı olarak geri yüklenecek. Güncel plan ayrıca korunacak.").set_buttons(rfd::MessageButtons::OkCancel).show();
    if !matches!(approved, rfd::MessageDialogResult::Ok | rfd::MessageDialogResult::Yes) { return Ok(None); }
    let connection = database(&app)?;
    let document = connection.query_row("SELECT document FROM project_backups WHERE id=?1 AND project_id=?2", params![backup_id, project_id], |row| row.get::<_, String>(0)).map_err(|error| match error { rusqlite::Error::QueryReturnedNoRows => "Yedek bulunamadı.".into(), _ => error.to_string() })?;
    validate_project_document(&project_id, &document)?;
    Ok(Some(document))
}

#[tauri::command]
fn set_provider_credential(provider: String, credential: String) -> Result<(), String> {
    keyring::Entry::new("PromtGen", &provider).map_err(|e| e.to_string())?.set_password(&credential).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_provider_credential(provider: String) -> Result<Option<String>, String> {
    match keyring::Entry::new("PromtGen", &provider).map_err(|e| e.to_string())?.get_password() {
        Ok(value) => Ok(Some(value)), Err(keyring::Error::NoEntry) => Ok(None), Err(error) => Err(error.to_string())
    }
}

#[tauri::command]
fn delete_provider_credential(provider: String) -> Result<(), String> {
    match keyring::Entry::new("PromtGen", &provider).map_err(|e| e.to_string())?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()), Err(error) => Err(error.to_string())
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(execution::ExecutionState::default())
        .invoke_handler(tauri::generate_handler![save_project, load_project, list_projects, storage_health, list_project_backups, list_quarantined_projects, read_project_backup_with_confirmation, set_provider_credential, get_provider_credential, delete_provider_credential, select_and_inventory_project_folder, execution::execution_capabilities, execution::select_codex_cli, execution::clear_codex_cli, execution::select_execution_repository, execution::prepare_execution_worktree, execution::run_codex_agent_step, execution::execution_patch, execution::cleanup_execution_worktree])
        .run(tauri::generate_context!()).expect("PromtGen başlatılamadı");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn project_inventory_policy_blocks_sensitive_and_generated_paths() {
        assert!(sensitive_or_hidden(".env"));
        assert!(sensitive_or_hidden("private.key"));
        assert!(ignored_directory("node_modules"));
        assert!(ignored_directory("TARGET"));
        assert!(!sensitive_or_hidden("package.json"));
    }

    #[test]
    fn project_inventory_recognizes_supported_signals() {
        assert_eq!(language_for_extension("tsx"), Some("TypeScript"));
        assert_eq!(manifest_kind("Cargo.toml"), Some("Rust"));
        assert!(is_text_extension("md"));
        assert!(!is_text_extension("png"));
    }

    #[test]
    fn project_document_validation_enforces_identity_and_size() {
        assert_eq!(validate_project_document("project-1", r#"{"id":"project-1","revision":7}"#).unwrap(), 7);
        assert!(validate_project_document("../escape", r#"{"id":"../escape"}"#).is_err());
        assert!(validate_project_document("project-1", r#"{"id":"other"}"#).is_err());
        assert!(validate_project_document("project-1", "not-json").is_err());
    }

    #[test]
    fn sqlite_backup_retention_and_quarantine_are_bounded() {
        let mut connection = Connection::open_in_memory().unwrap();
        initialize_database(&connection).unwrap();
        for revision in 1..=25 {
            let transaction = connection.transaction().unwrap();
            let document = format!(r#"{{"id":"project-1","revision":{revision}}}"#);
            backup_document(&transaction, "project-1", &document, &revision.to_string()).unwrap();
            transaction.commit().unwrap();
        }
        let backup_count: i64 = connection.query_row("SELECT COUNT(*) FROM project_backups WHERE project_id='project-1'", [], |row| row.get(0)).unwrap();
        let oldest_retained: i64 = connection.query_row("SELECT MIN(revision) FROM project_backups WHERE project_id='project-1'", [], |row| row.get(0)).unwrap();
        assert_eq!(backup_count, MAX_PROJECT_BACKUPS);
        assert_eq!(oldest_retained, 6);

        connection.execute("INSERT INTO projects(id, document, updated_at) VALUES('broken-project', 'not-json', 'now')", []).unwrap();
        let transaction = connection.transaction().unwrap();
        quarantine_document(&transaction, "broken-project", "not-json", "Geçersiz JSON").unwrap();
        transaction.commit().unwrap();
        let active_count: i64 = connection.query_row("SELECT COUNT(*) FROM projects WHERE id='broken-project'", [], |row| row.get(0)).unwrap();
        let quarantine_count: i64 = connection.query_row("SELECT COUNT(*) FROM project_quarantine WHERE project_id='broken-project'", [], |row| row.get(0)).unwrap();
        assert_eq!(active_count, 0);
        assert_eq!(quarantine_count, 1);
    }
}
