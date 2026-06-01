import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import BoardList from "./components/BoardList";
import BoardView from "./components/BoardView";

export type Board = {
  id: string;
  name: string;
  description: string;
  color: string;
  created_at: string;
};

export type Column = {
  id: string;
  board_id: string;
  name: string;
  position: number;
  color: string | null;
};

export type Label = {
  id: string;
  board_id: string;
  name: string;
  color: string;
};

export type TaskCard = {
  id: string;
  column_id: string;
  title: string;
  position: number;
  assignee: string | null;
  due_date: string | null;
  priority: string;
  estimate: number | null;
  estimate_unit: string;
  labels: Label[];
  comment_count: number;
  checklist_total: number;
  checklist_done: number;
};

export type Comment = {
  id: string;
  task_id: string;
  author: string;
  body: string;
  created_at: string;
};

export type ChecklistItem = {
  id: string;
  checklist_id: string;
  text: string;
  is_done: boolean;
  position: number;
};

export type Checklist = {
  id: string;
  task_id: string;
  title: string;
  items: ChecklistItem[];
};

export type FullTask = TaskCard & {
  board_id: string;
  description: string;
  created_at: string;
  updated_at: string;
  comments: Comment[];
  checklists: Checklist[];
};

export default function App() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBoards = useCallback(async () => {
    const data = await invoke<Board[]>("get_boards");
    setBoards(data);
    // Keep activeBoard in sync if it was updated
    if (activeBoard) {
      const updated = data.find((b) => b.id === activeBoard.id);
      if (updated) setActiveBoard(updated);
    }
  }, [activeBoard]);

  useEffect(() => {
    loadBoards().finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreateBoard(name: string, description: string, color: string) {
    const board = await invoke<Board>("create_board", { name, description, color });
    setBoards((prev) => [...prev, board]);
    setActiveBoard(board);
  }

  async function handleDeleteBoard(id: string) {
    await invoke("delete_board", { id });
    setBoards((prev) => prev.filter((b) => b.id !== id));
    if (activeBoard?.id === id) setActiveBoard(null);
  }

  async function handleRenameBoard(id: string, name: string, description: string) {
    await invoke("rename_board", { id, name, description });
    setBoards((prev) =>
      prev.map((b) => (b.id === id ? { ...b, name, description } : b))
    );
    if (activeBoard?.id === id) {
      setActiveBoard((prev) => prev ? { ...prev, name, description } : prev);
    }
  }

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingDot} />
        Loading…
      </div>
    );
  }

  if (activeBoard) {
    return (
      <BoardView
        board={activeBoard}
        onBack={() => setActiveBoard(null)}
        onRenameBoard={handleRenameBoard}
        onDeleteBoard={handleDeleteBoard}
      />
    );
  }

  return (
    <BoardList
      boards={boards}
      onOpen={setActiveBoard}
      onCreate={handleCreateBoard}
      onDelete={handleDeleteBoard}
    />
  );
}

const styles: Record<string, React.CSSProperties> = {
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
};
