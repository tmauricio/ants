use anyhow::Result;
use rusqlite::{params, Connection};
use std::path::PathBuf;

use crate::{
    Board, ChecklistItem, Column, Comment, FullTask, Label, TaskCard,
};

pub struct TasksDb {
    conn: Connection,
}

impl TasksDb {
    pub fn open() -> Result<Self> {
        let path = db_path();
        std::fs::create_dir_all(path.parent().unwrap())?;
        let conn = Connection::open(&path)?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        conn.execute_batch(include_str!("db/schema.sql"))?;
        Ok(Self { conn })
    }

    // ── Boards ────────────────────────────────────────────────────────────────

    pub fn get_boards(&self) -> Result<Vec<Board>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, color, created_at FROM boards ORDER BY created_at ASC",
        )?;
        let boards = stmt
            .query_map([], |row| {
                Ok(Board {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    color: row.get(3)?,
                    created_at: row.get(4)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(boards)
    }

    pub fn create_board(&self, name: &str, description: &str, color: &str) -> Result<Board> {
        let id = new_id();
        self.conn.execute(
            "INSERT INTO boards (id, name, description, color) VALUES (?1, ?2, ?3, ?4)",
            params![id, name, description, color],
        )?;
        // Seed default columns
        for (i, col_name) in ["Por hacer", "En progreso", "Listo"].iter().enumerate() {
            let cid = new_id();
            self.conn.execute(
                "INSERT INTO columns (id, board_id, name, position) VALUES (?1, ?2, ?3, ?4)",
                params![cid, id, col_name, i as i64],
            )?;
        }
        let board = self.conn.query_row(
            "SELECT id, name, description, color, created_at FROM boards WHERE id = ?1",
            [&id],
            |row| Ok(Board {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                color: row.get(3)?,
                created_at: row.get(4)?,
            }),
        )?;
        Ok(board)
    }

    pub fn rename_board(&self, id: &str, name: &str, description: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE boards SET name = ?1, description = ?2 WHERE id = ?3",
            params![name, description, id],
        )?;
        Ok(())
    }

    pub fn delete_board(&self, id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM boards WHERE id = ?1", [id])?;
        Ok(())
    }

    // ── Columns ───────────────────────────────────────────────────────────────

    pub fn get_columns(&self, board_id: &str) -> Result<Vec<Column>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, board_id, name, position, color FROM columns WHERE board_id = ?1 ORDER BY position ASC",
        )?;
        let cols = stmt
            .query_map([board_id], |row| {
                Ok(Column {
                    id: row.get(0)?,
                    board_id: row.get(1)?,
                    name: row.get(2)?,
                    position: row.get(3)?,
                    color: row.get(4)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(cols)
    }

    pub fn create_column(&self, board_id: &str, name: &str) -> Result<Column> {
        let id = new_id();
        let position: i64 = self.conn.query_row(
            "SELECT COALESCE(MAX(position) + 1, 0) FROM columns WHERE board_id = ?1",
            [board_id],
            |row| row.get(0),
        )?;
        self.conn.execute(
            "INSERT INTO columns (id, board_id, name, position) VALUES (?1, ?2, ?3, ?4)",
            params![id, board_id, name, position],
        )?;
        Ok(Column { id, board_id: board_id.to_string(), name: name.to_string(), position, color: None })
    }

    pub fn rename_column(&self, id: &str, name: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE columns SET name = ?1 WHERE id = ?2",
            params![name, id],
        )?;
        Ok(())
    }

    pub fn delete_column(&self, id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM columns WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn reorder_columns(&self, board_id: &str, ids: Vec<String>) -> Result<()> {
        for (pos, id) in ids.iter().enumerate() {
            self.conn.execute(
                "UPDATE columns SET position = ?1 WHERE id = ?2 AND board_id = ?3",
                params![pos as i64, id, board_id],
            )?;
        }
        Ok(())
    }

    // ── Tasks ─────────────────────────────────────────────────────────────────

    pub fn get_tasks_for_board(&self, board_id: &str) -> Result<Vec<TaskCard>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, column_id, title, position, assignee, due_date, priority, estimate, estimate_unit
             FROM tasks WHERE board_id = ?1 ORDER BY column_id, position ASC",
        )?;
        let mut tasks: Vec<TaskCard> = stmt
            .query_map([board_id], |row| {
                Ok(TaskCard {
                    id: row.get(0)?,
                    column_id: row.get(1)?,
                    title: row.get(2)?,
                    position: row.get(3)?,
                    assignee: row.get(4)?,
                    due_date: row.get(5)?,
                    priority: row.get(6)?,
                    estimate: row.get(7)?,
                    estimate_unit: row.get(8)?,
                    labels: vec![],
                    comment_count: 0,
                    checklist_total: 0,
                    checklist_done: 0,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        // Attach labels and counters
        for task in tasks.iter_mut() {
            task.labels = self.get_task_labels(&task.id)?;
            task.comment_count = self.conn.query_row(
                "SELECT COUNT(*) FROM comments WHERE task_id = ?1",
                [&task.id],
                |r| r.get(0),
            )?;
            let (total, done): (i64, i64) = {
                let t = self.conn.query_row(
                    "SELECT COUNT(*) FROM checklist_items ci JOIN checklists cl ON ci.checklist_id = cl.id WHERE cl.task_id = ?1",
                    [&task.id], |r| r.get(0)).unwrap_or(0);
                let d = self.conn.query_row(
                    "SELECT COUNT(*) FROM checklist_items ci JOIN checklists cl ON ci.checklist_id = cl.id WHERE cl.task_id = ?1 AND ci.is_done = 1",
                    [&task.id], |r| r.get(0)).unwrap_or(0);
                (t, d)
            };
            task.checklist_total = total;
            task.checklist_done = done;
        }
        Ok(tasks)
    }

    pub fn get_full_task(&self, id: &str) -> Result<FullTask> {
        let task = self.conn.query_row(
            "SELECT id, column_id, board_id, title, description, position, assignee, due_date, priority, estimate, estimate_unit, created_at, updated_at
             FROM tasks WHERE id = ?1",
            [id],
            |row| Ok(FullTask {
                id: row.get(0)?,
                column_id: row.get(1)?,
                board_id: row.get(2)?,
                title: row.get(3)?,
                description: row.get(4)?,
                position: row.get(5)?,
                assignee: row.get(6)?,
                due_date: row.get(7)?,
                priority: row.get(8)?,
                estimate: row.get(9)?,
                estimate_unit: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
                labels: vec![],
                comments: vec![],
                checklists: vec![],
            }),
        )?;

        let labels = self.get_task_labels(id)?;
        let comments = self.get_comments(id)?;
        let checklists = self.get_checklists(id)?;

        Ok(FullTask { labels, comments, checklists, ..task })
    }

    pub fn create_task(&self, column_id: &str, board_id: &str, title: &str) -> Result<TaskCard> {
        let id = new_id();
        let position: i64 = self.conn.query_row(
            "SELECT COALESCE(MAX(position) + 1, 0) FROM tasks WHERE column_id = ?1",
            [column_id],
            |row| row.get(0),
        )?;
        self.conn.execute(
            "INSERT INTO tasks (id, column_id, board_id, title, position) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, column_id, board_id, title, position],
        )?;
        Ok(TaskCard {
            id,
            column_id: column_id.to_string(),
            title: title.to_string(),
            position,
            assignee: None,
            due_date: None,
            priority: "medium".to_string(),
            estimate: None,
            estimate_unit: "points".to_string(),
            labels: vec![],
            comment_count: 0,
            checklist_total: 0,
            checklist_done: 0,
        })
    }

    pub fn update_task(
        &self,
        id: &str,
        title: &str,
        description: &str,
        assignee: Option<&str>,
        due_date: Option<&str>,
        priority: &str,
        estimate: Option<f64>,
        estimate_unit: &str,
    ) -> Result<()> {
        self.conn.execute(
            "UPDATE tasks SET title=?1, description=?2, assignee=?3, due_date=?4, priority=?5, estimate=?6, estimate_unit=?7 WHERE id=?8",
            params![title, description, assignee, due_date, priority, estimate, estimate_unit, id],
        )?;
        Ok(())
    }

    pub fn move_task(&self, task_id: &str, column_id: &str, position: i64) -> Result<()> {
        // Shift existing tasks in target column to make room
        self.conn.execute(
            "UPDATE tasks SET position = position + 1 WHERE column_id = ?1 AND position >= ?2",
            params![column_id, position],
        )?;
        self.conn.execute(
            "UPDATE tasks SET column_id = ?1, position = ?2 WHERE id = ?3",
            params![column_id, position, task_id],
        )?;
        // Compact positions in both columns
        self.compact_positions(column_id)?;
        Ok(())
    }

    pub fn delete_task(&self, id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM tasks WHERE id = ?1", [id])?;
        Ok(())
    }

    fn compact_positions(&self, column_id: &str) -> Result<()> {
        let ids: Vec<String> = {
            let mut stmt = self.conn.prepare(
                "SELECT id FROM tasks WHERE column_id = ?1 ORDER BY position ASC",
            )?;
            let result = stmt.query_map([column_id], |r| r.get(0))?
                .filter_map(|r| r.ok())
                .collect();
            result
        };
        for (pos, id) in ids.iter().enumerate() {
            self.conn.execute(
                "UPDATE tasks SET position = ?1 WHERE id = ?2",
                params![pos as i64, id],
            )?;
        }
        Ok(())
    }

    // ── Labels ────────────────────────────────────────────────────────────────

    pub fn get_board_labels(&self, board_id: &str) -> Result<Vec<Label>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, board_id, name, color FROM labels WHERE board_id = ?1 ORDER BY name ASC",
        )?;
        let labels = stmt
            .query_map([board_id], |row| {
                Ok(Label {
                    id: row.get(0)?,
                    board_id: row.get(1)?,
                    name: row.get(2)?,
                    color: row.get(3)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(labels)
    }

    fn get_task_labels(&self, task_id: &str) -> Result<Vec<Label>> {
        let mut stmt = self.conn.prepare(
            "SELECT l.id, l.board_id, l.name, l.color FROM labels l
             JOIN task_labels tl ON l.id = tl.label_id WHERE tl.task_id = ?1",
        )?;
        let labels = stmt
            .query_map([task_id], |row| {
                Ok(Label {
                    id: row.get(0)?,
                    board_id: row.get(1)?,
                    name: row.get(2)?,
                    color: row.get(3)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(labels)
    }

    pub fn create_label(&self, board_id: &str, name: &str, color: &str) -> Result<Label> {
        let id = new_id();
        self.conn.execute(
            "INSERT INTO labels (id, board_id, name, color) VALUES (?1, ?2, ?3, ?4)",
            params![id, board_id, name, color],
        )?;
        Ok(Label { id, board_id: board_id.to_string(), name: name.to_string(), color: color.to_string() })
    }

    pub fn delete_label(&self, id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM labels WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn set_task_labels(&self, task_id: &str, label_ids: Vec<String>) -> Result<()> {
        self.conn.execute("DELETE FROM task_labels WHERE task_id = ?1", [task_id])?;
        for label_id in &label_ids {
            self.conn.execute(
                "INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES (?1, ?2)",
                params![task_id, label_id],
            )?;
        }
        Ok(())
    }

    // ── Comments ──────────────────────────────────────────────────────────────

    fn get_comments(&self, task_id: &str) -> Result<Vec<Comment>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, task_id, author, body, created_at FROM comments WHERE task_id = ?1 ORDER BY created_at ASC",
        )?;
        let comments = stmt
            .query_map([task_id], |row| {
                Ok(Comment {
                    id: row.get(0)?,
                    task_id: row.get(1)?,
                    author: row.get(2)?,
                    body: row.get(3)?,
                    created_at: row.get(4)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(comments)
    }

    pub fn add_comment(&self, task_id: &str, author: &str, body: &str) -> Result<Comment> {
        let id = new_id();
        self.conn.execute(
            "INSERT INTO comments (id, task_id, author, body) VALUES (?1, ?2, ?3, ?4)",
            params![id, task_id, author, body],
        )?;
        let comment = self.conn.query_row(
            "SELECT id, task_id, author, body, created_at FROM comments WHERE id = ?1",
            [&id],
            |row| Ok(Comment {
                id: row.get(0)?,
                task_id: row.get(1)?,
                author: row.get(2)?,
                body: row.get(3)?,
                created_at: row.get(4)?,
            }),
        )?;
        Ok(comment)
    }

    pub fn delete_comment(&self, id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM comments WHERE id = ?1", [id])?;
        Ok(())
    }

    // ── Checklists ────────────────────────────────────────────────────────────

    fn get_checklists(&self, task_id: &str) -> Result<Vec<crate::Checklist>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, task_id, title FROM checklists WHERE task_id = ?1",
        )?;
        let mut lists: Vec<crate::Checklist> = stmt
            .query_map([task_id], |row| {
                Ok(crate::Checklist {
                    id: row.get(0)?,
                    task_id: row.get(1)?,
                    title: row.get(2)?,
                    items: vec![],
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        for list in lists.iter_mut() {
            list.items = self.get_checklist_items(&list.id)?;
        }
        Ok(lists)
    }

    fn get_checklist_items(&self, checklist_id: &str) -> Result<Vec<ChecklistItem>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, checklist_id, text, is_done, position FROM checklist_items WHERE checklist_id = ?1 ORDER BY position ASC",
        )?;
        let items = stmt
            .query_map([checklist_id], |row| {
                Ok(ChecklistItem {
                    id: row.get(0)?,
                    checklist_id: row.get(1)?,
                    text: row.get(2)?,
                    is_done: row.get::<_, i64>(3)? != 0,
                    position: row.get(4)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(items)
    }

    pub fn create_checklist(&self, task_id: &str, title: &str) -> Result<crate::Checklist> {
        let id = new_id();
        self.conn.execute(
            "INSERT INTO checklists (id, task_id, title) VALUES (?1, ?2, ?3)",
            params![id, task_id, title],
        )?;
        Ok(crate::Checklist { id, task_id: task_id.to_string(), title: title.to_string(), items: vec![] })
    }

    pub fn delete_checklist(&self, id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM checklists WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn add_checklist_item(&self, checklist_id: &str, text: &str) -> Result<ChecklistItem> {
        let id = new_id();
        let position: i64 = self.conn.query_row(
            "SELECT COALESCE(MAX(position) + 1, 0) FROM checklist_items WHERE checklist_id = ?1",
            [checklist_id],
            |row| row.get(0),
        )?;
        self.conn.execute(
            "INSERT INTO checklist_items (id, checklist_id, text, position) VALUES (?1, ?2, ?3, ?4)",
            params![id, checklist_id, text, position],
        )?;
        Ok(ChecklistItem { id, checklist_id: checklist_id.to_string(), text: text.to_string(), is_done: false, position })
    }

    pub fn toggle_checklist_item(&self, id: &str, is_done: bool) -> Result<()> {
        self.conn.execute(
            "UPDATE checklist_items SET is_done = ?1 WHERE id = ?2",
            params![is_done as i64, id],
        )?;
        Ok(())
    }

    pub fn delete_checklist_item(&self, id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM checklist_items WHERE id = ?1", [id])?;
        Ok(())
    }
}

fn db_path() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("platform")
        .join("modules")
        .join("com.platform.tasks")
        .join("data")
        .join("tasks.db")
}

fn new_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let ns = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    format!("{ms:013x}{ns:08x}")
}
