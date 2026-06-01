import { useState, useEffect, useRef, useCallback } from "react";
import { marked } from "marked";
import type { NoteContent } from "../App";

marked.setOptions({ breaks: true, gfm: true });

type Props = {
  note: NoteContent;
  onSave: (id: string, title: string, content: string) => void;
};

type Mode = "edit" | "preview" | "split";

export default function NoteEditor({ note, onSave }: Props) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [mode, setMode] = useState<Mode>("edit");
  const [saved, setSaved] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset when note changes
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setSaved(true);
  }, [note.id]);

  const scheduleSave = useCallback(
    (newTitle: string, newContent: string) => {
      setSaved(false);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        onSave(note.id, newTitle, newContent);
        setSaved(true);
      }, 800);
    },
    [note.id, onSave]
  );

  function handleTitleChange(v: string) {
    setTitle(v);
    scheduleSave(v, content);
  }

  function handleContentChange(v: string) {
    setContent(v);
    scheduleSave(title, v);
  }

  // Tab inserts spaces in textarea
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newVal = content.substring(0, start) + "  " + content.substring(end);
      setContent(newVal);
      scheduleSave(title, newVal);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    }
  }

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;
  const formattedDate = new Date(note.updated_at).toLocaleString("es", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });

  const previewHtml = marked.parse(content) as string;

  return (
    <div style={styles.editor}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.modeGroup}>
          {(["edit", "split", "preview"] as Mode[]).map((m) => (
            <button
              key={m}
              style={{ ...styles.modeBtn, ...(mode === m ? styles.modeBtnActive : {}) }}
              onClick={() => setMode(m)}
            >
              {{ edit: "Edit", split: "Split", preview: "Preview" }[m]}
            </button>
          ))}
        </div>
        <div style={styles.saveStatus}>
          {saved ? (
            <span style={styles.savedText}>✓ Saved</span>
          ) : (
            <span style={styles.savingText}>Saving…</span>
          )}
        </div>
      </div>

      {/* Title */}
      <div style={styles.titleWrap}>
        <input
          style={styles.titleInput}
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled"
        />
      </div>

      {/* Content area */}
      <div style={{ ...styles.body, flexDirection: mode === "split" ? "row" : "column" }}>
        {(mode === "edit" || mode === "split") && (
          <textarea
            ref={textareaRef}
            style={{
              ...styles.textarea,
              flex: mode === "split" ? "0 0 50%" : 1,
              borderRight: mode === "split" ? "1px solid var(--border)" : "none",
            }}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Start writing… (Markdown supported)"
            spellCheck
          />
        )}
        {(mode === "preview" || mode === "split") && (
          <div
            style={{ ...styles.preview, flex: mode === "split" ? "0 0 50%" : 1 }}
            className="md-preview"
            dangerouslySetInnerHTML={{ __html: previewHtml || "<p style='color:var(--text-muted)'>Nothing to preview</p>" }}
          />
        )}
      </div>

      {/* Status bar */}
      <div style={styles.statusBar}>
        <span style={styles.statusItem}>{wordCount} words</span>
        <span style={styles.statusDot}>·</span>
        <span style={styles.statusItem}>{charCount} characters</span>
        <span style={styles.statusDot}>·</span>
        <span style={styles.statusItem}>Edited {formattedDate}</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  editor: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "var(--bg-base)",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 20px",
    borderBottom: "1px solid var(--border-subtle)",
    flexShrink: 0,
  },
  modeGroup: {
    display: "flex",
    gap: 2,
    background: "var(--bg-elevated)",
    borderRadius: "var(--radius-sm)",
    padding: 2,
  },
  modeBtn: {
    padding: "4px 12px",
    border: "none",
    borderRadius: "var(--radius-sm)",
    background: "transparent",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
  },
  modeBtnActive: {
    background: "var(--bg-active)",
    color: "var(--text-primary)",
  },
  saveStatus: { display: "flex", alignItems: "center" },
  savedText: { fontSize: 12, color: "var(--text-muted)" },
  savingText: { fontSize: 12, color: "var(--accent)" },
  titleWrap: {
    padding: "20px 32px 0",
    flexShrink: 0,
  },
  titleInput: {
    width: "100%",
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--text-primary)",
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: "-0.5px",
    padding: 0,
  },
  body: {
    flex: 1,
    display: "flex",
    overflow: "hidden",
    minHeight: 0,
  },
  textarea: {
    background: "transparent",
    border: "none",
    outline: "none",
    resize: "none",
    color: "var(--text-primary)",
    fontSize: 15,
    lineHeight: 1.75,
    fontFamily: "'Cascadia Code','Fira Code','Consolas',monospace",
    padding: "16px 32px 32px",
    overflowY: "auto",
    caretColor: "var(--accent)",
  },
  preview: {
    overflowY: "auto",
    padding: "16px 32px 32px",
  },
  statusBar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 32px",
    borderTop: "1px solid var(--border-subtle)",
    flexShrink: 0,
  },
  statusItem: { fontSize: 11, color: "var(--text-muted)" },
  statusDot: { color: "var(--border)", fontSize: 11 },
};
