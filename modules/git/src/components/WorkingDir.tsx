import { useState } from "react";
import type { StatusEntry } from "../types";

interface Props {
  status: StatusEntry[];
  onStage: (path: string) => void;
  onUnstage: (path: string) => void;
  onStageAll: () => void;
  onCommit: (message: string) => void;
  onStash: () => void;
  onClose: () => void;
}

export default function WorkingDir({
  status, onStage, onUnstage, onStageAll, onCommit, onStash, onClose,
}: Props) {
  const [commitMsg, setCommitMsg] = useState("");
  const staged = status.filter((s) => s.staged);
  const unstaged = status.filter((s) => !s.staged);

  const panel: React.CSSProperties = {
    width: "var(--detail-w)",
    flexShrink: 0,
    background: "var(--bg-sidebar)",
    borderLeft: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };


  return (
    <div style={panel}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0,
      }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Local changes</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={onStash}
            style={{
              background: "none", border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)", color: "var(--text-secondary)",
              padding: "3px 8px", fontSize: 11, cursor: "pointer",
            }}
            title="Guardar stash"
          >≡ Stash</button>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "var(--text-muted)",
            fontSize: 16, cursor: "pointer", lineHeight: 1,
          }}>×</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Staged files */}
        <SectionHeader label="STAGED" count={staged.length} />
        {staged.length === 0 ? (
          <div style={{ padding: "8px 14px", fontSize: 12, color: "var(--text-muted)" }}>
            No files staged
          </div>
        ) : (
          staged.map((entry) => (
            <FileRow
              key={`s-${entry.path}`}
              entry={entry}
              action={{ label: "−", title: "Unstage", fn: () => onUnstage(entry.path) }}
            />
          ))
        )}

        {/* Unstaged files */}
        <SectionHeader
          label="UNSTAGED"
          count={unstaged.length}
          action={unstaged.length > 0 ? { label: "Stage all", fn: onStageAll } : undefined}
        />
        {unstaged.length === 0 ? (
          <div style={{ padding: "8px 14px", fontSize: 12, color: "var(--text-muted)" }}>
            No changes
          </div>
        ) : (
          unstaged.map((entry) => (
            <FileRow
              key={`u-${entry.path}`}
              entry={entry}
              action={{ label: "+", title: "Stage", fn: () => onStage(entry.path) }}
            />
          ))
        )}
      </div>

      {/* Commit area */}
      <div style={{
        borderTop: "1px solid var(--border)", padding: 12, flexShrink: 0,
      }}>
        <textarea
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          placeholder="Commit message…"
          rows={3}
          style={{
            width: "100%", background: "var(--bg-elevated)",
            border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)", padding: "6px 10px", fontSize: 12,
            resize: "none", outline: "none", fontFamily: "inherit",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        />
        <button
          disabled={!commitMsg.trim() || staged.length === 0}
          onClick={() => { onCommit(commitMsg.trim()); setCommitMsg(""); }}
          style={{
            marginTop: 8, width: "100%",
            background: commitMsg.trim() && staged.length > 0 ? "var(--accent)" : "var(--bg-elevated)",
            border: "none", borderRadius: "var(--radius-sm)",
            color: commitMsg.trim() && staged.length > 0 ? "#fff" : "var(--text-muted)",
            padding: "8px", fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}
        >
          Commit ({staged.length} file{staged.length !== 1 ? "s" : ""})
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ label, count, action }: {
  label: string; count: number; action?: { label: string; fn: () => void };
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", padding: "6px 14px",
      borderTop: "1px solid var(--border-subtle)",
      borderBottom: "1px solid var(--border-subtle)",
      background: "var(--bg-surface)",
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", flex: 1 }}>
        {label} ({count})
      </span>
      {action && (
        <button
          onClick={action.fn}
          style={{
            background: "none", border: "none", color: "var(--accent)",
            fontSize: 11, cursor: "pointer", padding: 0,
          }}
        >{action.label}</button>
      )}
    </div>
  );
}

const STATUS_ICON: Record<string, string> = {
  new: "U",
  modified: "M",
  deleted: "D",
  renamed: "R",
  conflict: "!",
};

const STATUS_COLOR: Record<string, string> = {
  new: "var(--added)",
  modified: "#5cb6f8",
  deleted: "var(--deleted)",
  renamed: "#f9c74f",
  conflict: "var(--warning)",
};

function FileRow({ entry, action }: {
  entry: StatusEntry;
  action: { label: string; title: string; fn: () => void };
}) {
  const [hovered, setHovered] = useState(false);
  const color = STATUS_COLOR[entry.status] ?? "var(--text-secondary)";
  const icon = STATUS_ICON[entry.status] ?? "?";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "5px 14px",
        background: hovered ? "var(--bg-hover)" : "transparent",
      }}
    >
      <span style={{
        fontSize: 10, fontWeight: 700, color,
        background: `${color}22`, padding: "1px 4px",
        borderRadius: 3, flexShrink: 0, width: 16, textAlign: "center",
      }}>{icon}</span>
      <span style={{
        flex: 1, fontSize: 12, fontFamily: "monospace",
        color: "var(--text-secondary)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }} title={entry.path}>
        {entry.path.split(/[\\/]/).pop()}
        <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>
          {entry.path.split(/[\\/]/).slice(0, -1).join("/")}
        </span>
      </span>
      {hovered && (
        <button
          onClick={action.fn}
          title={action.title}
          style={{
            background: "none", border: "1px solid var(--border)",
            borderRadius: 3, color: "var(--text-secondary)",
            width: 20, height: 20, fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >{action.label}</button>
      )}
    </div>
  );
}
