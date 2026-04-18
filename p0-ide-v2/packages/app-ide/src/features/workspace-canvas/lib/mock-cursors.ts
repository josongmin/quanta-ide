import { cursorsStore } from "../store/cursors-store";
import { sceneStore } from "../store/scene-store";

// Mock cursor driver — spawns two fake viewers ("viewer-a" / "viewer-b") that
// random-walk across the world and occasionally snap onto a real file's rect.
// Tick rate is ~50ms so the DOM cursor layer can interpolate smoothly.

const TICK_MS = 50;
const STEP = 12;          // world-units per tick (max component delta)
const SNAP_PROBABILITY = 0.005;

interface Walker {
  id: string;
  color: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function seedWalkers(): Walker[] {
  return [
    { id: "viewer-a", color: "var(--ws-user-a)", label: "viewer-a", x: 0,   y: 0,   vx: 0, vy: 0 },
    { id: "viewer-b", color: "var(--ws-user-b)", label: "viewer-b", x: 240, y: 160, vx: 0, vy: 0 },
  ];
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

export function startMockCursors(): () => void {
  const walkers = seedWalkers();
  for (const w of walkers) {
    cursorsStore.setCursor(w.id, {
      color: w.color,
      label: w.label,
      worldX: w.x,
      worldY: w.y,
    });
  }

  const interval = window.setInterval(() => {
    const layout = sceneStore.getState().layout;
    const bounds = layout?.totalBounds;

    for (const w of walkers) {
      // Light-weight Perlin-ish drift via random-walk velocity.
      w.vx = clamp(w.vx + (Math.random() - 0.5) * 3, -STEP, STEP);
      w.vy = clamp(w.vy + (Math.random() - 0.5) * 3, -STEP, STEP);

      if (Math.random() < SNAP_PROBABILITY && layout) {
        const files = sceneStore.getState().graph?.files;
        if (files && files.length > 0) {
          const f = files[Math.floor(Math.random() * files.length)];
          const r = f ? layout.fileRects.get(f.id) : undefined;
          if (r) {
            w.x = r.x + r.w * (0.25 + Math.random() * 0.5);
            w.y = r.y + r.h * (0.25 + Math.random() * 0.5);
            w.vx = 0;
            w.vy = 0;
          }
        }
      } else {
        w.x += w.vx;
        w.y += w.vy;
      }

      if (bounds) {
        if (w.x < 0)          { w.x = 0; w.vx = Math.abs(w.vx); }
        if (w.x > bounds.w)   { w.x = bounds.w; w.vx = -Math.abs(w.vx); }
        if (w.y < 0)          { w.y = 0; w.vy = Math.abs(w.vy); }
        if (w.y > bounds.h)   { w.y = bounds.h; w.vy = -Math.abs(w.vy); }
      }

      cursorsStore.setCursor(w.id, { worldX: w.x, worldY: w.y });
    }
  }, TICK_MS);

  return () => {
    window.clearInterval(interval);
    cursorsStore.reset();
  };
}
