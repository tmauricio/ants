import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import Sidebar from "./components/Sidebar";
import FileTree from "./components/FileTree";
import TrackList from "./components/TrackList";
import Queue from "./components/Queue";
import Player from "./components/Player";
import SpectrumBars from "./components/SpectrumBars";
import YouTubePlayer, { type YTHandle } from "./components/YouTubePlayer";

export type Playlist = { id: number; name: string; created_at: string; track_count: number; };
export type Track = { id: number; playlist_id: number; position: number; path: string; title: string | null; artist: string | null; album: string | null; duration_sec: number | null; };
export type FileNode = { name: string; path: string; is_dir: boolean; children: FileNode[]; extension: string | null; };
export type TrackMeta = { path: string; title: string | null; artist: string | null; album: string | null; duration_sec: number | null; has_cover: boolean; };

export type QueueItem = {
  path: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  duration_sec: number | null;
  youtubeId?: string;
  youtubeThumbnail?: string;
};

type MainView = "queue" | "playlist" | "filebrowser";

// Extract YouTube video ID from various URL formats
function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0] || null;
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      // /embed/ID or /shorts/ID
      const m = u.pathname.match(/\/(embed|shorts|v)\/([^/?&]+)/);
      if (m) return m[2];
    }
  } catch { /* not a URL */ }
  // plain video ID (11 chars)
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

function trackToQueueItem(t: { path: string; title: string | null; artist: string | null; album: string | null; duration_sec: number | null }): QueueItem {
  if (t.path.startsWith("youtube:")) {
    const videoId = t.path.slice(8);
    return {
      path: t.path,
      title: t.title,
      artist: t.artist,
      album: null,
      duration_sec: null,
      youtubeId: videoId,
      youtubeThumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    };
  }
  return { path: t.path, title: t.title, artist: t.artist, album: t.album, duration_sec: t.duration_sec };
}

async function fetchYTMeta(videoId: string): Promise<{ title: string; thumbnail: string }> {
  const res = await fetch(
    `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
  );
  if (!res.ok) throw new Error("oEmbed fetch failed");
  const data = await res.json();
  return {
    title: data.title ?? videoId,
    thumbnail: data.thumbnail_url ?? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
  };
}

export default function App() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);

  const [isPlaying, setIsPlaying] = useState(false);
  const [mainView, setMainView] = useState<MainView>("queue");
  const [scannedTree, setScannedTree] = useState<FileNode | null>(null);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const handleAnalyserReady = useCallback((node: AnalyserNode) => setAnalyserNode(node), []);

  // YouTube state
  const ytRef = useRef<YTHandle>(null);
  const [showYTVideo, setShowYTVideo] = useState(false);
  const [ytVideoHeight, setYtVideoHeight] = useState(124); // default 16:9 at 220px width
  const ytResizing = useRef(false);
  const ytResizeStart = useRef({ y: 0, h: 0 });

  const startYtResize = useCallback((e: React.MouseEvent) => {
    ytResizing.current = true;
    ytResizeStart.current = { y: e.clientY, h: ytVideoHeight };
    e.preventDefault();
    e.stopPropagation();
  }, [ytVideoHeight]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!ytResizing.current) return;
      const delta = e.clientY - ytResizeStart.current.y;
      setYtVideoHeight(Math.max(80, Math.min(320, ytResizeStart.current.h + delta)));
    };
    const onUp = () => { ytResizing.current = false; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);
  const [showURLModal, setShowURLModal] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);
  // Where to add the YouTube item
  const [urlTarget, setUrlTarget] = useState<"queue" | "playlist">("queue");

  const currentTrack = queueIndex >= 0 && queueIndex < queue.length ? queue[queueIndex] : null;
  const isYTTrack = !!currentTrack?.youtubeId;

  // ── Playlists ────────────────────────────────────────────────────────────────

  const loadPlaylists = useCallback(async () => {
    try {
      const result = await invoke<Playlist[]>("get_playlists");
      setPlaylists(result);
      return result;
    } catch { return []; }
  }, []);

  const loadPlaylistTracks = useCallback(async (id: number) => {
    try {
      const result = await invoke<Track[]>("get_tracks", { playlistId: id });
      setPlaylistTracks(result);
    } catch { setPlaylistTracks([]); }
  }, []);

  useEffect(() => {
    loadPlaylists().then((result) => {
      if (result.length > 0) { setSelectedPlaylist(result[0]); loadPlaylistTracks(result[0].id); }
    });
    invoke<string | null>("get_setting", { key: "last_folder" }).then((path) => {
      if (!path) return;
      invoke<FileNode>("scan_directory", { path })
        .then((tree) => setScannedTree(tree))
        .catch(() => {});
    }).catch(() => {});
  }, [loadPlaylists, loadPlaylistTracks]);

  // ── Media key listeners ───────────────────────────────────────────────────────

  useEffect(() => {
    const unlisten = Promise.all([
      listen("media-play-pause", () => {
        setIsPlaying((prev) => !prev);
      }),
      listen("media-next", () => {
        setQueue((q) => {
          setQueueIndex((idx) => {
            if (q.length === 0) return idx;
            const next = (idx + 1) % q.length;
            setIsPlaying(true);
            return next;
          });
          return q;
        });
      }),
      listen("media-prev", () => {
        setQueue((q) => {
          setQueueIndex((idx) => {
            if (q.length === 0) return idx;
            const prev = idx <= 0 ? q.length - 1 : idx - 1;
            setIsPlaying(true);
            return prev;
          });
          return q;
        });
      }),
      listen("media-stop", () => {
        setIsPlaying(false);
      }),
    ]);

    return () => {
      unlisten.then((fns) => fns.forEach((fn) => fn()));
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────

  const selectPlaylist = useCallback((p: Playlist) => {
    setSelectedPlaylist(p);
    loadPlaylistTracks(p.id);
    setMainView("playlist");
  }, [loadPlaylistTracks]);

  const handleCreatePlaylist = useCallback(async (name: string) => {
    await invoke("create_playlist", { name });
    const result = await loadPlaylists();
    const created = result.find((p) => p.name === name);
    if (created) { setSelectedPlaylist(created); setPlaylistTracks([]); setMainView("playlist"); }
  }, [loadPlaylists]);

  const handleDeletePlaylist = useCallback(async (id: number) => {
    await invoke("delete_playlist", { id });
    const result = await loadPlaylists();
    if (selectedPlaylist?.id === id) {
      if (result.length > 0) { setSelectedPlaylist(result[0]); loadPlaylistTracks(result[0].id); }
      else { setSelectedPlaylist(null); setPlaylistTracks([]); }
    }
  }, [loadPlaylists, loadPlaylistTracks, selectedPlaylist]);

  // ── Queue ────────────────────────────────────────────────────────────────────

  const readMeta = useCallback(async (path: string): Promise<QueueItem> => {
    try {
      const meta = await invoke<TrackMeta>("get_audio_metadata", { path });
      return { path, title: meta.title, artist: meta.artist, album: meta.album, duration_sec: meta.duration_sec };
    } catch {
      return { path, title: null, artist: null, album: null, duration_sec: null };
    }
  }, []);

  const addPathsToQueue = useCallback(async (paths: string[]) => {
    const items = await Promise.all(paths.map(readMeta));
    setQueue((prev) => {
      const existing = new Set(prev.map((i) => i.path));
      const fresh = items.filter((i) => !existing.has(i.path));
      return [...prev, ...fresh];
    });
    setQueueIndex((prev) => (prev === -1 && paths.length > 0 ? 0 : prev));
    setMainView("queue");
  }, [readMeta]);

const removeFromQueue = useCallback((index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
    setQueueIndex((prev) => {
      if (index < prev) return prev - 1;
      if (index === prev) { setIsPlaying(false); return Math.min(prev, queue.length - 2); }
      return prev;
    });
  }, [queue.length]);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setQueueIndex(-1);
    setIsPlaying(false);
  }, []);

  // ── Playlist → Queue ─────────────────────────────────────────────────────────

  const addPlaylistToQueue = useCallback(async (tracks: Track[]) => {
    const items: QueueItem[] = tracks.map(trackToQueueItem);
    setQueue((prev) => {
      const existing = new Set(prev.map((i) => i.path));
      const fresh = items.filter((i) => !existing.has(i.path));
      return [...prev, ...fresh];
    });
    setQueueIndex((prev) => (prev === -1 && items.length > 0 ? 0 : prev));
    setMainView("queue");
  }, []);

  const playPlaylistNow = useCallback((tracks: Track[]) => {
    const items: QueueItem[] = tracks.map(trackToQueueItem);
    setQueue(items);
    setQueueIndex(0);
    setIsPlaying(true);
    setMainView("queue");
  }, []);

  const handlePlayPlaylistById = useCallback(async (id: number) => {
    try {
      const tracks = await invoke<Track[]>("get_tracks", { playlistId: id });
      playPlaylistNow(tracks);
    } catch { /* ignore */ }
  }, [playPlaylistNow]);

  const handleAddPlaylistToQueueById = useCallback(async (id: number) => {
    try {
      const tracks = await invoke<Track[]>("get_tracks", { playlistId: id });
      addPlaylistToQueue(tracks);
    } catch { /* ignore */ }
  }, [addPlaylistToQueue]);

  // ── Playlist track management ─────────────────────────────────────────────────

  const handleAddFolderToPlaylist = useCallback(async (paths: string[]) => {
    if (!selectedPlaylist) return;
    await Promise.all(paths.map((path) => invoke("add_track", { playlistId: selectedPlaylist.id, path }).catch(() => {})));
    await loadPlaylistTracks(selectedPlaylist.id);
    await loadPlaylists();
  }, [selectedPlaylist, loadPlaylistTracks, loadPlaylists]);

  const handleRemoveFromPlaylist = useCallback(async (id: number) => {
    await invoke("remove_track", { trackId: id });
    if (selectedPlaylist) { await loadPlaylistTracks(selectedPlaylist.id); await loadPlaylists(); }
  }, [selectedPlaylist, loadPlaylistTracks, loadPlaylists]);

  // ── Playback ──────────────────────────────────────────────────────────────────

  const handlePlayQueueItem = useCallback((index: number) => {
    setQueueIndex(index);
    setIsPlaying(true);
  }, []);

  const handleNext = useCallback(() => {
    if (queue.length === 0) return;
    const next = (queueIndex + 1) % queue.length;
    setQueueIndex(next);
    setIsPlaying(true);
  }, [queue.length, queueIndex]);

  const handlePrev = useCallback(() => {
    if (queue.length === 0) return;
    const prev = queueIndex <= 0 ? queue.length - 1 : queueIndex - 1;
    setQueueIndex(prev);
    setIsPlaying(true);
  }, [queue.length, queueIndex]);

  // ── File browser ──────────────────────────────────────────────────────────────

  const handleScanFolder = useCallback(async () => {
    const folder = await open({ directory: true, multiple: false });
    if (!folder) return;
    const path = Array.isArray(folder) ? folder[0] : folder;
    try {
      const tree = await invoke<FileNode>("scan_directory", { path });
      setScannedTree(tree);
      setMainView("filebrowser");
      invoke("set_setting", { key: "last_folder", value: path }).catch(() => {});
    } catch (e) { console.error(e); }
  }, []);

  // ── YouTube URL ───────────────────────────────────────────────────────────────

  const handleAddURL = useCallback(async () => {
    const videoId = parseYouTubeId(urlInput.trim());
    if (!videoId) { setUrlError("Invalid YouTube URL"); return; }
    setUrlLoading(true);
    setUrlError(null);
    try {
      const meta = await fetchYTMeta(videoId);
      const item: QueueItem = {
        path: `youtube:${videoId}`,
        title: meta.title,
        artist: "YouTube",
        album: null,
        duration_sec: null,
        youtubeId: videoId,
        youtubeThumbnail: meta.thumbnail,
      };
      if (urlTarget === "queue") {
        setQueue((prev) => {
          const exists = prev.some((i) => i.youtubeId === videoId);
          if (exists) return prev;
          return [...prev, item];
        });
        setQueueIndex((prev) => (prev === -1 ? 0 : prev));
        setMainView("queue");
      } else if (urlTarget === "playlist" && selectedPlaylist) {
        await invoke("add_track", {
          playlistId: selectedPlaylist.id,
          path: `youtube:${videoId}`,
          titleOverride: meta.title,
          artistOverride: "YouTube",
        }).catch(() => {});
        await loadPlaylistTracks(selectedPlaylist.id);
        await loadPlaylists();
      }
      setShowURLModal(false);
      setUrlInput("");
      setUrlTarget("queue");
    } catch {
      setUrlError("Could not retrieve video information");
    } finally {
      setUrlLoading(false);
    }
  }, [urlInput, urlTarget, selectedPlaylist, loadPlaylistTracks, loadPlaylists]);

  // ── Sidebar resize ────────────────────────────────────────────────────────────

  const [sidebarWidth, setSidebarWidth] = useState(220);
  const sidebarResizing = useRef(false);
  const sidebarResizeStart = useRef({ x: 0, w: 0 });

  const startSidebarResize = useCallback((e: React.MouseEvent) => {
    sidebarResizing.current = true;
    sidebarResizeStart.current = { x: e.clientX, w: sidebarWidth };
    e.preventDefault();
  }, [sidebarWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!sidebarResizing.current) return;
      const delta = e.clientX - sidebarResizeStart.current.x;
      setSidebarWidth(Math.max(160, Math.min(420, sidebarResizeStart.current.w + delta)));
    };
    const onUp = () => { sidebarResizing.current = false; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────

  const topBarBtn: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 6, padding: "5px 11px",
    background: "var(--bg-elevated)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)", color: "var(--text-secondary)",
    cursor: "pointer", fontSize: 12, whiteSpace: "nowrap",
  };

  const topBarBtnActive: React.CSSProperties = {
    ...topBarBtn, background: "var(--accent-dim)", border: "1px solid var(--accent)", color: "var(--accent)",
  };

  // Single YouTubePlayer — always rendered at real dimensions (iframe needs size to play audio).
  // visibility:hidden hides it visually in audio-only mode without unmounting.
  const ytVideoPanel = isYTTrack ? (
    <div style={{ position: "relative" }}>
      <div style={{
        width: "100%", height: ytVideoHeight, background: "#000",
        visibility: showYTVideo ? "visible" : "hidden",
      }}>
        <YouTubePlayer
          ref={ytRef}
          videoId={currentTrack!.youtubeId!}
          autoplay={isPlaying}
          onReady={() => { if (isPlaying) ytRef.current?.play(); }}
          onEnded={handleNext}
          onPlaying={() => setIsPlaying(true)}
          onPaused={() => setIsPlaying(false)}
        />
      </div>
      {/* Height resize handle — only visible when video is shown */}
      {showYTVideo && (
        <div
          onMouseDown={startYtResize}
          style={{ height: 5, cursor: "ns-resize", background: "transparent", position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10 }}
          title="Arrastrar para redimensionar"
        />
      )}
    </div>
  ) : null;


  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "var(--bg-base)", position: "relative" }}>
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>
        {/* Sidebar */}
        <Sidebar
          width={sidebarWidth}
          playlists={playlists}
          selectedPlaylist={selectedPlaylist}
          queueCount={queue.length}
          onSelectQueue={() => setMainView("queue")}
          onSelect={selectPlaylist}
          onCreate={handleCreatePlaylist}
          onDelete={handleDeletePlaylist}
          onPlay={handlePlayPlaylistById}
          onAddToQueue={handleAddPlaylistToQueueById}
          bottomPanel={ytVideoPanel}
        />

        {/* Sidebar resize handle */}
        <div
          onMouseDown={startSidebarResize}
          style={{ width: 5, flexShrink: 0, cursor: "col-resize", background: "transparent", zIndex: 20, marginLeft: -5 }}
          title="Arrastrar para redimensionar"
        />

        {/* Main */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minWidth: 0 }}>
          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", flexShrink: 0, flexWrap: "wrap" }}>
            <button style={mainView === "queue" ? topBarBtnActive : topBarBtn} onClick={() => setMainView("queue")}>
              ▶ Now playing {queue.length > 0 && `(${queue.length})`}
            </button>
            {selectedPlaylist && (
              <button style={mainView === "playlist" ? topBarBtnActive : topBarBtn} onClick={() => setMainView("playlist")}>
                ♫ {selectedPlaylist.name}
              </button>
            )}
            <button style={mainView === "filebrowser" ? topBarBtnActive : topBarBtn} onClick={() => { if (scannedTree) setMainView("filebrowser"); else handleScanFolder(); }}>
              📁 Archivos
            </button>
            <button style={topBarBtn} onClick={handleScanFolder}>
              Scan folder
            </button>
            <button style={topBarBtn} onClick={() => { setShowURLModal(true); setUrlError(null); setUrlInput(""); }}>
              + YouTube URL
            </button>
            {mainView === "queue" && queue.length > 0 && (
              <button style={{ ...topBarBtn, color: "var(--danger)", borderColor: "var(--danger)" }} onClick={clearQueue}>
                Clear queue
              </button>
            )}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>
              {mainView === "queue" && queue.length > 0 && `${queue.length} songs in queue`}
              {mainView === "playlist" && selectedPlaylist && `${playlistTracks.length} songs`}
            </span>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
            {mainView === "queue" && (
              <Queue
                items={queue}
                currentIndex={queueIndex}
                onPlay={handlePlayQueueItem}
                onRemove={removeFromQueue}
              />
            )}
            {mainView === "playlist" && (
              <TrackList
                tracks={playlistTracks}
                currentPath={currentTrack?.path ?? null}
                onPlay={(t) => {
                  const item = trackToQueueItem(t);
                  setQueue([item]);
                  setQueueIndex(0);
                  setIsPlaying(true);
                }}
                onRemove={handleRemoveFromPlaylist}
                onAddToQueue={(t) => {
                  const item = trackToQueueItem(t);
                  setQueue((prev) => {
                    if (prev.some((i) => i.path === item.path)) return prev;
                    return [...prev, item];
                  });
                  setQueueIndex((prev) => (prev === -1 ? 0 : prev));
                }}
              />
            )}
            {mainView === "filebrowser" && scannedTree && (
              <FileTree
                node={scannedTree}
                onAddToQueue={addPathsToQueue}
                onAddToPlaylist={selectedPlaylist ? handleAddFolderToPlaylist : undefined}
                playlistName={selectedPlaylist?.name ?? null}
              />
            )}
            {mainView === "filebrowser" && !scannedTree && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, color: "var(--text-secondary)" }}>
                <span style={{ fontSize: 40 }}>📁</span>
                <p style={{ fontSize: 14 }}>Scan a folder to explore your files</p>
                <button style={{ ...topBarBtn, background: "var(--accent)", border: "none", color: "#000", fontWeight: 700, fontSize: 13, padding: "8px 18px" }} onClick={handleScanFolder}>
                  Select folder
                </button>
              </div>
            )}
          </div>

          {/* Spectrum visualizer */}
          {showVisualizer && !isYTTrack && (
            <div style={{ flexShrink: 0, background: "var(--bg-elevated)", borderTop: "1px solid var(--border)", padding: "10px 20px 6px", zIndex: 10, position: "relative" }}>
              {analyserNode
                ? <SpectrumBars analyserNode={analyserNode} />
                : <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>
                    Play a song to activate the visualizer
                  </div>
              }
            </div>
          )}

          {/* Player */}
          <Player
            track={currentTrack}
            isPlaying={isPlaying}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onNext={handleNext}
            onPrev={handlePrev}
            onEnded={handleNext}
            showVisualizer={showVisualizer}
            onToggleVisualizer={() => setShowVisualizer((v) => !v)}
            onAnalyserReady={handleAnalyserReady}
            ytRef={ytRef}
            showYTVideo={showYTVideo}
            onToggleYTVideo={() => setShowYTVideo((v) => !v)}
          />
        </div>
      </div>

      {/* URL Modal */}
      {showURLModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowURLModal(false); }}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 24, width: 420, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Add YouTube video</div>
            <input
              autoFocus
              value={urlInput}
              onChange={(e) => { setUrlInput(e.target.value); setUrlError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddURL(); if (e.key === "Escape") setShowURLModal(false); }}
              placeholder="https://www.youtube.com/watch?v=..."
              style={{ background: "var(--bg-elevated)", border: `1px solid ${urlError ? "var(--danger)" : "var(--border)"}`, borderRadius: 6, color: "var(--text-primary)", fontSize: 13, padding: "8px 10px", outline: "none" }}
            />
            {urlError && <div style={{ fontSize: 12, color: "var(--danger)" }}>{urlError}</div>}

            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>Add to:</span>
              <button
                onClick={() => setUrlTarget("queue")}
                style={{ fontSize: 12, padding: "4px 10px", borderRadius: 5, cursor: "pointer", border: "1px solid var(--border)", background: urlTarget === "queue" ? "var(--accent-dim)" : "var(--bg-elevated)", color: urlTarget === "queue" ? "var(--accent)" : "var(--text-secondary)" }}>
                Current queue
              </button>
              {selectedPlaylist && (
                <button
                  onClick={() => setUrlTarget("playlist")}
                  style={{ fontSize: 12, padding: "4px 10px", borderRadius: 5, cursor: "pointer", border: "1px solid var(--border)", background: urlTarget === "playlist" ? "var(--accent-dim)" : "var(--bg-elevated)", color: urlTarget === "playlist" ? "var(--accent)" : "var(--text-secondary)" }}>
                  ♫ {selectedPlaylist.name}
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowURLModal(false)}
                style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-muted)", cursor: "pointer", fontSize: 13, padding: "6px 14px" }}>
                Cancel
              </button>
              <button onClick={handleAddURL} disabled={urlLoading || !urlInput.trim()}
                style={{ background: "var(--accent)", border: "none", borderRadius: 6, color: "#000", cursor: urlLoading ? "wait" : "pointer", fontSize: 13, fontWeight: 700, padding: "6px 16px", opacity: urlLoading ? 0.7 : 1 }}>
                {urlLoading ? "Loading..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
