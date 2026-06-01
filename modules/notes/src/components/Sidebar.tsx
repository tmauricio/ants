import { useState, useRef, useEffect } from "react";
import type { TreeData, FolderItem, NoteItem } from "../App";

type Props = {
  tree: TreeData;
  activeNoteId: string | null;
  onOpenNote: (id: string) => void;
  onCreateNote: (folderId: string | null) => void;
  onDeleteNote: (id: string) => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
};

export default function Sidebar({
  tree,
  activeNoteId,
  onOpenNote,
  onCreateNote,
  onDeleteNote,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: Props) {
  const [search, setSearch] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number;
    type: "folder" | "note" | "root";
    id: string;
    name?: string;
  } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [creating, setCreating] = useState<{ parentId: string | null; type: "note" | "folder"; value: string } | null>(null);

  // Close context menu on click outside
  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const rootNotes = tree.notes.filter(
    (n) => n.folder_id === null &&
    (!search || n.title.toLowerCase().includes(search.toLowerCase()))
  );
  const rootFolders = tree.folders.filter(
    (f) => f.parent_id === null
  );

  function handleContextMenu(
    e: React.MouseEvent,
    type: "folder" | "note" | "root",
    id: string,
    name?: string
  ) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, id, name });
  }

  function commitRename() {
    if (renaming && renaming.value.trim()) {
      onRenameFolder(renaming.id, renaming.value.trim());
    }
    setRenaming(null);
  }

  function commitCreate() {
    if (!creating || !creating.value.trim()) { setCreating(null); return; }
    if (creating.type === "note") onCreateNote(creating.parentId);
    else onCreateFolder(creating.value.trim(), creating.parentId);
    setCreating(null);
  }

  return (
    <nav
      style={styles.sidebar}
      onContextMenu={(e) => handleContextMenu(e, "root", "root")}
    >
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.appName}>Notes</span>
        <button
          style={styles.iconBtn}
          title="New note at root"
          onClick={() => onCreateNote(null)}
        >
          +
        </button>
      </div>

      {/* Search */}
      <div style={styles.searchWrap}>
        <span style={styles.searchIcon}>⌕</span>
        <input
          style={styles.searchInput}
          placeholder="Search notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tree */}
      <div style={styles.tree}>
        {/* Root-level notes */}
        {rootNotes.map((note) => (
          <NoteRow
            key={note.id}
            note={note}
            active={activeNoteId === note.id}
            depth={0}
            onClick={() => onOpenNote(note.id)}
            onContextMenu={(e) => handleContextMenu(e, "note", note.id, note.title)}
          />
        ))}

        {/* Root-level folders */}
        {rootFolders.map((folder) => (
          <FolderRow
            key={folder.id}
            folder={folder}
            allFolders={tree.folders}
            allNotes={tree.notes}
            activeNoteId={activeNoteId}
            depth={0}
            search={search}
            renaming={renaming}
            onOpenNote={onOpenNote}
            onContextMenu={handleContextMenu}
            onCommitRename={commitRename}
            onRenameChange={(v) => setRenaming((r) => r ? { ...r, value: v } : null)}
          />
        ))}

        {/* Inline create form */}
        {creating && (
          <InlineInput
            placeholder={creating.type === "note" ? "Note name…" : "Folder name…"}
            value={creating.value}
            onChange={(v) => setCreating((c) => c ? { ...c, value: v } : null)}
            onCommit={commitCreate}
            onCancel={() => setCreating(null)}
            depth={0}
          />
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          onNewNote={() => {
            onCreateNote(contextMenu.type === "folder" ? contextMenu.id : null);
            setContextMenu(null);
          }}
          onNewFolder={() => {
            setCreating({
              parentId: contextMenu.type === "folder" ? contextMenu.id : null,
              type: "folder",
              value: "",
            });
            setContextMenu(null);
          }}
          onRename={
            contextMenu.type === "folder"
              ? () => {
                  setRenaming({ id: contextMenu.id, value: contextMenu.name ?? "" });
                  setContextMenu(null);
                }
              : undefined
          }
          onDelete={
            contextMenu.type === "folder"
              ? () => { onDeleteFolder(contextMenu.id); setContextMenu(null); }
              : contextMenu.type === "note"
              ? () => { onDeleteNote(contextMenu.id); setContextMenu(null); }
              : undefined
          }
        />
      )}
    </nav>
  );
}

// ── FolderRow ────────────────────────────────────────────────────────────────

function FolderRow({
  folder, allFolders, allNotes, activeNoteId, depth, search,
  renaming, onOpenNote, onContextMenu, onCommitRename, onRenameChange,
}: {
  folder: FolderItem;
  allFolders: FolderItem[];
  allNotes: NoteItem[];
  activeNoteId: string | null;
  depth: number;
  search: string;
  renaming: { id: string; value: string } | null;
  onOpenNote: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, type: "folder" | "note", id: string, name?: string) => void;
  onCommitRename: () => void;
  onRenameChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const childFolders = allFolders.filter((f) => f.parent_id === folder.id);
  const folderNotes = allNotes.filter(
    (n) =>
      n.folder_id === folder.id &&
      (!search || n.title.toLowerCase().includes(search.toLowerCase()))
  );
  const isRenaming = renaming?.id === folder.id;

  return (
    <div>
      <div
        style={{ ...styles.row, paddingLeft: 8 + depth * 14 }}
        onContextMenu={(e) => onContextMenu(e, "folder", folder.id, folder.name)}
      >
        <button style={styles.chevronBtn} onClick={() => setOpen((o) => !o)}>
          <span style={{ ...styles.chevron, transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>
            ›
          </span>
        </button>
        <span style={styles.folderIcon}>📁</span>
        {isRenaming ? (
          <input
            autoFocus
            style={styles.inlineInput}
            value={renaming!.value}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={onCommitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitRename();
              if (e.key === "Escape") onRenameChange("");
            }}
          />
        ) : (
          <span style={styles.rowLabel}>{folder.name}</span>
        )}
      </div>

      {open && (
        <div>
          {folderNotes.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              active={activeNoteId === note.id}
              depth={depth + 1}
              onClick={() => onOpenNote(note.id)}
              onContextMenu={(e) => onContextMenu(e, "note", note.id, note.title)}
            />
          ))}
          {childFolders.map((child) => (
            <FolderRow
              key={child.id}
              folder={child}
              allFolders={allFolders}
              allNotes={allNotes}
              activeNoteId={activeNoteId}
              depth={depth + 1}
              search={search}
              renaming={renaming}
              onOpenNote={onOpenNote}
              onContextMenu={onContextMenu}
              onCommitRename={onCommitRename}
              onRenameChange={onRenameChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── NoteRow ──────────────────────────────────────────────────────────────────

function NoteRow({
  note, active, depth, onClick, onContextMenu,
}: {
  note: NoteItem;
  active: boolean;
  depth: number;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      style={{
        ...styles.row,
        paddingLeft: 28 + depth * 14,
        background: active ? "var(--bg-active)" : "transparent",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <span style={styles.noteIcon}>📝</span>
      <span style={{ ...styles.rowLabel, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {note.title}
      </span>
    </div>
  );
}

// ── InlineInput ──────────────────────────────────────────────────────────────

function InlineInput({
  placeholder, value, onChange, onCommit, onCancel, depth,
}: {
  placeholder: string; value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  depth: number;
}) {
  return (
    <div style={{ ...styles.row, paddingLeft: 28 + depth * 14 }}>
      <input
        autoFocus
        style={styles.inlineInput}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit();
          if (e.key === "Escape") onCancel();
        }}
      />
    </div>
  );
}

// ── ContextMenu ──────────────────────────────────────────────────────────────

function ContextMenu({
  x, y, onNewNote, onNewFolder, onRename, onDelete,
}: {
  x: number; y: number;
  type?: "folder" | "note" | "root";
  onNewNote: () => void;
  onNewFolder: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Clamp to viewport
  const left = Math.min(x, window.innerWidth - 160);
  const top  = Math.min(y, window.innerHeight - 140);

  return (
    <div
      ref={ref}
      style={{ ...styles.ctxMenu, left, top }}
      onClick={(e) => e.stopPropagation()}
    >
      <CtxItem label="+ New note" onClick={onNewNote} />
      <CtxItem label="+ New folder" onClick={onNewFolder} />
      {onRename && <><div style={styles.ctxDivider} /><CtxItem label="Rename" onClick={onRename} /></>}
      {onDelete && <><div style={styles.ctxDivider} /><CtxItem label="Delete" onClick={onDelete} danger /></>}
    </div>
  );
}

function CtxItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      style={{ ...styles.ctxItem, color: danger ? "var(--danger)" : "var(--text-primary)" }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: "var(--sidebar-w)",
    flexShrink: 0,
    background: "var(--bg-sidebar)",
    borderRight: "1px solid var(--border-subtle)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    userSelect: "none",
  },
  header: {
    display: "flex",
    alignItems: "center",
    padding: "14px 12px 8px",
    justifyContent: "space-between",
  },
  appName: {
    fontWeight: 700,
    fontSize: 14,
    color: "var(--text-primary)",
    letterSpacing: "-0.2px",
  },
  iconBtn: {
    width: 26,
    height: 26,
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    background: "transparent",
    color: "var(--text-secondary)",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    position: "relative",
    margin: "0 10px 6px",
  },
  searchIcon: {
    position: "absolute",
    left: 8,
    top: "50%",
    transform: "translateY(-50%)",
    color: "var(--text-muted)",
    fontSize: 15,
    pointerEvents: "none",
  },
  searchInput: {
    width: "100%",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    fontSize: 12,
    padding: "5px 8px 5px 26px",
    outline: "none",
  },
  tree: {
    flex: 1,
    overflowY: "auto",
    padding: "4px 0 16px",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "5px 10px 5px 8px",
    cursor: "pointer",
    borderRadius: 0,
    transition: "background 0.1s",
  },
  chevronBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "0 2px",
    color: "var(--text-muted)",
    flexShrink: 0,
  },
  chevron: {
    display: "inline-block",
    fontSize: 16,
    lineHeight: 1,
    transition: "transform 0.15s",
    color: "var(--text-muted)",
  },
  folderIcon: { fontSize: 13, flexShrink: 0 },
  noteIcon: { fontSize: 12, flexShrink: 0 },
  rowLabel: {
    fontSize: 13,
    color: "inherit",
  },
  inlineInput: {
    flex: 1,
    background: "var(--bg-elevated)",
    border: "1px solid var(--accent)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    fontSize: 12,
    padding: "3px 7px",
    outline: "none",
  },
  ctxMenu: {
    position: "fixed",
    zIndex: 1000,
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "4px",
    minWidth: 150,
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
  },
  ctxItem: {
    display: "block",
    width: "100%",
    padding: "7px 12px",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    textAlign: "left",
    borderRadius: "var(--radius-sm)",
  },
  ctxDivider: {
    height: 1,
    background: "var(--border)",
    margin: "3px 0",
  },
};
