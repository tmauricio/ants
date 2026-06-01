import { useState } from "react";
import type { QueueItem } from "../App";

function formatTime(sec: number | null): string {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Queue({ items, currentIndex, onPlay, onRemove }: {
  items: QueueItem[];
  currentIndex: number;
  onPlay: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, color: "var(--text-muted)" }}>
        <span style={{ fontSize: 40, opacity: 0.4 }}>♪</span>
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>The queue is empty</p>
        <p style={{ fontSize: 12 }}>Browse files and add songs or entire folders</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "8px 0" }}>
      {items.map((item, i) => {
        const isCurrent = i === currentIndex;
        const name = item.title ?? item.path.replace(/\\/g, "/").split("/").pop() ?? item.path;
        return (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 16px", background: isCurrent ? "var(--accent-dim)" : hovered === i ? "rgba(255,255,255,0.03)" : "transparent", cursor: "pointer", transition: "background 0.1s" }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onDoubleClick={() => onPlay(i)}
          >
            <div style={{ width: 28, flexShrink: 0, textAlign: "center" }}>
              {isCurrent
                ? <span style={{ color: "var(--accent)", fontSize: 14 }}>▶</span>
                : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{i + 1}</span>
              }
            </div>
            {item.youtubeThumbnail && (
              <img src={item.youtubeThumbnail} alt="" style={{ width: 40, height: 28, objectFit: "cover", borderRadius: 3, flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {item.youtubeId && <span style={{ fontSize: 9, background: "#ff0000", color: "#fff", borderRadius: 2, padding: "1px 4px", fontWeight: 700, flexShrink: 0 }}>YT</span>}
                <span style={{ fontSize: 13, fontWeight: isCurrent ? 600 : 400, color: isCurrent ? "var(--accent)" : "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {name}
                </span>
              </div>
              {(item.artist || item.album) && !item.youtubeId && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                  {[item.artist, item.album].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
            <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>{formatTime(item.duration_sec)}</span>
            {hovered === i && (
              <button onClick={(e) => { e.stopPropagation(); onRemove(i); }}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, padding: "2px 6px", flexShrink: 0, lineHeight: 1 }}>
                ✕
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
