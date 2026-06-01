import { useState } from "react";
import type { RepoEntry } from "../types";

interface Props {
  repos: RepoEntry[];
  activeRepo: RepoEntry | null;
  onSelectRepo: (r: RepoEntry) => void;
  onAddRepo: (path: string) => void;
  onRemoveRepo: (id: string) => void;
  onFetch: () => void;
  onPull: () => void;
  onPush: () => void;
  onRefresh: () => void;
}

export default function TopBar({
  repos, activeRepo, onSelectRepo, onAddRepo, onRemoveRepo,
  onFetch, onPull, onPush, onRefresh,
}: Props) {
  const [addingRepo, setAddingRepo] = useState(false);
  const [newPath, setNewPath] = useState("");

  const commitAdd = () => {
    const p = newPath.trim();
    if (p) { onAddRepo(p); setNewPath(""); setAddingRepo(false); }
  };

  const bar: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    background: "var(--bg-sidebar)",
    borderBottom: "1px solid var(--border)",
    height: "var(--topbar-h)",
    padding: "0 8px",
    gap: 4,
    flexShrink: 0,
  };

  const tab = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "0 12px",
    height: "100%",
    borderRight: "1px solid var(--border-subtle)",
    background: active ? "var(--bg-base)" : "transparent",
    color: active ? "var(--text-primary)" : "var(--text-secondary)",
    cursor: "pointer",
    fontSize: 13,
    whiteSpace: "nowrap",
    userSelect: "none",
    borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
    borderTop: "none",
    borderLeft: "none",
  });

  const iconBtn = (color?: string): React.CSSProperties => ({
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: color ?? "var(--text-secondary)",
    padding: "4px 10px",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    gap: 5,
    height: 28,
    whiteSpace: "nowrap",
  });

  return (
    <div style={bar}>
      {/* Repo tabs */}
      <div style={{ display: "flex", alignItems: "center", flex: 1, height: "100%", overflow: "hidden" }}>
        {repos.map((r) => (
          <button
            key={r.id}
            style={tab(r.id === activeRepo?.id)}
            onClick={() => onSelectRepo(r)}
          >
            <span style={{ fontSize: 11, opacity: 0.7 }}>⎇</span>
            <span>{r.name}</span>
            <span
              onClick={(e) => { e.stopPropagation(); onRemoveRepo(r.id); }}
              style={{ marginLeft: 2, opacity: 0.5, fontSize: 14, lineHeight: 1, cursor: "pointer" }}
              title="Close"
            >×</span>
          </button>
        ))}

        {addingRepo ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 8px" }}>
            <input
              autoFocus
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitAdd();
                if (e.key === "Escape") { setAddingRepo(false); setNewPath(""); }
              }}
              placeholder="Repository path..."
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--accent)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
                padding: "3px 8px",
                width: 280,
                fontSize: 12,
                outline: "none",
              }}
            />
            <button onClick={commitAdd} style={{ ...iconBtn("var(--accent)"), borderColor: "var(--accent)" }}>Open</button>
            <button onClick={() => { setAddingRepo(false); setNewPath(""); }} style={iconBtn()}>✕</button>
          </div>
        ) : (
          <button
            onClick={() => setAddingRepo(true)}
            title="Add repository"
            style={{ ...tab(false), padding: "0 12px", fontSize: 18, color: "var(--text-muted)" }}
          >+</button>
        )}
      </div>

      {/* Action buttons */}
      {activeRepo && (
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
          <button onClick={onRefresh} style={iconBtn()} title="Recargar">↻ Refresh</button>
          <button onClick={onFetch} style={iconBtn()} title="Fetch">⬇ Fetch</button>
          <button onClick={onPull} style={iconBtn()} title="Pull">⬇⬆ Pull</button>
          <button
            onClick={onPush}
            style={{ ...iconBtn("var(--accent)"), borderColor: "var(--accent)" }}
            title="Push"
          >⬆ Push</button>
        </div>
      )}
    </div>
  );
}
