import { useState } from "react";
import type React from "react";
import type { Playlist } from "../App";

export default function Sidebar({ width, playlists, selectedPlaylist, queueCount, onSelectQueue, onSelect, onCreate, onDelete, onPlay, onAddToQueue, bottomPanel }: {
  width: number;
  playlists: Playlist[];
  selectedPlaylist: Playlist | null;
  queueCount: number;
  onSelectQueue: () => void;
  onSelect: (p: Playlist) => void;
  onCreate: (name: string) => void;
  onDelete: (id: number) => void;
  onPlay: (id: number) => void;
  onAddToQueue: (id: number) => void;
  bottomPanel?: React.ReactNode;
}) {
  const [newName, setNewName] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  function handleCreate() {
    if (!newName.trim()) return;
    onCreate(newName.trim());
    setNewName("");
    setShowInput(false);
  }

  return (
    <div style={{ width, flexShrink: 0, background: "var(--bg-surface)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "14px 14px 8px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
          Music
        </div>
        <div onClick={onSelectQueue}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--text-secondary)", fontSize: 13 }}>
          <span>▶</span>
          <span style={{ flex: 1 }}>Now playing</span>
          {queueCount > 0 && <span style={{ fontSize: 11, background: "var(--accent-dim)", color: "var(--accent)", borderRadius: 10, padding: "1px 7px", fontWeight: 700 }}>{queueCount}</span>}
        </div>
      </div>

      <div style={{ padding: "10px 14px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>Playlists</span>
        <button onClick={() => setShowInput((p) => !p)}
          style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 2px" }}>
          +
        </button>
      </div>

      {showInput && (
        <div style={{ padding: "0 14px 8px", display: "flex", gap: 6 }}>
          <input autoFocus value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowInput(false); }}
            placeholder="Name..."
            style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: 12, padding: "5px 8px", outline: "none" }}
          />
          <button onClick={handleCreate}
            style={{ background: "var(--accent)", border: "none", borderRadius: "var(--radius-sm)", color: "#000", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "5px 8px" }}>
            OK
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "0 6px 12px", minHeight: 0 }}>
        {playlists.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px", textAlign: "center" }}>No playlists</p>
        )}
        {playlists.map((p) => {
          const isActive = selectedPlaylist?.id === p.id;
          const isConfirm = confirmDelete === p.id;
          const isHovered = hovered === p.id;
          return (
            <div key={p.id}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 8px", borderRadius: "var(--radius-sm)", cursor: "pointer", background: isActive ? "var(--accent-dim)" : isHovered ? "rgba(255,255,255,0.03)" : "transparent", color: isActive ? "var(--accent)" : "var(--text-secondary)", fontSize: 13, margin: "1px 0" }}
              onClick={() => onSelect(p)}
              onMouseEnter={() => setHovered(p.id)}
              onMouseLeave={() => { setHovered(null); if (!isConfirm) setConfirmDelete(null); }}
            >
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>♫ {p.name}</span>

              {/* Always-visible track count */}
              {p.track_count > 0 && !isHovered && (
                <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{p.track_count}</span>
              )}

              {/* Hover actions */}
              {isHovered && !isConfirm && (
                <div style={{ display: "flex", gap: 3, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  {/* Play now — replaces queue */}
                  <button
                    onClick={() => onPlay(p.id)}
                    title="Play playlist"
                    style={{ background: "var(--accent)", border: "none", borderRadius: 3, color: "#000", cursor: "pointer", fontSize: 10, fontWeight: 700, padding: "2px 6px", lineHeight: 1 }}>
                    ▶
                  </button>
                  {/* Add to current queue */}
                  <button
                    onClick={() => onAddToQueue(p.id)}
                    title="Add to current queue"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 3, color: "var(--text-secondary)", cursor: "pointer", fontSize: 10, padding: "2px 5px", lineHeight: 1 }}>
                    ▶+
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => setConfirmDelete(p.id)}
                    title="Delete playlist"
                    style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 12, padding: "2px 3px", lineHeight: 1 }}>
                    ✕
                  </button>
                </div>
              )}

              {isConfirm && (
                <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { onDelete(p.id); setConfirmDelete(null); }}
                    style={{ background: "var(--danger)", border: "none", borderRadius: 4, color: "#fff", cursor: "pointer", fontSize: 11, padding: "2px 7px", fontWeight: 700 }}>Yes</button>
                  <button onClick={() => setConfirmDelete(null)}
                    style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-muted)", cursor: "pointer", fontSize: 11, padding: "2px 6px" }}>No</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {bottomPanel && (
        <div style={{ flexShrink: 0, borderTop: "1px solid var(--border)" }}>
          {bottomPanel}
        </div>
      )}
    </div>
  );
}
