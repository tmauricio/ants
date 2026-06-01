use anyhow::{Context, Result};
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistRow {
    pub id: i64,
    pub name: String,
    pub created_at: String,
    pub track_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackRow {
    pub id: i64,
    pub playlist_id: i64,
    pub position: i64,
    pub path: String,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration_sec: Option<i64>,
}

pub struct AppDb {
    conn: Connection,
}

impl AppDb {
    pub fn open() -> Result<Self> {
        let data_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("platform")
            .join("modules")
            .join("com.platform.music")
            .join("data");

        std::fs::create_dir_all(&data_dir)
            .with_context(|| format!("Failed to create data dir: {}", data_dir.display()))?;

        let db_path = data_dir.join("music.db");
        let conn = Connection::open(&db_path)
            .with_context(|| format!("Failed to open DB at: {}", db_path.display()))?;

        // Enable WAL mode and foreign keys
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA foreign_keys=ON;",
        )?;

        // Run schema
        let schema = include_str!("db/schema.sql");
        conn.execute_batch(schema)
            .context("Failed to apply schema")?;

        Ok(Self { conn })
    }

    pub fn get_playlists(&self) -> Result<Vec<PlaylistRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT p.id, p.name, p.created_at, COUNT(t.id) AS track_count
             FROM playlists p
             LEFT JOIN tracks t ON t.playlist_id = p.id
             GROUP BY p.id
             ORDER BY p.created_at ASC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(PlaylistRow {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                track_count: row.get(3)?,
            })
        })?;

        rows.collect::<rusqlite::Result<Vec<_>>>()
            .context("Failed to collect playlists")
    }

    pub fn create_playlist(&self, name: &str) -> Result<PlaylistRow> {
        self.conn.execute(
            "INSERT INTO playlists (name) VALUES (?1)",
            params![name],
        )?;
        let id = self.conn.last_insert_rowid();

        let row = self.conn.query_row(
            "SELECT id, name, created_at FROM playlists WHERE id = ?1",
            params![id],
            |row| {
                Ok(PlaylistRow {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    created_at: row.get(2)?,
                    track_count: 0,
                })
            },
        )?;

        Ok(row)
    }

    pub fn delete_playlist(&self, id: i64) -> Result<()> {
        self.conn
            .execute("DELETE FROM playlists WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn rename_playlist(&self, id: i64, name: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE playlists SET name = ?1 WHERE id = ?2",
            params![name, id],
        )?;
        Ok(())
    }

    pub fn get_tracks(&self, playlist_id: i64) -> Result<Vec<TrackRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, playlist_id, position, path, title, artist, album, duration_sec
             FROM tracks
             WHERE playlist_id = ?1
             ORDER BY position ASC",
        )?;

        let rows = stmt.query_map(params![playlist_id], |row| {
            Ok(TrackRow {
                id: row.get(0)?,
                playlist_id: row.get(1)?,
                position: row.get(2)?,
                path: row.get(3)?,
                title: row.get(4)?,
                artist: row.get(5)?,
                album: row.get(6)?,
                duration_sec: row.get(7)?,
            })
        })?;

        rows.collect::<rusqlite::Result<Vec<_>>>()
            .context("Failed to collect tracks")
    }

    pub fn add_track(
        &self,
        playlist_id: i64,
        position: i64,
        path: &str,
        title: Option<&str>,
        artist: Option<&str>,
        album: Option<&str>,
        duration_sec: Option<i64>,
    ) -> Result<TrackRow> {
        self.conn.execute(
            "INSERT OR IGNORE INTO tracks (playlist_id, position, path, title, artist, album, duration_sec)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![playlist_id, position, path, title, artist, album, duration_sec],
        )?;

        // If INSERT OR IGNORE silently ignored (duplicate), fetch existing row
        let row = self.conn.query_row(
            "SELECT id, playlist_id, position, path, title, artist, album, duration_sec
             FROM tracks
             WHERE playlist_id = ?1 AND path = ?2",
            params![playlist_id, path],
            |row| {
                Ok(TrackRow {
                    id: row.get(0)?,
                    playlist_id: row.get(1)?,
                    position: row.get(2)?,
                    path: row.get(3)?,
                    title: row.get(4)?,
                    artist: row.get(5)?,
                    album: row.get(6)?,
                    duration_sec: row.get(7)?,
                })
            },
        )?;

        Ok(row)
    }

    pub fn remove_track(&self, track_id: i64) -> Result<()> {
        self.conn
            .execute("DELETE FROM tracks WHERE id = ?1", params![track_id])?;
        Ok(())
    }

    pub fn move_track(&self, track_id: i64, new_position: i64) -> Result<()> {
        self.conn.execute(
            "UPDATE tracks SET position = ?1 WHERE id = ?2",
            params![new_position, track_id],
        )?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT value FROM settings WHERE key = ?1",
        )?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }
}
