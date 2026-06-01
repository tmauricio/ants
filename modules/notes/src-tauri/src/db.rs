use anyhow::Result;
use rusqlite::Connection;
use std::path::PathBuf;

use crate::{FolderItem, NoteContent, NoteItem, TreeData};

pub struct NotesDb {
    conn: Connection,
}

impl NotesDb {
    pub fn open() -> Result<Self> {
        let path = db_path();
        std::fs::create_dir_all(path.parent().unwrap())?;
        let conn = Connection::open(&path)?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        conn.execute_batch(include_str!("db/schema.sql"))?;
        Ok(Self { conn })
    }

    pub fn get_tree(&self) -> Result<TreeData> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, name, parent_id FROM folders ORDER BY name")?;
        let folders: Vec<FolderItem> = stmt
            .query_map([], |row| {
                Ok(FolderItem {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    parent_id: row.get(2)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        let mut stmt = self.conn.prepare(
            "SELECT id, title, folder_id, updated_at FROM notes ORDER BY updated_at DESC",
        )?;
        let notes: Vec<NoteItem> = stmt
            .query_map([], |row| {
                Ok(NoteItem {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    folder_id: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(TreeData { folders, notes })
    }

    pub fn get_note(&self, id: &str) -> Result<NoteContent> {
        let note = self.conn.query_row(
            "SELECT id, title, content, folder_id, created_at, updated_at FROM notes WHERE id = ?1",
            [id],
            |row| {
                Ok(NoteContent {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    content: row.get(2)?,
                    folder_id: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            },
        )?;
        Ok(note)
    }

    pub fn create_note(&self, title: &str, folder_id: Option<&str>) -> Result<NoteContent> {
        let id = new_id();
        self.conn.execute(
            "INSERT INTO notes (id, title, content, folder_id) VALUES (?1, ?2, '', ?3)",
            rusqlite::params![id, title, folder_id],
        )?;
        self.get_note(&id)
    }

    pub fn update_note(&self, id: &str, title: &str, content: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE notes SET title = ?1, content = ?2 WHERE id = ?3",
            rusqlite::params![title, content, id],
        )?;
        Ok(())
    }

    pub fn delete_note(&self, id: &str) -> Result<()> {
        self.conn
            .execute("DELETE FROM notes WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn create_folder(&self, name: &str, parent_id: Option<&str>) -> Result<FolderItem> {
        let id = new_id();
        self.conn.execute(
            "INSERT INTO folders (id, name, parent_id) VALUES (?1, ?2, ?3)",
            rusqlite::params![id, name, parent_id],
        )?;
        Ok(FolderItem {
            id,
            name: name.to_string(),
            parent_id: parent_id.map(String::from),
        })
    }

    pub fn rename_folder(&self, id: &str, name: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE folders SET name = ?1 WHERE id = ?2",
            rusqlite::params![name, id],
        )?;
        Ok(())
    }

    pub fn delete_folder(&self, id: &str) -> Result<()> {
        // Cascade: moves notes to parent or root, then deletes subfolders recursively
        self.conn.execute(
            "UPDATE notes SET folder_id = (SELECT parent_id FROM folders WHERE id = ?1) WHERE folder_id = ?1",
            [id],
        )?;
        self.conn
            .execute("DELETE FROM folders WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn move_note(&self, id: &str, folder_id: Option<&str>) -> Result<()> {
        self.conn.execute(
            "UPDATE notes SET folder_id = ?1 WHERE id = ?2",
            rusqlite::params![folder_id, id],
        )?;
        Ok(())
    }
}

fn db_path() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("platform")
        .join("modules")
        .join("com.platform.notes")
        .join("data")
        .join("notes.db")
}

fn new_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let ns = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    format!("{ms:013x}{ns:08x}")
}
