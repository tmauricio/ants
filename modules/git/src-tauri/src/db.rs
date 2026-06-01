use anyhow::Result;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepoEntry {
    pub id: String,
    pub name: String,
    pub path: String,
}

pub struct GitDb {
    conn: Connection,
}

impl GitDb {
    pub fn open() -> Result<Self> {
        let path = db_path();
        std::fs::create_dir_all(path.parent().unwrap())?;
        let conn = Connection::open(&path)?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS repos (
                id   TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT NOT NULL UNIQUE
            );",
        )?;
        Ok(Self { conn })
    }

    pub fn list_repos(&self) -> Result<Vec<RepoEntry>> {
        let mut stmt = self.conn.prepare("SELECT id, name, path FROM repos ORDER BY rowid")?;
        let rows = stmt.query_map([], |row| {
            Ok(RepoEntry {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn add_repo(&self, path: &str, name: &str) -> Result<RepoEntry> {
        let id = new_id();
        self.conn.execute(
            "INSERT OR IGNORE INTO repos (id, name, path) VALUES (?1, ?2, ?3)",
            rusqlite::params![id, name, path],
        )?;
        // If already existed, return the existing one
        let entry: RepoEntry = self.conn.query_row(
            "SELECT id, name, path FROM repos WHERE path = ?1",
            [path],
            |row| {
                Ok(RepoEntry {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    path: row.get(2)?,
                })
            },
        )?;
        Ok(entry)
    }

    pub fn remove_repo(&self, id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM repos WHERE id = ?1", [id])?;
        Ok(())
    }
}

fn db_path() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("platform")
        .join("modules")
        .join("com.platform.git")
        .join("data")
        .join("git.db")
}

fn new_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
    format!("{:013x}{:08x}", t.as_millis(), t.subsec_nanos())
}
