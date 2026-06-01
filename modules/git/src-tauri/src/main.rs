#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod git_ops;
mod graph;

use db::GitDb;
use std::sync::Mutex;
use tauri::State;

struct AppState {
    db: Mutex<GitDb>,
}

// ── Repository management ─────────────────────────────────────────────────────

#[tauri::command]
fn get_repos(state: State<AppState>) -> Result<Vec<db::RepoEntry>, String> {
    state.db.lock().unwrap().list_repos().map_err(|e| e.to_string())
}

#[tauri::command]
fn add_repo(path: String, state: State<AppState>) -> Result<db::RepoEntry, String> {
    git_ops::validate_repo(&path).map_err(|e| e.to_string())?;
    let name = git_ops::repo_name_from_path(&path);
    state
        .db
        .lock()
        .unwrap()
        .add_repo(&path, &name)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_repo(id: String, state: State<AppState>) -> Result<(), String> {
    state.db.lock().unwrap().remove_repo(&id).map_err(|e| e.to_string())
}

// ── Log / graph ───────────────────────────────────────────────────────────────

#[tauri::command]
fn get_log(repo_path: String, max_count: usize) -> Result<Vec<graph::GraphRow>, String> {
    git_ops::get_log(&repo_path, max_count).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_commit_detail(repo_path: String, oid: String) -> Result<git_ops::CommitDetail, String> {
    git_ops::get_commit_detail(&repo_path, &oid).map_err(|e| e.to_string())
}

// ── Refs ──────────────────────────────────────────────────────────────────────

#[tauri::command]
fn get_branches(repo_path: String) -> Result<Vec<git_ops::BranchInfo>, String> {
    git_ops::get_branches(&repo_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_remotes(repo_path: String) -> Result<Vec<git_ops::RemoteInfo>, String> {
    git_ops::get_remotes(&repo_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_tags(repo_path: String) -> Result<Vec<git_ops::TagInfo>, String> {
    git_ops::get_tags(&repo_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_stashes(repo_path: String) -> Result<Vec<git_ops::StashInfo>, String> {
    git_ops::get_stashes(&repo_path).map_err(|e| e.to_string())
}

// ── Status / staging ──────────────────────────────────────────────────────────

#[tauri::command]
fn get_status(repo_path: String) -> Result<Vec<git_ops::StatusEntry>, String> {
    git_ops::get_status(&repo_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn stage_file(repo_path: String, file_path: String) -> Result<(), String> {
    git_ops::stage_file(&repo_path, &file_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn unstage_file(repo_path: String, file_path: String) -> Result<(), String> {
    git_ops::unstage_file(&repo_path, &file_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn stage_all(repo_path: String) -> Result<(), String> {
    git_ops::stage_all(&repo_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn discard_file(repo_path: String, file_path: String) -> Result<(), String> {
    git_ops::discard_file(&repo_path, &file_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn commit_changes(repo_path: String, message: String) -> Result<String, String> {
    git_ops::commit(&repo_path, &message).map_err(|e| e.to_string())
}

// ── Branch operations ─────────────────────────────────────────────────────────

#[tauri::command]
fn checkout_branch(repo_path: String, branch_name: String) -> Result<(), String> {
    git_ops::checkout_branch(&repo_path, &branch_name).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_branch(repo_path: String, name: String, from_oid: String) -> Result<(), String> {
    git_ops::create_branch(&repo_path, &name, &from_oid).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_branch(repo_path: String, name: String, force: bool) -> Result<(), String> {
    git_ops::delete_branch(&repo_path, &name, force).map_err(|e| e.to_string())
}

#[tauri::command]
fn merge_branch(repo_path: String, branch_name: String) -> Result<String, String> {
    git_ops::merge_branch(&repo_path, &branch_name).map_err(|e| e.to_string())
}

// ── Remote operations ─────────────────────────────────────────────────────────

#[tauri::command]
fn fetch(repo_path: String, remote_name: String) -> Result<(), String> {
    git_ops::fetch(&repo_path, &remote_name).map_err(|e| e.to_string())
}

#[tauri::command]
fn push(repo_path: String, remote_name: String, branch: String) -> Result<(), String> {
    git_ops::push(&repo_path, &remote_name, &branch).map_err(|e| e.to_string())
}

#[tauri::command]
fn pull(repo_path: String) -> Result<String, String> {
    git_ops::pull(&repo_path).map_err(|e| e.to_string())
}

// ── Tags ──────────────────────────────────────────────────────────────────────

#[tauri::command]
fn create_tag(
    repo_path: String,
    name: String,
    oid: String,
    message: Option<String>,
) -> Result<(), String> {
    git_ops::create_tag(&repo_path, &name, &oid, message.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_tag(repo_path: String, name: String) -> Result<(), String> {
    git_ops::delete_tag(&repo_path, &name).map_err(|e| e.to_string())
}

// ── Stash ─────────────────────────────────────────────────────────────────────

#[tauri::command]
fn stash_push(repo_path: String, message: Option<String>) -> Result<(), String> {
    git_ops::stash_push(&repo_path, message.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn stash_pop(repo_path: String, index: usize) -> Result<(), String> {
    git_ops::stash_pop(&repo_path, index).map_err(|e| e.to_string())
}

#[tauri::command]
fn stash_drop(repo_path: String, index: usize) -> Result<(), String> {
    git_ops::stash_drop(&repo_path, index).map_err(|e| e.to_string())
}

// ── Entry point ───────────────────────────────────────────────────────────────

fn main() {
    let db = GitDb::open().expect("Failed to open git.db");

    tauri::Builder::default()
        .manage(AppState { db: Mutex::new(db) })
        .invoke_handler(tauri::generate_handler![
            get_repos,
            add_repo,
            remove_repo,
            get_log,
            get_commit_detail,
            get_branches,
            get_remotes,
            get_tags,
            get_stashes,
            get_status,
            stage_file,
            unstage_file,
            stage_all,
            discard_file,
            commit_changes,
            checkout_branch,
            create_branch,
            delete_branch,
            merge_branch,
            fetch,
            push,
            pull,
            create_tag,
            delete_tag,
            stash_push,
            stash_pop,
            stash_drop,
        ])
        .run(tauri::generate_context!())
        .expect("error running git client");
}
