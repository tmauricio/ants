#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;

use db::NotesDb;
use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

// ── Shared types ─────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct FolderItem {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct NoteItem {
    pub id: String,
    pub title: String,
    pub folder_id: Option<String>,
    pub updated_at: String,
}

#[derive(Serialize)]
pub struct NoteContent {
    pub id: String,
    pub title: String,
    pub content: String,
    pub folder_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize)]
pub struct TreeData {
    pub folders: Vec<FolderItem>,
    pub notes: Vec<NoteItem>,
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
fn get_tree(state: State<Mutex<NotesDb>>) -> Result<TreeData, String> {
    state.lock().unwrap().get_tree().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_note(id: String, state: State<Mutex<NotesDb>>) -> Result<NoteContent, String> {
    state
        .lock()
        .unwrap()
        .get_note(&id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn create_note(
    title: String,
    folder_id: Option<String>,
    state: State<Mutex<NotesDb>>,
) -> Result<NoteContent, String> {
    state
        .lock()
        .unwrap()
        .create_note(&title, folder_id.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn update_note(
    id: String,
    title: String,
    content: String,
    state: State<Mutex<NotesDb>>,
) -> Result<(), String> {
    state
        .lock()
        .unwrap()
        .update_note(&id, &title, &content)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_note(id: String, state: State<Mutex<NotesDb>>) -> Result<(), String> {
    state
        .lock()
        .unwrap()
        .delete_note(&id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn create_folder(
    name: String,
    parent_id: Option<String>,
    state: State<Mutex<NotesDb>>,
) -> Result<FolderItem, String> {
    state
        .lock()
        .unwrap()
        .create_folder(&name, parent_id.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_folder(id: String, name: String, state: State<Mutex<NotesDb>>) -> Result<(), String> {
    state
        .lock()
        .unwrap()
        .rename_folder(&id, &name)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_folder(id: String, state: State<Mutex<NotesDb>>) -> Result<(), String> {
    state
        .lock()
        .unwrap()
        .delete_folder(&id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn move_note(
    id: String,
    folder_id: Option<String>,
    state: State<Mutex<NotesDb>>,
) -> Result<(), String> {
    state
        .lock()
        .unwrap()
        .move_note(&id, folder_id.as_deref())
        .map_err(|e| e.to_string())
}

// ── Entry point ───────────────────────────────────────────────────────────────

fn main() {
    let db = NotesDb::open().expect("Failed to open notes.db");

    tauri::Builder::default()
        .manage(Mutex::new(db))
        .invoke_handler(tauri::generate_handler![
            get_tree,
            get_note,
            create_note,
            update_note,
            delete_note,
            create_folder,
            rename_folder,
            delete_folder,
            move_note,
        ])
        .run(tauri::generate_context!())
        .expect("Error running Notes");
}
