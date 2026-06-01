import { useState } from "react";
import type { InstalledModule, CatalogEntry, RunningStats } from "../App";

export default function DashboardView({
  installed,
  catalog,
  runningStats,
  onLaunch,
  onUninstall,
}: {
  installed: InstalledModule[];
  catalog: CatalogEntry[];
  runningStats: Record<string, RunningStats>;
  onLaunch: (id: string) => void;
  onUninstall: (id: string) => void;
}) {
  const catalogMap = Object.fromEntries(catalog.map((c) => [c.id, c]));

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Dashboard</h1>
        <p style={styles.subtitle}>
          {installed.length} module{installed.length !== 1 ? "s" : ""} installed
        </p>
      </div>

      {installed.length === 0 ? (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>◈</div>
          <p style={styles.emptyText}>No modules installed yet.</p>
          <p style={styles.emptyHint}>Go to the Store to install your first one.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {[...installed].sort((a, b) => a.name.localeCompare(b.name)).map((mod) => {
            const cat = catalogMap[mod.id];
            const running = runningStats[mod.id];
            return (
              <InstalledCard
                key={mod.id}
                mod={mod}
                iconColor={cat?.icon_color ?? "#888"}
                ramTypicalMb={cat?.ram_typical_mb}
                running={running}
                onLaunch={() => onLaunch(mod.id)}
                onUninstall={() => onUninstall(mod.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function InstalledCard({
  mod,
  iconColor,
  ramTypicalMb,
  running,
  onLaunch,
  onUninstall,
}: {
  mod: InstalledModule;
  iconColor: string;
  ramTypicalMb?: number;
  running?: RunningStats;
  onLaunch: () => void;
  onUninstall: () => void;
}) {
  const [confirmUninstall, setConfirmUninstall] = useState(false);
  const isRunning = running !== undefined && running.instances > 0;

  const lastSeen = mod.last_launched
    ? new Date(mod.last_launched).toLocaleString("es", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Never";

  const ramDisplay = isRunning
    ? `${running.ram_mb} MB`
    : ramTypicalMb
    ? `~${ramTypicalMb} MB`
    : "—";

  const r = parseInt(iconColor.slice(1, 3), 16);
  const g = parseInt(iconColor.slice(3, 5), 16);
  const b = parseInt(iconColor.slice(5, 7), 16);
  const alpha = (a: number) => `rgba(${r},${g},${b},${a})`;

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div
          style={{
            ...styles.icon,
            background: alpha(0.15),
            color: iconColor,
          }}
        >
          {mod.name[0]}
        </div>
        <div style={styles.info}>
          <div style={styles.nameRow}>
            <span style={styles.name}>{mod.name}</span>
            {isRunning && running.instances > 1 && (
              <span style={styles.instanceBadge}>{running.instances}×</span>
            )}
          </div>
          <div style={styles.version}>v{mod.version}</div>
        </div>
        <div style={styles.statusArea}>
          <div
            style={{
              ...styles.statusDot,
              background: isRunning ? "var(--accent)" : "var(--text-muted)",
              boxShadow: isRunning ? "0 0 6px var(--accent)" : "none",
            }}
          />
          {isRunning && <span style={styles.statusLabel}>active</span>}
        </div>
      </div>

      <div style={styles.statsRow}>
        <Stat
          label={isRunning ? "Current RAM" : "Typical RAM"}
          value={ramDisplay}
          highlight={isRunning}
        />
        <Stat label="Last used" value={lastSeen} />
        <Stat label="Permissions" value={`${mod.permissions.length}`} />
      </div>

      <div style={styles.actions}>
        <button style={styles.launchBtn} onClick={onLaunch}>
          ▶ Open
        </button>
        {confirmUninstall ? (
          <div style={styles.confirmRow}>
            <span style={styles.confirmText}>Uninstall {mod.name}?</span>
            <button style={styles.confirmYes} onClick={onUninstall}>Yes</button>
            <button style={styles.confirmNo} onClick={() => setConfirmUninstall(false)}>Cancel</button>
          </div>
        ) : (
          <button style={styles.uninstallBtn} onClick={() => setConfirmUninstall(true)}>
            Uninstall
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div style={styles.stat}>
      <div
        style={{
          ...styles.statValue,
          color: highlight ? "var(--accent)" : undefined,
        }}
      >
        {value}
      </div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    overflowY: "auto",
    padding: "28px 32px",
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  header: {},
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "-0.4px",
    marginBottom: 4,
  },
  subtitle: {
    color: "var(--text-secondary)",
    fontSize: 13,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 16,
  },
  card: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 700,
    flexShrink: 0,
  },
  info: { flex: 1, minWidth: 0 },
  nameRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  name: {
    fontWeight: 600,
    fontSize: 14,
    color: "var(--text-primary)",
  },
  instanceBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: "var(--accent)",
    background: "var(--accent-dim)",
    borderRadius: 4,
    padding: "1px 5px",
  },
  version: {
    fontSize: 11,
    color: "var(--text-muted)",
    marginTop: 1,
  },
  statusArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    flexShrink: 0,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    transition: "background 0.3s, box-shadow 0.3s",
  },
  statusLabel: {
    fontSize: 9,
    color: "var(--accent)",
    fontWeight: 600,
    letterSpacing: "0.3px",
  },
  statsRow: {
    display: "flex",
    gap: 0,
    background: "var(--bg-elevated)",
    borderRadius: "var(--radius-sm)",
    overflow: "hidden",
  },
  stat: {
    flex: 1,
    padding: "10px 12px",
    textAlign: "center",
    borderRight: "1px solid var(--border)",
  },
  statValue: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  statLabel: {
    fontSize: 10,
    color: "var(--text-muted)",
    marginTop: 2,
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  launchBtn: {
    padding: "8px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text-secondary)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    transition: "all 0.15s",
  },
  uninstallBtn: {
    padding: "6px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid transparent",
    background: "transparent",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: 12,
    transition: "all 0.15s",
  },
  confirmRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 0",
  },
  confirmText: {
    fontSize: 12,
    color: "var(--danger)",
    flex: 1,
  },
  confirmYes: {
    padding: "3px 10px",
    borderRadius: "var(--radius-sm)",
    border: "none",
    background: "var(--danger)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  confirmNo: {
    padding: "3px 10px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text-secondary)",
    cursor: "pointer",
    fontSize: 12,
  },
  empty: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 40,
    color: "var(--text-muted)",
    marginBottom: 8,
  },
  emptyText: {
    color: "var(--text-secondary)",
    fontSize: 15,
    fontWeight: 500,
  },
  emptyHint: {
    color: "var(--text-muted)",
    fontSize: 13,
  },
};
