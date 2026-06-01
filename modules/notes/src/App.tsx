import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import Sidebar from "./components/Sidebar";
import NoteEditor from "./components/NoteEditor";

export type FolderItem = {
  id: string;
  name: string;
  parent_id: string | null;
};

export type NoteItem = {
  id: string;
  title: string;
  folder_id: string | null;
  updated_at: string;
};

export type NoteContent = {
  id: string;
  title: string;
  content: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TreeData = {
  folders: FolderItem[];
  notes: NoteItem[];
};

export default function App() {
  const [tree, setTree] = useState<TreeData>({ folders: [], notes: [] });
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<NoteContent | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshTree = useCallback(async () => {
    const data = await invoke<TreeData>("get_tree");
    setTree(data);
  }, []);

  useEffect(() => {
    refreshTree().finally(() => setLoading(false));
  }, [refreshTree]);

  async function openNote(id: string) {
    setActiveNoteId(id);
    const note = await invoke<NoteContent>("get_note", { id });
    setActiveNote(note);
  }

  async function handleCreateNote(folderId: string | null) {
    const note = await invoke<NoteContent>("create_note", {
      title: "Untitled",
      folderId,
    });
    await refreshTree();
    await openNote(note.id);
  }

  async function handleSaveNote(id: string, title: string, content: string) {
    await invoke("update_note", { id, title, content });
    setTree((prev) => ({
      ...prev,
      notes: prev.notes.map((n) => (n.id === id ? { ...n, title } : n)),
    }));
  }

  async function handleDeleteNote(id: string) {
    await invoke("delete_note", { id });
    if (activeNoteId === id) {
      setActiveNoteId(null);
      setActiveNote(null);
    }
    await refreshTree();
  }

  async function handleCreateFolder(name: string, parentId: string | null) {
    await invoke("create_folder", { name, parentId });
    await refreshTree();
  }

  async function handleRenameFolder(id: string, name: string) {
    await invoke("rename_folder", { id, name });
    await refreshTree();
  }

  async function handleDeleteFolder(id: string) {
    await invoke("delete_folder", { id });
    await refreshTree();
  }

  return (
    <div style={styles.app}>
      {loading ? (
        <div style={styles.loading}>Loading…</div>
      ) : (
        <>
          <Sidebar
            tree={tree}
            activeNoteId={activeNoteId}
            onOpenNote={openNote}
            onCreateNote={handleCreateNote}
            onDeleteNote={handleDeleteNote}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
          />
          <div style={styles.editorArea}>
            {activeNote ? (
              <NoteEditor
                key={activeNote.id}
                note={activeNote}
                onSave={handleSaveNote}
              />
            ) : (
              <Empty onCreateNote={() => handleCreateNote(null)} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Empty({ onCreateNote }: { onCreateNote: () => void }) {
  return (
    <div style={styles.empty}>
      <div style={styles.emptyIcon}>✦</div>
      <p style={styles.emptyTitle}>Select a note</p>
      <p style={styles.emptyHint}>or create a new one</p>
      <button style={styles.emptyBtn} onClick={onCreateNote}>
        + New note
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: "flex",
    height: "100vh",
    background: "var(--bg-base)",
    overflow: "hidden",
  },
  editorArea: {
    flex: 1,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  loading: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text-muted)",
  },
  empty: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    color: "var(--text-secondary)",
  },
  emptyIcon: {
    fontSize: 36,
    color: "var(--accent)",
    marginBottom: 8,
    opacity: 0.5,
  },
  emptyTitle: { fontSize: 16, fontWeight: 500, color: "var(--text-secondary)" },
  emptyHint: { fontSize: 13, color: "var(--text-muted)" },
  emptyBtn: {
    marginTop: 16,
    padding: "8px 20px",
    borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text-secondary)",
    cursor: "pointer",
    fontSize: 13,
  },
};
