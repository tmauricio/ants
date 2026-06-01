-- ============================================================
-- Platform Shell — schema + seed data
-- ============================================================

-- Store catalog (mirrors the remote registry index.json locally)
CREATE TABLE IF NOT EXISTS catalog (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    tagline         TEXT NOT NULL,
    description     TEXT NOT NULL,
    category        TEXT NOT NULL,       -- productivity | media | communication | utilities
    latest_version  TEXT NOT NULL,
    ram_typical_mb  INTEGER NOT NULL,
    replaces        TEXT NOT NULL,       -- JSON array of strings
    platforms       TEXT NOT NULL,       -- JSON array: ["windows","macos","linux"]
    icon_color      TEXT NOT NULL        -- hex color for placeholder icon
);

-- Installed modules (written to when user installs a module)
CREATE TABLE IF NOT EXISTS modules (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    version         TEXT NOT NULL,
    install_path    TEXT NOT NULL,
    data_path       TEXT NOT NULL,
    installed_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_launched   DATETIME,
    is_enabled      BOOLEAN DEFAULT TRUE,
    permissions     TEXT NOT NULL DEFAULT '[]'   -- JSON array
);

-- Resource usage history per session
CREATE TABLE IF NOT EXISTS usage_sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id       TEXT NOT NULL,
    started_at      DATETIME NOT NULL,
    ended_at        DATETIME,
    peak_ram_mb     INTEGER,
    avg_cpu_percent REAL,
    FOREIGN KEY (module_id) REFERENCES modules(id)
);

-- Backup records
CREATE TABLE IF NOT EXISTS backups (
    id          TEXT PRIMARY KEY,
    module_id   TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    path        TEXT NOT NULL,
    size_bytes  INTEGER,
    checksum    TEXT NOT NULL,
    FOREIGN KEY (module_id) REFERENCES modules(id)
);

