use serde::Deserialize;
use std::path::PathBuf;

#[derive(Deserialize, Debug)]
pub struct Manifest {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub version: String,
    pub ram_typical_mb: i64,
    pub replaces: Vec<String>,
    pub permissions: Vec<String>,
    #[serde(default)]
    pub icon_color: Option<String>,
    pub entry: ManifestEntry,
}

#[derive(Deserialize, Debug)]
pub struct ManifestEntry {
    pub backend: String,
}

pub struct DiscoveredModule {
    pub manifest: Manifest,
    pub module_dir: PathBuf,
    pub binary_path: PathBuf,
}

/// Walks up from CWD until it finds a `modules/` directory (max 6 levels).
pub fn find_modules_dir() -> Option<PathBuf> {
    let mut dir = std::env::current_dir().ok()?;
    for _ in 0..6 {
        let candidate = dir.join("modules");
        if candidate.is_dir() {
            return Some(candidate);
        }
        dir = dir.parent()?.to_path_buf();
    }
    None
}

/// Scans every subdirectory of `modules/` looking for a `manifest.json`.
pub fn scan_modules() -> Vec<DiscoveredModule> {
    let Some(modules_dir) = find_modules_dir() else {
        eprintln!("[scanner] modules/ directory not found");
        return vec![];
    };

    println!("[scanner] scanning {}", modules_dir.display());

    let Ok(entries) = std::fs::read_dir(&modules_dir) else {
        return vec![];
    };

    entries
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_dir())
        .filter_map(|e| load_module(e.path()))
        .collect()
}

fn load_module(module_dir: PathBuf) -> Option<DiscoveredModule> {
    let manifest_path = module_dir.join("manifest.json");
    let content = std::fs::read_to_string(&manifest_path)
        .map_err(|err| eprintln!("[scanner] cannot read {}: {err}", manifest_path.display()))
        .ok()?;

    let manifest: Manifest = serde_json::from_str(&content)
        .map_err(|err| eprintln!("[scanner] invalid manifest in {}: {err}", module_dir.display()))
        .ok()?;

    // Binary name is the last segment of entry.backend (e.g. "bin/notes" → "notes")
    let binary_name = std::path::Path::new(&manifest.entry.backend)
        .file_name()?
        .to_string_lossy()
        .to_string();

    let target_base = module_dir
        .join("src-tauri")
        .join("target")
        .join("x86_64-pc-windows-gnu");

    // Release binary has frontendDist embedded — always prefer it.
    // Debug binary works too (Vite dev server must be running on the module's port).
    let release_binary = target_base.join("release").join(format!("{binary_name}.exe"));
    let debug_binary   = target_base.join("debug").join(format!("{binary_name}.exe"));

    let binary_path = if release_binary.exists() {
        release_binary
    } else if debug_binary.exists() {
        println!("[scanner] using debug binary for {} (run `cargo tauri build` for release)", manifest.id);
        debug_binary
    } else {
        // Neither exists yet — store expected release path so the error message is useful
        println!("[scanner] WARNING: no binary found for {} — build the module first", manifest.id);
        target_base.join("release").join(format!("{binary_name}.exe"))
    };

    println!(
        "[scanner] found module {} v{} (binary: {})",
        manifest.id,
        manifest.version,
        binary_path.display()
    );

    Some(DiscoveredModule { manifest, module_dir, binary_path })
}

/// Deterministic accent color derived from the module id.
pub fn color_for_id(id: &str) -> &'static str {
    const PALETTE: &[&str] = &[
        "#4A9EFF", "#72F621", "#FF6B35", "#7C3AED",
        "#EC4899", "#F59E0B", "#1DB954", "#FF5555",
    ];
    let hash: usize = id.bytes().fold(0usize, |acc, b| acc.wrapping_add(b as usize));
    PALETTE[hash % PALETTE.len()]
}
