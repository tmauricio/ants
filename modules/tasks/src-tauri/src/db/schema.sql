-- ============================================================
-- Tasks module — schema + seed data
-- ============================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS boards (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    color       TEXT NOT NULL DEFAULT '#7C3AED',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS columns (
    id         TEXT PRIMARY KEY,
    board_id   TEXT NOT NULL,
    name       TEXT NOT NULL,
    position   INTEGER NOT NULL DEFAULT 0,
    color      TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
    id             TEXT PRIMARY KEY,
    column_id      TEXT NOT NULL,
    board_id       TEXT NOT NULL,
    title          TEXT NOT NULL,
    description    TEXT NOT NULL DEFAULT '',
    position       INTEGER NOT NULL DEFAULT 0,
    assignee       TEXT,
    due_date       TEXT,
    priority       TEXT NOT NULL DEFAULT 'medium',
    estimate       REAL,
    estimate_unit  TEXT NOT NULL DEFAULT 'points',
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE,
    FOREIGN KEY (board_id)  REFERENCES boards(id)  ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS labels (
    id       TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,
    name     TEXT NOT NULL,
    color    TEXT NOT NULL DEFAULT '#888888',
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS task_labels (
    task_id  TEXT NOT NULL,
    label_id TEXT NOT NULL,
    PRIMARY KEY (task_id, label_id),
    FOREIGN KEY (task_id)  REFERENCES tasks(id)  ON DELETE CASCADE,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
    id         TEXT PRIMARY KEY,
    task_id    TEXT NOT NULL,
    author     TEXT NOT NULL DEFAULT 'Yo',
    body       TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS checklists (
    id      TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    title   TEXT NOT NULL DEFAULT 'Lista',
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS checklist_items (
    id           TEXT PRIMARY KEY,
    checklist_id TEXT NOT NULL,
    text         TEXT NOT NULL,
    is_done      INTEGER NOT NULL DEFAULT 0,
    position     INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE
);

-- Auto-update updated_at on task changes
CREATE TRIGGER IF NOT EXISTS tasks_updated_at
AFTER UPDATE ON tasks
FOR EACH ROW
BEGIN
    UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS boards_updated_at
AFTER UPDATE ON boards
FOR EACH ROW
BEGIN
    UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================================
-- Seed data
-- ============================================================

INSERT OR IGNORE INTO boards (id, name, description, color) VALUES
    ('b-platform', 'Plataforma', 'Desarrollo del shell y módulos', '#7C3AED'),
    ('b-personal',  'Personal',  'Tareas y proyectos personales',   '#1DB954');

INSERT OR IGNORE INTO columns (id, board_id, name, position) VALUES
    ('c-p-backlog',     'b-platform', 'Backlog',      0),
    ('c-p-todo',        'b-platform', 'Por hacer',    1),
    ('c-p-inprogress',  'b-platform', 'En progreso',  2),
    ('c-p-review',      'b-platform', 'En revisión',  3),
    ('c-p-done',        'b-platform', 'Listo',        4),

    ('c-pe-todo',       'b-personal', 'Por hacer',    0),
    ('c-pe-inprogress', 'b-personal', 'En progreso',  1),
    ('c-pe-done',       'b-personal', 'Listo',        2);

INSERT OR IGNORE INTO labels (id, board_id, name, color) VALUES
    ('l-bug',      'b-platform', 'Bug',       '#FF5555'),
    ('l-feature',  'b-platform', 'Feature',   '#4A9EFF'),
    ('l-backend',  'b-platform', 'Backend',   '#F59E0B'),
    ('l-frontend', 'b-platform', 'Frontend',  '#72F621'),
    ('l-urgent',   'b-platform', 'Urgente',   '#FF6B35'),
    ('l-p-home',   'b-personal', 'Casa',      '#1DB954'),
    ('l-p-finance','b-personal', 'Finanzas',  '#EC4899');

INSERT OR IGNORE INTO tasks (id, column_id, board_id, title, description, position, assignee, priority, estimate, estimate_unit) VALUES
    ('t-001', 'c-p-inprogress', 'b-platform',
     'Implementar drag & drop en el tablero',
     'Las tarjetas deben poder arrastrarse entre columnas para cambiar de estado. Usar HTML5 DnD API sin dependencias externas.',
     0, 'Mauri', 'high', 3, 'points'),

    ('t-002', 'c-p-inprogress', 'b-platform',
     'Módulo Notes: guardado automático',
     'El editor debe guardar automáticamente con debounce de 800ms. Ya implementado, falta test de regresión.',
     1, 'Mauri', 'medium', 1, 'points'),

    ('t-003', 'c-p-todo', 'b-platform',
     'Shell: health monitor con sysinfo',
     'Leer RAM y CPU de cada módulo corriendo usando el crate sysinfo. Actualizar cada 3s.',
     0, NULL, 'high', 5, 'points'),

    ('t-004', 'c-p-todo', 'b-platform',
     'Dashboard: gráfico de uso de RAM histórico',
     'Mostrar un sparkline con el uso de RAM de los últimos 30 minutos por módulo.',
     1, NULL, 'low', 8, 'hours'),

    ('t-005', 'c-p-backlog', 'b-platform',
     'Módulo de Música',
     'Reproductor de música local. Reemplaza Spotify. Target < 20MB RAM.',
     0, NULL, 'medium', 21, 'points'),

    ('t-006', 'c-p-backlog', 'b-platform',
     'Sistema de actualizaciones de módulos',
     'El shell debe detectar cuando hay una versión nueva de un módulo en el índice remoto y notificar al usuario.',
     1, NULL, 'medium', 13, 'points'),

    ('t-007', 'c-p-done', 'b-platform',
     'Corregir loop infinito en beforeDevCommand',
     'pnpm dev llamaba a tauri dev que volvía a llamar a pnpm dev. Corregido apuntando beforeDevCommand a pnpm vite:dev.',
     0, 'Mauri', 'high', 1, 'points'),

    ('t-008', 'c-p-done', 'b-platform',
     'Process tracker con PIDs',
     'Implementar seguimiento de procesos corriendo por módulo. Mostrar RAM real e instancias en el dashboard.',
     1, 'Mauri', 'high', 2, 'points'),

    ('t-009', 'c-pe-todo', 'b-personal',
     'Renovar el seguro del auto',
     '', 0, NULL, 'medium', NULL, 'points'),

    ('t-010', 'c-pe-inprogress', 'b-personal',
     'Leer Zero to Production in Rust',
     'Capítulos 1-4 completados. Seguir con el capítulo 5 (telemetría).',
     0, 'Mauri', 'low', 4, 'hours');

INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES
    ('t-001', 'l-feature'),
    ('t-001', 'l-frontend'),
    ('t-002', 'l-bug'),
    ('t-002', 'l-frontend'),
    ('t-003', 'l-backend'),
    ('t-003', 'l-feature'),
    ('t-004', 'l-feature'),
    ('t-004', 'l-frontend'),
    ('t-005', 'l-feature'),
    ('t-006', 'l-feature'),
    ('t-006', 'l-backend'),
    ('t-007', 'l-bug'),
    ('t-007', 'l-urgent'),
    ('t-008', 'l-feature'),
    ('t-008', 'l-backend');

INSERT OR IGNORE INTO comments (id, task_id, author, body) VALUES
    ('cm-001', 't-001', 'Mauri', 'Empecé con el ondragstart/ondrop básico. Falta limpiar el ghost visual.'),
    ('cm-002', 't-007', 'Mauri', 'Solucionado: beforeDevCommand ahora apunta a pnpm vite:dev en vez de pnpm dev.'),
    ('cm-003', 't-008', 'Mauri', 'Usé mem::forget en el Child para que el proceso siga corriendo independiente. Los PIDs se limpian solos cuando sysinfo no los encuentra.');

INSERT OR IGNORE INTO checklists (id, task_id, title) VALUES
    ('cl-001', 't-001', 'Tareas');

INSERT OR IGNORE INTO checklist_items (id, checklist_id, text, is_done, position) VALUES
    ('ci-001', 'cl-001', 'Drag desde la tarjeta (ondragstart)', 1, 0),
    ('ci-002', 'cl-001', 'Drop en columna (ondrop)', 1, 1),
    ('ci-003', 'cl-001', 'Actualizar posición en DB', 0, 2),
    ('ci-004', 'cl-001', 'Animación visual durante el drag', 0, 3),
    ('ci-005', 'cl-001', 'Reordenar dentro de la misma columna', 0, 4);
