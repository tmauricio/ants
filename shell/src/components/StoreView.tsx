import { useState } from "react";
import type { CatalogEntry } from "../App";
import ModuleCard from "./ModuleCard";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "productivity", label: "Productivity" },
  { key: "media", label: "Media" },
  { key: "communication", label: "Communication" },
  { key: "utilities", label: "Utilities" },
];

export default function StoreView({
  catalog,
  onInstall,
}: {
  catalog: CatalogEntry[];
  onInstall: (id: string) => Promise<void>;
}) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [installing, setInstalling] = useState<string | null>(null);

  const filtered =
    activeCategory === "all"
      ? catalog
      : catalog.filter((m) => m.category === activeCategory);

  async function handleInstall(id: string) {
    setInstalling(id);
    await onInstall(id);
    setInstalling(null);
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Store</h1>
          <p style={styles.subtitle}>
            Lightweight apps that replace the bloated ones. No Electron, no 300 MB of RAM.
          </p>
        </div>
      </div>

      <div style={styles.filterBar}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            style={{
              ...styles.filterBtn,
              ...(activeCategory === cat.key ? styles.filterBtnActive : {}),
            }}
            onClick={() => setActiveCategory(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div style={styles.grid}>
        {filtered.map((entry) => (
          <ModuleCard
            key={entry.id}
            entry={entry}
            installing={installing === entry.id}
            onInstall={() => handleInstall(entry.id)}
          />
        ))}
      </div>
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
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
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
  filterBar: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  filterBtn: {
    padding: "6px 14px",
    borderRadius: 20,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text-secondary)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    transition: "all 0.15s",
  },
  filterBtnActive: {
    background: "var(--accent-dim)",
    borderColor: "var(--accent)",
    color: "var(--accent)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 16,
  },
};
