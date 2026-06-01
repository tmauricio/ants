import { useState } from "react";
import type { CommitDetail as CommitDetailType } from "../types";

interface Props {
  detail: CommitDetailType;
  onClose: () => void;
}

export default function CommitDetail({ detail, onClose }: Props) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const toggleFile = (path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

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
        padding: "10px 14px", borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Commit</span>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: "var(--text-muted)",
          fontSize: 16, cursor: "pointer", lineHeight: 1,
        }}>×</button>
      </div>

      {/* Commit meta */}
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{
          fontFamily: "monospace", fontSize: 11, color: "var(--accent)",
          background: "var(--accent-dim)", padding: "2px 6px", borderRadius: 4,
          display: "inline-block", marginBottom: 8,
        }}>
          {detail.short_oid}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6, lineHeight: 1.4 }}>
          {detail.summary}
        </div>
        {detail.body && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "pre-wrap", marginBottom: 8 }}>
            {detail.body}
          </div>
        )}
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          <span style={{ color: "var(--text-secondary)" }}>{detail.author_name}</span>
          <span style={{ marginLeft: 6 }}>{"<"}{detail.author_email}{">"}</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
          {new Date(detail.author_time * 1000).toLocaleString("en")}
        </div>
        {detail.parents.length > 1 && (
          <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
            Merge of {detail.parents.length} parents
          </div>
        )}
      </div>

      {/* File list + diff */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Files changed summary */}
        <div style={{
          padding: "6px 14px", borderBottom: "1px solid var(--border)",
          fontSize: 11, color: "var(--text-muted)", flexShrink: 0,
        }}>
          {detail.files.length} file{detail.files.length !== 1 ? "s" : ""} modified
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {detail.files.map((file) => (
            <div key={file.path}>
              {/* File header */}
              <button
                onClick={() => {
                  toggleFile(file.path);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", background: "none", border: "none",
                  borderBottom: "1px solid var(--border-subtle)",
                  padding: "6px 14px", cursor: "pointer",
                  color: "var(--text-secondary)", textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                <StatusBadge status={file.status} />
                <span style={{
                  flex: 1, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis",
                  whiteSpace: "nowrap", fontFamily: "monospace",
                }}>
                  {file.path}
                </span>
                <span style={{ fontSize: 11, color: "var(--added)", flexShrink: 0 }}>+{file.additions}</span>
                <span style={{ fontSize: 11, color: "var(--deleted)", marginLeft: 4, flexShrink: 0 }}>-{file.deletions}</span>
                <span style={{ marginLeft: 4, fontSize: 10, color: "var(--text-muted)" }}>
                  {expandedFiles.has(file.path) ? "▾" : "▸"}
                </span>
              </button>

              {/* Diff patch */}
              {expandedFiles.has(file.path) && (
                <DiffView patch={file.patch} />
              )}
            </div>
          ))}

          {detail.files.length === 0 && (
            <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>
              No file changes
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    added:    ["A", "var(--added)"],
    deleted:  ["D", "var(--deleted)"],
    modified: ["M", "#5cb6f8"],
    renamed:  ["R", "#f9c74f"],
  };
  const [letter, color] = map[status] ?? ["?", "var(--text-muted)"];
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color,
      background: `${color}22`, padding: "1px 5px",
      borderRadius: 3, flexShrink: 0,
    }}>{letter}</span>
  );
}

function DiffView({ patch }: { patch: string }) {
  const lines = patch.split("\n");
  return (
    <div style={{
      fontFamily: "Cascadia Code, Fira Code, Consolas, monospace",
      fontSize: 11,
      lineHeight: 1.6,
      overflow: "auto",
      maxHeight: 400,
      background: "var(--bg-base)",
      borderBottom: "1px solid var(--border)",
    }}>
      {lines.map((line, i) => {
        const origin = line[0];
        let bg = "transparent";
        let color = "var(--text-secondary)";
        if (origin === "+") { bg = "rgba(63,185,80,0.08)"; color = "var(--added)"; }
        else if (origin === "-") { bg = "rgba(248,81,73,0.08)"; color = "var(--deleted)"; }
        else if (origin === "@") { bg = "var(--bg-surface)"; color = "var(--text-muted)"; }
        return (
          <div key={i} style={{
            background: bg, color, padding: "0 12px",
            whiteSpace: "pre", display: "block",
          }}>
            {line || " "}
          </div>
        );
      })}
    </div>
  );
}
