import { useState } from "react";
import type { BranchInfo, TagInfo, StashInfo } from "../types";

interface Props {
  branches: BranchInfo[];
  tags: TagInfo[];
  stashes: StashInfo[];
  onCheckout: (name: string) => void;
  onDeleteBranch: (name: string) => void;
  onStashPop: (index: number) => void;
}

export default function Sidebar({ branches, tags, stashes, onCheckout, onDeleteBranch, onStashPop }: Props) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    local: true, remote: false, tags: false, stashes: false,
  });
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; type: "branch" | "stash"; name: string; idx?: number } | null>(null);

  const toggle = (key: string) => setOpenSections((p) => ({ ...p, [key]: !p[key] }));

  const localBranches = branches.filter((b) => !b.name.includes("/"));
  const remoteBranches = branches.filter((b) => b.name.includes("/"));

  const sidebar: React.CSSProperties = {
    width: "var(--sidebar-w)",
    flexShrink: 0,
    background: "var(--bg-sidebar)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  const scroll: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: "8px 0",
  };

  return (
    <div style={sidebar} onClick={() => setCtxMenu(null)}>
      <div style={scroll}>
        <Section
          label="LOCAL"
          open={openSections.local}
          onToggle={() => toggle("local")}
          count={localBranches.length}
        >
          {localBranches.map((b) => (
            <BranchRow
              key={b.name}
              branch={b}
              onCheckout={() => onCheckout(b.name)}
              onContext={(x, y) => setCtxMenu({ x, y, type: "branch", name: b.name })}
            />
          ))}
        </Section>

        <Section
          label="REMOTES"
          open={openSections.remote}
          onToggle={() => toggle("remote")}
          count={remoteBranches.length}
        >
          {remoteBranches.map((b) => (
            <BranchRow
              key={b.name}
              branch={b}
              onCheckout={() => onCheckout(b.name)}
              onContext={(x, y) => setCtxMenu({ x, y, type: "branch", name: b.name })}
            />
          ))}
        </Section>

        <Section
          label="TAGS"
          open={openSections.tags}
          onToggle={() => toggle("tags")}
          count={tags.length}
        >
          {tags.map((t) => (
            <div key={t.name} style={rowStyle(false)} title={t.oid}>
              <span style={{ opacity: 0.6, fontSize: 11 }}>⌖</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.name}
              </span>
            </div>
          ))}
        </Section>

        <Section
          label="STASHES"
          open={openSections.stashes}
          onToggle={() => toggle("stashes")}
          count={stashes.length}
        >
          {stashes.map((s) => (
            <div
              key={s.index}
              style={rowStyle(false)}
              onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, type: "stash", name: s.message, idx: s.index }); }}
            >
              <span style={{ opacity: 0.6, fontSize: 11 }}>≡</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.message}
              </span>
            </div>
          ))}
        </Section>
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={
            ctxMenu.type === "branch"
              ? [
                  { label: "Checkout", action: () => { onCheckout(ctxMenu.name); setCtxMenu(null); } },
                  { label: "Delete branch", action: () => { onDeleteBranch(ctxMenu.name); setCtxMenu(null); }, danger: true },
                ]
              : [
                  { label: "Pop stash", action: () => { onStashPop(ctxMenu.idx!); setCtxMenu(null); } },
                ]
          }
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

function Section({
  label, open, onToggle, count, children,
}: {
  label: string; open: boolean; onToggle: () => void; count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          padding: "4px 12px",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.05em",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 10 }}>{open ? "▾" : "▸"}</span>
        {label}
        <span style={{ marginLeft: "auto", fontWeight: 400 }}>{count}</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function BranchRow({
  branch, onCheckout, onContext,
}: {
  branch: BranchInfo;
  onCheckout: () => void;
  onContext: (x: number, y: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const shortName = branch.name.split("/").pop() ?? branch.name;

  return (
    <div
      style={rowStyle(branch.is_head, hovered)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onCheckout}
      onContextMenu={(e) => { e.preventDefault(); onContext(e.clientX, e.clientY); }}
      title={branch.name}
    >
      <span style={{ color: branch.is_head ? "var(--accent)" : "var(--text-muted)", fontSize: 12 }}>
        {branch.is_head ? "●" : "○"}
      </span>
      <span style={{
        flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        color: branch.is_head ? "var(--text-primary)" : "var(--text-secondary)",
        fontWeight: branch.is_head ? 600 : 400,
      }}>
        {shortName}
      </span>
      {branch.upstream && (
        <span style={{ fontSize: 10, color: "var(--text-muted)", opacity: 0.7 }}>↑</span>
      )}
    </div>
  );
}

function rowStyle(active: boolean, hovered = false): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 12px 4px 24px",
    cursor: "pointer",
    background: active
      ? "var(--accent-dim)"
      : hovered
      ? "var(--bg-hover)"
      : "transparent",
    fontSize: 13,
    color: "var(--text-secondary)",
    userSelect: "none",
  };
}

function ContextMenu({
  x, y, items, onClose,
}: {
  x: number; y: number;
  items: { label: string; action: () => void; danger?: boolean }[];
  onClose: () => void;
}) {
  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 99 }}
        onClick={onClose}
      />
      <div style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: 100,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        minWidth: 160,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        overflow: "hidden",
      }}>
        {items.map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            style={{
              display: "block",
              width: "100%",
              background: "none",
              border: "none",
              color: item.danger ? "var(--danger)" : "var(--text-primary)",
              padding: "8px 16px",
              textAlign: "left",
              fontSize: 13,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
