import type { CatalogEntry } from "../App";

export default function ModuleCard({
  entry,
  installing,
  onInstall,
}: {
  entry: CatalogEntry;
  installing: boolean;
  onInstall: () => void;
}) {
  return (
    <div style={styles.card}>
      <div style={styles.cardTop}>
        <div
          style={{
            ...styles.icon,
            background: hexToAlpha(entry.icon_color, 0.15),
            color: entry.icon_color,
          }}
        >
          {entry.name[0]}
        </div>
        <div style={styles.meta}>
          <div style={styles.name}>{entry.name}</div>
          <div style={styles.version}>v{entry.latest_version}</div>
        </div>
        <RamBadge mb={entry.ram_typical_mb} />
      </div>

      <p style={styles.tagline}>{entry.tagline}</p>

      <div style={styles.replaces}>
        {entry.replaces.map((r) => (
          <span key={r} style={styles.replaceTag}>
            {r}
          </span>
        ))}
      </div>

      <div style={styles.cardBottom}>
        <span style={styles.category}>{entry.category}</span>
        {entry.is_installed ? (
          <span style={styles.installedBadge}>✓ Installed</span>
        ) : (
          <button
            style={{ ...styles.installBtn, ...(installing ? styles.installBtnLoading : {}) }}
            onClick={onInstall}
            disabled={installing}
          >
            {installing ? "Installing…" : "Install"}
          </button>
        )}
      </div>
    </div>
  );
}

function RamBadge({ mb }: { mb: number }) {
  const color = mb <= 15 ? "#72F621" : mb <= 30 ? "#F5A623" : "#FF6B6B";
  return (
    <div
      style={{
        ...styles.ramBadge,
        color,
        background: hexToAlpha(color, 0.1),
        border: `1px solid ${hexToAlpha(color, 0.25)}`,
      }}
    >
      {mb}MB
    </div>
  );
}

function hexToAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    transition: "border-color 0.15s",
  },
  cardTop: {
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
  meta: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontWeight: 600,
    fontSize: 14,
    color: "var(--text-primary)",
  },
  version: {
    fontSize: 11,
    color: "var(--text-muted)",
    marginTop: 1,
  },
  ramBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 6,
    flexShrink: 0,
  },
  tagline: {
    fontSize: 13,
    color: "var(--text-secondary)",
    lineHeight: 1.5,
  },
  replaces: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  replaceTag: {
    fontSize: 11,
    color: "var(--text-muted)",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    padding: "2px 7px",
  },
  cardBottom: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  category: {
    fontSize: 11,
    color: "var(--text-muted)",
    textTransform: "capitalize",
  },
  installedBadge: {
    fontSize: 12,
    color: "var(--accent)",
    fontWeight: 600,
  },
  installBtn: {
    padding: "6px 14px",
    borderRadius: "var(--radius-sm)",
    border: "none",
    background: "var(--accent)",
    color: "#000",
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
    transition: "opacity 0.15s",
  },
  installBtnLoading: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
};
