import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Board, Column, TaskCard, Label } from "../App";
import TaskModal from "./TaskModal";

const PRIORITY_COLOR: Record<string, string> = {
  low: "var(--priority-low)",
  medium: "var(--priority-medium)",
  high: "var(--priority-high)",
  urgent: "var(--priority-urgent)",
};

export default function BoardView({
  board,
  onBack,
  onRenameBoard,
  onDeleteBoard,
}: {
  board: Board;
  onBack: () => void;
  onRenameBoard: (id: string, name: string, description: string) => void;
  onDeleteBoard: (id: string) => void;
}) {
  const [columns, setColumns] = useState<Column[]>([]);
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingBoard, setEditingBoard] = useState(false);
  const [confirmDeleteBoard, setConfirmDeleteBoard] = useState(false);
  const [boardName, setBoardName] = useState(board.name);
  const [boardDesc, setBoardDesc] = useState(board.description);

  const reload = useCallback(async () => {
    const [cols, tks, lbls] = await Promise.all([
      invoke<Column[]>("get_columns", { boardId: board.id }),
      invoke<TaskCard[]>("get_tasks_for_board", { boardId: board.id }),
      invoke<Label[]>("get_board_labels", { boardId: board.id }),
    ]);
    setColumns(cols);
    setTasks(tks);
    setLabels(lbls);
  }, [board.id]);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  // ── Board rename ─────────────────────────────────────────────────────────

  async function handleSaveBoard() {
    if (!boardName.trim()) return;
    await invoke("rename_board", { id: board.id, name: boardName.trim(), description: boardDesc.trim() });
    onRenameBoard(board.id, boardName.trim(), boardDesc.trim());
    setEditingBoard(false);
  }

  // ── Column ops ───────────────────────────────────────────────────────────

  async function handleAddColumn() {
    const col = await invoke<Column>("create_column", { boardId: board.id, name: "New column" });
    setColumns((prev) => [...prev, col]);
  }

  async function handleRenameColumn(id: string, name: string) {
    await invoke("rename_column", { id, name });
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  }

  async function handleDeleteColumn(id: string) {
    await invoke("delete_column", { id });
    setColumns((prev) => prev.filter((c) => c.id !== id));
    setTasks((prev) => prev.filter((t) => t.column_id !== id));
  }

  // ── Task ops ─────────────────────────────────────────────────────────────

  async function handleAddTask(columnId: string) {
    const task = await invoke<TaskCard>("create_task", {
      columnId,
      boardId: board.id,
      title: "Nueva tarea",
    });
    setTasks((prev) => [...prev, task]);
    setSelectedTaskId(task.id);
  }

  async function handleMoveTask(taskId: string, targetColId: string, position: number) {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, column_id: targetColId, position } : t
      )
    );
    await invoke("move_task", { taskId, columnId: targetColId, position });
    // Re-fetch to get correct positions after compaction
    const updated = await invoke<TaskCard[]>("get_tasks_for_board", { boardId: board.id });
    setTasks(updated);
  }

  async function handleDeleteTask(id: string) {
    await invoke("delete_task", { id });
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSelectedTaskId(null);
  }

  // ── Label ops ────────────────────────────────────────────────────────────

  async function handleCreateLabel(name: string, color: string) {
    const label = await invoke<Label>("create_label", { boardId: board.id, name, color });
    setLabels((prev) => [...prev, label]);
    return label;
  }

  async function handleDeleteLabel(id: string) {
    await invoke("delete_label", { id });
    setLabels((prev) => prev.filter((l) => l.id !== id));
    setTasks((prev) =>
      prev.map((t) => ({ ...t, labels: t.labels.filter((l) => l.id !== id) }))
    );
  }

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingDot} />
        Loading board…
      </div>
    );
  }

  const colTasks = (colId: string) =>
    tasks.filter((t) => t.column_id === colId).sort((a, b) => a.position - b.position);

  return (
    <div style={styles.wrapper}>
      {/* Topbar */}
      <div style={{ ...styles.topbar, borderBottomColor: board.color + "44" }}>
        <button style={styles.backBtn} onClick={onBack}>
          ← Boards
        </button>
        <div style={styles.boardTitle}>
          <div style={{ ...styles.boardDot, background: board.color }} />
          {editingBoard ? (
            <div style={styles.editBoardRow}>
              <input
                style={styles.editBoardInput}
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveBoard()}
                autoFocus
              />
              <input
                style={{ ...styles.editBoardInput, fontSize: 12, color: "var(--text-secondary)" }}
                value={boardDesc}
                onChange={(e) => setBoardDesc(e.target.value)}
                placeholder="Description"
              />
              <button style={styles.saveBtn} onClick={handleSaveBoard}>Save</button>
              <button style={styles.cancelEditBtn} onClick={() => setEditingBoard(false)}>✕</button>
            </div>
          ) : (
            <span style={styles.titleText} onClick={() => setEditingBoard(true)}>
              {board.name}
            </span>
          )}
        </div>
        <div style={styles.topbarActions}>
          {confirmDeleteBoard ? (
            <div style={styles.confirmRow}>
              <span style={styles.confirmText}>Delete "{board.name}"?</span>
              <button style={styles.confirmYes} onClick={() => { onDeleteBoard(board.id); onBack(); }}>
                Yes, delete
              </button>
              <button style={styles.confirmNo} onClick={() => setConfirmDeleteBoard(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button style={styles.deleteBtn} onClick={() => setConfirmDeleteBoard(true)}>
              Delete board
            </button>
          )}
        </div>
      </div>

      {/* Kanban board */}
      <div style={styles.board}>
        {columns.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={colTasks(col.id)}
            onAddTask={() => handleAddTask(col.id)}
            onRename={(name) => handleRenameColumn(col.id, name)}
            onDelete={() => handleDeleteColumn(col.id)}
            onSelectTask={setSelectedTaskId}
            onMoveTask={handleMoveTask}
          />
        ))}
        <button style={styles.addColBtn} onClick={handleAddColumn}>
          + Add column
        </button>
      </div>

      {/* Task modal */}
      {selectedTaskId && (
        <TaskModal
          taskId={selectedTaskId}
          columns={columns}
          boardLabels={labels}
          onClose={() => setSelectedTaskId(null)}
          onDelete={handleDeleteTask}
          onTaskUpdated={() => reload()}
          onCreateLabel={handleCreateLabel}
          onDeleteLabel={handleDeleteLabel}
        />
      )}
    </div>
  );
}

// ── KanbanColumn ─────────────────────────────────────────────────────────────

const DRAG_KEY = "taskId";

function KanbanColumn({
  column,
  tasks,
  onAddTask,
  onRename,
  onDelete,
  onSelectTask,
  onMoveTask,
}: {
  column: Column;
  tasks: TaskCard[];
  onAddTask: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onSelectTask: (id: string) => void;
  onMoveTask: (taskId: string, colId: string, position: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Counter instead of boolean — avoids false-negatives when cursor moves
  // between child elements (each child fires dragLeave before dragEnter)
  const [dragCounter, setDragCounter] = useState(0);
  const isDragOver = dragCounter > 0;

  function handleRename() {
    if (name.trim() && name.trim() !== column.name) onRename(name.trim());
    setEditing(false);
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    setDragCounter((c) => c + 1);
  }

  function handleDragLeave() {
    setDragCounter((c) => Math.max(0, c - 1));
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragCounter(0);
    const taskId = e.dataTransfer.getData(DRAG_KEY);
    if (taskId) onMoveTask(taskId, column.id, tasks.length);
  }

  return (
    <div
      style={{
        ...styles.column,
        ...(isDragOver ? styles.columnDragOver : {}),
      }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div style={styles.colHeader}>
        {editing ? (
          <input
            style={styles.colNameInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") { setName(column.name); setEditing(false); }
            }}
            autoFocus
          />
        ) : (
          <span style={styles.colName} onDoubleClick={() => setEditing(true)}>
            {column.name}
          </span>
        )}
        <span style={styles.colCount}>{tasks.length}</span>
        {confirmDelete ? (
          <div style={styles.colConfirm}>
            <button style={styles.colConfirmYes} onClick={onDelete}>✓</button>
            <button style={styles.colConfirmNo} onClick={() => setConfirmDelete(false)}>✕</button>
          </div>
        ) : (
          <button style={styles.colMenuBtn} onClick={() => setConfirmDelete(true)} title="Eliminar columna">×</button>
        )}
      </div>

      <div style={styles.taskList}>
        {tasks.map((task, idx) => (
          <TaskCardView
            key={task.id}
            task={task}
            onSelect={() => onSelectTask(task.id)}
            onDropBefore={(taskId) => onMoveTask(taskId, column.id, idx)}
          />
        ))}
      </div>

      <button style={styles.addTaskBtn} onClick={onAddTask}>
        + Add task
      </button>
    </div>
  );
}

// ── TaskCardView ──────────────────────────────────────────────────────────────

function TaskCardView({
  task,
  onSelect,
  onDropBefore,
}: {
  task: TaskCard;
  onSelect: () => void;
  onDropBefore: (taskId: string) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const overdue = task.due_date && new Date(task.due_date) < new Date();
  const dueLabel = task.due_date
    ? new Date(task.due_date).toLocaleDateString("en", { day: "2-digit", month: "short" })
    : null;

  // Distinguish drag from click: only open modal if not dragging
  let dragMoved = false;

  return (
    <div
      draggable
      onDragStart={(e) => {
        dragMoved = false;
        setIsDragging(true);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData(DRAG_KEY, task.id);
      }}
      onDragEnd={() => { setIsDragging(false); dragMoved = true; }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
      onDragLeave={(e) => { e.stopPropagation(); setIsDragOver(false); }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const taskId = e.dataTransfer.getData(DRAG_KEY);
        if (taskId && taskId !== task.id) onDropBefore(taskId);
      }}
      onClick={() => { if (!dragMoved) onSelect(); }}
      style={{
        ...styles.card,
        ...(isDragging ? styles.cardDragging : {}),
        ...(isDragOver ? styles.cardDragOver : {}),
      }}
    >
      {/* Labels */}
      {task.labels.length > 0 && (
        <div style={styles.labelRow}>
          {task.labels.map((l) => (
            <span key={l.id} style={{ ...styles.labelChip, background: l.color + "33", color: l.color }}>
              {l.name}
            </span>
          ))}
        </div>
      )}

      {/* Title + priority dot */}
      <div style={styles.cardTitleRow}>
        <div
          style={{
            ...styles.priorityDot,
            background: PRIORITY_COLOR[task.priority] ?? "#888",
          }}
          title={task.priority}
        />
        <span style={styles.cardTitle}>{task.title}</span>
      </div>

      {/* Footer: assignee, due date, counters */}
      <div style={styles.cardFooter}>
        <div style={styles.cardMeta}>
          {task.assignee && (
            <span style={styles.assigneePill}>
              {task.assignee[0].toUpperCase()}
            </span>
          )}
          {dueLabel && (
            <span style={{ ...styles.duePill, color: overdue ? "var(--danger)" : "var(--text-muted)" }}>
              📅 {dueLabel}
            </span>
          )}
        </div>
        <div style={styles.cardCounters}>
          {task.comment_count > 0 && (
            <span style={styles.counter}>💬 {task.comment_count}</span>
          )}
          {task.checklist_total > 0 && (
            <span
              style={{
                ...styles.counter,
                color: task.checklist_done === task.checklist_total
                  ? "var(--priority-low)"
                  : "var(--text-muted)",
              }}
            >
              ✓ {task.checklist_done}/{task.checklist_total}
            </span>
          )}
          {task.estimate && (
            <span style={styles.counter}>
              {task.estimate}{task.estimate_unit === "hours" ? "h" : "sp"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "var(--bg-base)",
    overflow: "hidden",
  },
  loading: {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    color: "var(--text-secondary)",
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "var(--accent)",
  },
  topbar: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "12px 20px",
    borderBottom: "1px solid",
    background: "var(--bg-surface)",
    flexShrink: 0,
  },
  backBtn: {
    background: "transparent",
    border: "none",
    color: "var(--text-secondary)",
    cursor: "pointer",
    fontSize: 13,
    padding: "4px 8px",
    borderRadius: "var(--radius-sm)",
  },
  boardTitle: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  boardDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    flexShrink: 0,
  },
  titleText: {
    fontWeight: 600,
    fontSize: 15,
    color: "var(--text-primary)",
    cursor: "pointer",
  },
  editBoardRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  editBoardInput: {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    padding: "4px 10px",
    fontSize: 14,
    outline: "none",
    fontWeight: 600,
  },
  saveBtn: {
    padding: "4px 12px",
    borderRadius: "var(--radius-sm)",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  cancelEditBtn: {
    padding: "4px 8px",
    borderRadius: "var(--radius-sm)",
    border: "none",
    background: "transparent",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: 14,
  },
  topbarActions: { display: "flex", gap: 8 },
  deleteBtn: {
    padding: "5px 12px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--danger)",
    cursor: "pointer",
    fontSize: 12,
  },
  board: {
    display: "flex",
    gap: 14,
    padding: "20px 20px",
    overflowX: "auto",
    flex: 1,
    alignItems: "flex-start",
  },
  column: {
    width: 272,
    flexShrink: 0,
    background: "var(--bg-surface)",
    borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    maxHeight: "calc(100vh - 120px)",
    transition: "border-color 0.15s, background 0.15s",
  },
  columnDragOver: {
    borderColor: "var(--accent)",
    background: "var(--accent-dim)",
  },
  colHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 14px 10px",
    borderBottom: "1px solid var(--border-subtle)",
    flexShrink: 0,
  },
  colName: {
    fontWeight: 600,
    fontSize: 13,
    color: "var(--text-primary)",
    flex: 1,
    cursor: "default",
  },
  colNameInput: {
    flex: 1,
    background: "var(--bg-elevated)",
    border: "1px solid var(--accent)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    padding: "2px 8px",
    fontSize: 13,
    fontWeight: 600,
    outline: "none",
  },
  colCount: {
    fontSize: 11,
    color: "var(--text-muted)",
    background: "var(--bg-elevated)",
    borderRadius: 10,
    padding: "1px 7px",
    fontWeight: 600,
  },
  colMenuBtn: {
    background: "transparent",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
    padding: "0 2px",
  },
  taskList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: "10px 10px",
    overflowY: "auto",
    flex: 1,
  },
  addTaskBtn: {
    margin: "4px 10px 10px",
    padding: "7px 12px",
    borderRadius: "var(--radius-sm)",
    border: "1px dashed var(--border)",
    background: "transparent",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: 12,
    textAlign: "left",
    transition: "all 0.15s",
    flexShrink: 0,
  },
  addColBtn: {
    width: 200,
    flexShrink: 0,
    padding: "10px 16px",
    borderRadius: "var(--radius)",
    border: "1px dashed var(--border)",
    background: "transparent",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: 13,
    alignSelf: "flex-start",
  },
  card: {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    padding: "10px 12px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    transition: "border-color 0.1s",
    userSelect: "none",
  },
  cardDragging: { opacity: 0.4 },
  cardDragOver: {
    borderColor: "var(--accent)",
    borderStyle: "dashed",
  },
  labelRow: { display: "flex", gap: 4, flexWrap: "wrap" },
  labelChip: {
    fontSize: 10,
    fontWeight: 600,
    padding: "1px 7px",
    borderRadius: 10,
    letterSpacing: "0.2px",
  },
  cardTitleRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
  },
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    flexShrink: 0,
    marginTop: 5,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 500,
    color: "var(--text-primary)",
    lineHeight: 1.4,
  },
  cardFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardMeta: { display: "flex", alignItems: "center", gap: 6 },
  assigneePill: {
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "var(--accent-dim)",
    color: "var(--accent)",
    fontSize: 10,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  duePill: { fontSize: 10 },
  cardCounters: { display: "flex", gap: 8 },
  counter: { fontSize: 10, color: "var(--text-muted)" },
  // Column confirm delete
  colConfirm: {
    display: "flex",
    gap: 4,
    alignItems: "center",
  },
  colConfirmYes: {
    background: "var(--danger)",
    border: "none",
    borderRadius: "var(--radius-sm)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    padding: "2px 7px",
  },
  colConfirmNo: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: 12,
    padding: "2px 7px",
  },
  // Board confirm delete (topbar)
  confirmRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  confirmText: {
    fontSize: 12,
    color: "var(--danger)",
    fontWeight: 600,
  },
  confirmYes: {
    padding: "5px 12px",
    borderRadius: "var(--radius-sm)",
    border: "none",
    background: "var(--danger)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  confirmNo: {
    padding: "5px 12px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text-secondary)",
    cursor: "pointer",
    fontSize: 12,
  },
};
