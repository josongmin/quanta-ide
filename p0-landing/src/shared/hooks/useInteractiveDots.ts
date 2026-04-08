"use client";

import { useEffect, useRef, useCallback } from "react";

interface Dot {
  bx: number;
  by: number;
  x: number;
  y: number;
}

const GAP = 14;
const DOT_R = 0.9;
const STRENGTH = 36;
const RADIUS = 4800;
const IDLE_DELAY = 1600;

export function useInteractiveDots() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    dots: [] as Dot[],
    cols: 0,
    rows: 0,
    mouse: { x: -9999, y: -9999 },
    target: { x: -9999, y: -9999 },
    lastMove: 0,
    idleBlend: 1,
    waveTime: 0,
    pointerInside: false,
    raf: 0,
  });

  const buildGrid = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = stateRef.current;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    s.cols = Math.ceil(w / GAP) + 1;
    s.rows = Math.ceil(h / GAP) + 1;
    s.dots = [];
    for (let r = 0; r < s.rows; r++) {
      for (let c = 0; c < s.cols; c++) {
        const bx = c * GAP;
        const by = r * GAP;
        s.dots.push({ bx, by, x: bx, y: by });
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;

    buildGrid();

    const onResize = () => buildGrid();
    const onMove = (e: MouseEvent) => {
      s.target.x = e.clientX;
      s.target.y = e.clientY;
      s.lastMove = performance.now();
      s.pointerInside = true;
    };
    const onLeave = () => {
      s.pointerInside = false;
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);

    const draw = (now: number) => {
      s.raf = requestAnimationFrame(draw);
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const idle = !s.pointerInside || now - s.lastMove > IDLE_DELAY;
      const tgt = idle ? 1 : 0;
      s.idleBlend += (tgt - s.idleBlend) * 0.015;
      s.waveTime += 0.012;

      s.mouse.x += (s.target.x - s.mouse.x) * 0.14;
      s.mouse.y += (s.target.y - s.mouse.y) * 0.14;

      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.sqrt(cx * cx + cy * cy);

      for (const dot of s.dots) {
        const dx = dot.bx - s.mouse.x;
        const dy = dot.by - s.mouse.y;
        const d2 = dx * dx + dy * dy;

        let px = dot.bx;
        let py = dot.by;

        if (d2 < RADIUS && d2 > 0) {
          const f = (STRENGTH / d2) * (1 - s.idleBlend);
          px += dx * f;
          py += dy * f;
        }

        if (s.idleBlend > 0.01) {
          const dist = Math.sqrt(
            (dot.bx - cx) * (dot.bx - cx) + (dot.by - cy) * (dot.by - cy),
          );
          const ring =
            Math.sin(dist * 0.015 - s.waveTime * 2.8) * 1.5 +
            Math.sin(dist * 0.022 - s.waveTime * 1.6) * 1.0;
          const diag =
            Math.sin((dot.bx + dot.by) * 0.009 + s.waveTime * 1.4) * 1.2;
          const wave = ring * 0.6 + diag * 0.4;
          px += wave * s.idleBlend * 0.7;
          py += wave * s.idleBlend * 0.7;
        }

        const vx = (dot.bx - cx) / cx;
        const vy = (dot.by - cy) / cy;
        const vig = 1 - (vx * vx * 0.6 + vy * vy * 0.5);

        let alpha = 0.38;
        if (d2 < RADIUS) alpha += (1 - d2 / RADIUS) * 0.32 * (1 - s.idleBlend);
        alpha *= Math.max(vig, 0);

        if (alpha < 0.01) continue;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(px, py, DOT_R, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    s.raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(s.raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [buildGrid]);

  return canvasRef;
}
