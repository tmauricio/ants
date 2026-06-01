import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import StoreView from "./components/StoreView";
import DashboardView from "./components/DashboardView";

export type CatalogEntry = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  latest_version: string;
  ram_typical_mb: number;
  replaces: string[];
  platforms: string[];
  icon_color: string;
  is_installed: boolean;
};

export type InstalledModule = {
  id: string;
  name: string;
  version: string;
  is_enabled: boolean;
  last_launched: string | null;
  permissions: string[];
};

export type RunningStats = {
  instances: number;
  ram_mb: number;
};

type View = "store" | "dashboard";

export default function App() {
  const [view, setView] = useState<View>("store");
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [installed, setInstalled] = useState<InstalledModule[]>([]);
  const [runningStats, setRunningStats] = useState<Record<string, RunningStats>>({});
  const [loading, setLoading] = useState(true);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadData() {
    try {
      const [cat, inst] = await Promise.all([
        invoke<CatalogEntry[]>("get_catalog"),
        invoke<InstalledModule[]>("get_installed_modules"),
      ]);
      setCatalog(cat);
      setInstalled(inst);
    } finally {
      setLoading(false);
    }
  }

  async function pollRunningStats() {
    const stats = await invoke<Record<string, RunningStats>>("get_running_stats");
    setRunningStats(stats);
  }

  useEffect(() => {
    loadData();
    pollRunningStats();
    pollingRef.current = setInterval(pollRunningStats, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  async function handleInstall(id: string) {
    await invoke("install_module", { id });
    await loadData();
  }

  async function handleUninstall(id: string) {
    try {
      await invoke("uninstall_module", { id });
      await loadData();
    } catch (e) {
      setLaunchError(String(e));
    }
  }

  async function handleLaunch(id: string) {
    try {
      setLaunchError(null);
      await invoke("launch_module", { id });
      await loadData();
      await pollRunningStats();
    } catch (e) {
      setLaunchError(String(e));
    }
  }

  return (
    <div style={styles.shell}>
      <Sidebar view={view} setView={setView} installedCount={installed.length} />
      <main style={styles.main}>
        {launchError && (
          <div style={styles.errorBanner}>
            <span>⚠ {launchError}</span>
            <button style={styles.errorClose} onClick={() => setLaunchError(null)}>✕</button>
          </div>
        )}
        {loading ? (
          <div style={styles.loading}>
            <span style={styles.loadingDot} />
            Loading…
          </div>
        ) : view === "store" ? (
          <StoreView catalog={catalog} onInstall={handleInstall} />
        ) : (
          <DashboardView installed={installed} catalog={catalog} runningStats={runningStats} onLaunch={handleLaunch} onUninstall={handleUninstall} />
        )}
      </main>
    </div>
  );
}

function Sidebar({
  view,
  setView,
  installedCount,
}: {
  view: View;
  setView: (v: View) => void;
  installedCount: number;
}) {
  return (
    <nav style={styles.sidebar}>
      <div style={styles.logo}>
        <div style={styles.logoIcon}>P</div>
        <span style={styles.logoText}>Platform</span>
      </div>

      <div style={styles.navSection}>
        <NavItem
          icon="⊞"
          label="Store"
          active={view === "store"}
          onClick={() => setView("store")}
        />
        <NavItem
          icon="◈"
          label="Dashboard"
          active={view === "dashboard"}
          onClick={() => setView("dashboard")}
          badge={installedCount}
        />
      </div>

      <div style={styles.sidebarFooter}>
        <span style={styles.version}>v0.1.0</span>
      </div>
    </nav>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      style={{
        ...styles.navItem,
        ...(active ? styles.navItemActive : {}),
      }}
      onClick={onClick}
    >
      <span style={styles.navIcon}>{icon}</span>
      <span style={styles.navLabel}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span style={styles.badge}>{badge}</span>
      )}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: "flex",
    height: "100vh",
    background: "var(--bg-base)",
    overflow: "hidden",
  },
  sidebar: {
    width: 200,
    flexShrink: 0,
    background: "var(--bg-surface)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    padding: "16px 8px",
    gap: 4,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px 20px",
  },
  logoIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: "var(--accent)",
    color: "#000",
    fontWeight: 800,
    fontSize: 15,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontWeight: 700,
    fontSize: 15,
    color: "var(--text-primary)",
    letterSpacing: "-0.3px",
  },
  navSection: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    flex: 1,
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 12px",
    borderRadius: "var(--radius-sm)",
    border: "none",
    background: "transparent",
    color: "var(--text-secondary)",
    cursor: "pointer",
    width: "100%",
    textAlign: "left",
    fontSize: 13,
    fontWeight: 500,
    transition: "all 0.15s",
  },
  navItemActive: {
    background: "var(--accent-dim)",
    color: "var(--accent)",
  },
  navIcon: { fontSize: 16, lineHeight: 1 },
  navLabel: { flex: 1 },
  badge: {
    background: "var(--accent)",
    color: "#000",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 700,
    padding: "1px 6px",
    minWidth: 18,
    textAlign: "center",
  },
  sidebarFooter: {
    padding: "8px 12px 0",
  },
  version: {
    fontSize: 11,
    color: "var(--text-muted)",
  },
  main: {
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
    gap: 10,
    color: "var(--text-secondary)",
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "var(--accent)",
    display: "inline-block",
  },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 16px",
    background: "rgba(255,85,85,0.12)",
    borderBottom: "1px solid rgba(255,85,85,0.3)",
    color: "#ff5555",
    fontSize: 12,
    flexShrink: 0,
  },
  errorClose: {
    background: "transparent",
    border: "none",
    color: "#ff5555",
    cursor: "pointer",
    fontSize: 15,
    padding: "0 4px",
    flexShrink: 0,
  },
};
