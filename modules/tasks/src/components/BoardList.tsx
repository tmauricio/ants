import { useState } from "react";
import type { Board } from "../App";

const BOARD_COLORS = [
  "#7C3AED", "#4A9EFF", "#1DB954", "#FF6B35",
  "#EC4899", "#F59E0B", "#FF5555", "#06B6D4",
];

export default function BoardList({
  boards,
  onOpen,
  onCreate,
  onDelete,
}: {
  boards: Board[];
  onOpen: (b: Board) => void;
  onCreate: (name: string, description: string, color: string) => void;
  onDelete: (id: string) => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState(BOARD_COLORS[0]);

  function handleCreate() {
    if (!newName.trim()) return;
    onCreate(newName.trim(), newDesc.trim(), newColor);
    setNewName("");
    setNewDesc("");
    setNewColor(BOARD_COLORS[0]);
    setShowNew(false);
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>My boards</h1>
          <p style={styles.subtitle}>{boards.length} board{boards.length !== 1 ? "s" : ""}</p>
        </div>
        <button style={styles.newBtn} onClick={() => setShowNew(true)}>
          + New board
        </button>
      </div>

      {showNew && (
        <div style={styles.newCard}>
          <div style={styles.colorRow}>
            {BOARD_COLORS.map((c) => (
              <button
                key={c}
                style={{
                  ...styles.colorDot,
                  background: c,
                  outline: newColor === c ? `2px solid ${c}` : "none",
                  outlineOffset: 2,
                }}
                onClick={() => setNewColor(c)}
              />
            ))}
          </div>
          <input
            style={styles.input}
            placeholder="Board name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
          />
          <input
            style={styles.input}
            placeholder="Description (optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <div style={styles.newActions}>
            <button style={styles.cancelBtn} onClick={() => setShowNew(false)}>
              Cancel
            </button>
            <button
              style={{ ...styles.createBtn, background: newColor }}
              onClick={handleCreate}
            >
              Create board
            </button>
          </div>
        </div>
      )}

      {boards.length === 0 && !showNew ? (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>◫</div>
          <p style={styles.emptyText}>No boards yet.</p>
          <button style={styles.emptyBtn} onClick={() => setShowNew(true)}>
            Create your first board
          </button>
        </div>
      ) : (
        <div style={styles.grid}>
          {boards.map((b) => (
            <BoardCard
              key={b.id}
              board={b}
              onOpen={() => onOpen(b)}
              onDelete={() => onDelete(b.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BoardCard({
  board,
  onOpen,
  onDelete,
}: {
  board: Board;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div style={{ ...styles.card, borderTopColor: board.color }} onClick={onOpen}>
      <div style={styles.cardTop}>
        <div style={{ ...styles.boardIcon, background: board.color + "22", color: board.color }}>
          {board.name[0].toUpperCase()}
        </div>
        <button
          style={styles.menuBtn}
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu((v) => !v);
            setConfirmDelete(false);
          }}
        >
          ···
        </button>
        {showMenu && (
          <div style={styles.menu} onClick={(e) => e.stopPropagation()}>
            {confirmDelete ? (
              <div style={styles.menuConfirm}>
                <span style={styles.menuConfirmText}>Delete?</span>
                <button style={styles.menuConfirmYes} onClick={() => { setShowMenu(false); onDelete(); }}>
                  Yes
                </button>
                <button style={styles.menuConfirmNo} onClick={() => setConfirmDelete(false)}>
                  No
                </button>
              </div>
            ) : (
              <button style={styles.menuItem} onClick={() => setConfirmDelete(true)}>
                Delete board
              </button>
            )}
          </div>
        )}
      </div>
      <div style={styles.boardName}>{board.name}</div>
      {board.description && (
        <div style={styles.boardDesc}>{board.description}</div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: "100vh",
    overflowY: "auto",
    padding: "32px 40px",
    display: "flex",
    flexDirection: "column",
    gap: 24,
    background: "var(--bg-base)",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "-0.4px",
    marginBottom: 4,
  },
  subtitle: { fontSize: 13, color: "var(--text-secondary)" },
  newBtn: {
    padding: "8px 16px",
    borderRadius: "var(--radius)",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  newCard: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    maxWidth: 420,
  },
  colorRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
  },
  input: {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    padding: "8px 12px",
    fontSize: 13,
    outline: "none",
    width: "100%",
  },
  newActions: { display: "flex", gap: 8, justifyContent: "flex-end" },
  cancelBtn: {
    padding: "7px 14px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text-secondary)",
    cursor: "pointer",
    fontSize: 13,
  },
  createBtn: {
    padding: "7px 14px",
    borderRadius: "var(--radius-sm)",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 16,
  },
  card: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderTop: "3px solid",
    borderRadius: "var(--radius)",
    padding: 16,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    position: "relative",
    transition: "background 0.15s",
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  boardIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 16,
  },
  menuBtn: {
    background: "transparent",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: 16,
    padding: "2px 6px",
    borderRadius: 4,
    letterSpacing: 2,
  },
  menu: {
    position: "absolute",
    top: 48,
    right: 8,
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    zIndex: 100,
    minWidth: 160,
    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
  },
  menuItem: {
    display: "block",
    width: "100%",
    padding: "8px 14px",
    background: "transparent",
    border: "none",
    color: "var(--danger)",
    cursor: "pointer",
    fontSize: 13,
    textAlign: "left",
  },
  boardName: {
    fontWeight: 600,
    fontSize: 14,
    color: "var(--text-primary)",
  },
  boardDesc: {
    fontSize: 12,
    color: "var(--text-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  empty: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingTop: 80,
  },
  emptyIcon: { fontSize: 48, color: "var(--text-muted)" },
  emptyText: { fontSize: 15, color: "var(--text-secondary)" },
  emptyBtn: {
    marginTop: 8,
    padding: "8px 20px",
    borderRadius: "var(--radius)",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  menuConfirm: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
  },
  menuConfirmText: {
    fontSize: 12,
    color: "var(--danger)",
    fontWeight: 600,
    flex: 1,
  },
  menuConfirmYes: {
    padding: "3px 10px",
    borderRadius: "var(--radius-sm)",
    border: "none",
    background: "var(--danger)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  menuConfirmNo: {
    padding: "3px 10px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text-secondary)",
    cursor: "pointer",
    fontSize: 12,
  },
};
