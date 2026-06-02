import { useRef, useEffect } from "react";

// 16 frequency edges → 15 bands, roughly logarithmic from 60 Hz to 18 kHz
const FREQ_EDGES_HZ = [60, 120, 200, 310, 470, 700, 1000, 1500, 2200, 3200, 4700, 6800, 9800, 13500, 17000, 20000];

function hzToBin(hz: number, sampleRate: number, binCount: number): number {
  return Math.min(binCount - 1, Math.round((hz / (sampleRate / 2)) * binCount));
}

interface SpectrumBarsProps {
  analyserNode: AnalyserNode;
  /** CSS height in px (default: 100) */
  height?: number;
  /** Number of frequency bands to display (default: 15) */
  barCount?: number;
}

export default function SpectrumBars({ analyserNode, height = 100, barCount = 15 }: SpectrumBarsProps) {
  const BAR_COUNT = Math.min(barCount, FREQ_EDGES_HZ.length - 1);
  const CANVAS_W = 900;
  const CANVAS_H = 200;
  const DISPLAY_H = height;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const smoothRef = useRef<Float32Array>(new Float32Array(BAR_COUNT).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    const binCount = analyserNode.frequencyBinCount;
    const sampleRate = analyserNode.context.sampleRate;
    const data = new Uint8Array(binCount);
    const smooth = smoothRef.current = new Float32Array(BAR_COUNT).fill(0);

    // Pre-compute bin ranges for each band
    const bands: Array<[number, number]> = FREQ_EDGES_HZ.slice(0, BAR_COUNT).map((lo: number, i: number) => [
      hzToBin(lo, sampleRate, binCount),
      hzToBin(FREQ_EDGES_HZ[i + 1], sampleRate, binCount),
    ]);

    const W = CANVAS_W;
    const H = CANVAS_H;
    const gap = Math.round(W * 0.022);
    const totalGap = gap * (BAR_COUNT + 1);
    const barW = Math.floor((W - totalGap) / BAR_COUNT);
    const radius = Math.min(barW / 2, 6);

    // Pre-create gradient so we don't recreate every frame
    const grad = ctx.createLinearGradient(0, H, 0, 0);
    grad.addColorStop(0,   "rgba(52, 211, 153, 0.85)");  // emerald
    grad.addColorStop(0.5, "rgba(163, 230, 53, 1.0)");   // lime
    grad.addColorStop(1,   "rgba(250, 204, 21, 1.0)");   // yellow

    function draw() {
      rafRef.current = requestAnimationFrame(draw);
      analyserNode.getByteFrequencyData(data);

      ctx.clearRect(0, 0, W, H);

      for (let i = 0; i < BAR_COUNT; i++) {
        const [lo, hi] = bands[i];
        let sum = 0;
        const count = Math.max(1, hi - lo);
        for (let b = lo; b < hi; b++) sum += data[b];
        const normalized = (sum / count) / 255;

        // Fast attack, slow decay
        smooth[i] += normalized > smooth[i]
          ? (normalized - smooth[i]) * 0.45
          : (normalized - smooth[i]) * 0.10;

        const barH = Math.max(3, smooth[i] * (H - 10));
        const x = gap + i * (barW + gap);
        const y = H - barH;

        ctx.fillStyle = grad;

        // Rounded top
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barW - radius, y);
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
        ctx.lineTo(x + barW, H);
        ctx.lineTo(x, H);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
      }
    }

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyserNode]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{ display: "block", width: "100%", height: `${DISPLAY_H}px` }}
    />
  );
}
