-- ============================================================
-- Notes module — schema + seed data
-- ============================================================

CREATE TABLE IF NOT EXISTS folders (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    parent_id  TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL DEFAULT 'Sin título',
    content    TEXT NOT NULL DEFAULT '',
    folder_id  TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
);

-- Auto-update updated_at on note changes
CREATE TRIGGER IF NOT EXISTS notes_updated_at
AFTER UPDATE ON notes
FOR EACH ROW
BEGIN
    UPDATE notes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================================
-- Seed data
-- ============================================================

INSERT OR IGNORE INTO folders (id, name, parent_id) VALUES
    ('f-work',     'Trabajo',    NULL),
    ('f-personal', 'Personal',   NULL),
    ('f-dev',      'Dev',        'f-work');

INSERT OR IGNORE INTO notes (id, title, content, folder_id) VALUES
    ('n-001', 'Bienvenido a Notes',
'# Bienvenido a Notes 📝

Este es tu bloc de notas local. Todo se guarda en tu máquina, sin servidores.

## Lo que podés hacer

- **Crear notas** con el botón `+` en la barra lateral
- **Crear carpetas** para organizar tus notas
- **Editar** haciendo clic en cualquier nota
- Los cambios se guardan automáticamente

## Markdown

Notes soporta Markdown básico:

- `# Título`, `## Subtítulo`
- `**negrita**`, `_cursiva_`
- `- listas`
- `` `código` ``

¡Empezá a escribir!',
    NULL),

    ('n-002', 'Ideas de proyecto',
'# Ideas de proyecto

## Plataforma modular

- [ ] Shell con Tauri
- [ ] Módulo de notas (este!)
- [ ] Módulo de música
- [ ] Módulo de tareas

## Próximos pasos

1. Terminar el MVP del shell
2. Publicar en GitHub
3. Armar landing page',
    'f-work'),

    ('n-003', 'Reunión 2026-05-27',
'# Reunión — 27 mayo 2026

**Asistentes:** Mauri, equipo

## Agenda

1. Review del sprint
2. Demo de la plataforma
3. Planificación Q3

## Notas

- La demo salió bien
- Priorizar módulo de tasks para Q3
- Revisar performance del shell',
    'f-work'),

    ('n-004', 'Arquitectura del módulo',
'# Arquitectura Notes

## Stack

- **Backend:** Rust + rusqlite (bundled)
- **Frontend:** React + TypeScript + Vite
- **Shell:** Tauri 2

## Base de datos

```sql
folders (id, name, parent_id)
notes (id, title, content, folder_id, updated_at)
```

## IPC con el shell

El módulo se conecta al shell via JSON-RPC 2.0.
Expone: `notes.create`, `notes.list`, `notes.delete`',
    'f-dev'),

    ('n-005', 'Lista de lectura',
'# Lista de lectura

## Leyendo ahora
- [ ] The Pragmatic Programmer
- [ ] Rust in Action

## Por leer
- [ ] Zero to Production in Rust
- [ ] Database Internals

## Leídos
- [x] Clean Code
- [x] The Phoenix Project',
    'f-personal'),

    ('n-006', 'Objetivos 2026',
'# Objetivos 2026

## Técnicos
- [ ] Lanzar plataforma v1.0
- [ ] Aprender Rust en profundidad
- [ ] Contribuir a un proyecto open source

## Personales
- [ ] Leer 12 libros
- [ ] Ejercicio 3x por semana

## Revisión mensual
- **Enero:** ✅ Buen arranque
- **Febrero:** ✅
- **Marzo:** ✅
- **Abril:** ⚠️ Bajo en técnicos
- **Mayo:** 🔄 En curso',
    'f-personal');
