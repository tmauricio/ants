import { useState, useCallback } from "react";
import type { FileNode } from "../App";

const AUDIO_EXT = new Set(["mp3", "flac", "wav", "ogg", "aac", "m4a", "wma", "opus", "aiff", "ape"]);

function isAudio(node: FileNode): boolean {
  return !node.is_dir && node.extension != null && AUDIO_EXT.has(node.extension.toLowerCase());
}

function collectAudioPaths(node: FileNode): string[] {
  if (isAudio(node)) return [node.path];
  if (node.is_dir) return node.children.flatMap(collectAudioPaths);
  return [];
}

interface FileTreeProps {
  node: FileNode;
  onAddToQueue: (paths: string[]) => void;
  onAddToPlaylist?: (paths: string[]) => void;
  playlistName: string | null;
}

export default function FileTree({ node, onAddToQueue, onAddToPlaylist, playlistName }: FileTreeProps) {
  const allPaths = collectAudioPaths(node);

  return (
    <div style={{ padding: "8px 0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px 12px", borderBottom: "1px solid var(--border)", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {allPaths.length > 0 ? `${allPaths.length} audio files` : "No audio files"}
        </span>
        {allPaths.length > 0 && (
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => onAddToQueue(allPaths)}
              style={{ padding: "5px 12px", background: "var(--accent)", border: "none", borderRadius: "var(--radius-sm)", color: "#000", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
              ▶ Add all to queue ({allPaths.length})
            </button>
            {onAddToPlaylist && playlistName && (
              <button onClick={() => onAddToPlaylist(allPaths)}
                style={{ padding: "5px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12 }}>
                + All to "{playlistName}"
              </button>
            )}
          </div>
        )}
      </div>
      <FileNodeRow node={node} depth={0} onAddToQueue={onAddToQueue} onAddToPlaylist={onAddToPlaylist} playlistName={playlistName} />
    </div>
  );
}

function FileNodeRow({ node, depth, onAddToQueue, onAddToPlaylist, playlistName }: {
  node: FileNode;
  depth: number;
  onAddToQueue: (paths: string[]) => void;
  onAddToPlaylist?: (paths: string[]) => void;
  playlistName: string | null;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [hovered, setHovered] = useState(false);

  const folderPaths = useCallback(() => collectAudioPaths(node), [node]);
  const indent = depth * 16;
  const audio = isAudio(node);

  if (node.is_dir) {
    const count = collectAudioPaths(node).length;
    return (
      <div>
        <div
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 16px", paddingLeft: 16 + indent, cursor: "pointer", background: hovered ? "rgba(255,255,255,0.03)" : "transparent", transition: "background 0.1s" }}
          onClick={() => setExpanded((p) => !p)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <span style={{ fontSize: 10, color: "var(--text-muted)", width: 12, display: "inline-block", transition: "transform 0.15s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }}>▶</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.name}
          </span>
          {count > 0 && <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{count}</span>}
          {/* Folder action buttons on hover */}
          {hovered && count > 0 && (
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => onAddToQueue(folderPaths())}
                style={{ padding: "2px 8px", background: "var(--accent)", border: "none", borderRadius: "var(--radius-sm)", color: "#000", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                ▶ Queue
              </button>
              {onAddToPlaylist && playlistName && (
                <button onClick={() => onAddToPlaylist(folderPaths())}
                  style={{ padding: "2px 8px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 11 }}>
                  + Playlist
                </button>
              )}
            </div>
          )}
        </div>
        {expanded && node.children.map((child, i) => (
          <FileNodeRow key={child.path + i} node={child} depth={depth + 1} onAddToQueue={onAddToQueue} onAddToPlaylist={onAddToPlaylist} playlistName={playlistName} />
        ))}
      </div>
    );
  }

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 16px", paddingLeft: 16 + indent + 18, background: hovered ? "rgba(255,255,255,0.03)" : "transparent", transition: "background 0.1s" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ fontSize: 12, color: audio ? "var(--accent)" : "var(--text-muted)", flexShrink: 0 }}>{audio ? "♪" : "·"}</span>
      <span style={{ fontSize: 13, color: audio ? "var(--text-primary)" : "var(--text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
        {node.name}
      </span>
      {node.extension && (
        <span style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "1px 5px", borderRadius: 3, flexShrink: 0 }}>
          {node.extension.toUpperCase()}
        </span>
      )}
      {audio && hovered && (
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onAddToQueue([node.path])}
            style={{ padding: "2px 8px", background: "var(--accent)", border: "none", borderRadius: "var(--radius-sm)", color: "#000", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
            ▶
          </button>
          {onAddToPlaylist && (
            <button onClick={() => onAddToPlaylist([node.path])}
              style={{ padding: "2px 8px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 11 }}>
              +
            </button>
          )}
        </div>
      )}
    </div>
  );
}
