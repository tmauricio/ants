// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use db::{AppDb, PlaylistRow, TrackRow};
use lofty::prelude::*;
use lofty::probe::Probe;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{Emitter, State};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use walkdir::WalkDir;

// ---------------------------------------------------------------------------
// Data types sent to frontend
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<FileNode>,
    pub extension: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackMeta {
    pub path: String,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration_sec: Option<u64>,
    pub has_cover: bool,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUDIO_EXTENSIONS: &[&str] = &[
    "mp3", "flac", "ogg", "wav", "aac", "m4a", "opus", "wma",
];

fn is_audio_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| AUDIO_EXTENSIONS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Build a recursive FileNode tree from a root directory.
/// Uses a HashMap<parent, Vec<child_path>> approach.
fn build_tree(root: &Path) -> FileNode {
    // Collect all entries grouped by parent directory
    let mut children_map: HashMap<PathBuf, Vec<walkdir::DirEntry>> = HashMap::new();
    // Track which dirs contain at least one audio file (directly or transitively)
    let mut audio_dirs: std::collections::HashSet<PathBuf> = std::collections::HashSet::new();

    for entry in WalkDir::new(root)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path() != root)
    {
        let path = entry.path().to_path_buf();

        if entry.file_type().is_file() && is_audio_file(&path) {
            // Mark all ancestor dirs up to root as containing audio
            let mut ancestor = path.parent().map(|p| p.to_path_buf());
            while let Some(dir) = ancestor {
                if dir == root {
                    break;
                }
                audio_dirs.insert(dir.clone());
                ancestor = dir.parent().map(|p| p.to_path_buf());
            }
        }

        if let Some(parent) = path.parent() {
            children_map
                .entry(parent.to_path_buf())
                .or_default()
                .push(entry);
        }
    }

    fn assemble(
        dir: &Path,
        children_map: &HashMap<PathBuf, Vec<walkdir::DirEntry>>,
        audio_dirs: &std::collections::HashSet<PathBuf>,
    ) -> Vec<FileNode> {
        let Some(entries) = children_map.get(dir) else {
            return vec![];
        };

        let mut nodes: Vec<FileNode> = entries
            .iter()
            .filter_map(|entry| {
                let path = entry.path();
                let name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();

                if entry.file_type().is_dir() {
                    // Only include dirs that contain audio files
                    if !audio_dirs.contains(path) {
                        return None;
                    }
                    let children = assemble(path, children_map, audio_dirs);
                    Some(FileNode {
                        name,
                        path: path.to_string_lossy().to_string(),
                        is_dir: true,
                        children,
                        extension: None,
                    })
                } else if is_audio_file(path) {
                    let ext = path
                        .extension()
                        .and_then(|e| e.to_str())
                        .map(|e| e.to_lowercase());
                    Some(FileNode {
                        name,
                        path: path.to_string_lossy().to_string(),
                        is_dir: false,
                        children: vec![],
                        extension: ext,
                    })
                } else {
                    None
                }
            })
            .collect();

        // Sort: dirs first, then files, both alphabetically
        nodes.sort_by(|a, b| match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        });

        nodes
    }

    let root_name = root
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();

    let children = assemble(root, &children_map, &audio_dirs);

    FileNode {
        name: root_name,
        path: root.to_string_lossy().to_string(),
        is_dir: true,
        children,
        extension: None,
    }
}

fn read_meta(path: &str) -> TrackMeta {
    let blank = TrackMeta {
        path: path.to_string(),
        title: None,
        artist: None,
        album: None,
        duration_sec: None,
        has_cover: false,
    };

    let tagged_file = match Probe::open(path).and_then(|p| p.read()) {
        Ok(f) => f,
        Err(_) => return blank,
    };

    let tag = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag());

    let (title, artist, album, has_cover) = if let Some(tag) = tag {
        let title = tag.title().map(|s| s.to_string());
        let artist = tag.artist().map(|s| s.to_string());
        let album = tag.album().map(|s| s.to_string());
        let has_cover = !tag.pictures().is_empty();
        (title, artist, album, has_cover)
    } else {
        (None, None, None, false)
    };

    let duration_sec = Some(tagged_file.properties().duration().as_secs());

    TrackMeta {
        path: path.to_string(),
        title,
        artist,
        album,
        duration_sec,
        has_cover,
    }
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn scan_directory(path: String) -> Result<FileNode, String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err(format!("Not a directory: {path}"));
    }
    Ok(build_tree(&root))
}

#[tauri::command]
fn get_audio_metadata(path: String) -> Result<TrackMeta, String> {
    Ok(read_meta(&path))
}

#[tauri::command]
fn get_cover_art(path: String) -> Result<Option<String>, String> {
    let tagged_file = match Probe::open(&path).and_then(|p| p.read()) {
        Ok(f) => f,
        Err(_) => return Ok(None),
    };

    let tag = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag());

    let Some(tag) = tag else {
        return Ok(None);
    };

    let Some(picture) = tag.pictures().first() else {
        return Ok(None);
    };

    let encoded = BASE64.encode(picture.data());
    let mime = picture
        .mime_type()
        .map(|m| m.to_string())
        .unwrap_or_else(|| "image/jpeg".to_string());

    Ok(Some(format!("data:{mime};base64,{encoded}")))
}

#[tauri::command]
fn get_playlists(state: State<'_, Mutex<AppDb>>) -> Result<Vec<PlaylistRow>, String> {
    let db = state.lock().map_err(|e| e.to_string())?;
    db.get_playlists().map_err(|e| e.to_string())
}

#[tauri::command]
fn create_playlist(name: String, state: State<'_, Mutex<AppDb>>) -> Result<PlaylistRow, String> {
    let db = state.lock().map_err(|e| e.to_string())?;
    db.create_playlist(&name).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_playlist(id: i64, state: State<'_, Mutex<AppDb>>) -> Result<(), String> {
    let db = state.lock().map_err(|e| e.to_string())?;
    db.delete_playlist(id).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_playlist(
    id: i64,
    name: String,
    state: State<'_, Mutex<AppDb>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| e.to_string())?;
    db.rename_playlist(id, &name).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_tracks(playlist_id: i64, state: State<'_, Mutex<AppDb>>) -> Result<Vec<TrackRow>, String> {
    let db = state.lock().map_err(|e| e.to_string())?;
    db.get_tracks(playlist_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_track(
    playlist_id: i64,
    path: String,
    title_override: Option<String>,
    artist_override: Option<String>,
    state: State<'_, Mutex<AppDb>>,
) -> Result<TrackRow, String> {
    let meta = if path.starts_with("youtube:") {
        TrackMeta {
            path: path.clone(),
            title: title_override,
            artist: artist_override,
            album: None,
            duration_sec: None,
            has_cover: false,
        }
    } else {
        read_meta(&path)
    };

    let db = state.lock().map_err(|e| e.to_string())?;

    // Next position = current track count in playlist
    let current_count = db
        .get_tracks(playlist_id)
        .map_err(|e| e.to_string())?
        .len() as i64;

    db.add_track(
        playlist_id,
        current_count,
        &path,
        meta.title.as_deref(),
        meta.artist.as_deref(),
        meta.album.as_deref(),
        meta.duration_sec.map(|d| d as i64),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_track(track_id: i64, state: State<'_, Mutex<AppDb>>) -> Result<(), String> {
    let db = state.lock().map_err(|e| e.to_string())?;
    db.remove_track(track_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn move_track(
    track_id: i64,
    new_position: i64,
    state: State<'_, Mutex<AppDb>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| e.to_string())?;
    db.move_track(track_id, new_position).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_setting(key: String, state: State<'_, Mutex<AppDb>>) -> Result<Option<String>, String> {
    let db = state.lock().map_err(|e| e.to_string())?;
    db.get_setting(&key).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_setting(key: String, value: String, state: State<'_, Mutex<AppDb>>) -> Result<(), String> {
    let db = state.lock().map_err(|e| e.to_string())?;
    db.set_setting(&key, &value).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

fn main() {
    let db = AppDb::open().expect("Failed to open music database");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(Mutex::new(db))
        .setup(|app| {
            let sc_play_pause = Shortcut::new(None::<Modifiers>, Code::MediaPlayPause);
            let sc_next       = Shortcut::new(None::<Modifiers>, Code::MediaTrackNext);
            let sc_prev       = Shortcut::new(None::<Modifiers>, Code::MediaTrackPrevious);
            let sc_stop       = Shortcut::new(None::<Modifiers>, Code::MediaStop);

            app.handle().global_shortcut().on_shortcuts(
                [sc_play_pause, sc_next, sc_prev, sc_stop],
                move |app_handle, shortcut, _event| {
                    let event = if shortcut.matches(Modifiers::empty(), Code::MediaPlayPause) {
                        "media-play-pause"
                    } else if shortcut.matches(Modifiers::empty(), Code::MediaTrackNext) {
                        "media-next"
                    } else if shortcut.matches(Modifiers::empty(), Code::MediaTrackPrevious) {
                        "media-prev"
                    } else if shortcut.matches(Modifiers::empty(), Code::MediaStop) {
                        "media-stop"
                    } else {
                        return;
                    };
                    let _ = app_handle.emit(event, ());
                },
            )?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan_directory,
            get_audio_metadata,
            get_cover_art,
            get_playlists,
            create_playlist,
            delete_playlist,
            rename_playlist,
            get_tracks,
            add_track,
            remove_track,
            move_track,
            get_setting,
            set_setting,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
