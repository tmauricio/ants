import { useState } from "react";
import type { Track } from "../App";

function formatDuration(sec: number | null): string {
  if (sec == null || isNaN(sec)) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function basename(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() ?? path;
}

interface TrackListProps {
  tracks: Track[];
  currentPath: string | null;
  onPlay: (track: Track) => void;
  onRemove: (id: number) => void;
  onAddToQueue: (track: Track) => void;
}

export default function TrackList({
  tracks,
  currentPath,
  onPlay,
  onRemove,
  onAddToQueue,
}: TrackListProps) {
  if (tracks.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: 10,
          padding: 32,
          color: "var(--text-secondary)",
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: 48, opacity: 0.4 }}>♪</span>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          The list is empty. Browse files to add songs.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "8px 0" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "36px 1fr 160px 80px 80px",
          padding: "4px 16px",
          fontSize: 11,
          color: "var(--text-muted)",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          borderBottom: "1px solid var(--border)",
          marginBottom: 4,
        }}
      >
        <span>#</span>
        <span>Title</span>
        <span>Album</span>
        <span style={{ textAlign: "right" }}>Duration</span>
        <span />
      </div>
      {tracks.map((track, index) => (
        <TrackRow
          key={track.id}
          track={track}
          index={index}
          isPlaying={currentPath === track.path}
          onPlay={() => onPlay(track)}
          onRemove={() => onRemove(track.id)}
          onAddToQueue={() => onAddToQueue(track)}
        />
      ))}
    </div>
  );
}

interface TrackRowProps {
  track: Track;
  index: number;
  isPlaying: boolean;
  onPlay: () => void;
  onRemove: () => void;
  onAddToQueue: () => void;
}

function TrackRow({ track, index, isPlaying, onPlay, onRemove, onAddToQueue }: TrackRowProps) {
  const [hovered, setHovered] = useState(false);

  const title = track.title ?? basename(track.path);
  const artist = track.artist ?? "Unknown";

  const rowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "36px 1fr 160px 80px 80px",
    padding: "7px 16px",
    alignItems: "center",
    cursor: "default",
    background: isPlaying
      ? "var(--accent-dim)"
      : hovered
      ? "rgba(255,255,255,0.03)"
      : "transparent",
    borderRadius: 4,
    margin: "0 4px",
    transition: "background 0.1s",
  };

  return (
    <div
      style={rowStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={onPlay}
    >
      <div
        style={{
          fontSize: 13,
          color: isPlaying ? "var(--accent)" : "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {isPlaying ? (
          <PulsingDot />
        ) : (
          <span style={{ opacity: 0.6 }}>{index + 1}</span>
        )}
      </div>

      <div style={{ minWidth: 0, paddingRight: 12 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: isPlaying ? 600 : 400,
            color: isPlaying ? "var(--accent)" : "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {isPlaying && (
            <span style={{ fontSize: 12, color: "var(--accent)" }}>♪</span>
          )}
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginTop: 1,
          }}
        >
          {artist}
        </div>
      </div>

      <div
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          paddingRight: 8,
        }}
      >
        {track.album ?? "—"}
      </div>

      <div
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          textAlign: "right",
          paddingRight: 8,
        }}
      >
        {formatDuration(track.duration_sec)}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
        {hovered && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onAddToQueue(); }}
              title="Add to queue"
              style={{ background: "var(--accent)", border: "none", color: "#000", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4, lineHeight: 1 }}
            >▶</button>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              title="Remove from playlist"
              style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, padding: 4, borderRadius: 4, lineHeight: 1 }}
            >✕</button>
          </>
        )}
      </div>
    </div>
  );
}

function PulsingDot() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "var(--accent)",
        animation: "pulse 1.2s ease-in-out infinite",
      }}
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.7); }
        }
      `}</style>
    </span>
  );
}
