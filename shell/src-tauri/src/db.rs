use anyhow::Result;
use rusqlite::Connection;
use std::path::PathBuf;

use crate::{CatalogEntry, InstalledModule};
use crate::scanner::{color_for_id, DiscoveredModule};

pub struct AppDb {
    conn: Connection,
}

impl AppDb {
    pub fn open() -> Result<Self> {
        let path = db_path();
        std::fs::create_dir_all(path.parent().unwrap())?;
        let conn = Connection::open(&path)?;
        conn.execute_batch(include_str!("db/schema.sql"))?;
        Ok(Self { conn })
    }

    /// Upserts a discovered module into both `catalog` and `modules` tables.
    pub fn register_module(&self, discovered: &DiscoveredModule) -> Result<()> {
        let m = &discovered.manifest;

        let replaces_json = serde_json::to_string(&m.replaces)?;
        let permissions_json = serde_json::to_string(&m.permissions)?;
        let platforms_json = r#"["windows","macos","linux"]"#;
        let icon_color = m.icon_color.as_deref().unwrap_or_else(|| color_for_id(&m.id));

        // Upsert catalog — replace so version/description stay current
        self.conn.execute(
            "INSERT OR REPLACE INTO catalog
             (id, name, tagline, description, category, latest_version,
              ram_typical_mb, replaces, platforms, icon_color)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            rusqlite::params![
                m.id, m.name, m.description, m.description,
                m.category, m.version, m.ram_typical_mb,
                replaces_json, platforms_json, icon_color,
            ],
        )?;

        let binary_path = discovered.binary_path.to_string_lossy().to_string();
        let data_path = discovered.module_dir.to_string_lossy().to_string();

        // INSERT if not present; otherwise update paths, version and permissions
        self.conn.execute(
            "INSERT INTO modules (id, name, version, install_path, data_path, permissions)
             VALUES (?1,?2,?3,?4,?5,?6)
             ON CONFLICT(id) DO UPDATE SET
               name         = excluded.name,
               version      = excluded.version,
               install_path = excluded.install_path,
               data_path    = excluded.data_path,
               permissions  = excluded.permissions",
            rusqlite::params![
                m.id, m.name, m.version,
                binary_path, data_path,
                permissions_json,
            ],
        )?;

        Ok(())
    }

    pub fn get_module_binary(&self, id: &str) -> Result<String> {
        let path: String = self.conn.query_row(
            "SELECT install_path FROM modules WHERE id = ?1",
            [id],
            |row| row.get(0),
        )?;
        Ok(path)
    }

    pub fn update_last_launched(&self, id: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE modules SET last_launched = CURRENT_TIMESTAMP WHERE id = ?1",
            [id],
        )?;
        Ok(())
    }

    pub fn get_catalog(&self) -> Result<Vec<CatalogEntry>> {
        let installed_ids = self.installed_ids()?;

        let mut stmt = self.conn.prepare(
            "SELECT id, name, tagline, description, category, latest_version,
                    ram_typical_mb, replaces, platforms, icon_color
             FROM catalog
             ORDER BY category, name",
        )?;

        let entries = stmt
            .query_map([], |row| {
                let replaces_json: String = row.get(7)?;
                let platforms_json: String = row.get(8)?;
                let id: String = row.get(0)?;
                let is_installed = installed_ids.contains(&id);
                Ok(CatalogEntry {
                    id,
                    name: row.get(1)?,
                    tagline: row.get(2)?,
                    description: row.get(3)?,
                    category: row.get(4)?,
                    latest_version: row.get(5)?,
                    ram_typical_mb: row.get(6)?,
                    replaces: serde_json::from_str(&replaces_json).unwrap_or_default(),
                    platforms: serde_json::from_str(&platforms_json).unwrap_or_default(),
                    icon_color: row.get(9)?,
                    is_installed,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(entries)
    }

    pub fn get_installed_modules(&self) -> Result<Vec<InstalledModule>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, version, is_enabled, last_launched, permissions
             FROM modules
             WHERE is_enabled = TRUE
             ORDER BY last_launched DESC NULLS LAST",
        )?;

        let modules = stmt
            .query_map([], |row| {
                let perms_json: String = row.get(5)?;
                Ok(InstalledModule {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    version: row.get(2)?,
                    is_enabled: row.get(3)?,
                    last_launched: row.get(4)?,
                    permissions: serde_json::from_str(&perms_json).unwrap_or_default(),
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(modules)
    }

    pub fn install_module(&self, id: &str) -> Result<()> {
        let mut stmt = self
            .conn
            .prepare("SELECT name, latest_version FROM catalog WHERE id = ?1")?;
        let (name, version): (String, String) =
            stmt.query_row([id], |row| Ok((row.get(0)?, row.get(1)?)))?;

        self.conn.execute(
            "INSERT OR IGNORE INTO modules
             (id, name, version, install_path, data_path, permissions)
             VALUES (?1,?2,?3,?4,?5,'[]')",
            rusqlite::params![
                id, name, version,
                format!("modules/{id}/bin"),
                format!("modules/{id}/data"),
            ],
        )?;
        Ok(())
    }

    pub fn uninstall_module(&self, id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM modules WHERE id = ?1", [id])?;
        Ok(())
    }

    fn installed_ids(&self) -> Result<std::collections::HashSet<String>> {
        let mut stmt = self.conn.prepare("SELECT id FROM modules")?;
        let ids = stmt
            .query_map([], |row| row.get::<_, String>(0))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(ids)
    }
}

fn db_path() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("platform")
        .join("shell.db")
}
