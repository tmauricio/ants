import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  FullTask, Column, Label, Comment, Checklist, ChecklistItem,
} from "../App";

const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"] as const;
const PRIORITY_LABELS: Record<string, string> = {
  low: "Low", medium: "Medium", high: "High", urgent: "Urgent",
};
const PRIORITY_COLOR: Record<string, string> = {
  low: "var(--priority-low)",
  medium: "var(--priority-medium)",
  high: "var(--priority-high)",
  urgent: "var(--priority-urgent)",
};
const LABEL_COLORS = [
  "#FF5555", "#FF6B35", "#F59E0B", "#1DB954",
  "#4A9EFF", "#7C3AED", "#EC4899", "#06B6D4",
];

export default function TaskModal({
  taskId,
  columns,
  boardLabels,
  onClose,
  onDelete,
  onTaskUpdated,
  onCreateLabel,
  onDeleteLabel,
}: {
  taskId: string;
  columns: Column[];
  boardLabels: Label[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onTaskUpdated: () => void;
  onCreateLabel: (name: string, color: string) => Promise<Label>;
  onDeleteLabel: (id: string) => void;
}) {
  const [task, setTask] = useState<FullTask | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Editable fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [estimate, setEstimate] = useState("");
  const [estimateUnit, setEstimateUnit] = useState("points");

  // Comment input
  const [commentText, setCommentText] = useState("");
  const [commentAuthor] = useState("Yo");

  // Label picker
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);

  // Checklist
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newItemTexts, setNewItemTexts] = useState<Record<string, string>>({});

  async function loadTask() {
    const t = await invoke<FullTask>("get_full_task", { id: taskId });
    setTask(t);
    setTitle(t.title);
    setDescription(t.description);
    setAssignee(t.assignee ?? "");
    setDueDate(t.due_date ?? "");
    setPriority(t.priority);
    setEstimate(t.estimate != null ? String(t.estimate) : "");
    setEstimateUnit(t.estimate_unit);
  }

  useEffect(() => {
    loadTask();
  }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  function scheduleSave(
    t: string, d: string, a: string, dd: string,
    p: string, est: string, eu: string
  ) {
    setSaving(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await invoke("update_task", {
        id: taskId,
        title: t,
        description: d,
        assignee: a || null,
        dueDate: dd || null,
        priority: p,
        estimate: est ? parseFloat(est) : null,
        estimateUnit: eu,
      });
      setSaving(false);
      onTaskUpdated();
    }, 600);
  }

  function handleField<T>(
    setter: (v: T) => void,
    field: "title" | "description" | "assignee" | "dueDate" | "priority" | "estimate" | "estimateUnit",
    value: T,
  ) {
    setter(value);
    const vals = {
      title, description, assignee, dueDate, priority, estimate, estimateUnit,
      [field]: value,
    };
    scheduleSave(
      String(vals.title), String(vals.description), String(vals.assignee),
      String(vals.dueDate), String(vals.priority), String(vals.estimate),
      String(vals.estimateUnit)
    );
  }

  // ── Labels ────────────────────────────────────────────────────────────────

  async function toggleLabel(label: Label) {
    if (!task) return;
    const currentIds = task.labels.map((l) => l.id);
    const newIds = currentIds.includes(label.id)
      ? currentIds.filter((id) => id !== label.id)
      : [...currentIds, label.id];
    await invoke("set_task_labels", { taskId, labelIds: newIds });
    await loadTask();
    onTaskUpdated();
  }

  async function handleCreateLabel() {
    if (!newLabelName.trim()) return;
    const label = await onCreateLabel(newLabelName.trim(), newLabelColor);
    // Add it to the task
    if (task) {
      const newIds = [...task.labels.map((l) => l.id), label.id];
      await invoke("set_task_labels", { taskId, labelIds: newIds });
    }
    setNewLabelName("");
    setNewLabelColor(LABEL_COLORS[0]);
    await loadTask();
    onTaskUpdated();
  }

  // ── Comments ──────────────────────────────────────────────────────────────

  async function handleAddComment() {
    if (!commentText.trim()) return;
    await invoke<Comment>("add_comment", { taskId, author: commentAuthor, body: commentText.trim() });
    setCommentText("");
    await loadTask();
  }

  async function handleDeleteComment(id: string) {
    await invoke("delete_comment", { id });
    await loadTask();
  }

  // ── Checklists ────────────────────────────────────────────────────────────

  async function handleAddChecklist() {
    if (!newChecklistTitle.trim()) return;
    await invoke<Checklist>("create_checklist", { taskId, title: newChecklistTitle.trim() });
    setNewChecklistTitle("");
    await loadTask();
  }

  async function handleDeleteChecklist(id: string) {
    await invoke("delete_checklist", { id });
    await loadTask();
  }

  async function handleAddItem(checklistId: string) {
    const text = newItemTexts[checklistId]?.trim();
    if (!text) return;
    await invoke<ChecklistItem>("add_checklist_item", { checklistId, text });
    setNewItemTexts((prev) => ({ ...prev, [checklistId]: "" }));
    await loadTask();
  }

  async function handleToggleItem(id: string, isDone: boolean) {
    await invoke("toggle_checklist_item", { id, isDone });
    await loadTask();
  }

  async function handleDeleteItem(id: string) {
    await invoke("delete_checklist_item", { id });
    await loadTask();
  }

  // ── Move column ───────────────────────────────────────────────────────────

  async function handleMoveColumn(columnId: string) {
    if (!task) return;
    await invoke("move_task", { taskId, columnId, position: 9999 });
    await loadTask();
    onTaskUpdated();
  }

  if (!task) {
    return (
      <div style={styles.overlay}>
        <div style={styles.modal}>
          <div style={styles.loadingText}>Loading…</div>
        </div>
      </div>
    );
  }

  const checklistProgress = task.checklists.reduce(
    (acc, cl) => ({
      done: acc.done + cl.items.filter((i) => i.is_done).length,
      total: acc.total + cl.items.length,
    }),
    { done: 0, total: 0 }
  );

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.modalHeader}>
          <div style={styles.headerLeft}>
            <div
              style={{
                ...styles.priorityBadge,
                background: PRIORITY_COLOR[priority] + "22",
                color: PRIORITY_COLOR[priority],
              }}
            >
              {PRIORITY_LABELS[priority]}
            </div>
            <span style={styles.columnPill}>
              {columns.find((c) => c.id === task.column_id)?.name ?? "—"}
            </span>
          </div>
          <div style={styles.headerActions}>
            {confirmDelete ? (
              <div style={styles.confirmRow}>
                <span style={styles.confirmText}>Delete task?</span>
                <button style={styles.confirmYes} onClick={() => onDelete(task.id)}>
                  Yes, delete
                </button>
                <button style={styles.confirmNo} onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button style={styles.deleteTaskBtn} onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            )}
            <button style={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={styles.modalBody}>
          {/* Left: main content */}
          <div style={styles.mainCol}>
            {/* Title */}
            <textarea
              style={styles.titleInput}
              value={title}
              onChange={(e) => handleField(setTitle, "title", e.target.value)}
              rows={2}
              placeholder="Task title"
            />

            {/* Labels */}
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionLabel}>Labels</span>
                <button style={styles.sectionAction} onClick={() => setShowLabelPicker((v) => !v)}>
                  + Manage
                </button>
              </div>
              <div style={styles.labelRow}>
                {task.labels.map((l) => (
                  <span key={l.id} style={{ ...styles.labelChip, background: l.color + "33", color: l.color }}>
                    {l.name}
                  </span>
                ))}
                {task.labels.length === 0 && (
                  <span style={styles.emptyHint}>No labels</span>
                )}
              </div>
              {showLabelPicker && (
                <div style={styles.labelPicker}>
                  <div style={styles.pickerTitle}>Board labels</div>
                  {boardLabels.map((l) => {
                    const active = task.labels.some((tl) => tl.id === l.id);
                    return (
                      <div key={l.id} style={styles.pickerRow}>
                        <button
                          style={{
                            ...styles.pickerLabel,
                            background: l.color + "22",
                            color: l.color,
                            outline: active ? `2px solid ${l.color}` : "none",
                          }}
                          onClick={() => toggleLabel(l)}
                        >
                          {active ? "✓ " : ""}{l.name}
                        </button>
                        <button
                          style={styles.pickerDelete}
                          onClick={() => { onDeleteLabel(l.id); loadTask(); }}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                  <div style={styles.newLabelRow}>
                    <div style={styles.colorDots}>
                      {LABEL_COLORS.map((c) => (
                        <button
                          key={c}
                          style={{
                            ...styles.colorDot,
                            background: c,
                            outline: newLabelColor === c ? `2px solid ${c}` : "none",
                            outlineOffset: 2,
                          }}
                          onClick={() => setNewLabelColor(c)}
                        />
                      ))}
                    </div>
                    <input
                      style={styles.newLabelInput}
                      placeholder="New label…"
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateLabel()}
                    />
                    <button style={styles.addLabelBtn} onClick={handleCreateLabel}>+</button>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div style={styles.section}>
              <div style={styles.sectionLabel}>Description</div>
              <textarea
                style={styles.descInput}
                value={description}
                onChange={(e) => handleField(setDescription, "description", e.target.value)}
                placeholder="Add a more detailed description…"
                rows={4}
              />
            </div>

            {/* Checklists */}
            {task.checklists.map((cl) => (
              <ChecklistBlock
                key={cl.id}
                checklist={cl}
                newItemText={newItemTexts[cl.id] ?? ""}
                onNewItemChange={(v) => setNewItemTexts((p) => ({ ...p, [cl.id]: v }))}
                onAddItem={() => handleAddItem(cl.id)}
                onToggle={handleToggleItem}
                onDeleteItem={handleDeleteItem}
                onDeleteChecklist={() => handleDeleteChecklist(cl.id)}
              />
            ))}

            {/* Add checklist */}
            <div style={styles.addChecklistRow}>
              <input
                style={styles.inlineInput}
                placeholder="+ New checklist…"
                value={newChecklistTitle}
                onChange={(e) => setNewChecklistTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddChecklist()}
              />
              {newChecklistTitle && (
                <button style={styles.inlineAddBtn} onClick={handleAddChecklist}>
                  Add
                </button>
              )}
            </div>

            {/* Comments */}
            <div style={styles.section}>
              <div style={styles.sectionLabel}>
                Comments {task.comments.length > 0 && `(${task.comments.length})`}
              </div>
              <div style={styles.commentList}>
                {task.comments.map((c) => (
                  <CommentItem key={c.id} comment={c} onDelete={() => handleDeleteComment(c.id)} />
                ))}
              </div>
              <div style={styles.commentInputRow}>
                <div style={styles.commentAvatar}>{commentAuthor[0]}</div>
                <textarea
                  style={styles.commentInput}
                  placeholder="Write a comment…"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={2}
                />
                <button
                  style={styles.commentSendBtn}
                  onClick={handleAddComment}
                  disabled={!commentText.trim()}
                >
                  ↵
                </button>
              </div>
            </div>
          </div>

          {/* Right: metadata sidebar */}
          <div style={styles.sideCol}>
            {saving && <div style={styles.savingIndicator}>Saving…</div>}

            <MetaBlock label="Column">
              <select
                style={styles.select}
                value={task.column_id}
                onChange={(e) => handleMoveColumn(e.target.value)}
              >
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </MetaBlock>

            <MetaBlock label="Priority">
              <div style={styles.priorityRow}>
                {PRIORITY_OPTIONS.map((p) => (
                  <button
                    key={p}
                    style={{
                      ...styles.priorityBtn,
                      ...(priority === p ? {
                        background: PRIORITY_COLOR[p] + "22",
                        color: PRIORITY_COLOR[p],
                        borderColor: PRIORITY_COLOR[p],
                      } : {}),
                    }}
                    onClick={() => handleField(setPriority, "priority", p)}
                  >
                    {PRIORITY_LABELS[p]}
                  </button>
                ))}
              </div>
            </MetaBlock>

            <MetaBlock label="Assigned to">
              <input
                style={styles.metaInput}
                value={assignee}
                onChange={(e) => handleField(setAssignee, "assignee", e.target.value)}
                placeholder="Name or email"
              />
            </MetaBlock>

            <MetaBlock label="Due date">
              <input
                type="date"
                style={styles.metaInput}
                value={dueDate}
                onChange={(e) => handleField(setDueDate, "dueDate", e.target.value)}
              />
            </MetaBlock>

            <MetaBlock label="Estimate">
              <div style={styles.estimateRow}>
                <input
                  style={{ ...styles.metaInput, width: 70 }}
                  type="number"
                  min="0"
                  step="0.5"
                  value={estimate}
                  onChange={(e) => handleField(setEstimate, "estimate", e.target.value)}
                  placeholder="0"
                />
                <select
                  style={{ ...styles.select, flex: 1 }}
                  value={estimateUnit}
                  onChange={(e) => handleField(setEstimateUnit, "estimateUnit", e.target.value)}
                >
                  <option value="points">Story Points</option>
                  <option value="hours">Hours</option>
                </select>
              </div>
            </MetaBlock>

            {checklistProgress.total > 0 && (
              <MetaBlock label="Progress">
                <div style={styles.progressBar}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${(checklistProgress.done / checklistProgress.total) * 100}%`,
                    }}
                  />
                </div>
                <div style={styles.progressLabel}>
                  {checklistProgress.done}/{checklistProgress.total} items
                </div>
              </MetaBlock>
            )}

            <div style={styles.timestamps}>
              <div style={styles.timestamp}>
                Created {new Date(task.created_at).toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
              <div style={styles.timestamp}>
                Edited {new Date(task.updated_at).toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetaBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={styles.metaBlock}>
      <div style={styles.metaLabel}>{label}</div>
      {children}
    </div>
  );
}

function CommentItem({ comment, onDelete }: { comment: Comment; onDelete: () => void }) {
  const date = new Date(comment.created_at).toLocaleString("en", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
  return (
    <div style={styles.comment}>
      <div style={styles.commentHeader}>
        <span style={styles.commentAvatar}>{comment.author[0]}</span>
        <span style={styles.commentAuthor}>{comment.author}</span>
        <span style={styles.commentDate}>{date}</span>
        <button style={styles.commentDelete} onClick={onDelete}>×</button>
      </div>
      <div style={styles.commentBody}>{comment.body}</div>
    </div>
  );
}

function ChecklistBlock({
  checklist,
  newItemText,
  onNewItemChange,
  onAddItem,
  onToggle,
  onDeleteItem,
  onDeleteChecklist,
}: {
  checklist: Checklist;
  newItemText: string;
  onNewItemChange: (v: string) => void;
  onAddItem: () => void;
  onToggle: (id: string, done: boolean) => void;
  onDeleteItem: (id: string) => void;
  onDeleteChecklist: () => void;
}) {
  const done = checklist.items.filter((i) => i.is_done).length;
  const total = checklist.items.length;
  const pct = total > 0 ? (done / total) * 100 : 0;

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <span style={styles.sectionLabel}>☑ {checklist.title}</span>
        <span style={styles.checklistProgress}>{done}/{total}</span>
        <button style={styles.sectionAction} onClick={onDeleteChecklist}>Delete</button>
      </div>
      <div style={styles.progressBar}>
        <div style={{ ...styles.progressFill, width: `${pct}%` }} />
      </div>
      {checklist.items.map((item) => (
        <ChecklistItemRow key={item.id} item={item} onToggle={onToggle} onDelete={onDeleteItem} />
      ))}
      <div style={styles.addChecklistRow}>
        <input
          style={styles.inlineInput}
          placeholder="New item…"
          value={newItemText}
          onChange={(e) => onNewItemChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAddItem()}
        />
        {newItemText && (
          <button style={styles.inlineAddBtn} onClick={onAddItem}>+</button>
        )}
      </div>
    </div>
  );
}

function ChecklistItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: ChecklistItem;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div style={styles.checkItem}>
      <input
        type="checkbox"
        checked={item.is_done}
        onChange={(e) => onToggle(item.id, e.target.checked)}
        style={styles.checkbox}
      />
      <span
        style={{
          ...styles.checkItemText,
          textDecoration: item.is_done ? "line-through" : "none",
          color: item.is_done ? "var(--text-muted)" : "var(--text-primary)",
        }}
      >
        {item.text}
      </span>
      <button style={styles.itemDelete} onClick={() => onDelete(item.id)}>×</button>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    zIndex: 1000,
    padding: "40px 20px",
    overflowY: "auto",
  },
  modal: {
    background: "var(--bg-surface)",
    borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
    width: "100%",
    maxWidth: 900,
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
    overflow: "hidden",
  },
  loadingText: {
    padding: 40,
    color: "var(--text-muted)",
    textAlign: "center",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    flexShrink: 0,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 10 },
  priorityBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 10,
    letterSpacing: "0.3px",
  },
  columnPill: {
    fontSize: 11,
    color: "var(--text-secondary)",
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "3px 10px",
  },
  headerActions: { display: "flex", alignItems: "center", gap: 8 },
  deleteTaskBtn: {
    padding: "5px 12px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--danger)",
    cursor: "pointer",
    fontSize: 12,
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
    padding: "2px 6px",
  },
  modalBody: {
    display: "flex",
    gap: 0,
    flex: 1,
    minHeight: 0,
    maxHeight: "calc(100vh - 160px)",
    overflowY: "auto",
  },
  mainCol: {
    flex: 1,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
    overflowY: "auto",
    minWidth: 0,
  },
  sideCol: {
    width: 240,
    flexShrink: 0,
    padding: "20px 20px",
    borderLeft: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    background: "var(--bg-elevated)",
    overflowY: "auto",
  },
  savingIndicator: {
    fontSize: 11,
    color: "var(--accent)",
    textAlign: "right",
    marginBottom: -8,
  },
  titleInput: {
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--text-primary)",
    fontSize: 20,
    fontWeight: 700,
    resize: "none",
    width: "100%",
    letterSpacing: "-0.3px",
    lineHeight: 1.35,
    padding: 0,
    fontFamily: "inherit",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-secondary)",
    flex: 1,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  checklistProgress: {
    fontSize: 11,
    color: "var(--text-muted)",
  },
  sectionAction: {
    fontSize: 11,
    color: "var(--accent)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "2px 6px",
  },
  labelRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  labelChip: {
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 10px",
    borderRadius: 10,
  },
  emptyHint: { fontSize: 12, color: "var(--text-muted)" },
  labelPicker: {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  pickerTitle: { fontSize: 11, color: "var(--text-muted)", fontWeight: 600 },
  pickerRow: { display: "flex", alignItems: "center", gap: 6 },
  pickerLabel: {
    flex: 1,
    padding: "4px 10px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 600,
    textAlign: "left",
  },
  pickerDelete: {
    background: "transparent",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: 15,
    padding: "0 4px",
  },
  newLabelRow: { display: "flex", alignItems: "center", gap: 6, marginTop: 4 },
  colorDots: { display: "flex", gap: 4 },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    padding: 0,
  },
  newLabelInput: {
    flex: 1,
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    padding: "4px 8px",
    fontSize: 12,
    outline: "none",
  },
  addLabelBtn: {
    background: "var(--accent)",
    border: "none",
    borderRadius: "var(--radius-sm)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 600,
    padding: "2px 8px",
  },
  descInput: {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    padding: "10px 12px",
    fontSize: 13,
    resize: "vertical",
    outline: "none",
    lineHeight: 1.6,
    fontFamily: "inherit",
    minHeight: 80,
  },
  addChecklistRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  inlineInput: {
    flex: 1,
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    padding: "6px 10px",
    fontSize: 12,
    outline: "none",
  },
  inlineAddBtn: {
    background: "var(--accent)",
    border: "none",
    borderRadius: "var(--radius-sm)",
    color: "#fff",
    cursor: "pointer",
    padding: "6px 12px",
    fontSize: 13,
    fontWeight: 600,
  },
  checkItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "3px 0",
  },
  checkbox: { width: 14, height: 14, cursor: "pointer", accentColor: "var(--accent)" },
  checkItemText: { flex: 1, fontSize: 13 },
  itemDelete: {
    background: "transparent",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: 15,
    opacity: 0,
    padding: "0 4px",
  },
  progressBar: {
    height: 4,
    background: "var(--border)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "var(--priority-low)",
    borderRadius: 2,
    transition: "width 0.3s",
  },
  progressLabel: { fontSize: 11, color: "var(--text-muted)" },
  commentList: { display: "flex", flexDirection: "column", gap: 12 },
  comment: {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  commentHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  commentAvatar: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "var(--accent-dim)",
    color: "var(--accent)",
    fontSize: 11,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  commentAuthor: { fontSize: 12, fontWeight: 600, color: "var(--text-primary)", flex: 1 },
  commentDate: { fontSize: 11, color: "var(--text-muted)" },
  commentDelete: {
    background: "transparent",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: 15,
    padding: "0 4px",
  },
  commentBody: { fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 },
  commentInputRow: { display: "flex", gap: 10, alignItems: "flex-start" },
  commentInput: {
    flex: 1,
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    padding: "8px 12px",
    fontSize: 13,
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
    lineHeight: 1.5,
  },
  commentSendBtn: {
    padding: "8px 12px",
    borderRadius: "var(--radius-sm)",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 700,
  },
  metaBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  metaInput: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    padding: "6px 10px",
    fontSize: 12,
    outline: "none",
    width: "100%",
    fontFamily: "inherit",
  },
  select: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    padding: "6px 10px",
    fontSize: 12,
    outline: "none",
    width: "100%",
    cursor: "pointer",
  },
  priorityRow: { display: "flex", gap: 4, flexWrap: "wrap" },
  priorityBtn: {
    padding: "4px 8px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text-secondary)",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 600,
  },
  estimateRow: { display: "flex", gap: 8 },
  timestamps: {
    marginTop: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  timestamp: { fontSize: 10, color: "var(--text-muted)" },
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
