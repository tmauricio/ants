CREATE TABLE IF NOT EXISTS playlists (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tracks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id  INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    position     INTEGER NOT NULL DEFAULT 0,
    path         TEXT NOT NULL,
    title        TEXT,
    artist       TEXT,
    album        TEXT,
    duration_sec INTEGER,
    UNIQUE(playlist_id, path)
);

CREATE INDEX IF NOT EXISTS idx_tracks_playlist ON tracks(playlist_id, position);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
