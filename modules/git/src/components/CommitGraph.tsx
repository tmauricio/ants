import { useRef, useState } from "react";
import type { GraphRow, StatusEntry } from "../types";
import { LANE_COLORS } from "../types";

const ROW_H = 36;
const LANE_W = 18;
const DOT_R = 5;

interface Props {
  rows: GraphRow[];
  selectedOid: string | null;
  status: StatusEntry[];
  loading: boolean;
  onSelectCommit: (oid: string) => void;
  onSelectWip: () => void;
  onCreateBranch: (name: string, fromOid: string) => void;
}

export default function CommitGraph({
  rows, selectedOid, status, loading, onSelectCommit, onSelectWip, onCreateBranch,
}: Props) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; oid: string } | null>(null);
  const [branchInput, setBranchInput] = useState<{ oid: string } | null>(null);
  const [branchName, setBranchName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const hasWip = status.length > 0;
  const wipStaged = status.filter((s) => s.staged).length;
  const wipUnstaged = status.filter((s) => !s.staged).length;

  const header: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    height: "var(--col-hdr-h)",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-surface)",
    flexShrink: 0,
    fontSize: 11,
    color: "var(--text-muted)",
    fontWeight: 600,
    letterSpacing: "0.04em",
    padding: "0 8px",
    userSelect: "none",
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}
      onClick={() => setCtxMenu(null)}>

      {/* Column header */}
      <div style={header}>
        <span style={{ width: 160, flexShrink: 0, paddingLeft: 8 }}>GRAPH</span>
        <span style={{ flex: 1 }}>MESSAGE</span>
        <span style={{ width: 160, flexShrink: 0 }}>AUTHOR</span>
        <span style={{ width: 110, flexShrink: 0 }}>DATE</span>
      </div>

      {/* Rows */}
      <div ref={containerRef} style={{ flex: 1, overflowY: "auto", position: "relative" }}>
        {loading && (
          <div style={{ padding: 20, color: "var(--text-muted)", textAlign: "center" }}>
            Loading history…
          </div>
        )}

        {/* WIP row (uncommitted changes) */}
        {hasWip && !loading && (
          <WipRow
            staged={wipStaged}
            unstaged={wipUnstaged}
            selected={selectedOid === "__wip__"}
            onClick={onSelectWip}
          />
        )}

        {/* Commit rows */}
        {rows.map((row, idx) => {
          const prevEdges = idx > 0 ? rows[idx - 1].edges : [];
          return (
            <CommitRow
              key={row.oid}
              row={row}
              prevEdges={prevEdges}
              selected={selectedOid === row.oid}
              onSelect={() => onSelectCommit(row.oid)}
              onContext={(x, y) => setCtxMenu({ x, y, oid: row.oid })}
            />
          );
        })}

        {rows.length === 0 && !loading && (
          <div style={{ padding: 24, color: "var(--text-muted)", textAlign: "center", fontSize: 13 }}>
            No commits
          </div>
        )}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setCtxMenu(null)} />
          <div style={{
            position: "fixed", left: ctxMenu.x, top: ctxMenu.y, zIndex: 100,
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", minWidth: 200,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden",
          }}>
            {[
              {
                label: "Create branch here…",
                action: () => {
                  setBranchInput({ oid: ctxMenu.oid });
                  setBranchName("");
                  setCtxMenu(null);
                },
              },
              {
                label: `Copy hash (${ctxMenu.oid.slice(0, 8)})`,
                action: () => { navigator.clipboard.writeText(ctxMenu.oid); setCtxMenu(null); },
              },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                style={{
                  display: "block", width: "100%", background: "none",
                  border: "none", color: "var(--text-primary)", padding: "8px 16px",
                  textAlign: "left", fontSize: 13, cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Branch name input overlay */}
      {branchInput && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99, background: "rgba(0,0,0,0.4)" }}
            onClick={() => setBranchInput(null)} />
          <div style={{
            position: "fixed", top: "40%", left: "50%", transform: "translate(-50%,-50%)",
            zIndex: 100, background: "var(--bg-elevated)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: 20, width: 320,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>New branch</div>
            <input
              autoFocus
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && branchName.trim()) {
                  onCreateBranch(branchName.trim(), branchInput.oid);
                  setBranchInput(null);
                }
                if (e.key === "Escape") setBranchInput(null);
              }}
              placeholder="branch-name"
              style={{
                width: "100%", background: "var(--bg-surface)", border: "1px solid var(--accent)",
                borderRadius: "var(--radius-sm)", color: "var(--text-primary)",
                padding: "6px 10px", fontSize: 13, outline: "none",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button onClick={() => setBranchInput(null)} style={cancelBtnStyle}>Cancel</button>
              <button
                onClick={() => {
                  if (branchName.trim()) {
                    onCreateBranch(branchName.trim(), branchInput.oid);
                    setBranchInput(null);
                  }
                }}
                style={confirmBtnStyle}
              >Create</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── WIP row ──────────────────────────────────────────────────────────────────

function WipRow({
  staged, unstaged, selected, onClick,
}: {
  staged: number; unstaged: number; selected: boolean; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", height: ROW_H,
        background: selected ? "var(--accent-dim)" : hovered ? "var(--bg-hover)" : "transparent",
        borderBottom: "1px solid var(--border-subtle)",
        cursor: "pointer", userSelect: "none",
        borderLeft: selected ? "2px solid var(--accent)" : "2px solid transparent",
      }}
    >
      {/* Graph cell */}
      <div style={{ width: 160, flexShrink: 0, display: "flex", alignItems: "center" }}>
        <svg width={LANE_W} height={ROW_H} style={{ flexShrink: 0, overflow: "visible" }}>
          <circle cx={LANE_W / 2} cy={ROW_H / 2} r={DOT_R + 1}
            fill="none" stroke="var(--warning)" strokeWidth={2} strokeDasharray="3 2" />
        </svg>
        <span style={{ fontSize: 11, color: "var(--warning)", fontWeight: 600, marginLeft: 4 }}>WIP</span>
      </div>
      {/* Summary */}
      <span style={{ flex: 1, color: "var(--warning)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        Uncommitted changes
        {staged > 0 && <span style={{ marginLeft: 8, opacity: 0.7, fontSize: 11 }}>{staged} staged</span>}
        {unstaged > 0 && <span style={{ marginLeft: 4, opacity: 0.7, fontSize: 11 }}>{unstaged} unstaged</span>}
      </span>
    </div>
  );
}

// ── Commit row ────────────────────────────────────────────────────────────────

function CommitRow({
  row, prevEdges, selected, onSelect, onContext,
}: {
  row: GraphRow;
  prevEdges: [number, number, number][];
  selected: boolean;
  onSelect: () => void;
  onContext: (x: number, y: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const svgWidth = (row.num_lanes + 1) * LANE_W;

  return (
    <div
      onClick={onSelect}
      onContextMenu={(e) => { e.preventDefault(); onContext(e.clientX, e.clientY); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", height: ROW_H,
        background: selected ? "var(--accent-dim)" : hovered ? "var(--bg-hover)" : "transparent",
        borderBottom: "1px solid var(--border-subtle)",
        cursor: "pointer", userSelect: "none",
        borderLeft: selected ? "2px solid var(--accent)" : "2px solid transparent",
      }}
    >
      {/* Graph cell */}
      <div style={{ width: 160, flexShrink: 0, display: "flex", alignItems: "center", overflow: "hidden" }}>
        <svg width={svgWidth} height={ROW_H} style={{ flexShrink: 0, overflow: "visible", minWidth: svgWidth }}>
          {/* Incoming edges: always straight verticals.
              Each prevEdge [from, to, color] means the line arrived at lane `to`
              at the bottom of the previous row — it enters this row at (to, 0)
              and goes straight down to (to, ROW_H/2). The curve already happened
              in the previous row's lower half. */}
          {prevEdges.map(([_from, to, ci], i) => (
            <line
              key={`in-${i}`}
              x1={cx(to)} y1={0}
              x2={cx(to)} y2={ROW_H / 2}
              stroke={LANE_COLORS[ci % LANE_COLORS.length]}
              strokeWidth={2}
            />
          ))}
          {/* Outgoing edges: straight or curved to next lane */}
          {row.edges.map(([from, to, ci], i) => (
            <GraphEdgeLine
              key={`out-${i}`}
              x1={cx(from)} y1={ROW_H / 2}
              x2={cx(to)} y2={ROW_H}
              color={LANE_COLORS[ci % LANE_COLORS.length]}
            />
          ))}
          {/* Commit dot */}
          <circle
            cx={cx(row.lane)}
            cy={ROW_H / 2}
            r={DOT_R}
            fill={row.color}
            stroke={selected ? "#fff" : row.color}
            strokeWidth={selected ? 2 : 0}
          />
          {row.is_merge && (
            <circle
              cx={cx(row.lane)}
              cy={ROW_H / 2}
              r={DOT_R - 2}
              fill="var(--bg-base)"
            />
          )}
        </svg>

        {/* Branch/tag labels */}
        {row.refs.length > 0 && (
          <div style={{ display: "flex", gap: 3, flexShrink: 0, overflow: "hidden", maxWidth: 100 }}>
            {row.refs.slice(0, 2).map((ref) => (
              <RefLabel key={ref} label={ref} />
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <span style={{
        flex: 1,
        fontSize: 13,
        color: selected ? "var(--text-primary)" : "var(--text-secondary)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        paddingRight: 8,
      }}>
        {row.summary}
      </span>

      {/* Author */}
      <span style={{
        width: 160, flexShrink: 0,
        fontSize: 12, color: "var(--text-muted)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {row.author_name}
      </span>

      {/* Date */}
      <span style={{
        width: 110, flexShrink: 0,
        fontSize: 11, color: "var(--text-muted)",
      }}>
        {formatDate(row.author_time)}
      </span>
    </div>
  );
}

function GraphEdgeLine({ x1, y1, x2, y2, color }: {
  x1: number; y1: number; x2: number; y2: number; color: string;
}) {
  if (x1 === x2) {
    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2} />;
  }
  // Cubic bezier: exits vertically from (x1,y1), arrives vertically at (x2,y2).
  // Control points are directly below/above each endpoint so the curve is smooth.
  const yMid = (y1 + y2) / 2;
  return (
    <path
      d={`M ${x1} ${y1} C ${x1} ${yMid}, ${x2} ${yMid}, ${x2} ${y2}`}
      stroke={color}
      strokeWidth={2}
      fill="none"
    />
  );
}

function RefLabel({ label }: { label: string }) {
  const isTag = label.startsWith("tag: ");
  const name = isTag ? label.slice(5) : label;
  const isRemote = name.includes("/");
  return (
    <span style={{
      fontSize: 10,
      padding: "1px 5px",
      borderRadius: 3,
      background: isTag
        ? "rgba(249,199,79,0.15)"
        : isRemote
        ? "rgba(92,182,248,0.12)"
        : "rgba(29,166,114,0.15)",
      color: isTag ? "#f9c74f" : isRemote ? "#5cb6f8" : "var(--accent)",
      border: `1px solid ${isTag ? "rgba(249,199,79,0.3)" : isRemote ? "rgba(92,182,248,0.2)" : "rgba(29,166,114,0.3)"}`,
      whiteSpace: "nowrap",
      maxWidth: 80,
      overflow: "hidden",
      textOverflow: "ellipsis",
      display: "inline-block",
    }} title={name}>
      {isTag ? "⌖ " : isRemote ? "⬆ " : "⎇ "}{name}
    </span>
  );
}

function cx(lane: number): number {
  return lane * LANE_W + LANE_W / 2;
}

function formatDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return d.toLocaleDateString("en", { day: "numeric", month: "short", year: "2-digit" });
}

const cancelBtnStyle: React.CSSProperties = {
  background: "none", border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)", color: "var(--text-secondary)",
  padding: "6px 14px", cursor: "pointer", fontSize: 13,
};

const confirmBtnStyle: React.CSSProperties = {
  background: "var(--accent)", border: "none",
  borderRadius: "var(--radius-sm)", color: "#fff",
  padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600,
};
