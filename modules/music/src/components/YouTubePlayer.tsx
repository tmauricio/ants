import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
    _ytApiCallbacks: Array<() => void>;
  }
}

export interface YTHandle {
  play(): void;
  pause(): void;
  seekTo(seconds: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  setVolume(v: number): void; // 0–1 range
}

interface Props {
  videoId: string;
  autoplay?: boolean;
  onReady?: () => void;
  onEnded?: () => void;
  onPlaying?: () => void;
  onPaused?: () => void;
}

const YouTubePlayer = forwardRef<YTHandle, Props>(
  ({ videoId, autoplay = true, onReady, onEnded, onPlaying, onPaused }, ref) => {
    const divRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);

    const ready = () => {
      const p = playerRef.current;
      return p && typeof p.playVideo === "function";
    };

    useImperativeHandle(ref, () => ({
      play: () => { if (ready()) playerRef.current.playVideo(); },
      pause: () => { if (ready()) playerRef.current.pauseVideo(); },
      seekTo: (s) => { if (ready()) playerRef.current.seekTo(s, true); },
      getCurrentTime: () => ready() ? playerRef.current.getCurrentTime() : 0,
      getDuration: () => ready() ? playerRef.current.getDuration() : 0,
      setVolume: (v) => { if (ready()) playerRef.current.setVolume(Math.round(v * 100)); },
    }));

    useEffect(() => {
      let destroyed = false;

      function createPlayer() {
        if (destroyed || !divRef.current) return;
        playerRef.current = new window.YT.Player(divRef.current, {
          videoId,
          playerVars: {
            autoplay: autoplay ? 1 : 0,
            controls: 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
          },
          events: {
            onReady: (event: any) => {
              if (!destroyed) {
                if (autoplay) event.target.playVideo();
                onReady?.();
              }
            },
            onStateChange: (e: any) => {
              if (destroyed) return;
              const S = window.YT?.PlayerState;
              if (S && e.data === S.ENDED) onEnded?.();
              if (S && e.data === S.PLAYING) onPlaying?.();
              if (S && e.data === S.PAUSED) onPaused?.();
            },
          },
        });
      }

      if (!window._ytApiCallbacks) window._ytApiCallbacks = [];

      if (window.YT?.Player) {
        createPlayer();
      } else {
        window._ytApiCallbacks.push(createPlayer);
        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
          const prev = window.onYouTubeIframeAPIReady;
          window.onYouTubeIframeAPIReady = () => {
            prev?.();
            const cbs = window._ytApiCallbacks ?? [];
            window._ytApiCallbacks = [];
            cbs.forEach((cb) => cb());
          };
          const s = document.createElement("script");
          s.src = "https://www.youtube.com/iframe_api";
          document.head.appendChild(s);
        }
      }

      return () => {
        destroyed = true;
        playerRef.current?.destroy();
        playerRef.current = null;
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId]);

    return <div ref={divRef} style={{ width: "100%", height: "100%" }} />;
  }
);

export default YouTubePlayer;
