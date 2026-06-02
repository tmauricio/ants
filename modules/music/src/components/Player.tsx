import { useRef, useEffect, useState, useCallback, RefObject } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import type { QueueItem } from "../App";
import type { YTHandle } from "./YouTubePlayer";

function formatTime(sec: number): string {
  if (!isFinite(sec) || isNaN(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface PlayerProps {
  track: QueueItem | null;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onEnded: () => void;
  showVisualizer: boolean;
  onToggleVisualizer: () => void;
  onAnalyserReady: (node: AnalyserNode) => void;
  ytRef: RefObject<YTHandle | null>;
  showYTVideo: boolean;
  onToggleYTVideo: () => void;
  /** Called whenever playback time / duration changes */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** Called whenever the cover art changes */
  onCoverChange?: (url: string | null) => void;
  /** External volume control (0–1). When provided, Player uses it as source of truth. */
  externalVolume?: number;
  /** Called when internal volume slider changes */
  onVolumeChange?: (v: number) => void;
  /** Ref that will be filled with a `seekTo(seconds)` function for external control */
  seekRef?: React.MutableRefObject<((t: number) => void) | null>;
}

export default function Player({
  track, isPlaying, onPlay, onPause, onNext, onPrev, onEnded,
  showVisualizer, onToggleVisualizer, onAnalyserReady,
  ytRef, showYTVideo, onToggleYTVideo,
  onTimeUpdate, onCoverChange, externalVolume, onVolumeChange, seekRef,
}: PlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);

  // Detect container width to switch to stacked layout
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setNarrow(entry.contentRect.width < 640);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const audioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const onAnalyserReadyRef = useRef(onAnalyserReady);
  useEffect(() => { onAnalyserReadyRef.current = onAnalyserReady; }, [onAnalyserReady]);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(externalVolume ?? 0.8);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  // Sync volume when external changes
  useEffect(() => {
    if (externalVolume !== undefined) setVolume(externalVolume);
  }, [externalVolume]);

  const isYT = !!track?.youtubeId;

  // Poll YouTube time/duration
  const ytPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (ytPollRef.current) clearInterval(ytPollRef.current);
    if (!isYT || !isPlaying) return;
    ytPollRef.current = setInterval(() => {
      const yt = ytRef.current;
      if (!yt) return;
      const ct = yt.getCurrentTime();
      const dur = yt.getDuration();
      setCurrentTime(ct);
      if (dur > 0) setDuration(dur);
      onTimeUpdate?.(ct, dur > 0 ? dur : 0);
    }, 500);
    return () => { if (ytPollRef.current) clearInterval(ytPollRef.current); };
  }, [isYT, isPlaying, ytRef]);

  // createMediaElementSource connects to the *element*, not the current stream.
  // Changing audio.src never breaks this connection — wired once, works forever.
  const wireAudioGraph = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audioCtxRef.current) return;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    // Aggressively keep context running — browser may suspend it on silence
    ctx.addEventListener("statechange", () => {
      if (ctx.state === "suspended") ctx.resume();
    });

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.75;
    analyserRef.current = analyser;

    // Permanent wire: element → analyser → destination
    const source = ctx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(ctx.destination);

    ctx.resume();
    onAnalyserReadyRef.current(analyser);
  }, []);

  const handleToggleVisualizer = useCallback(() => {
    wireAudioGraph();
    onToggleVisualizer();
  }, [wireAudioGraph, onToggleVisualizer]);

  // Track change
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!track) {
      audio.src = "";
      setCoverUrl(null);
      setCurrentTime(0);
      setDuration(0);
      return;
    }
    if (isYT) {
      audio.src = "";
      setCoverUrl(track.youtubeThumbnail ?? null);
      setCurrentTime(0);
      setDuration(0);
      return;
    }
    audio.src = convertFileSrc(track.path);
    audio.volume = volume;
    audio.play().catch((e) => console.warn("Autoplay blocked:", e));
    audioCtxRef.current?.resume();
    invoke<string | null>("get_cover_art", { path: track.path })
      .then((d) => { setCoverUrl(d ?? null); onCoverChange?.(d ?? null); })
      .catch(() => { setCoverUrl(null); onCoverChange?.(null); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);

  // Play/pause — regular audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track || isYT) return;
    if (isPlaying) audio.play().catch((e) => console.warn("Play failed:", e));
    else audio.pause();
  }, [isPlaying, track, isYT]);

  // Play/pause — YouTube
  useEffect(() => {
    if (!isYT || !track) return;
    if (isPlaying) ytRef.current?.play();
    else ytRef.current?.pause();
  }, [isPlaying, isYT, track, ytRef]);

  // Volume — regular audio
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Volume — YouTube
  useEffect(() => {
    if (isYT) ytRef.current?.setVolume(volume);
  }, [volume, isYT, ytRef]);

  const handlePlayPause = () => { if (isPlaying) onPause(); else onPlay(); };

  const seekTo = useCallback((t: number) => {
    setCurrentTime(t);
    if (isYT) ytRef.current?.seekTo(t);
    else if (audioRef.current) audioRef.current.currentTime = t;
  }, [isYT, ytRef]);

  // Expose seekTo externally
  useEffect(() => {
    if (seekRef) seekRef.current = seekTo;
    return () => { if (seekRef) seekRef.current = null; };
  }, [seekRef, seekTo]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seekTo(parseFloat(e.target.value));
  };

  const title = track
    ? (track.title ?? track.path.replace(/\\/g, "/").split("/").pop() ?? "Sin título")
    : null;

  const btn: React.CSSProperties = {
    background: "transparent", border: "none", color: "var(--text-secondary)",
    cursor: "pointer", fontSize: 18, padding: "4px 6px", borderRadius: 4, lineHeight: 1,
  };
  const playBtn: React.CSSProperties = {
    ...btn, fontSize: 20, color: "#000", background: "var(--accent)",
    borderRadius: "50%", width: 38, height: 38, display: "flex",
    alignItems: "center", justifyContent: "center", padding: 0,
  };
  const toggleBtn = (active: boolean): React.CSSProperties => ({
    background: active ? "var(--accent-dim)" : "transparent",
    border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: active ? "var(--accent)" : "var(--text-muted)",
    cursor: "pointer", fontSize: 11, fontWeight: 700,
    padding: "4px 8px", letterSpacing: "0.05em", flexShrink: 0,
  });

  // ── Shared sections ──────────────────────────────────────────────────────────

  const coverAndInfo = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
      {/* Cover */}
      <div style={{ width: 44, height: 44, borderRadius: 6, flexShrink: 0, background: "var(--bg-elevated)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {coverUrl
          ? <img src={coverUrl} alt="cover" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 20, color: "var(--accent)", opacity: track ? 1 : 0.3 }}>{isYT ? "▶" : "♪"}</span>
        }
      </div>
      {/* Info */}
      <div style={{ minWidth: 0, maxWidth: narrow ? 220 : 200 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: track ? "var(--text-primary)" : "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title ?? "Nothing playing"}
        </div>
        {track?.artist && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
            {track.artist}
          </div>
        )}
        {isYT && <div style={{ fontSize: 10, color: "var(--accent)", marginTop: 2, letterSpacing: "0.05em" }}>YouTube</div>}
      </div>
    </div>
  );

  const controls = (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
      <button style={btn} onClick={onPrev} disabled={!track} title="Previous">⏮</button>
      <button style={playBtn} onClick={handlePlayPause} disabled={!track}>
        {isPlaying ? "⏸" : "▶"}
      </button>
      <button style={btn} onClick={onNext} disabled={!track} title="Next">⏭</button>
    </div>
  );

  const seekAndExtras = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0, minWidth: 32, textAlign: "right" }}>{formatTime(currentTime)}</span>
      <input type="range" min={0} max={duration || 1} step={0.1} value={currentTime}
        onChange={handleSeek} disabled={!track}
        style={{ flex: 1, cursor: track ? "pointer" : "default", accentColor: "var(--accent)", minWidth: 60 }}
      />
      <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0, minWidth: 32 }}>{formatTime(duration)}</span>

      {/* Volume */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>🔊</span>
        <input type="range" min={0} max={1} step={0.01} value={volume}
          onChange={(e) => { const v = parseFloat(e.target.value); setVolume(v); onVolumeChange?.(v); }}
          style={{ width: 60, cursor: "pointer", accentColor: "var(--accent)" }}
        />
      </div>

      {/* VIZ / VIDEO toggle */}
      {!isYT && (
        <button onClick={handleToggleVisualizer} title="Spectrum visualizer" style={toggleBtn(showVisualizer)}>VIZ</button>
      )}
      {isYT && (
        <button onClick={onToggleYTVideo} title={showYTVideo ? "Audio only" : "Watch video"} style={toggleBtn(showYTVideo)}>
          {showYTVideo ? "AUDIO" : "VIDEO"}
        </button>
      )}
    </div>
  );

  return (
    <div ref={containerRef} style={{ flexShrink: 0, background: "var(--bg-surface)", borderTop: "1px solid var(--border)" }}>
      {narrow ? (
        // ── Stacked layout ────────────────────────────────────────────────────
        <div style={{ padding: "8px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            {coverAndInfo}
            {controls}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {seekAndExtras}
          </div>
        </div>
      ) : (
        // ── Single-row layout ─────────────────────────────────────────────────
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", height: 76 }}>
          {coverAndInfo}
          {controls}
          {seekAndExtras}
        </div>
      )}

      <audio ref={audioRef} crossOrigin="anonymous" style={{ display: "none" }}
        onTimeUpdate={() => {
          if (!audioRef.current) return;
          const ct = audioRef.current.currentTime;
          setCurrentTime(ct);
          onTimeUpdate?.(ct, audioRef.current.duration || 0);
        }}
        onLoadedMetadata={() => {
          if (!audioRef.current) return;
          const dur = audioRef.current.duration;
          setDuration(dur);
          onTimeUpdate?.(audioRef.current.currentTime, dur);
        }}
        onEnded={onEnded}
        preload="auto"
      />
    </div>
  );
}
