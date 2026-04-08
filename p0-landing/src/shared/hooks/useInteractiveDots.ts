import { useEffect, useRef, useCallback } from "react";

interface Dot { bx: number; by: number; }

const SPACING = 14;
const RADIUS = 4800;
const STRENGTH = 36;
const DOT_R = 0.9;
const BASE_ALPHA = 0.38;
const BOOST = 0.7;
const IDLE_MS = 1600;
const IDLE_SMOOTH = 0.032;

export function useInteractiveDots() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const s = useRef({
    dots: [] as Dot[],
    mouse: { x: 0, y: 0 },
    target: { x: 0, y: 0 },
    lastClient: { x: 0, y: 0 },
    lastMove: performance.now(),
    waveTime: 0,
    idleBlend: 0,
    pointerInside: true,
    raf: 0,
  });

  const buildGrid = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const st = s.current;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    st.dots = [];
    const cols = Math.ceil(c.width / SPACING) + 1;
    const rows = Math.ceil(c.height / SPACING) + 1;
    for (let r = 0; r < rows; r++)
      for (let col = 0; col < cols; col++)
        st.dots.push({ bx: col * SPACING, by: r * SPACING });
    // center pointer on init
    const cx = c.width * 0.5, cy = c.height * 0.5;
    st.mouse.x = cx; st.mouse.y = cy;
    st.target.x = cx; st.target.y = cy;
    st.lastClient.x = cx; st.lastClient.y = cy;
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const st = s.current;
    buildGrid();

    const onResize = () => buildGrid();
    const onMove = (e: MouseEvent) => {
      st.target.x = e.clientX; st.target.y = e.clientY;
      st.lastClient.x = e.clientX; st.lastClient.y = e.clientY;
      st.lastMove = performance.now();
    };
    const onLeave = () => { st.pointerInside = false; };
    const onEnter = () => { st.pointerInside = true; st.lastMove = performance.now(); };

    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("mouseenter", onEnter);

    const draw = () => {
      st.raf = requestAnimationFrame(draw);
      const w = c.width, h = c.height;
      ctx.clearRect(0, 0, w, h);

      const stale = performance.now() - st.lastMove >= IDLE_MS;
      const useIdle = !st.pointerInside || stale;
      st.idleBlend += ((useIdle ? 1 : 0) - st.idleBlend) * IDLE_SMOOTH;
      st.waveTime += 0.012;
      const wt = st.waveTime;

      // idle drift
      const drift = Math.min(w, h) * 0.045;
      const idleEx = st.lastClient.x + Math.sin(wt * 0.36) * drift * 0.45;
      const idleEy = st.lastClient.y + Math.cos(wt * 0.29) * drift * 0.40;
      const ex = st.target.x + (idleEx - st.target.x) * st.idleBlend;
      const ey = st.target.y + (idleEy - st.target.y) * st.idleBlend;
      st.mouse.x += (ex - st.mouse.x) * 0.08;
      st.mouse.y += (ey - st.mouse.y) * 0.08;

      const cx = w * 0.5, cy = h * 0.5;
      const wavBoost = 0.38 + st.idleBlend * 0.62;

      for (const d of st.dots) {
        const dx = d.bx - st.mouse.x;
        const dy = d.by - st.mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const infl = Math.max(0, 1 - dist / RADIUS);
        const angle = Math.atan2(dy, dx);
        const push = infl * infl * STRENGTH;
        let px = d.bx + Math.cos(angle) * push;
        let py = d.by + Math.sin(angle) * push;

        // ambient ring + plane waves
        const rdx = d.bx - cx, rdy = d.by - cy;
        const rd = Math.sqrt(rdx * rdx + rdy * rdy) + 0.001;
        const ux = rdx / rd, uy = rdy / rd;
        const ring1 = Math.sin(wt * 0.90 - rd * 0.01150) * 8.5;
        const ring2 = Math.sin(wt * 0.52 - rd * 0.02100) * 3.5;
        const ring = (ring1 + ring2) * wavBoost;
        const gx = d.bx * 0.033, gy = d.by * 0.028;
        const plX = Math.sin(wt * 0.86 + gx + gy * 0.62) * 6.5;
        const plY = Math.cos(wt * 0.79 - gx * 0.68 + gy) * 6.0;
        const plX2 = Math.sin(wt * 0.58 + gy * 1.05 - gx * 0.42) * 4.5;
        const diag = Math.sin(wt * 0.66 + (d.bx + d.by) * 0.024) * 4.5;
        px += (ux * ring + plX + plX2 * 0.45 + diag * 0.85) * wavBoost;
        py += (uy * ring + plY + plX2 * 0.38 + diag * 0.85) * wavBoost;

        // vignette + brightness
        const vigDx = (d.bx - cx) / (w * 0.72);
        const vigDy = (d.by - cy) / (h * 0.72);
        const vig = Math.max(0, 1 - (vigDx * vigDx + vigDy * vigDy));
        const alpha = Math.min(1, BASE_ALPHA * vig + infl * BOOST * vig);
        if (alpha < 0.01) continue;

        ctx.beginPath();
        ctx.arc(px, py, DOT_R, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(210, 190, 255, ${alpha})`;
        ctx.fill();
      }
    };

    st.raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(st.raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("mouseenter", onEnter);
    };
  }, [buildGrid]);

  return canvasRef;
}
