# Platform Architecture — Documento de referencia para desarrollo

## Visión del producto

Una plataforma modular que reemplaza aplicaciones de escritorio populares (Slack, Spotify, Notion, etc.)
con versiones ultra-optimizadas que consumen una fracción de los recursos.

**Propuesta de valor central**: Las apps modernas basadas en Electron consumen 150-400MB de RAM cada una.
Los módulos de esta plataforma deben operar en 10-50MB cada uno.

---

## Principios de diseño

1. **Local-first**: Los datos del usuario viven en su máquina. Nunca en servidores propios.
2. **Modular**: Cada app es un proceso independiente. Si crashea, no afecta al resto.
3. **Mínimo privilegio**: Los módulos declaran permisos explícitos. El usuario los aprueba.
4. **Sin vendor lock-in**: El usuario puede exportar/borrar sus datos en cualquier momento.
5. **Transparencia de recursos**: El usuario siempre ve cuánta RAM/CPU consume cada módulo.

---

## Stack tecnológico

| Componente | Tecnología | Justificación |
|---|---|---|
| App Shell | Tauri (Rust + WebView nativo) | Sin Chromium empaquetado. ~5MB vs ~150MB de Electron |
| Módulos backend | Rust (recomendado) o cualquier lenguaje compilado | Performance, seguridad de memoria |
| Módulos frontend | Cualquier framework web | Libertad para contribuidores |
| Base de datos local | SQLite por módulo (embebida) | Liviano, sin servidor, corre dentro del mismo proceso Rust |
| Comunicación Shell↔Módulo | JSON-RPC 2.0 sobre Unix socket / named pipe | Simple, estándar, cross-platform |
| Monitoreo de procesos | crate `sysinfo` | RAM, CPU por PID |
| Registry remoto | JSON estático en GitHub | Cero costo de infraestructura inicial |
| Binarios | GitHub Releases | Cero costo, confiable, versionado |

---

## SQLite embebida — modelo de base de datos

SQLite **no es un servidor separado**. Es una librería que corre dentro del mismo proceso Rust.
No hay ningún demonio que levantar, ningún puerto, ninguna configuración de red.

```
# PostgreSQL / MySQL (NO es este modelo):
Tu app  →  socket/red  →  Proceso DB separado  →  archivos en disco

# SQLite (este modelo):
Tu app  →  librería rusqlite  →  archivos en disco
           (mismo proceso Rust)
```

### Crate a usar: `rusqlite`

```toml
# src-tauri/Cargo.toml
[dependencies]
rusqlite = { version = "0.31", features = ["bundled"] }
```

El feature `bundled` incluye SQLite compilado dentro del binario.
No requiere que SQLite esté instalado en el sistema operativo del usuario.

### Inicialización en el arranque del shell

```rust
// src-tauri/src/main.rs
use rusqlite::Connection;

fn main() {
    // Abre (o crea) el archivo shell.db al arrancar
    let conn = Connection::open(get_db_path()).expect("No se pudo abrir shell.db");

    // Crea las tablas si no existen (idempotente)
    conn.execute_batch(include_str!("db/schema.sql"))
        .expect("Error inicializando schema");

    tauri::Builder::default()
        .manage(conn)   // disponible en todos los comandos Tauri
        .run(tauri::generate_context!())
        .expect("Error iniciando Tauri");
}

fn get_db_path() -> PathBuf {
    // Guarda la DB en el directorio de datos del sistema operativo
    // Linux:   ~/.local/share/platform/shell.db
    // macOS:   ~/Library/Application Support/platform/shell.db
    // Windows: %APPDATA%\platform\shell.db
    dirs::data_dir()
        .expect("No se pudo encontrar data dir")
        .join("platform")
        .join("shell.db")
}
```

### Una DB por módulo, misma mecánica

Cada módulo también tiene su propia SQLite embebida en su proceso.
El shell NO accede a la DB de los módulos directamente — los módulos exponen
sus datos via IPC si el shell los necesita.

```
shell (proceso)     → abre shell.db
notes (proceso)     → abre modules/com.platform.notes/data/notes.db
music (proceso)     → abre modules/com.platform.music/data/library.db
```

Esto garantiza aislamiento total: un módulo nunca puede corromper datos de otro.

---

## Arquitectura general

```
Shell (Tauri)
├── Store UI          → Explorar e instalar módulos
├── Dashboard UI      → Módulos activos + stats de RAM/CPU
├── Module Manager    → Instalar, desinstalar, actualizar
├── Process Manager   → Spawn, kill, watchdog por módulo
├── Health Monitor    → Métricas por PID en tiempo real
├── Backup Manager    → Backup/restore por módulo
└── shell.db (SQLite) → Registry local de módulos instalados

Módulo (proceso independiente)
├── Binario nativo    → Lógica de la app + backend
├── UI propia         → Ventana nativa independiente
├── data/app.db       → SQLite propio del módulo
└── manifest.json     → Contrato con el shell
```

### Flujo de procesos

El shell spawna cada módulo como proceso hijo independiente.
Cada módulo abre su propia ventana nativa.
El shell NO renderiza UI de los módulos — solo los lanza, monitorea y mata.

---

## Estructura de directorios del proyecto

```
platform/
├── ARCHITECTURE.md              ← este archivo
├── shell/                       ← App Tauri principal
│   ├── src-tauri/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── main.rs
│   │       ├── module_manager.rs
│   │       ├── process_manager.rs
│   │       ├── health_monitor.rs
│   │       ├── ipc_server.rs
│   │       ├── backup_manager.rs
│   │       ├── downloader.rs
│   │       └── db/
│   │           └── schema.sql
│   ├── src/                     ← UI del shell (React o Svelte)
│   │   ├── store/
│   │   ├── dashboard/
│   │   ├── module_detail/
│   │   └── settings/
│   └── tauri.conf.json
│
├── module-sdk/                  ← SDK para desarrolladores de módulos
│   ├── Cargo.toml               ← Crate Rust
│   └── src/
│       └── lib.rs
│
└── modules/                     ← Módulos oficiales
    ├── notes/
    ├── music-player/
    └── tasks/
```

---

## Datos del shell (shell.db)

```sql
CREATE TABLE modules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    install_path TEXT NOT NULL,
    data_path TEXT NOT NULL,
    installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_launched DATETIME,
    is_enabled BOOLEAN DEFAULT TRUE,
    permissions TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE usage_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id TEXT NOT NULL,
    started_at DATETIME NOT NULL,
    ended_at DATETIME,
    peak_ram_mb INTEGER,
    avg_cpu_percent REAL,
    FOREIGN KEY (module_id) REFERENCES modules(id)
);

CREATE TABLE backups (
    id TEXT PRIMARY KEY,
    module_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    path TEXT NOT NULL,
    size_bytes INTEGER,
    checksum TEXT NOT NULL,
    FOREIGN KEY (module_id) REFERENCES modules(id)
);
```

---

## Datos de cada módulo

```
~/.local/share/platform/          (Linux)
~/Library/Application Support/platform/  (macOS)
%APPDATA%\platform\              (Windows)
├── shell.db
└── modules/
    └── com.platform.notes/
        ├── data/
        │   └── notes.db
        └── files/

~/.local/share/platform/backups/
    └── com.platform.notes_2024-01-15.tar.gz.enc
```

---

## Manifest de módulo (manifest.json)

Cada módulo debe incluir este archivo. Es el contrato con el shell.

```json
{
  "id": "com.platform.notes",
  "name": "Notes",
  "version": "1.0.0",
  "min_shell_version": "0.1.0",
  "description": "Reemplaza Notion/Obsidian. Usa ~12MB de RAM.",
  "replaces": ["Notion", "Obsidian"],
  "ram_typical_mb": 12,
  "category": "productivity",
  "permissions": [
    "storage:local",
    "notifications"
  ],
  "resources": {
    "max_ram_mb": 80,
    "max_cpu_percent": 15
  },
  "entry": {
    "backend": "bin/notes"
  },
  "ipc": {
    "exposes": ["notes.create", "notes.list", "notes.delete"],
    "requires": []
  },
  "binaries": {
    "windows-x64": {
      "url": "https://github.com/org/notes/releases/download/v1.0.0/notes-win-x64.zip",
      "sha256": "...",
      "size_bytes": 0
    },
    "macos-arm64": {
      "url": "https://github.com/org/notes/releases/download/v1.0.0/notes-mac-arm64.zip",
      "sha256": "...",
      "size_bytes": 0
    },
    "linux-x64": {
      "url": "https://github.com/org/notes/releases/download/v1.0.0/notes-linux-x64.zip",
      "sha256": "...",
      "size_bytes": 0
    }
  }
}
```

### Permisos disponibles

| Permiso | Descripción |
|---|---|
| `storage:local` | Leer/escribir en su carpeta de datos |
| `notifications` | Mostrar notificaciones del sistema |
| `sync:optional` | Sincronización entre dispositivos (opcional para el usuario) |
| `network:outbound` | Acceso a internet (requiere justificación) |
| `ipc:read:<module_id>` | Leer datos de otro módulo |

---

## IPC — Comunicación Shell ↔ Módulos

Protocolo: **JSON-RPC 2.0** sobre Unix socket (Linux/macOS) o Named Pipe (Windows).

El shell expone el socket. Los módulos se conectan al iniciarse.
La ruta del socket se pasa via variable de entorno `PLATFORM_IPC_SOCKET`.

### Variables de entorno inyectadas por el shell

```
PLATFORM_IPC_SOCKET    → ruta del socket IPC
PLATFORM_MODULE_ID     → ID del módulo (ej: com.platform.notes)
PLATFORM_DATA_DIR      → carpeta de datos del módulo
PLATFORM_VERSION       → versión del shell
```

### Métodos que expone el shell

```
shell.heartbeat                  → el módulo confirma que está vivo
shell.notifications.show(title, body)
shell.backup.prepare             → shell avisa que va a hacer backup
                                   (módulo debe hacer flush de su DB)
```

### Métodos que expone cada módulo

Definidos en el campo `ipc.exposes` del manifest.
Ejemplo para el módulo notes:
```
notes.create(title, content)
notes.list(limit, offset)
notes.delete(id)
```

---

## Process Manager — comportamiento esperado

- Al lanzar un módulo: `spawn()` del binario con las env vars correctas
- Watchdog cada 5 segundos: verificar que el proceso sigue vivo
- Si el proceso muere inesperadamente: reintentar hasta 3 veces
- Si falla 3 veces: notificar al usuario, no reintentar más
- Al cerrar el shell: `kill()` a todos los módulos activos con señal SIGTERM

---

## Health Monitor — métricas recolectadas

Usando la crate `sysinfo`. Intervalo de polling: cada 3 segundos.

Métricas por módulo:
- `ram_mb`: memoria RSS en megabytes
- `cpu_percent`: uso de CPU en porcentaje
- `uptime_secs`: segundos desde que fue lanzado

Estas métricas se muestran en el dashboard en tiempo real
y se guardan en `usage_sessions` al finalizar cada sesión.

---

## Registry remoto

### Estructura del repositorio GitHub

```
platform-registry/ (repo público)
├── index.json              ← se cachea localmente, se refresca al abrir el shell
├── categories.json
└── modules/
    └── com.platform.notes/
        ├── manifest.json   ← versión latest
        └── versions/
            └── 1.0.0.json
```

### index.json (lista de módulos para el store)

```json
{
  "generated_at": "2024-01-15T10:00:00Z",
  "modules": [
    {
      "id": "com.platform.notes",
      "name": "Notes",
      "tagline": "Reemplaza Notion. Usa 12MB de RAM.",
      "category": "productivity",
      "latest_version": "1.0.0",
      "platforms": ["windows", "macos", "linux"],
      "replaces": ["Notion", "Obsidian"],
      "ram_typical_mb": 12
    }
  ]
}
```

### Proceso de instalación de un módulo

1. Descargar manifest de la versión latest
2. Mostrar permisos requeridos al usuario (requiere confirmación explícita)
3. Descargar zip del binario para la plataforma actual
4. Verificar SHA256 — si no coincide, abortar y alertar al usuario
5. Descomprimir en la carpeta de instalación del módulo
6. Registrar en shell.db con los permisos aceptados
7. Mostrar el módulo en el dashboard

---

## SDK del módulo (module-sdk)

Crate Rust mínima que cualquier módulo importa para comunicarse con el shell.

```rust
// Uso esperado en main.rs de cualquier módulo
use platform_sdk::Shell;

#[tokio::main]
async fn main() {
    let shell = Shell::connect().await.unwrap();

    // Registrar handlers de eventos del shell
    shell.on("shell.backup.prepare", |_| async {
        db::flush().await;
    });

    // Iniciar heartbeat automático cada 3s
    shell.start_heartbeat();

    // El módulo lanza su propia ventana (Tauri, GTK, etc.)
    launch_window().await;
}
```

---

## Estructura de un módulo individual

```
modules/notes/
├── manifest.json
├── Cargo.toml
├── src/
│   ├── main.rs          ← entry point, conecta con shell via SDK
│   ├── db.rs            ← SQLite local (notes.db)
│   ├── ipc_handlers.rs  ← implementa notes.create, notes.list, etc.
│   └── window.rs        ← lanza la ventana nativa del módulo
└── frontend/            ← UI del módulo (opcional si usa Tauri)
    └── index.html
```

---

## Roadmap de desarrollo

### Fase 1 — MVP (prioridad actual)

- [ ] Shell básico en Tauri
  - [ ] Dashboard con lista de módulos instalados
  - [ ] Store con lista de módulos disponibles (desde index.json)
  - [ ] Instalación de módulos (download + verify SHA256 + register)
  - [ ] Launch/kill de módulos como procesos independientes
  - [ ] Heartbeat básico para detectar módulos caídos
- [ ] module-sdk crate mínima (connect, heartbeat, on)
- [ ] Primer módulo: Notes
  - [ ] SQLite local
  - [ ] UI básica funcional
  - [ ] IPC handlers

### Fase 2 — Estabilidad

- [ ] Health monitor con RAM/CPU en tiempo real
- [ ] Watchdog con reintentos automáticos
- [ ] Backup/restore por módulo
- [ ] Sistema de actualizaciones con changelog
- [ ] Comparativa de RAM "vs app que reemplaza" en el dashboard

### Fase 3 — Comunidad

- [ ] Documentación del SDK para terceros
- [ ] Proceso de review y firma de módulos externos
- [ ] Registry federado (fuentes adicionales opcionales)
- [ ] Sistema de ratings y reportes

---

## Convenciones de código

- Idioma del código: inglés (variables, funciones, comentarios)
- Idioma de commits: inglés
- Formato Rust: `rustfmt` con configuración por defecto
- Error handling: usar `anyhow` para errores de aplicación, `thiserror` para tipos de error propios
- Async runtime: `tokio`
- Tests: unit tests en el mismo archivo, integration tests en `tests/`
