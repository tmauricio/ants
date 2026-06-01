#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod scanner;

use db::AppDb;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use sysinfo::{Pid, ProcessRefreshKind, System};
use tauri::State;

// ── Data types sent to the frontend ──────────────────────────────────────────

#[derive(Serialize)]
pub struct CatalogEntry {
    pub id: String,
    pub name: String,
    pub tagline: String,
    pub description: String,
    pub category: String,
    pub latest_version: String,
    pub ram_typical_mb: i64,
    pub replaces: Vec<String>,
    pub platforms: Vec<String>,
    pub icon_color: String,
    pub is_installed: bool,
}

#[derive(Serialize)]
pub struct InstalledModule {
    pub id: String,
    pub name: String,
    pub version: String,
    pub is_enabled: bool,
    pub last_launched: Option<String>,
    pub permissions: Vec<String>,
}

#[derive(Serialize)]
pub struct RunningStats {
    pub instances: usize,
    pub ram_mb: u64,
}

// Tracks PIDs of running module instances: module_id -> [pid, ...]
type ProcessTracker = Mutex<HashMap<String, Vec<u32>>>;

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
fn get_catalog(state: State<Mutex<AppDb>>) -> Result<Vec<CatalogEntry>, String> {
    state.lock().unwrap().get_catalog().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_installed_modules(state: State<Mutex<AppDb>>) -> Result<Vec<InstalledModule>, String> {
    state
        .lock()
        .unwrap()
        .get_installed_modules()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn install_module(id: String, state: State<Mutex<AppDb>>) -> Result<(), String> {
    state
        .lock()
        .unwrap()
        .install_module(&id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn launch_module(
    id: String,
    db_state: State<Mutex<AppDb>>,
    tracker: State<ProcessTracker>,
) -> Result<(), String> {
    let db = db_state.lock().unwrap();

    let binary = db.get_module_binary(&id).map_err(|e| e.to_string())?;
    let binary_path = std::path::Path::new(&binary);

    if !binary_path.exists() {
        return Err(format!(
            "Binary not found: {}. Build the module first with `cargo build`.",
            binary_path.display()
        ));
    }

    // Set CWD to the module's src-tauri/ dir so Tauri resolves
    // frontendDist ("../dist") correctly relative to that directory.
    let src_tauri_dir = binary_path
        .ancestors()
        .find(|p| p.file_name().map(|n| n == "src-tauri").unwrap_or(false))
        .unwrap_or_else(|| binary_path.parent().unwrap_or(binary_path));

    let child = std::process::Command::new(binary_path)
        .current_dir(src_tauri_dir)
        .spawn()
        .map_err(|e| format!("Failed to launch {id}: {e}"))?;

    let pid = child.id();
    // Detach child so it keeps running after we drop it
    std::mem::forget(child);

    tracker
        .lock()
        .unwrap()
        .entry(id.clone())
        .or_default()
        .push(pid);

    db.update_last_launched(&id).map_err(|e| e.to_string())?;

    println!("[shell] launched module {id} (pid {pid})");
    Ok(())
}

#[tauri::command]
fn uninstall_module(id: String, state: State<Mutex<AppDb>>) -> Result<(), String> {
    state
        .lock()
        .unwrap()
        .uninstall_module(&id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_running_stats(tracker: State<ProcessTracker>) -> HashMap<String, RunningStats> {
    let mut map = tracker.lock().unwrap();

    // Refresh all processes — more reliable on Windows than querying specific PIDs
    let mut sys = System::new();
    sys.refresh_processes_specifics(
        sysinfo::ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::new().with_memory(),
    );

    let mut result = HashMap::new();
    for (id, pids) in map.iter_mut() {
        // Drop PIDs of processes that have already exited
        pids.retain(|&p| sys.process(Pid::from_u32(p)).is_some());

        if pids.is_empty() {
            continue;
        }

        let ram_mb: u64 = pids
            .iter()
            .filter_map(|&p| sys.process(Pid::from_u32(p)))
            .map(|proc| proc.memory() / 1024 / 1024)
            .sum();

        result.insert(
            id.clone(),
            RunningStats {
                instances: pids.len(),
                ram_mb,
            },
        );
    }
    result
}

// ── Entry point ───────────────────────────────────────────────────────────────

fn main() {
    let app_db = AppDb::open().expect("Failed to open shell.db");

    // Discover modules from the modules/ folder and register them
    let discovered = scanner::scan_modules();
    if discovered.is_empty() {
        println!("[shell] no modules found in modules/ directory");
    }
    for module in &discovered {
        if let Err(e) = app_db.register_module(module) {
            eprintln!("[shell] failed to register {}: {e}", module.manifest.id);
        }
    }

    let tracker: ProcessTracker = Mutex::new(HashMap::new());

    tauri::Builder::default()
        .manage(Mutex::new(app_db))
        .manage(tracker)
        .invoke_handler(tauri::generate_handler![
            get_catalog,
            get_installed_modules,
            install_module,
            uninstall_module,
            launch_module,
            get_running_stats,
        ])
        .run(tauri::generate_context!())
        .expect("Error running Platform Shell");
}
