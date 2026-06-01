#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;

use db::TasksDb;
use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

// ── Shared types ──────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct Board {
    pub id: String,
    pub name: String,
    pub description: String,
    pub color: String,
    pub created_at: String,
}

#[derive(Serialize, Clone)]
pub struct Column {
    pub id: String,
    pub board_id: String,
    pub name: String,
    pub position: i64,
    pub color: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct Label {
    pub id: String,
    pub board_id: String,
    pub name: String,
    pub color: String,
}

/// Compact task view used in the kanban board
#[derive(Serialize, Clone)]
pub struct TaskCard {
    pub id: String,
    pub column_id: String,
    pub title: String,
    pub position: i64,
    pub assignee: Option<String>,
    pub due_date: Option<String>,
    pub priority: String,
    pub estimate: Option<f64>,
    pub estimate_unit: String,
    pub labels: Vec<Label>,
    pub comment_count: i64,
    pub checklist_total: i64,
    pub checklist_done: i64,
}

/// Full task detail for the task modal
#[derive(Serialize, Clone)]
pub struct FullTask {
    pub id: String,
    pub column_id: String,
    pub board_id: String,
    pub title: String,
    pub description: String,
    pub position: i64,
    pub assignee: Option<String>,
    pub due_date: Option<String>,
    pub priority: String,
    pub estimate: Option<f64>,
    pub estimate_unit: String,
    pub created_at: String,
    pub updated_at: String,
    pub labels: Vec<Label>,
    pub comments: Vec<Comment>,
    pub checklists: Vec<Checklist>,
}

#[derive(Serialize, Clone)]
pub struct Comment {
    pub id: String,
    pub task_id: String,
    pub author: String,
    pub body: String,
    pub created_at: String,
}

#[derive(Serialize, Clone)]
pub struct Checklist {
    pub id: String,
    pub task_id: String,
    pub title: String,
    pub items: Vec<ChecklistItem>,
}

#[derive(Serialize, Clone)]
pub struct ChecklistItem {
    pub id: String,
    pub checklist_id: String,
    pub text: String,
    pub is_done: bool,
    pub position: i64,
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
fn get_boards(state: State<Mutex<TasksDb>>) -> Result<Vec<Board>, String> {
    state.lock().unwrap().get_boards().map_err(|e| e.to_string())
}

#[tauri::command]
fn create_board(
    name: String,
    description: String,
    color: String,
    state: State<Mutex<TasksDb>>,
) -> Result<Board, String> {
    state.lock().unwrap().create_board(&name, &description, &color).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_board(
    id: String,
    name: String,
    description: String,
    state: State<Mutex<TasksDb>>,
) -> Result<(), String> {
    state.lock().unwrap().rename_board(&id, &name, &description).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_board(id: String, state: State<Mutex<TasksDb>>) -> Result<(), String> {
    state.lock().unwrap().delete_board(&id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_columns(board_id: String, state: State<Mutex<TasksDb>>) -> Result<Vec<Column>, String> {
    state.lock().unwrap().get_columns(&board_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_column(
    board_id: String,
    name: String,
    state: State<Mutex<TasksDb>>,
) -> Result<Column, String> {
    state.lock().unwrap().create_column(&board_id, &name).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_column(id: String, name: String, state: State<Mutex<TasksDb>>) -> Result<(), String> {
    state.lock().unwrap().rename_column(&id, &name).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_column(id: String, state: State<Mutex<TasksDb>>) -> Result<(), String> {
    state.lock().unwrap().delete_column(&id).map_err(|e| e.to_string())
}

#[tauri::command]
fn reorder_columns(
    board_id: String,
    ids: Vec<String>,
    state: State<Mutex<TasksDb>>,
) -> Result<(), String> {
    state.lock().unwrap().reorder_columns(&board_id, ids).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_tasks_for_board(
    board_id: String,
    state: State<Mutex<TasksDb>>,
) -> Result<Vec<TaskCard>, String> {
    state.lock().unwrap().get_tasks_for_board(&board_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_full_task(id: String, state: State<Mutex<TasksDb>>) -> Result<FullTask, String> {
    state.lock().unwrap().get_full_task(&id).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_task(
    column_id: String,
    board_id: String,
    title: String,
    state: State<Mutex<TasksDb>>,
) -> Result<TaskCard, String> {
    state.lock().unwrap().create_task(&column_id, &board_id, &title).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_task(
    id: String,
    title: String,
    description: String,
    assignee: Option<String>,
    due_date: Option<String>,
    priority: String,
    estimate: Option<f64>,
    estimate_unit: String,
    state: State<Mutex<TasksDb>>,
) -> Result<(), String> {
    state
        .lock()
        .unwrap()
        .update_task(
            &id,
            &title,
            &description,
            assignee.as_deref(),
            due_date.as_deref(),
            &priority,
            estimate,
            &estimate_unit,
        )
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn move_task(
    task_id: String,
    column_id: String,
    position: i64,
    state: State<Mutex<TasksDb>>,
) -> Result<(), String> {
    state.lock().unwrap().move_task(&task_id, &column_id, position).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_task(id: String, state: State<Mutex<TasksDb>>) -> Result<(), String> {
    state.lock().unwrap().delete_task(&id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_board_labels(
    board_id: String,
    state: State<Mutex<TasksDb>>,
) -> Result<Vec<Label>, String> {
    state.lock().unwrap().get_board_labels(&board_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_label(
    board_id: String,
    name: String,
    color: String,
    state: State<Mutex<TasksDb>>,
) -> Result<Label, String> {
    state.lock().unwrap().create_label(&board_id, &name, &color).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_label(id: String, state: State<Mutex<TasksDb>>) -> Result<(), String> {
    state.lock().unwrap().delete_label(&id).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_task_labels(
    task_id: String,
    label_ids: Vec<String>,
    state: State<Mutex<TasksDb>>,
) -> Result<(), String> {
    state.lock().unwrap().set_task_labels(&task_id, label_ids).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_comment(
    task_id: String,
    author: String,
    body: String,
    state: State<Mutex<TasksDb>>,
) -> Result<Comment, String> {
    state.lock().unwrap().add_comment(&task_id, &author, &body).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_comment(id: String, state: State<Mutex<TasksDb>>) -> Result<(), String> {
    state.lock().unwrap().delete_comment(&id).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_checklist(
    task_id: String,
    title: String,
    state: State<Mutex<TasksDb>>,
) -> Result<Checklist, String> {
    state.lock().unwrap().create_checklist(&task_id, &title).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_checklist(id: String, state: State<Mutex<TasksDb>>) -> Result<(), String> {
    state.lock().unwrap().delete_checklist(&id).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_checklist_item(
    checklist_id: String,
    text: String,
    state: State<Mutex<TasksDb>>,
) -> Result<ChecklistItem, String> {
    state.lock().unwrap().add_checklist_item(&checklist_id, &text).map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_checklist_item(
    id: String,
    is_done: bool,
    state: State<Mutex<TasksDb>>,
) -> Result<(), String> {
    state.lock().unwrap().toggle_checklist_item(&id, is_done).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_checklist_item(id: String, state: State<Mutex<TasksDb>>) -> Result<(), String> {
    state.lock().unwrap().delete_checklist_item(&id).map_err(|e| e.to_string())
}

// ── Entry point ───────────────────────────────────────────────────────────────

fn main() {
    let db = TasksDb::open().expect("Failed to open tasks.db");

    tauri::Builder::default()
        .manage(Mutex::new(db))
        .invoke_handler(tauri::generate_handler![
            get_boards,
            create_board,
            rename_board,
            delete_board,
            get_columns,
            create_column,
            rename_column,
            delete_column,
            reorder_columns,
            get_tasks_for_board,
            get_full_task,
            create_task,
            update_task,
            move_task,
            delete_task,
            get_board_labels,
            create_label,
            delete_label,
            set_task_labels,
            add_comment,
            delete_comment,
            create_checklist,
            delete_checklist,
            add_checklist_item,
            toggle_checklist_item,
            delete_checklist_item,
        ])
        .run(tauri::generate_context!())
        .expect("Error running Tasks");
}
