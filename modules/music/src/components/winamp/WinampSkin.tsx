import { useState, useMemo } from "react";
import type { QueueItem, Playlist, Track } from "../../App";
import SpectrumBars from "../SpectrumBars";
import "./winamp.css";

function fmt(sec: number): string {
  if (!isFinite(sec) || isNaN(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fmtTotal(tracks: Array<{ duration_sec: number | null }>): string {
  const total = tracks.reduce((acc, t) => acc + (t.duration_sec ?? 0), 0);
  if (total === 0) return "";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type PlaylistView = "queue" | "playlist";

export interface WinampSkinProps {
  track: QueueItem | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  coverUrl: string | null;
  volume: number;
  analyserNode: AnalyserNode | null;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (t: number) => void;
  onVolumeChange: (v: number) => void;
  queue: QueueItem[];
  queueIndex: number;
  onPlayQueueItem: (index: number) => void;
  onRemoveFromQueue: (index: number) => void;
  playlists: Playlist[];
  selectedPlaylist: Playlist | null;
  playlistTracks: Track[];
  onSelectPlaylist: (p: Playlist) => void;
  onPlayPlaylist: (id: number) => void;
  onAddPlaylistToQueue: (id: number) => void;
  onScanFolder: () => void;
  onPlayTrack: (t: Track) => void;
  onAddTrackToQueue: (t: Track) => void;
  onRemoveFromPlaylist: (id: number) => void;
  onToggleMode: () => void;
}

export default function WinampSkin({
  track, isPlaying, currentTime, duration, coverUrl, volume, analyserNode,
  onPlay, onPause, onNext, onPrev, onSeek, onVolumeChange,
  queue, queueIndex, onPlayQueueItem, onRemoveFromQueue,
  playlists, selectedPlaylist, playlistTracks,
  onSelectPlaylist, onPlayPlaylist, onAddPlaylistToQueue,
  onScanFolder, onPlayTrack, onRemoveFromPlaylist,
  onToggleMode,
}: WinampSkinProps) {
  const [plView, setPlView] = useState<PlaylistView>("queue");
  const [showViz, setShowViz] = useState(true);

  const isYT = !!track?.youtubeId;

  const songTitle = track
    ? (track.title ?? track.path.replace(/\\/g, "/").split("/").pop() ?? "No title")
    : "— NO TRACK —";

  const isShortTitle = songTitle.length < 36;

  const displayTracks = useMemo(() => {
    if (plView === "queue") {
      return queue.map((item, i) => ({
        id: i,
        title: item.title ?? item.path.split(/[\\/]/).pop() ?? "?",
        artist: item.artist,
        duration_sec: item.duration_sec,
        isCurrent: i === queueIndex,
        isYT: !!item.youtubeId,
      }));
    }
    return playlistTracks.map((t) => ({
      id: t.id,
      title: t.title ?? t.path.split(/[\\/]/).pop() ?? "?",
      artist: t.artist,
      duration_sec: t.duration_sec,
      isCurrent: track?.path === t.path,
      isYT: t.path.startsWith("youtube:"),
    }));
  }, [plView, queue, queueIndex, playlistTracks, track]);

  const totalTime = useMemo(
    () => fmtTotal(plView === "queue" ? queue : playlistTracks),
    [plView, queue, playlistTracks]
  );

  const handleTrackDblClick = (id: number) => {
    if (plView === "queue") onPlayQueueItem(id);
    else {
      const t = playlistTracks.find((tr) => tr.id === id);
      if (t) onPlayTrack(t);
    }
  };

  const handleTrackRemove = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (plView === "queue") onRemoveFromQueue(id);
    else onRemoveFromPlaylist(id);
  };

  const handlePlaylistChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pid = parseInt(e.target.value, 10);
    const pl = playlists.find((p) => p.id === pid);
    if (pl) { onSelectPlaylist(pl); setPlView("playlist"); }
  };

  return (
    <div className="wa-screen">

      {/* ── PLAYER ────────────────────────────────────────────────────── */}
      <div className="wa-panel wa-player-panel">

        {/* Cover + Info + Time */}
        <div className="wa-display">
          <div className="wa-cover">
            {coverUrl
              ? <img src={coverUrl} alt="cover" />
              : <span className="wa-cover-icon">{isYT ? "▶" : "♫"}</span>
            }
          </div>

          <div className="wa-info">
            <div className="wa-ticker-wrap">
              <span className={`wa-ticker${isShortTitle ? " short" : ""}`}>
                {songTitle}
              </span>
            </div>
            <div className="wa-artist-line">
              {track?.artist && <span className="wa-artist">{track.artist}</span>}
              {track?.album && <span className="wa-album"> · {track.album}</span>}
              {isYT && <span className="wa-badge">YT</span>}
            </div>
          </div>

          <div className="wa-time-area">
            <span className={`wa-time${!track ? " no-track" : ""}`}>
              {fmt(currentTime)}
            </span>
            <span className="wa-duration">{track ? fmt(duration) : "—:——"}</span>
            <div className={`wa-state-dot${!isPlaying ? " paused" : ""}`} />
          </div>
        </div>

        {/* Seek bar */}
        <div className="wa-seek-row">
          <span className="wa-seek-time">{fmt(currentTime)}</span>
          <input
            type="range" className="wa-seek"
            min={0} max={duration || 1} step={0.5} value={currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            disabled={!track}
          />
          <span className="wa-seek-time">{fmt(duration)}</span>
        </div>

        {/* Volume + controls row */}
        <div className="wa-bottom-row">

          {/* Volume */}
          <div className="wa-vol-wrap">
            <span className="wa-slider-label">VOL</span>
            <input
              type="range" className="wa-vol-slider"
              min={0} max={1} step={0.01} value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            />
            <span className="wa-slider-val">{Math.round(volume * 100)}%</span>
          </div>

          {/* Transport controls */}
          <div className="wa-transport">
            <button className="wa-ctrl wa-ctrl-prev" onClick={onPrev} disabled={!track} title="Anterior" />
            <button
              className={`wa-ctrl wa-ctrl-play${isPlaying ? " playing" : ""}`}
              onClick={() => isPlaying ? onPause() : onPlay()}
              disabled={!track}
              title={isPlaying ? "Pausar" : "Reproducir"}
            />
            <button className="wa-ctrl wa-ctrl-pause" onClick={onPause} disabled={!isPlaying} title="Pausar" />
            <button className="wa-ctrl wa-ctrl-stop" onClick={onPause} disabled={!track} title="Detener" />
            <button className="wa-ctrl wa-ctrl-next" onClick={onNext} disabled={!track} title="Siguiente" />
          </div>

          {/* Extra actions */}
          <div className="wa-extras">
            <button className="wa-extra-btn" onClick={onScanFolder} title="Abrir carpeta">
              <span className="wa-extra-icon">📁</span>
              <span className="wa-extra-label">OPEN</span>
            </button>
            <button
              className={`wa-extra-btn${showViz ? " active" : ""}`}
              onClick={() => setShowViz(v => !v)}
              disabled={isYT}
              title={showViz ? "Ocultar visualizador" : "Mostrar visualizador"}
            >
              <span className="wa-extra-icon">📊</span>
              <span className="wa-extra-label">VIZ</span>
            </button>
            <button className="wa-extra-btn" onClick={onToggleMode} title="Volver al modo moderno">
              <span className="wa-extra-icon">⬡</span>
              <span className="wa-extra-label">MODERN</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── VISUALIZER ────────────────────────────────────────────────── */}
      {showViz && (
        <div className="wa-panel wa-viz-panel">
          {analyserNode && !isYT
            ? <SpectrumBars analyserNode={analyserNode} height={56} barCount={32} />
            : (
              <div className="wa-viz-placeholder">
                {isYT ? "— visualizer not available for YouTube —" : "— play a song to activate the spectrum —"}
              </div>
            )
          }
        </div>
      )}

      {/* ── PLAYLIST ──────────────────────────────────────────────────── */}
      <div className="wa-panel wa-playlist-panel">

        {/* Tabs + playlist selector */}
        <div className="wa-pl-topbar">
          <button
            className={`wa-pl-tab${plView === "queue" ? " active" : ""}`}
            onClick={() => setPlView("queue")}
          >NOW PLAYING{queue.length > 0 ? ` (${queue.length})` : ""}</button>
          <button
            className={`wa-pl-tab${plView === "playlist" ? " active" : ""}`}
            onClick={() => setPlView("playlist")}
          >PLAYLIST</button>
          {plView === "playlist" && playlists.length > 0 && (
            <select className="wa-pl-select" value={selectedPlaylist?.id ?? ""} onChange={handlePlaylistChange}>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.track_count})</option>
              ))}
            </select>
          )}
          {totalTime && (
            <span className="wa-pl-total">{displayTracks.length} tracks · {totalTime}</span>
          )}
        </div>

        {/* Track list */}
        <div className="wa-tracklist">
          {displayTracks.length === 0 ? (
            <div className="wa-empty-msg">
              {plView === "queue" ? "— COLA VACÍA — abrí una carpeta desde OPEN —" : "— PLAYLIST VACÍA —"}
            </div>
          ) : (
            displayTracks.map((t, idx) => (
              <div
                key={`${plView}-${t.id}-${idx}`}
                className={`wa-track-row${t.isCurrent ? " current" : ""}`}
                onDoubleClick={() => handleTrackDblClick(t.id)}
                title="Doble click para reproducir"
              >
                <span className="wa-track-num">
                  {t.isCurrent && isPlaying ? "▶" : `${idx + 1}.`}
                </span>
                <span className="wa-track-title">{t.isYT ? "▶ " : ""}{t.title}</span>
                {t.artist && <span className="wa-track-artist">{t.artist}</span>}
                <span className="wa-track-dur">{t.duration_sec ? fmt(t.duration_sec) : "—"}</span>
                <button
                  className="wa-track-remove"
                  onClick={(e) => handleTrackRemove(e, t.id)}
                  title="Eliminar"
                >✕</button>
              </div>
            ))
          )}
        </div>

        {/* Bottom actions */}
        <div className="wa-pl-bottombar">
          {plView === "queue" ? (
            <>
              <button className="wa-pl-btn" onClick={onScanFolder}>+ FOLDER</button>
              <button className="wa-pl-btn"
                onClick={() => selectedPlaylist && onAddPlaylistToQueue(selectedPlaylist.id)}
                disabled={!selectedPlaylist}>+ PLAYLIST</button>
              <button className="wa-pl-btn"
                onClick={() => selectedPlaylist && onPlayPlaylist(selectedPlaylist.id)}
                disabled={!selectedPlaylist}>▶ PLAY PL</button>
            </>
          ) : (
            <>
              <button className="wa-pl-btn"
                onClick={() => selectedPlaylist && onPlayPlaylist(selectedPlaylist.id)}
                disabled={!selectedPlaylist}>▶ PLAY</button>
              <button className="wa-pl-btn"
                onClick={() => selectedPlaylist && onAddPlaylistToQueue(selectedPlaylist.id)}
                disabled={!selectedPlaylist}>+ QUEUE</button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
